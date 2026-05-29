import { ArchiveStorage } from './data.js';

// Hash definitions for Admin security
const DEFAULT_PASSWORD_HASH = "9d67af1a2bd4002ba6897497a029981240169b30006dc31871470fc768e4fca0";

async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Global State
let currentRoute = 'home';
let activeManageTab = 'concepts'; // 'concepts', 'companies', 'characters', 'incidents', 'games'
let selectedManageId = null; // ID of the item being edited
let currentDetailedItem = null; // Currently opened detail item
let unlockedSealedDocuments = new Set();

// Cache DOM elements
let appContainer = null;
let navLogo = null;
let navMenu = null;
let menuToggle = null;
let modalOverlay = null;
let modalContent = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // Initialize data storage
  ArchiveStorage.init();

  // Initialize character comments seed data
  initCharacterComments();

  // Load and apply theme immediately
  applyTheme();

  appContainer = document.getElementById('app');
  navLogo = document.getElementById('nav-logo');
  navMenu = document.getElementById('nav-menu');
  menuToggle = document.getElementById('menu-toggle');
  modalOverlay = document.getElementById('detail-modal-overlay');
  modalContent = document.getElementById('detail-modal-content');

  // Set up Event Listeners
  initNavigation();
  initMobileMenu();
  initModalClose();
  initVaultEventHandlers();

  // Run Loading Quote transition overlay
  handleLoadingScreen();

  // Run Router on Initial Load
  handleRouting(window.location.pathname);
});

// ==========================================================================
// ROUTER & NAVIGATION SYSTEM
// ==========================================================================
function initNavigation() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    const dataRoute = link.getAttribute('data-route');

    if (href && (href.startsWith('/') || href.startsWith('../') || dataRoute)) {
      e.preventDefault();
      
      let route = 'home';
      if (href.includes('/world')) route = 'world';
      else if (href.includes('/company')) route = 'company';
      else if (href.includes('/character')) route = 'character';
      else if (href.includes('/incident')) route = 'incident';
      else if (href.includes('/games')) route = 'games';
      else if (href.includes('/manage')) route = 'manage';
      else if (href.includes('/admin-login')) route = 'admin-login';

      const resolvedPath = getResolvedPath(route);
      window.history.pushState({}, '', resolvedPath);
      navigate(route);
      
      if (navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        menuToggle.textContent = '☰';
      }
    }
  });

  window.addEventListener('popstate', () => {
    let route = 'home';
    const path = window.location.pathname;
    if (path.includes('/world')) route = 'world';
    else if (path.includes('/company')) route = 'company';
    else if (path.includes('/character')) route = 'character';
    else if (path.includes('/incident')) route = 'incident';
    else if (path.includes('/games')) route = 'games';
    else if (path.includes('/manage')) route = 'manage';
    else if (path.includes('/admin-login')) route = 'admin-login';

    navigate(route);
  });
}

function getResolvedPath(route) {
  const depth = getPathDepth();
  const prefix = depth > 0 ? '../' : './';
  
  if (route === 'home') return prefix + 'index.html';
  return prefix + `${route}/index.html`;
}

function getPathDepth() {
  const path = window.location.pathname;
  if (path.includes('/world/') || path.includes('/company/') || path.includes('/character/') || path.includes('/incident/') || path.includes('/games/') || path.includes('/manage/') || path.includes('/admin-login/')) {
    return 1;
  }
  return 0;
}

function handleRouting(pathname) {
  let route = 'home';
  if (pathname.includes('/world')) route = 'world';
  else if (pathname.includes('/company')) route = 'company';
  else if (pathname.includes('/character')) route = 'character';
  else if (pathname.includes('/incident')) route = 'incident';
  else if (pathname.includes('/games')) route = 'games';
  else if (pathname.includes('/manage')) route = 'manage';
  else if (pathname.includes('/admin-login')) route = 'admin-login';

  navigate(route);
}

function navigate(route) {
  // Check admin lock for management route
  if (route === 'manage') {
    if (!checkAdminSession()) {
      window.history.pushState({}, '', getResolvedPath('admin-login'));
      currentRoute = 'admin-login';
      updateNavigationHeader();
      renderView('admin-login');
      showStatusNotification('관리자 권한이 필요합니다. 로그인해 주십시오.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    // Check if password change is forced
    const savedHash = localStorage.getItem('zj_admin_password_hash') || DEFAULT_PASSWORD_HASH;
    const passwordChanged = localStorage.getItem('zj_password_changed') === 'true';
    if (savedHash === DEFAULT_PASSWORD_HASH && !passwordChanged) {
      window.history.pushState({}, '', getResolvedPath('admin-login'));
      currentRoute = 'admin-login';
      updateNavigationHeader();
      renderView('admin-login');
      showPasswordChangeModal(true); // force it
      return;
    }
  }

  // Handle logout when visiting login page while already logged in
  if (route === 'admin-login' && checkAdminSession()) {
    localStorage.removeItem('zj_admin_logged_in');
    localStorage.removeItem('zj_admin_login_time');
    window.history.pushState({}, '', getResolvedPath('home'));
    currentRoute = 'home';
    updateNavigationHeader();
    renderView('home');
    showStatusNotification('관리자 세션이 완전히 종료되었습니다.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  currentRoute = route;
  
  updateNavigationHeader();

  if (document.startViewTransition) {
    document.startViewTransition(() => {
      renderView(route);
      updateScreenNoiseState();
    });
  } else {
    renderView(route);
    updateScreenNoiseState();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initMobileMenu() {
  menuToggle.addEventListener('click', () => {
    const isActive = navMenu.classList.contains('active');
    if (isActive) {
      navMenu.classList.remove('active');
      menuToggle.textContent = '☰';
    } else {
      navMenu.classList.add('active');
      menuToggle.textContent = '✕';
    }
  });
}

// --------------------------------------------------------------------------
// RANDOM CHARACTER QUOTE LOADING SCREEN TRANSITION
// --------------------------------------------------------------------------
function handleLoadingScreen() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;

  const characters = ArchiveStorage.get('characters');
  const quotesList = characters.filter(c => c.quote);

  if (quotesList.length > 0) {
    const randomChar = quotesList[Math.floor(Math.random() * quotesList.length)];
    document.getElementById('loading-quote-text').textContent = `“${randomChar.quote}”`;
    document.getElementById('loading-quote-author').textContent = `— ${randomChar.name} (${randomChar.catchphrase || ''})`;
  } else {
    // Fallback if no quote exists
    document.getElementById('loading-quote-text').textContent = "“망각을 거부한 기록들만이 여기에 정박해 있습니다.”";
    document.getElementById('loading-quote-author').textContent = "— 사후 연합 기록물 관리본부";
  }

  // Set timeout to fade out overlay elegantly after reading time
  setTimeout(() => {
    overlay.classList.add('fade-out');
  }, 1600);
}

// ==========================================================================
// VIEW RENDERING TEMPLATES
// ==========================================================================
function renderView(route) {
  appContainer.innerHTML = '';

  switch (route) {
    case 'home':
      renderHome();
      break;
    case 'world':
      renderWorld();
      break;
    case 'company':
      renderCompany();
      break;
    case 'character':
      renderCharacter();
      break;
    case 'incident':
      renderIncident();
      break;
    case 'games':
      renderGames();
      break;
    case 'manage':
      renderManage();
      break;
    case 'admin-login':
      renderAdminLogin();
      break;
    default:
      renderHome();
  }
}

// --------------------------------------------------------------------------
// 1. HOME VIEW
// --------------------------------------------------------------------------
function renderHome() {
  const characters = ArchiveStorage.get('characters');
  const companies = ArchiveStorage.get('companies');
  const incidents = ArchiveStorage.get('incidents');

  const featuredChar = characters[0] || null;
  const featuredComp = companies[0] || null;
  const featuredInc = incidents[0] || null;

  // Gather a random quote
  let quotesList = characters.filter(c => c.quote);
  let randomMessageHTML = '';
  if (quotesList.length > 0) {
    const randomFrag = quotesList[Math.floor(Math.random() * quotesList.length)];
    randomMessageHTML = `
      <div class="archive-panel paper-texture random-message-card">
        <div class="message-meta">
          <span>기록 수집 대사</span>
          <span>소유주: ${randomFrag.name} (${randomFrag.affiliationName})</span>
        </div>
        <p class="message-content" style="font-style:italic;">“${randomFrag.quote}”</p>
      </div>
    `;
  } else {
    randomMessageHTML = `
      <div class="archive-panel paper-texture random-message-card">
        <div class="message-meta">
          <span>기록물 파편</span>
          <span>SYSTEM</span>
        </div>
        <p class="message-content">“잔류하고 있는 영체 기억 기록이 존재하지 않습니다.”</p>
      </div>
    `;
  }

  appContainer.innerHTML = `
    <!-- Cinematic Header -->
    <section class="hero-section">
      <div class="archive-pretitle">Residual Afterlife Corporate Archive</div>
      <h1 class="archive-title">잔계 (殘界)</h1>
      <div class="archive-subtitle">정서 재난 및 망자 기록 보관망</div>
      <p class="archive-intro">
        이곳은 육체의 죽음 이후 사후 세계로 이행된 망자들의 의식 조각, 잔류하는 감정적 오염, 
        그리고 사후 법인 백화상조, 염라관리공단, 삼도천 물류의 기록을 보존하는 공통 분류망입니다.
        애도되지 못한 채 소멸해 가는 영혼들의 마지막 흔적을 보존합니다.
      </p>
    </section>

    <!-- Homepage Grid Layout -->
    <div class="homepage-grid">
      <!-- Status & Metrics Sidebar -->
      <aside class="status-panel-wrapper">
        <div class="archive-panel paper-texture">
          <h3 style="margin-bottom: 1.25rem; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">보관소 작동 상태</h3>
          
          <div class="status-row">
            <span class="status-label">서버 상태</span>
            <span class="status-value"><span class="status-indicator status-online"></span>정상 (접속 중)</span>
          </div>
          
          <div class="status-row">
            <span class="status-label">보관 영혼 수</span>
            <span class="status-value">${characters.length} 명</span>
          </div>

          <div class="status-row">
            <span class="status-label">추적 사건 수</span>
            <span class="status-value">${incidents.length} 건</span>
          </div>

          <div class="status-row" style="border-bottom: none; margin-bottom: 0; padding-bottom: 0;">
            <span class="status-label">소속 기업 수</span>
            <span class="status-value">${companies.length} 사</span>
          </div>
        </div>

        ${randomMessageHTML}
      </aside>

      <!-- Featured Items Dashboard -->
      <section class="featured-section">
        <!-- 1. Featured Company -->
        <div>
          <div class="section-header">
            <h2 class="section-title"><span class="stamp">대표 사후 법인</span></h2>
            <a href="/company/" class="section-link">전체 보기 →</a>
          </div>
          ${featuredComp ? `
            <div class="archive-panel company-card" data-id="${featuredComp.id}">
              <div class="company-card-header">
                <div class="company-icon">${getCompanyIconSVG(featuredComp.name)}</div>
                <div class="company-title-wrap">
                  <h3>${featuredComp.name}</h3>
                  <div style="font-size: 0.8rem; color: var(--text-secondary);">${featuredComp.nameEn || ''} | ${featuredComp.hierarchy}</div>
                </div>
              </div>
              <p style="font-family: var(--font-serif); font-size: 0.95rem; line-height: 1.7; color: var(--text-secondary); margin-bottom: 1.25rem;">
                “${featuredComp.philosophy}”
              </p>
              
              <div style="display:flex; flex-direction:column; gap:0.5rem;">
                ${featuredComp.organization && featuredComp.organization.length > 0 ? featuredComp.organization.slice(0, 2).map(org => `
                  <div style="font-size: 0.8rem; border-left: 2px solid var(--accent-red); padding-left: 0.5rem;">
                    <strong style="color:var(--text-primary);">${org.headquarters}</strong>: 
                    <span style="color:var(--text-secondary);">${org.departments.join(', ')}</span>
                  </div>
                `).join('') : '<span style="color:var(--text-muted); font-size:0.8rem;">조직 정보 미배정</span>'}
              </div>

              <div class="card-footer" style="margin-top: 1.5rem;">
                <span>기록 위계: ${featuredComp.hierarchy}</span>
                <span style="color: var(--accent-red);">${featuredComp.status}</span>
              </div>
            </div>
          ` : '<p style="color: var(--text-muted);">등록된 회사가 없습니다.</p>'}
        </div>

        <!-- 2. Featured Character -->
        <div>
          <div class="section-header">
            <h2 class="section-title"><span class="stamp stamp-sealed">보관 영체 프로필</span></h2>
            <a href="/character/" class="section-link">전체 보기 →</a>
          </div>
          ${featuredChar ? `
            <div class="archive-panel character-card click-card" data-type="character" data-id="${featuredChar.id}" style="cursor: pointer;">
              <div class="funeral-ribbon-diagonal"></div>
              <div class="char-portrait-container">
                ${featuredChar.portrait ? `
                  <img class="char-portrait-img" src="${featuredChar.portrait}" alt="${featuredChar.name}">
                ` : `
                  <div class="char-portrait-fallback">殘</div>
                `}
              </div>
              
              <div class="char-meta-top" style="margin-bottom: 0.5rem;">
                <div>
                  <h3 class="char-name">${featuredChar.name}</h3>
                  <div class="char-affinity" style="margin-bottom: 0.25rem;">
                    [${featuredChar.affiliationType}] ${featuredChar.affiliationName}
                  </div>
                </div>
                <span class="stamp" style="font-size: 0.65rem;">${featuredChar.status || '활동 중'}</span>
              </div>

              <!-- Catchphrase & Quote block -->
              <div class="char-catchphrase">“${featuredChar.catchphrase || '아카이브 분석원'}”</div>
              <div class="char-quote-box">“${featuredChar.quote || '침묵으로 영혼을 지키고 있습니다.'}”</div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; font-size: 0.8rem; border-top: 1px dashed var(--border-color); padding-top: 0.75rem; margin-top: 0.75rem; margin-bottom: 1rem; color: var(--text-secondary);">
                <div><strong style="color:var(--text-muted);">부서:</strong> ${featuredChar.affiliationDept || '없음'}</div>
                <div><strong style="color:var(--text-muted);">역할:</strong> ${featuredChar.role || '없음'}</div>
              </div>

              <div class="card-footer">
                <span>태그: ${featuredChar.tags && featuredChar.tags.length > 0 ? featuredChar.tags.map(t => `#${t}`).join(' ') : '없음'}</span>
                <span style="color:var(--text-muted);">추모록: ${getCharacterComments(featuredChar.id).length}건</span>
              </div>
            </div>
          ` : '<p style="color: var(--text-muted);">등록된 인물이 없습니다.</p>'}
        </div>

        <!-- 3. Featured Incident -->
        <div>
          <div class="section-header">
            <h2 class="section-title"><span class="stamp" style="border-color: var(--text-secondary); color: var(--text-secondary);">정서 재난 및 보고</span></h2>
            <a href="/incident/" class="section-link">전체 보기 →</a>
          </div>
          ${featuredInc ? `
            <div class="archive-panel incident-card click-card ${featuredInc.zanhyang === '암전' || featuredInc.zanhyang === '공백' ? 'high-threat' : ''}" data-type="incident" data-id="${featuredInc.id}" style="cursor: pointer;">
              <div>
                <div class="incident-header">
                  <span class="incident-code">${featuredInc.code}</span>
                </div>
                <h3 class="incident-title">${featuredInc.title}</h3>
                
                <div style="margin-bottom: 0.75rem; display: flex; flex-wrap: wrap;">
                  ${featuredInc.jurisdictionDepartments && featuredInc.jurisdictionDepartments.length > 0 ? featuredInc.jurisdictionDepartments.map(dept => `
                    <span class="incident-dept-chip">${dept}</span>
                  `).join('') : ''}
                </div>

                <p class="incident-summary">${featuredInc.report}</p>
              </div>
              <div class="card-footer" style="margin-top: 1rem;">
                <span>잔향(殘響): <strong style="color:var(--accent-red); font-weight:normal;">${featuredInc.zanhyang}</strong></span>
              </div>
            </div>
          ` : '<p style="color: var(--text-muted);">등록된 주요 사건이 없습니다.</p>'}
        </div>
      </section>
    </div>
  `;

  attachCardClickHandlers();
}

// --------------------------------------------------------------------------
// 2. WORLD VIEW (세계관)
// --------------------------------------------------------------------------
function renderWorld() {
  const concepts = ArchiveStorage.get('concepts');

  let conceptsHTML = '';
  if (concepts.length > 0) {
    conceptsHTML = concepts.map(concept => `
      <div class="archive-panel editorial-card paper-texture" style="background-color: var(--bg-panel);">
        <div class="editorial-symbol">${concept.symbol || '殘'}</div>
        <div class="editorial-category">${concept.category}</div>
        <h3 class="editorial-title">${concept.title}</h3>
        <p class="editorial-body">${concept.description}</p>
        <div class="editorial-details">
          ${concept.details}
        </div>
      </div>
    `).join('');
  } else {
    conceptsHTML = `<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">등록된 세계관 개념이 없습니다. [기록관리] 탭에서 생성할 수 있습니다.</p>`;
  }

  appContainer.innerHTML = `
    <section class="hero-section">
      <div class="archive-pretitle">AFTERLIFE ARCHIVE GENERAL RECORD</div>
      <h1 class="archive-title">세계관 및 기밀 보관소</h1>
      <p class="archive-intro">
        사후력에 따라 집필된 세계관 연표와 주요 정서 규정 지침서, 그리고 봉인된 기밀 문서와 단서 기억 파편들의 종합 데이터망입니다.
      </p>
    </section>

    <!-- 1. 세계관 연표 -->
    <section style="margin-bottom: 4rem;">
      <h2 style="font-family: var(--font-serif); font-size: 1.6rem; border-bottom: 2px solid var(--border-strong); padding-bottom: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items:center; gap:0.5rem; color: var(--text-primary);">
        ✿ 세계관 연표
      </h2>
      ${renderTimeline()}
    </section>

    <!-- 2. 세계관 개요 / 개념 분류 -->
    <section style="margin-bottom: 4rem;">
      <h2 style="font-family: var(--font-serif); font-size: 1.6rem; border-bottom: 2px solid var(--border-strong); padding-bottom: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items:center; gap:0.5rem; color: var(--text-primary);">
        ⚖ 사후 의식 공간 규정
      </h2>
      <div class="editorial-layout" style="margin-top: 1.5rem;">
        ${conceptsHTML}
      </div>
    </section>

    <!-- 3. 기억 파편 및 봉인 문서 -->
    <section style="margin-bottom: 3rem;">
      ${renderWorldVaults()}
    </section>
  `;
}

// --------------------------------------------------------------------------
// 3. COMPANY VIEW (회사)
// --------------------------------------------------------------------------
function renderCompany() {
  const companies = ArchiveStorage.get('companies');

  let companiesHTML = '';
  if (companies.length > 0) {
    companiesHTML = companies.map(company => {
      let orgChartHTML = '';
      if (company.organization && company.organization.length > 0) {
        orgChartHTML = `
          <div class="company-org-chart">
            ${company.organization.map(group => `
              <div class="org-headquarters-group">
                <div class="org-headquarters-node">
                  ${group.headquarters}
                </div>
                <div class="org-departments-nodes">
                  ${group.departments.map(dept => `
                    <span class="org-dept-node-chip">${dept}</span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        orgChartHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">조직 구조가 정의되지 않았습니다.</p>`;
      }

      return `
        <div class="archive-panel company-card" style="padding: 2.5rem;">
          <div class="company-card-header">
            <div class="company-icon">${getCompanyIconSVG(company.name)}</div>
            <div class="company-title-wrap">
              <h3 style="font-size: 1.4rem; margin-bottom: 0.15rem;">${company.name}</h3>
              <div style="font-size: 0.8rem; color: var(--text-secondary); letter-spacing: 0.05em;">${company.nameEn || ''} | ${company.hierarchy}</div>
            </div>
          </div>
          
          <div class="funeral-ribbon"></div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-family: var(--font-serif); text-transform: uppercase; letter-spacing:0.1em;">기업 철학</h4>
            <p style="font-family: var(--font-serif); font-size: 1.05rem; font-style: italic; color: var(--text-primary);">
              “${company.philosophy}”
            </p>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-family: var(--font-serif); text-transform: uppercase; letter-spacing:0.1em;">기관 성격 및 설명</h4>
            <p style="font-family: var(--font-serif); font-size: 0.95rem; line-height: 1.8; color: var(--text-secondary); word-break: keep-all;">
              ${company.description}
            </p>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <h4 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem; font-family: var(--font-serif); text-transform: uppercase; letter-spacing:0.1em;">공식 조직 체계</h4>
            ${orgChartHTML}
          </div>

          <div class="card-footer" style="margin-top: auto; padding-top: 1.5rem;">
            <span>운영 분류: <strong style="color: var(--text-primary); font-weight: normal; font-family: var(--font-serif);">${company.hierarchy}</strong></span>
            <span class="stamp stamp-sealed">${company.status}</span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    companiesHTML = `<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">등록된 사후 법인 정보가 없습니다. [기록관리] 탭에서 생성할 수 있습니다.</p>`;
  }

  appContainer.innerHTML = `
    <section class="hero-section">
      <div class="archive-pretitle">AFTERLIFE CORPORATE ENTITIES</div>
      <h1 class="archive-title">사후 장례 법인 및 행정 공단</h1>
      <p class="archive-intro">
        잔계에 도달한 영체들을 분류 및 정화하며, 유품 수송, 원념 진압을 통해 거대한 순환계를 수호하는 주요 초자연적 운영 기구들입니다.
      </p>
    </section>

    <div class="cards-grid" style="grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));">
      ${companiesHTML}
    </div>
  `;
}

// --------------------------------------------------------------------------
// 4. CHARACTER VIEW (인물)
// --------------------------------------------------------------------------
function renderCharacter() {
  const characters = ArchiveStorage.get('characters');

  let charactersHTML = '';
  if (characters.length > 0) {
    charactersHTML = renderCharacterCardsList(characters);
  } else {
    charactersHTML = `<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">등록된 보관 인물 프로필이 없습니다. [기록관리] 탭에서 생성할 수 있습니다.</p>`;
  }

  appContainer.innerHTML = `
    <section class="hero-section" style="padding-bottom: 1.5rem;">
      <div class="archive-pretitle">PERSONNEL DOSSIER</div>
      <h1 class="archive-title">영체 신원 보관대장</h1>
      <p class="archive-intro">
        사후 법인의 요원, 혹은 특별 관리가 필요한 망자들의 소속, 역할, 그리고 관련 프로젝트와 관련된 신상 정보 기록 대장입니다.
      </p>

      <!-- Advanced Filter Panel -->
      <div class="filter-panel paper-texture">
        <div class="form-group">
          <label class="archive-label">검색어 (이름/부서/설명)</label>
          <input type="text" id="char-search" class="archive-input" placeholder="검색 단어 입력...">
        </div>
        
        <div class="form-group">
          <label class="archive-label">소속 구분</label>
          <select id="char-filter-type" class="archive-select">
            <option value="">모든 구분</option>
            <option value="회사">회사</option>
            <option value="프로젝트">프로젝트</option>
            <option value="사건">사건</option>
            <option value="기타">기타</option>
          </select>
        </div>

        <div class="form-group">
          <label class="archive-label">소속명</label>
          <select id="char-filter-name" class="archive-select">
            <option value="">모든 소속명</option>
          </select>
        </div>

        <div class="form-group">
          <label class="archive-label">소속 부서</label>
          <input type="text" id="char-filter-dept" class="archive-input" placeholder="부서명 검색...">
        </div>

        <div class="form-group">
          <label class="archive-label">상태</label>
          <input type="text" id="char-filter-status" class="archive-input" placeholder="활동, 실종 등...">
        </div>

        <div class="form-group">
          <label class="archive-label">관련 사건</label>
          <input type="text" id="char-filter-incident" class="archive-input" placeholder="사건 코드...">
        </div>

        <div class="form-group">
          <label class="archive-label">관련 프로젝트</label>
          <input type="text" id="char-filter-project" class="archive-input" placeholder="프로젝트명...">
        </div>

        <div class="form-group">
          <label class="archive-label">태그</label>
          <input type="text" id="char-filter-tag" class="archive-input" placeholder="태그 입력...">
        </div>
      </div>
    </section>

    <div class="cards-grid" id="char-grid">
      ${charactersHTML}
    </div>
  `;

  populateAffiliationNamesDropdown(characters);

  const searchInput = document.getElementById('char-search');
  const typeFilter = document.getElementById('char-filter-type');
  const nameFilter = document.getElementById('char-filter-name');
  const deptInput = document.getElementById('char-filter-dept');
  const statusInput = document.getElementById('char-filter-status');
  const incInput = document.getElementById('char-filter-incident');
  const projInput = document.getElementById('char-filter-project');
  const tagInput = document.getElementById('char-filter-tag');
  const gridContainer = document.getElementById('char-grid');

  const filterAction = () => {
    const query = searchInput.value.toLowerCase();
    const typeVal = typeFilter.value;
    const nameVal = nameFilter.value;
    const deptVal = deptInput.value.toLowerCase();
    const statusVal = statusInput.value.toLowerCase();
    const incVal = incInput.value.toLowerCase();
    const projVal = projInput.value.toLowerCase();
    const tagVal = tagInput.value.toLowerCase();

    const filtered = characters.filter(char => {
      const matchSearch = !query || 
        char.name.toLowerCase().includes(query) || 
        (char.notes && char.notes.toLowerCase().includes(query)) ||
        (char.role && char.role.toLowerCase().includes(query)) ||
        (char.affiliationDept && char.affiliationDept.toLowerCase().includes(query));

      const matchType = !typeVal || char.affiliationType === typeVal;
      const matchName = !nameVal || char.affiliationName === nameVal;
      const matchDept = !deptVal || (char.affiliationDept && char.affiliationDept.toLowerCase().includes(deptVal));
      const matchStatus = !statusVal || (char.status && char.status.toLowerCase().includes(statusVal));
      
      const matchInc = !incVal || (char.relatedIncidents && char.relatedIncidents.some(code => code.toLowerCase().includes(incVal)));
      const matchProj = !projVal || (char.relatedProjects && char.relatedProjects.some(proj => proj.toLowerCase().includes(projVal)));
      const matchTag = !tagVal || (char.tags && char.tags.some(tag => tag.toLowerCase().includes(tagVal)));

      return matchSearch && matchType && matchName && matchDept && matchStatus && matchInc && matchProj && matchTag;
    });

    if (filtered.length > 0) {
      gridContainer.innerHTML = renderCharacterCardsList(filtered);
    } else {
      gridContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1; padding: 4rem 0;">조회된 조건과 매칭되는 인사 기록이 존재하지 않습니다.</p>`;
    }
    attachCardClickHandlers();
  };

  [searchInput, deptInput, statusInput, incInput, projInput, tagInput].forEach(inp => inp.addEventListener('input', filterAction));
  [typeFilter, nameFilter].forEach(sel => sel.addEventListener('change', filterAction));

  attachCardClickHandlers();
}

function populateAffiliationNamesDropdown(characters) {
  const select = document.getElementById('char-filter-name');
  if (!select) return;

  const uniqueNames = [...new Set(characters.map(c => c.affiliationName).filter(Boolean))].sort();
  select.innerHTML = '<option value="">모든 소속명</option>' + 
    uniqueNames.map(name => `<option value="${name}">${name}</option>`).join('');
}

function renderCharacterCardsList(charactersList) {
  return charactersList.map(char => {
    const comments = getCharacterComments(char.id);
    const commentCount = comments.length;
    return `
    <div class="archive-panel character-card click-card" data-type="character" data-id="${char.id}" style="cursor: pointer;">
      <div class="funeral-ribbon-diagonal"></div>
      
      <div class="char-portrait-container">
        ${char.portrait ? `
          <img class="char-portrait-img" src="${char.portrait}" alt="${char.name}">
        ` : `
          <div class="char-portrait-fallback">殘</div>
        `}
      </div>

      <div class="char-meta-top" style="margin-bottom: 0.5rem;">
        <div>
          <h3 class="char-name">${char.name}</h3>
          <div class="char-affinity" style="margin-bottom: 0.15rem; font-size: 0.8rem;">
            [${char.affiliationType}] ${char.affiliationName}
          </div>
        </div>
        <span class="stamp" style="font-size: 0.65rem;">${char.status || '수행 중'}</span>
      </div>

      <!-- Catchphrase & Quote Display on Card -->
      ${char.catchphrase ? `<div class="char-catchphrase">“${char.catchphrase}”</div>` : ''}
      ${char.quote ? `<div class="char-quote-box">“${char.quote}”</div>` : ''}

      <div style="margin: 0.5rem 0; height: 1px; background: rgba(0,0,0,0.05);"></div>

      <!-- Personnel fields grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; font-size: 0.8rem; margin: 0.75rem 0; color: var(--text-secondary);">
        <div><strong style="color: var(--text-muted);">부서:</strong> ${char.affiliationDept || '미배정'}</div>
        <div><strong style="color: var(--text-muted);">역할:</strong> ${char.role || '요원'}</div>
      </div>

      <div style="margin: 0.5rem 0; height: 1px; background: rgba(0,0,0,0.05);"></div>

      <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem; display:flex; flex-direction:column; gap:0.25rem;">
        ${char.relatedProjects && char.relatedProjects.length > 0 ? `<div><strong>관련 프로젝트:</strong> ${char.relatedProjects.join(', ')}</div>` : ''}
      </div>

      <div class="card-footer" style="margin-top: auto; padding-top: 0.5rem;">
        <span>태그: ${char.tags && char.tags.length > 0 ? char.tags.map(t => `#${t}`).join(' ') : '없음'}</span>
        <span style="color:var(--text-muted);">추모기록: ${commentCount}건</span>
      </div>
    </div>
  `;
  }).join('');
}

// --------------------------------------------------------------------------
// 5. INCIDENT VIEW (주요사건)
// --------------------------------------------------------------------------
function renderIncident() {
  const incidents = ArchiveStorage.get('incidents');

  let incidentsHTML = '';
  if (incidents.length > 0) {
    incidentsHTML = incidents.map(inc => `
      <div class="archive-panel incident-card click-card ${inc.zanhyang === '암전' || inc.zanhyang === '공백' ? 'high-threat' : ''}" data-type="incident" data-id="${inc.id}" style="cursor: pointer;">
        <div>
          <div class="incident-header">
            <span class="incident-code">${inc.code}</span>
          </div>
          <h3 class="incident-title">${inc.title}</h3>
          
          <div style="margin-bottom: 0.75rem; display: flex; flex-wrap: wrap;">
            ${inc.jurisdictionDepartments && inc.jurisdictionDepartments.length > 0 ? inc.jurisdictionDepartments.map(dept => `
              <span class="incident-dept-chip">${dept}</span>
            `).join('') : '<span style="font-size: 0.75rem; color:var(--text-muted);">관할부서 정보 미입력</span>'}
          </div>

          <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
            대응 관할: ${inc.company || '미정'}
          </div>
          <p class="incident-summary" style="margin-bottom: 1rem;">${inc.report}</p>
        </div>
        <div class="card-footer">
          <span>잔향(殘響): <strong style="color: var(--accent-red); font-weight: normal;">${inc.zanhyang}</strong></span>
        </div>
      </div>
    `).join('');
  } else {
    incidentsHTML = `<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">등록된 주요 사건 기록이 없습니다. [기록관리] 탭에서 생성할 수 있습니다.</p>`;
  }

  appContainer.innerHTML = `
    <section class="hero-section">
      <div class="archive-pretitle">INCIDENT INVESTIGATION REPORTS</div>
      <h1 class="archive-title">초자연적 정서 재난 기록</h1>
      <p class="archive-intro">
        사후 세계 내부의 균열, 잔류 원념의 집단 폭발, 또는 통제를 벗어난 정서 재난과 관련된 사건들의 암호화된 기록 일람입니다.
      </p>

      <!-- Filter Controls -->
      <div class="search-filter-row" style="max-width: 600px; margin: 2rem auto 0 auto; justify-content: center;">
        <div class="search-input-wrapper">
          <input type="text" id="inc-search" class="archive-input" placeholder="사건 번호, 사건명, 관할부서 검색..." style="text-align: center;">
        </div>
        <select id="inc-filter-grade" class="archive-select" style="max-width: 200px; text-align-last: center;">
          <option value="">모든 잔향 등급</option>
          <option value="미등">미등</option>
          <option value="잔화">잔화</option>
          <option value="적조">적조</option>
          <option value="암전">암전</option>
          <option value="공백">공백</option>
        </select>
      </div>
    </section>

    <div class="cards-grid" id="inc-grid">
      ${incidentsHTML}
    </div>
  `;

  const incSearch = document.getElementById('inc-search');
  const incFilterGrade = document.getElementById('inc-filter-grade');
  const incGrid = document.getElementById('inc-grid');

  const filterIncidents = () => {
    const query = incSearch.value.toLowerCase();
    const gradeFilter = incFilterGrade.value;

    const filtered = incidents.filter(inc => {
      const matchQuery = inc.title.toLowerCase().includes(query) || 
        inc.code.toLowerCase().includes(query) || 
        inc.report.toLowerCase().includes(query) ||
        (inc.jurisdictionDepartments && inc.jurisdictionDepartments.some(d => d.toLowerCase().includes(query)));
      
      const matchGrade = !gradeFilter || inc.zanhyang === gradeFilter;
      return matchQuery && matchGrade;
    });

    if (filtered.length > 0) {
      incGrid.innerHTML = filtered.map(inc => `
        <div class="archive-panel incident-card click-card ${inc.zanhyang === '암전' || inc.zanhyang === '공백' ? 'high-threat' : ''}" data-type="incident" data-id="${inc.id}" style="cursor: pointer;">
          <div>
            <div class="incident-header">
              <span class="incident-code">${inc.code}</span>
            </div>
            <h3 class="incident-title">${inc.title}</h3>
            
            <div style="margin-bottom: 0.75rem; display: flex; flex-wrap: wrap;">
              ${inc.jurisdictionDepartments && inc.jurisdictionDepartments.length > 0 ? inc.jurisdictionDepartments.map(dept => `
                <span class="incident-dept-chip">${dept}</span>
              `).join('') : ''}
            </div>

            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
              대응 관할: ${inc.company || '미정'}
            </div>
            <p class="incident-summary" style="margin-bottom: 1rem;">${inc.report}</p>
          </div>
          <div class="card-footer">
            <span>잔향(殘響): <strong style="color: var(--accent-red); font-weight: normal;">${inc.zanhyang}</strong></span>
          </div>
        </div>
      `).join('');
    } else {
      incGrid.innerHTML = `<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1; padding: 3rem 0;">검색 결과와 일치하는 사건 기록이 없습니다.</p>`;
    }
    attachCardClickHandlers();
  };

  incSearch.addEventListener('input', filterIncidents);
  incFilterGrade.addEventListener('change', filterIncidents);

  attachCardClickHandlers();
}

// --------------------------------------------------------------------------
// 5. GAMES VIEW (게임배포)
// --------------------------------------------------------------------------
function renderGames() {
  const games = ArchiveStorage.get('games');

  let gamesHTML = '';
  if (games.length > 0) {
    gamesHTML = games.map(game => {
      // Calculate average rating
      let avgRating = '평점 없음';
      if (game.guestbook && game.guestbook.length > 0) {
        const sum = game.guestbook.reduce((acc, c) => acc + c.rating, 0);
        avgRating = `★ ${(sum / game.guestbook.length).toFixed(1)} (${game.guestbook.length}명 참여)`;
      }

      return `
        <div class="archive-panel paper-texture" style="margin-bottom: 2rem; display:flex; flex-direction:column; gap:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
            <div>
              <span class="stamp stamp-sealed" style="margin-bottom:0.5rem;">${game.status}</span>
              <h2 style="font-size: 1.8rem; line-height: 1.2; margin-bottom: 0.25rem;">${game.title}</h2>
              <div style="font-size:0.85rem; color:var(--text-secondary);">버전: ${game.version} | 업데이트: ${game.date}</div>
            </div>
            <div style="font-family: var(--font-serif); font-size: 1rem; color: var(--accent-red); font-weight: 600;">
              ${avgRating}
            </div>
          </div>

          ${game.image ? `
            <div style="width:100%; max-height:280px; overflow:hidden; border: 1px solid var(--border-color); border-radius:3px;">
              <img src="${game.image}" style="width:100%; height:100%; object-fit:cover; opacity:0.85; filter:grayscale(0.6);" />
            </div>
          ` : ''}

          <p style="font-family:var(--font-serif); font-size:1rem; line-height:1.7; color:var(--text-primary); word-break:keep-all;">
            ${game.description}
          </p>

          <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
            ${game.downloadUrl ? `
              <a href="${game.downloadUrl}" target="_blank" class="archive-btn archive-btn-primary" style="text-decoration:none; padding:0.6rem 1.2rem; font-size:0.85rem;">⬇ 게임 다운로드</a>
            ` : ''}
            ${game.externalUrl ? `
              <a href="${game.externalUrl}" target="_blank" class="archive-btn" style="text-decoration:none; padding:0.6rem 1.2rem; font-size:0.85rem;">🔗 공식 배포처 방문</a>
            ` : ''}
          </div>

          <!-- Connected references -->
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; border-top:1px dashed var(--border-color); border-bottom:1px dashed var(--border-color); padding: 1rem 0; font-size:0.8rem; color:var(--text-secondary);">
            <div>
              <strong style="color:var(--text-muted);">연계 아카이브 프로젝트:</strong>
              <div>${game.relatedProjects && game.relatedProjects.length > 0 ? game.relatedProjects.join(', ') : '없음'}</div>
            </div>
            <div>
              <strong style="color:var(--text-muted);">연계 사후 재난 사건:</strong>
              <div>${game.relatedIncidents && game.relatedIncidents.length > 0 ? game.relatedIncidents.join(', ') : '없음'}</div>
            </div>
            <div>
              <strong style="color:var(--text-muted);">연계 신상 영체:</strong>
              <div>${game.relatedCharacters && game.relatedCharacters.length > 0 ? game.relatedCharacters.join(', ') : '없음'}</div>
            </div>
          </div>

          <!-- Tags list -->
          <div style="font-size:0.8rem; color:var(--text-muted);">
            태그: ${game.tags && game.tags.length > 0 ? game.tags.map(t => `#${t}`).join(' ') : '없음'}
          </div>

          <!-- Guestbook reviews portal -->
          <div class="guestbook-section">
            <h3 style="font-size:1.1rem; margin-bottom:1rem; border-left:2px solid var(--accent-red); padding-left:0.5rem;">방명록 및 수집 평점</h3>
            
            <div class="visitor-comments-container">
              ${game.guestbook && game.guestbook.length > 0 ? game.guestbook.map(comment => `
                <div class="visitor-comment-card">
                  <div class="visitor-comment-header">
                    <strong style="color:var(--text-primary);">${comment.author}</strong>
                    <div>
                      <span>${comment.date}</span>
                      <button class="comment-delete-btn" data-game-id="${game.id}" data-comment-id="${comment.id}">[소거]</button>
                    </div>
                  </div>
                  <div class="visitor-rating-stars">
                    ${'★'.repeat(comment.rating)}${'☆'.repeat(5 - comment.rating)}
                  </div>
                  <p class="visitor-comment-content">“${comment.content}”</p>
                </div>
              `).join('') : '<p style="color:var(--text-muted); font-size:0.85rem; font-style:italic; padding: 1rem 0;">등록된 방문객 기록이 없습니다. 평점과 방명록을 첫 등록해 보십시오.</p>'}
            </div>

            <!-- Review writing form box -->
            <div class="review-form-box">
              <h4 style="font-size:0.9rem; margin-bottom:0.75rem; font-family:var(--font-serif);">방명록 기록 등록</h4>
              <form class="visitor-review-form" data-game-id="${game.id}">
                <div style="display:flex; gap:1rem; margin-bottom:0.75rem; flex-wrap:wrap;">
                  <div style="flex:1; min-width:150px;">
                    <label class="archive-label">작성자명</label>
                    <input type="text" class="archive-input form-review-author" required placeholder="예: 익명의 영체">
                  </div>
                  <div>
                    <label class="archive-label">부여 평점</label>
                    <div class="rating-star-selector" data-rating="5">
                      <span class="active" data-val="1">★</span>
                      <span class="active" data-val="2">★</span>
                      <span class="active" data-val="3">★</span>
                      <span class="active" data-val="4">★</span>
                      <span class="active" data-val="5">★</span>
                    </div>
                  </div>
                </div>
                <div class="form-group" style="margin-bottom:1rem;">
                  <label class="archive-label">방명록 내용</label>
                  <textarea class="archive-textarea form-review-content" required style="min-height:70px;" placeholder="애도와 감상의 평을 남겨주십시오."></textarea>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                  <span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">
                    * 이 방명록과 평점은 현재 사용 중인 브라우저(localStorage)에만 저장됩니다.
                  </span>
                  <button type="submit" class="archive-btn archive-btn-primary" style="padding:0.4rem 1rem; font-size:0.8rem;">기록 전송</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    gamesHTML = `<p style="color: var(--text-muted); text-align: center; padding: 5rem 0;">배포 중인 게임이 없습니다. [기록관리] 탭에서 추가할 수 있습니다.</p>`;
  }

  appContainer.innerHTML = `
    <section class="hero-section">
      <div class="archive-pretitle">GAME PROJECT ARCHIVE</div>
      <h1 class="archive-title">게임 프로젝트 배포관</h1>
      <p class="archive-intro">
        사후 아카이브 보관망의 잔류 의식과 설정들을 재해석하여 제작된 게임 프로젝트 패키지들을 열람하고 로컬에서 평론을 남길 수 있는 배포처입니다.
      </p>
    </section>

    <div style="max-width: 800px; margin: 0 auto;">
      ${gamesHTML}
    </div>
  `;

  // Bind Star Rating Selector Events
  const starSelectors = appContainer.querySelectorAll('.rating-star-selector');
  starSelectors.forEach(selector => {
    const stars = selector.querySelectorAll('span');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const ratingVal = parseInt(star.getAttribute('data-val'));
        selector.setAttribute('data-rating', ratingVal);
        
        stars.forEach(s => {
          const sVal = parseInt(s.getAttribute('data-val'));
          if (sVal <= ratingVal) {
            s.classList.add('active');
          } else {
            s.classList.remove('active');
          }
        });
      });
    });
  });

  // Bind Guestbook Comment Submissions
  const reviewForms = appContainer.querySelectorAll('.visitor-review-form');
  reviewForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const gameId = form.getAttribute('data-game-id');
      const author = form.querySelector('.form-review-author').value;
      const content = form.querySelector('.form-review-content').value;
      const rating = form.querySelector('.rating-star-selector').getAttribute('data-rating') || 5;

      const gamesList = ArchiveStorage.get('games');
      const gameIndex = gamesList.findIndex(g => g.id === gameId);
      if (gameIndex !== -1) {
        const newComment = {
          id: `comment-${Date.now()}`,
          rating: parseInt(rating),
          author: author || "익명의 영체",
          content: content,
          date: new Date().toISOString().split('T')[0]
        };
        if (!gamesList[gameIndex].guestbook) {
          gamesList[gameIndex].guestbook = [];
        }
        gamesList[gameIndex].guestbook.push(newComment);
        ArchiveStorage.save('games', gamesList);
        renderGames();
        showStatusNotification('방명록 기록이 성공적으로 기입되었습니다.');
      }
    });
  });

  // Bind comment deletion click events
  const deleteCommentButtons = appContainer.querySelectorAll('.comment-delete-btn');
  deleteCommentButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const gameId = btn.getAttribute('data-game-id');
      const commentId = btn.getAttribute('data-comment-id');
      
      if (confirm('이 방명록 한 줄을 소멸 조치하겠습니까?')) {
        const gamesList = ArchiveStorage.get('games');
        const gameIndex = gamesList.findIndex(g => g.id === gameId);
        if (gameIndex !== -1 && gamesList[gameIndex].guestbook) {
          gamesList[gameIndex].guestbook = gamesList[gameIndex].guestbook.filter(c => c.id !== commentId);
          ArchiveStorage.save('games', gamesList);
          renderGames();
          showStatusNotification('방명록 기록이 소거되었습니다.');
        }
      }
    });
  });
}

// ==========================================================================
// 6. RECORD MANAGEMENT VIEW (/manage)
// ==========================================================================
function renderManage() {
  appContainer.innerHTML = `
    <section class="hero-section" style="padding-bottom: 2rem; margin-bottom: 2rem;">
      <div class="archive-pretitle">BUILT-IN MANAGEMENT CONSOLE</div>
      <h1 class="archive-title">기록 보관 제어 관리망</h1>
      <p class="archive-intro">
        사후 기록물의 수동 추가, 편집 및 영구 파기를 위한 비종결성 콘솔 인터페이스입니다. 
        이곳의 변경 사항은 잔계 공통 데이터베이스에 즉시 동기화됩니다.
      </p>
    </section>

    <!-- Admin Tabs Navigation -->
    <div class="manage-tabs-container" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1.5rem;">
      <button class="manage-tab ${activeManageTab === 'concepts' ? 'active' : ''}" data-tab="concepts">1. 세계관 개념</button>
      <button class="manage-tab ${activeManageTab === 'companies' ? 'active' : ''}" data-tab="companies">2. 회사 관리</button>
      <button class="manage-tab ${activeManageTab === 'characters' ? 'active' : ''}" data-tab="characters">3. 인물 관리</button>
      <button class="manage-tab ${activeManageTab === 'incidents' ? 'active' : ''}" data-tab="incidents">4. 사건 관리</button>
      <button class="manage-tab ${activeManageTab === 'games' ? 'active' : ''}" data-tab="games">5. 게임배포 관리</button>
      <button class="manage-tab ${activeManageTab === 'timeline' ? 'active' : ''}" data-tab="timeline">6. 연표 관리</button>
      <button class="manage-tab ${activeManageTab === 'sealed_documents' ? 'active' : ''}" data-tab="sealed_documents">7. 봉인 문서</button>
      <button class="manage-tab ${activeManageTab === 'relationships' ? 'active' : ''}" data-tab="relationships">8. 관계도 관리</button>
      <button class="manage-tab ${activeManageTab === 'memory_fragments' ? 'active' : ''}" data-tab="memory_fragments">9. 기억 파편</button>
    </div>
    
    <div style="margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:0.8rem; color:var(--text-muted);">보안 등급: 2급 기밀 (ADMIN PANEL)</span>
      <div style="display:flex; gap:0.5rem;">
        <button class="archive-btn archive-btn-primary" id="btn-change-password" style="font-size:0.8rem; padding:0.4rem 1rem; cursor: pointer;">🔑 비밀번호 변경</button>
        <button class="archive-btn archive-btn-danger" id="btn-reset-db" style="font-size:0.8rem; padding:0.4rem 1rem; cursor: pointer;">⚠️ 데이터베이스 초기화</button>
      </div>
    </div>

    <!-- Management Workspace Layout -->
    <div class="archive-panel paper-texture">
      <div class="manage-grid" id="manage-grid-content">
      </div>
    </div>
  `;

  const tabs = appContainer.querySelectorAll('.manage-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeManageTab = tab.getAttribute('data-tab');
      selectedManageId = null;
      renderManageTabContent();
    });
  });

  const changePasswordBtn = document.getElementById('btn-change-password');
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => {
      showPasswordChangeModal(false);
    });
  }

  const resetBtn = document.getElementById('btn-reset-db');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('경고: 이 작업은 모든 로컬 데이터를 삭제하고 초기 상태(시드 데이터)로 되돌립니다. 진행하시겠습니까?')) {
        ArchiveStorage.reset();
        unlockedSealedDocuments.clear();
        updateScreenNoiseState();
        selectedManageId = null;
        renderManageTabContent();
        showStatusNotification('데이터베이스가 완전 초기화되었습니다.');
      }
    });
  }

  renderManageTabContent();
}

function renderManageTabContent() {
  const container = document.getElementById('manage-grid-content');
  if (!container) return;

  const data = ArchiveStorage.get(activeManageTab);
  
  let sidebarHTML = `
    <div class="manage-sidebar-list">
      <div class="list-header-actions">
        <span class="list-count">총 ${data.length}건 기록물</span>
        <button class="archive-btn archive-btn-primary" id="btn-create-new" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">+ 신규 생성</button>
      </div>
      <div style="display:flex; flex-direction:column; gap: 0.5rem;" id="sidebar-items-list">
        ${data.map(item => {
          let title = '';
          let sub = '';
          if (activeManageTab === 'concepts') { title = item.title; sub = item.category; }
          else if (activeManageTab === 'companies') { title = item.name; sub = item.hierarchy; }
          else if (activeManageTab === 'characters') { title = item.name; sub = `[${item.affiliationType}] ${item.affiliationName}`; }
          else if (activeManageTab === 'incidents') { title = item.title; sub = item.code; }
          else if (activeManageTab === 'games') { title = item.title; sub = `버전: ${item.version} (${item.status})`; }
          else if (activeManageTab === 'timeline') { title = item.title; sub = `${item.year} (${item.level})`; }
          else if (activeManageTab === 'sealed_documents') { title = item.title; sub = `${item.code || ''} (${item.unlockMethod})`; }
          else if (activeManageTab === 'relationships') { 
            const src = getConnectedEntityName(item.sourceType, item.sourceId);
            const tgt = getConnectedEntityName(item.targetType, item.targetId);
            title = `${src} ↔ ${tgt}`;
            sub = `${item.relation} (${item.displayMode})`; 
          }
          else if (activeManageTab === 'memory_fragments') { title = item.title; sub = `${item.level} | ${item.source}`; }

          const activeClass = item.id === selectedManageId ? 'active' : '';

          return `
            <div class="manage-item-link ${activeClass}" data-id="${item.id}">
              <div>
                <div class="manage-item-title">${title}</div>
                <div class="manage-item-sub">${sub}</div>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-muted);">❯</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  let formHTML = `
    <div class="manage-content-form" id="manage-form-container">
    </div>
  `;

  container.innerHTML = sidebarHTML + formHTML;

  const sidebarItems = container.querySelectorAll('.manage-item-link');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      selectedManageId = item.getAttribute('data-id');
      renderActiveForm();
    });
  });

  document.getElementById('btn-create-new').addEventListener('click', () => {
    sidebarItems.forEach(i => i.classList.remove('active'));
    selectedManageId = null;
    renderActiveForm();
  });

  renderActiveForm();
}

function renderActiveForm() {
  const formContainer = document.getElementById('manage-form-container');
  if (!formContainer) return;

  const data = ArchiveStorage.get(activeManageTab);
  const item = selectedManageId ? data.find(i => i.id === selectedManageId) : null;

  let formFieldsHTML = '';
  let formTitle = selectedManageId ? '기록물 편집 및 갱신' : '신규 아카이브 기록 작성';

  if (activeManageTab === 'concepts') {
    formFieldsHTML = `
      <div class="form-group">
        <label class="archive-label">개념 명칭</label>
        <input type="text" id="form-title" class="archive-input" value="${item ? item.title : ''}" required placeholder="예: 잔류 기억">
      </div>
      <div class="form-group">
        <label class="archive-label">분류 카테고리</label>
        <input type="text" id="form-category" class="archive-input" value="${item ? item.category : ''}" placeholder="예: 기록 물질">
      </div>
      <div class="form-group">
        <label class="archive-label">한자/상징 표식</label>
        <input type="text" id="form-symbol" class="archive-input" maxlength="1" value="${item ? item.symbol : ''}" placeholder="예: 憶">
      </div>
      <div class="form-group">
        <label class="archive-label">한 줄 설명</label>
        <input type="text" id="form-description" class="archive-input" value="${item ? item.description : ''}" placeholder="개념을 함축하는 짧은 문구">
      </div>
      <div class="form-group">
        <label class="archive-label">상세 보고 규정</label>
        <textarea id="form-details" class="archive-textarea" placeholder="개념의 원리와 사후 행정적 처리 방침을 소상히 기입하십시오.">${item ? item.details : ''}</textarea>
      </div>
    `;
  } 
  else if (activeManageTab === 'companies') {
    let orgText = '';
    if (item && item.organization) {
      orgText = item.organization.map(g => `${g.headquarters}: ${g.departments.join(', ')}`).join('\n');
    }

    formFieldsHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">회사/기관 명칭</label>
          <input type="text" id="form-name" class="archive-input" value="${item ? item.name : ''}" required placeholder="예: 백화상조 (白花喪弔)">
        </div>
        <div class="form-group">
          <label class="archive-label">영문명 또는 한자명</label>
          <input type="text" id="form-nameEn" class="archive-input" value="${item ? (item.nameEn || '') : ''}" placeholder="예: BAEKHWA SANGJO">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">운영 위계</label>
          <input type="text" id="form-hierarchy" class="archive-input" value="${item ? item.hierarchy : ''}" placeholder="예: 사후 행정원 산하 특수 법인">
        </div>
        <div class="form-group">
          <label class="archive-label">현재 아카이브 상태</label>
          <select id="form-status" class="archive-select">
            <option value="정상 운영 (Green)" ${item && item.status.includes('정상') ? 'selected' : ''}>정상 운영</option>
            <option value="경계 상태 (Yellow)" ${item && item.status.includes('경계') ? 'selected' : ''}>경계 상태</option>
            <option value="주의/이상 발생 (Orange)" ${item && item.status.includes('주의') ? 'selected' : ''}>주의/이상 발생</option>
            <option value="영업 제한/봉인 (Red)" ${item && item.status.includes('제한') ? 'selected' : ''}>영업 제한/봉인</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="archive-label">사명 및 철학</label>
        <input type="text" id="form-philosophy" class="archive-input" value="${item ? item.philosophy : ''}" placeholder="“마지막 소멸을 애도합니다.”">
      </div>
      
      <div class="form-group">
        <label class="archive-label">조직 구조 입력 (본부 산하 조직)</label>
        <textarea id="form-organization" class="archive-textarea" style="height:100px;" placeholder="한 줄에 하나의 본부를 입력하세요. 예:\n기록관리본부: 잔류기록부, 문서봉인과\n의식운영본부: 장례의식부, 호흡등록과">${orgText}</textarea>
        <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-top:0.25rem;">
          형식: [소속본부]: [소속부서1], [소속부서2] (부서는 쉼표로 구분하며 줄바꿈으로 본부를 나눕니다.)
        </span>
      </div>

      <div class="form-group">
        <label class="archive-label">이미지/엠블럼</label>
        <div class="file-upload-container">
          <span class="file-upload-label" id="file-label-text">
            ${item && item.emblem ? '엠블럼이 등록되어 있습니다. 변경하려면 클릭.' : '엠블럼 이미지 드래그 또는 클릭'}
          </span>
          <input type="file" id="form-emblem" class="file-upload-input" accept="image/*">
          <input type="hidden" id="form-emblem-base64" value="${item ? item.emblem : ''}">
          <div id="emblem-preview-wrap">
            ${item && item.emblem ? `<img class="file-upload-preview" src="${item.emblem}" />` : ''}
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="archive-label">법인 상세 소개</label>
        <textarea id="form-description" class="archive-textarea" placeholder="기관의 사명, 역사, 잔류 영혼 처리 방식에 대해 상세히 기입하십시오.">${item ? item.description : ''}</textarea>
      </div>
    `;
  } 
  else if (activeManageTab === 'characters') {
    formFieldsHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">이름</label>
          <input type="text" id="form-name" class="archive-input" value="${item ? item.name : ''}" required placeholder="예: 민우진">
        </div>
        <div class="form-group">
          <label class="archive-label">소속 구분</label>
          <select id="form-affiliationType" class="archive-select">
            <option value="회사" ${item && item.affiliationType === '회사' ? 'selected' : ''}>회사</option>
            <option value="프로젝트" ${item && item.affiliationType === '프로젝트' ? 'selected' : ''}>프로젝트</option>
            <option value="사건" ${item && item.affiliationType === '사건' ? 'selected' : ''}>사건</option>
            <option value="기타" ${item && item.affiliationType === '기타' ? 'selected' : ''}>기타</option>
          </select>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">소속명</label>
          <input type="text" id="form-affiliationName" class="archive-input" value="${item ? item.affiliationName : ''}" placeholder="예: 백화상조 (白花喪弔), PJT-망량">
        </div>
        <div class="form-group">
          <label class="archive-label">소속 부서</label>
          <input type="text" id="form-affiliationDept" class="archive-input" value="${item ? item.affiliationDept : ''}" placeholder="예: 기억수집과, 현장조사국">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">직위 또는 역할</label>
          <input type="text" id="form-role" class="archive-input" value="${item ? item.role : ''}" placeholder="예: 과장 / 현장 기사">
        </div>
        <div class="form-group">
          <label class="archive-label">현재 상태</label>
          <input type="text" id="form-status" class="archive-input" value="${item ? item.status : '활동 중'}" placeholder="예: 활동 중, 실종, 정직, 격리">
        </div>
      </div>

      <!-- Catchphrase & Quote inputs (New) -->
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">캐치프레이즈</label>
          <input type="text" id="form-catchphrase" class="archive-input" value="${item ? (item.catchphrase || '') : ''}" placeholder="“죽음 이후에도 출근하는 기록관”">
        </div>
        <div class="form-group">
          <label class="archive-label">대표대사</label>
          <input type="text" id="form-quote" class="archive-input" value="${item ? (item.quote || '') : ''}" placeholder="“이름은 가장 오래 남는 오염입니다.”">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">관련 프로젝트 (쉼표로 구분)</label>
          <input type="text" id="form-relatedProjects" class="archive-input" value="${item && item.relatedProjects ? item.relatedProjects.join(', ') : ''}" placeholder="예: PJT-애도기록, PJT-삼도수송">
        </div>
        <div class="form-group" style="align-self: center; margin-top: 1.5rem;">
          <label class="archive-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
            <input type="checkbox" id="form-enableNoise" ${item && item.enableNoise ? 'checked' : ''}>
            이 기록 열람 시 화면 노이즈 적용 (enableNoise)
          </label>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">인물 태그 (쉼표로 구분)</label>
          <input type="text" id="form-tags" class="archive-input" value="${item && item.tags ? item.tags.join(', ') : ''}" placeholder="예: 요원, 베테랑, 실종자">
        </div>
        <div class="form-group">
          <label class="archive-label">초상화 이미지 파일</label>
          <div class="file-upload-container">
            <span class="file-upload-label" id="file-label-text">
              ${item && item.portrait ? '이미지가 등록되어 있습니다. 변경하려면 클릭.' : '초상화 이미지 업로드'}
            </span>
            <input type="file" id="form-portrait" class="file-upload-input" accept="image/*">
            <input type="hidden" id="form-portrait-base64" value="${item ? item.portrait : ''}">
            <div id="image-preview-wrap">
              ${item && item.portrait ? `<img class="file-upload-preview" src="${item.portrait}" />` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="archive-label">절망 기록 (스포일러 경고 및 블러 처리)</label>
        <textarea id="form-despair" class="archive-textarea" style="height:80px;" placeholder="망자의 가장 치명적이고 슬픈 원념의 핵을 적으십시오. 상세 화면에서 비밀 필터로 가려집니다.">${item ? (item.despair || '') : ''}</textarea>
      </div>

      <div class="form-group">
        <label class="archive-label">인물 상세 분석 및 설명</label>
        <textarea id="form-notes" class="archive-textarea" placeholder="대상 인물의 배경 설명, 성격, 심리 기록을 상세히 기입하십시오.">${item ? item.notes : ''}</textarea>
      </div>
    `;
  }
  else if (activeManageTab === 'incidents') {
    const companies = ArchiveStorage.get('companies');
    formFieldsHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">사건번호</label>
          <input type="text" id="form-code" class="archive-input" value="${item ? item.code : ''}" required placeholder="예: INC-928">
        </div>
        <div class="form-group">
          <label class="archive-label">사건명</label>
          <input type="text" id="form-title" class="archive-input" value="${item ? item.title : ''}" required placeholder="예: 서부 망량의 난">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">잔향 등급</label>
          <select id="form-zanhyang" class="archive-select">
            <option value="미등" ${item && item.zanhyang === '미등' ? 'selected' : ''}>1. 미등</option>
            <option value="잔화" ${item && item.zanhyang === '잔화' ? 'selected' : ''}>2. 잔화</option>
            <option value="적조" ${item && item.zanhyang === '적조' ? 'selected' : ''}>3. 적조</option>
            <option value="암전" ${item && item.zanhyang === '암전' ? 'selected' : ''}>4. 암전</option>
            <option value="공백" ${item && item.zanhyang === '공백' ? 'selected' : ''}>5. 공백</option>
          </select>
        </div>
        <div class="form-group">
          <label class="archive-label">대응 관련 회사</label>
          <select id="form-company" class="archive-select">
            <option value="">선택 안 함</option>
            ${companies.map(c => `<option value="${c.name}" ${item && item.company === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">기밀 봉인 형태</label>
          <select id="form-sealedSetting" class="archive-select">
            <option value="unsealed" ${item && item.sealedSetting === 'unsealed' ? 'selected' : ''}>공개 문서 (Unsealed)</option>
            <option value="sealed" ${item && item.sealedSetting === 'sealed' ? 'selected' : ''}>비밀 봉인 (Sealed)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="archive-label">열람 권한 수준</label>
          <input type="text" id="form-accessLevel" class="archive-input" value="${item ? item.accessLevel : 'Level 2 : 제한열람'}" placeholder="예: Level 2 : 제한열람">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">관할부서 (쉼표로 구분)</label>
          <input type="text" id="form-jurisdictionDepartments" class="archive-input" value="${item && item.jurisdictionDepartments ? item.jurisdictionDepartments.join(', ') : ''}" placeholder="예: 잔류기록부, 봉인국, 사고조사과">
        </div>
        <div class="form-group">
          <label class="archive-label">관련 연루 인물들 (쉼표로 구분)</label>
          <input type="text" id="form-personnel" class="archive-input" value="${item && item.personnel ? item.personnel.join(', ') : ''}" placeholder="예: 민우진, 지호식">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">사건 태그 (쉼표로 구분)</label>
          <input type="text" id="form-tags" class="archive-input" value="${item && item.tags ? item.tags.join(', ') : ''}" placeholder="예: 정서재난, 실종, 균열">
        </div>
        <div class="form-group">
          <label class="archive-label">사건 단서 이미지 업로드</label>
          <div class="file-upload-container">
            <span class="file-upload-label" id="file-label-text">
              ${item && item.image ? '이미지가 등록되어 있습니다. 변경하려면 클릭.' : '사건 이미지 드래그 또는 클릭'}
            </span>
            <input type="file" id="form-image" class="file-upload-input" accept="image/*">
            <input type="hidden" id="form-image-base64" value="${item ? item.image : ''}">
            <div id="image-preview-wrap">
              ${item && item.image ? `<img class="file-upload-preview" src="${item.image}" />` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">사건 개요</label>
          <input type="text" id="form-description" class="archive-input" value="${item ? (item.description || '') : ''}" placeholder="사건의 간략한 진행 요약 기입">
        </div>
        <div class="form-group" style="align-self: center; margin-top: 1.5rem;">
          <label class="archive-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
            <input type="checkbox" id="form-enableNoise" ${item && item.enableNoise ? 'checked' : ''}>
            이 기록 열람 시 화면 노이즈 적용 (enableNoise)
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="archive-label">사건 공식 경위서 및 보고 내용</label>
        <textarea id="form-report" class="archive-textarea" placeholder="정서 재난 발생 사건 경위, 오염 양상, 사후 피해 보고를 상세히 기입하십시오.">${item ? item.report : ''}</textarea>
      </div>
    `;
  }
  else if (activeManageTab === 'games') {
    const incidents = ArchiveStorage.get('incidents');
    const characters = ArchiveStorage.get('characters');
    
    let projectSet = new Set();
    characters.forEach(c => { if (c.relatedProjects) c.relatedProjects.forEach(p => projectSet.add(p)); });
    const uniqueProjects = [...projectSet].sort();

    formFieldsHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">게임 명칭</label>
          <input type="text" id="form-title" class="archive-input" value="${item ? item.title : ''}" required placeholder="예: 망량의 흔적">
        </div>
        <div class="form-group">
          <label class="archive-label">게임 버전</label>
          <input type="text" id="form-version" class="archive-input" value="${item ? item.version : 'v1.0.0'}" placeholder="예: v1.0.0">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">배포 상태</label>
          <select id="form-status" class="archive-select">
            <option value="제작중" ${item && item.status === '제작중' ? 'selected' : ''}>제작중</option>
            <option value="체험판" ${item && item.status === '체험판' ? 'selected' : ''}>체험판</option>
            <option value="배포중" ${item && item.status === '배포중' ? 'selected' : ''}>배포중</option>
            <option value="업데이트중" ${item && item.status === '업데이트중' ? 'selected' : ''}>업데이트중</option>
            <option value="중단" ${item && item.status === '중단' ? 'selected' : ''}>중단</option>
            <option value="비공개" ${item && item.status === '비공개' ? 'selected' : ''}>비공개</option>
          </select>
        </div>
        <div class="form-group">
          <label class="archive-label">업데이트 배포 일자</label>
          <input type="date" id="form-date" class="archive-input" value="${item ? item.date : new Date().toISOString().split('T')[0]}">
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">게임 다운로드 링크</label>
          <input type="url" id="form-downloadUrl" class="archive-input" value="${item ? (item.downloadUrl || '') : ''}" placeholder="다운로드 링크 주소 기입">
        </div>
        <div class="form-group">
          <label class="archive-label">공식 배포처/블로그 외부 링크</label>
          <input type="url" id="form-externalUrl" class="archive-input" value="${item ? (item.externalUrl || '') : ''}" placeholder="공식 페이지 외부 연결 주소 기입">
        </div>
      </div>

      <div style="border: 1px solid var(--border-color); padding: 1rem; background-color: rgba(28,28,31,0.01); margin-bottom: 1.25rem; border-radius:3px;">
        <h4 style="font-size:0.85rem; margin-bottom:0.75rem; font-family:var(--font-serif); border-bottom:1px dashed var(--border-color); padding-bottom:0.25rem;">연계 기록 연동 설정</h4>
        
        <div class="form-group">
          <label class="archive-label">1. 연계 프로젝트 목록 (쉼표로 구분)</label>
          <input type="text" id="form-relatedProjects" class="archive-input" value="${item && item.relatedProjects ? item.relatedProjects.join(', ') : ''}" placeholder="기존 고유 프로젝트 혹은 자유 기입 (예: PJT-삼도수송, PJT-애도기록)">
          ${uniqueProjects.length > 0 ? `
            <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.25rem;">
              추천 기존 프로젝트: ${uniqueProjects.join(', ')}
            </div>
          ` : ''}
        </div>

        <div class="form-row">
          <div class="form-group" style="max-height: 150px; overflow-y: auto;">
            <label class="archive-label">2. 연계 주요 사건 선택</label>
            <div id="relationship-incidents-checks" style="display:flex; flex-direction:column; gap:0.25rem;">
              ${incidents.map(inc => {
                const checked = item && item.relatedIncidents && item.relatedIncidents.includes(inc.code) ? 'checked' : '';
                return `
                  <label style="font-size:0.8rem; display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                    <input type="checkbox" name="rel-incidents" value="${inc.code}" ${checked}>
                    <span>${inc.code} - ${inc.title}</span>
                  </label>
                `;
              }).join('')}
              ${incidents.length === 0 ? '<span style="font-size:0.75rem; color:var(--text-muted);">연계 가능한 사건 없음</span>' : ''}
            </div>
          </div>

          <div class="form-group" style="max-height: 150px; overflow-y: auto;">
            <label class="archive-label">3. 연계 소속 인물 선택</label>
            <div id="relationship-characters-checks" style="display:flex; flex-direction:column; gap:0.25rem;">
              ${characters.map(char => {
                const checked = item && item.relatedCharacters && item.relatedCharacters.includes(char.name) ? 'checked' : '';
                return `
                  <label style="font-size:0.8rem; display:flex; align-items:center; gap:0.35rem; cursor:pointer;">
                    <input type="checkbox" name="rel-characters" value="${char.name}" ${checked}>
                    <span>${char.name}</span>
                  </label>
                `;
              }).join('')}
              ${characters.length === 0 ? '<span style="font-size:0.75rem; color:var(--text-muted);">연계 가능한 인물 없음</span>' : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">게임 홍보용 태그 (쉼표로 구분)</label>
          <input type="text" id="form-tags" class="archive-input" value="${item && item.tags ? item.tags.join(', ') : ''}" placeholder="예: 텍스트어드벤처, 사후세계, 퍼즐">
        </div>
        <div class="form-group">
          <label class="archive-label">대표 홍보 이미지 파일</label>
          <div class="file-upload-container">
            <span class="file-upload-label" id="file-label-text">
              ${item && item.image ? '포스터 이미지가 등록되어 있습니다. 변경하려면 클릭.' : '게임 포스터 이미지 업로드'}
            </span>
            <input type="file" id="form-image" class="file-upload-input" accept="image/*">
            <input type="hidden" id="form-image-base64" value="${item ? item.image : ''}">
            <div id="image-preview-wrap">
              ${item && item.image ? `<img class="file-upload-preview" src="${item.image}" />` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="archive-label">게임 배포 상세 소개</label>
        <textarea id="form-description" class="archive-textarea" placeholder="게임 프로젝트의 핵심 시놉시스, 기획 설정 및 아카이브 연결 요소를 상세 기입하십시오.">${item ? item.description : ''}</textarea>
      </div>
    `;
  }
  else if (activeManageTab === 'timeline') {
    formFieldsHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">연도/시기</label>
          <input type="text" id="form-year" class="archive-input" value="${item ? item.year : ''}" required placeholder="예: 사후력 03년">
        </div>
        <div class="form-group">
          <label class="archive-label">사건 제목</label>
          <input type="text" id="form-title" class="archive-input" value="${item ? item.title : ''}" required placeholder="예: 백화상조 기록관 설립">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">열람 권한 수준</label>
          <input type="text" id="form-level" class="archive-input" value="${item ? item.level : 'Level 1 : 내부기록'}" placeholder="예: Level 1 : 내부기록">
        </div>
        <div class="form-group" style="align-self: center; margin-top: 1.5rem;">
          <label class="archive-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
            <input type="checkbox" id="form-enableNoise" ${item && item.enableNoise ? 'checked' : ''}>
            이 기록 열람 시 화면 노이즈 적용 (enableNoise)
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="archive-label">상세 내용 설명</label>
        <textarea id="form-description" class="archive-textarea" placeholder="해당 연도에 일어난 주요 사건의 경위를 기술하십시오.">${item ? item.description : ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">연계 프로젝트 (쉼표로 구분)</label>
          <input type="text" id="form-relatedProjects" class="archive-input" value="${item && item.relatedProjects ? item.relatedProjects.join(', ') : ''}" placeholder="예: PJT-애도기록">
        </div>
        <div class="form-group">
          <label class="archive-label">연계 인물 (쉼표로 구분)</label>
          <input type="text" id="form-relatedCharacters" class="archive-input" value="${item && item.relatedCharacters ? item.relatedCharacters.join(', ') : ''}" placeholder="예: 민우진">
        </div>
      </div>
      <div class="form-group">
        <label class="archive-label">연계 사건 (쉼표로 구분)</label>
        <input type="text" id="form-relatedIncidents" class="archive-input" value="${item && item.relatedIncidents ? item.relatedIncidents.join(', ') : ''}" placeholder="예: INC-092">
      </div>
    `;
  }
  else if (activeManageTab === 'sealed_documents') {
    formFieldsHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">문서 번호/코드</label>
          <input type="text" id="form-code" class="archive-input" value="${item ? item.code : ''}" required placeholder="예: DOC-04">
        </div>
        <div class="form-group">
          <label class="archive-label">문서 제목</label>
          <input type="text" id="form-title" class="archive-input" value="${item ? item.title : ''}" required placeholder="예: 수인 격리 보고서">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">보안 봉인 수준</label>
          <input type="text" id="form-level" class="archive-input" value="${item ? item.level : 'Level 3 : 봉인기록'}" placeholder="예: Level 3 : 봉인기록">
        </div>
        <div class="form-group">
          <label class="archive-label">한 줄 요약/설명</label>
          <input type="text" id="form-description" class="archive-input" value="${item ? item.description : ''}" placeholder="봉인 해제 전 노출되는 간략 소개">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">봉인 해제 방식</label>
          <select id="form-unlockMethod" class="archive-select">
            <option value="click" ${item && item.unlockMethod === 'click' ? 'selected' : ''}>클릭 (영체 해제)</option>
            <option value="password" ${item && item.unlockMethod === 'password' ? 'selected' : ''}>암호 검증</option>
            <option value="admin" ${item && item.unlockMethod === 'admin' ? 'selected' : ''}>관리자 전용</option>
          </select>
        </div>
        <div class="form-group">
          <label class="archive-label">해독 암호</label>
          <input type="text" id="form-password" class="archive-input" value="${item ? item.password : ''}" placeholder="예: INC-092">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">경고 문구 (Warning Text)</label>
          <input type="text" id="form-warningText" class="archive-input" value="${item ? item.warningText : ''}" placeholder="봉인 외벽에 붉게 보일 경고 메시지">
        </div>
        <div class="form-group" style="align-self: center; margin-top: 1.5rem;">
          <label class="archive-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
            <input type="checkbox" id="form-enableNoise" ${item && item.enableNoise ? 'checked' : ''}>
            이 기록 열람 시 화면 노이즈 적용 (enableNoise)
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="archive-label">봉인 문서 내용</label>
        <textarea id="form-content" class="archive-textarea" style="height:150px;" placeholder="해독 성공 시 웅장하게 보여질 실제 기밀 내용.">${item ? item.content : ''}</textarea>
      </div>
    `;
  }
  else if (activeManageTab === 'relationships') {
    const chars = ArchiveStorage.get('characters');
    const incs = ArchiveStorage.get('incidents');
    const comps = ArchiveStorage.get('companies');

    formFieldsHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">출발지 타입</label>
          <select id="form-sourceType" class="archive-select">
            <option value="character" ${item && item.sourceType === 'character' ? 'selected' : ''}>인물</option>
            <option value="incident" ${item && item.sourceType === 'incident' ? 'selected' : ''}>사건</option>
            <option value="company" ${item && item.sourceType === 'company' ? 'selected' : ''}>회사</option>
          </select>
        </div>
        <div class="form-group">
          <label class="archive-label">출발지 개체</label>
          <select id="form-sourceId" class="archive-select">
            <!-- Populated dynamically -->
          </select>
        </div>
      </div>
 
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">목적지 타입</label>
          <select id="form-targetType" class="archive-select">
            <option value="character" ${item && item.targetType === 'character' ? 'selected' : ''}>인물</option>
            <option value="incident" ${item && item.targetType === 'incident' ? 'selected' : ''}>사건</option>
            <option value="company" ${item && item.targetType === 'company' ? 'selected' : ''}>회사</option>
          </select>
        </div>
        <div class="form-group">
          <label class="archive-label">목적지 개체</label>
          <select id="form-targetId" class="archive-select">
            <!-- Populated dynamically -->
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">관계 설명</label>
          <input type="text" id="form-relation" class="archive-input" value="${item ? item.relation : ''}" required placeholder="예: 추적자 / 실종자">
        </div>
        <div class="form-group">
          <label class="archive-label">표시 모드</label>
          <select id="form-displayMode" class="archive-select">
            <option value="mindmap" ${item && item.displayMode === 'mindmap' ? 'selected' : ''}>마인드맵</option>
            <option value="table" ${item && item.displayMode === 'table' ? 'selected' : ''}>테이블</option>
            <option value="card" ${item && item.displayMode === 'card' ? 'selected' : ''}>카드</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="archive-label">관계 상세 설명</label>
        <textarea id="form-description" class="archive-textarea" placeholder="관계에 관한 아카이브 상세 보고 내용을 기술하십시오.">${item ? item.description : ''}</textarea>
      </div>
    `;

    setTimeout(() => {
      const srcTypeSel = document.getElementById('form-sourceType');
      const srcIdSel = document.getElementById('form-sourceId');
      const tgtTypeSel = document.getElementById('form-targetType');
      const tgtIdSel = document.getElementById('form-targetId');

      const populateEntityDropdown = (typeSelect, idSelect, selectedValue) => {
        const type = typeSelect.value;
        let optionsHTML = '';
        if (type === 'character') {
          optionsHTML = chars.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        } else if (type === 'incident') {
          optionsHTML = incs.map(i => `<option value="${i.id}">${i.code} - ${i.title}</option>`).join('');
        } else if (type === 'company') {
          optionsHTML = comps.map(co => `<option value="${co.id}">${co.name}</option>`).join('');
        }
        idSelect.innerHTML = optionsHTML;
        if (selectedValue) {
          idSelect.value = selectedValue;
        }
      };

      srcTypeSel.addEventListener('change', () => populateEntityDropdown(srcTypeSel, srcIdSel));
      tgtTypeSel.addEventListener('change', () => populateEntityDropdown(tgtTypeSel, tgtIdSel));

      populateEntityDropdown(srcTypeSel, srcIdSel, item ? item.sourceId : null);
      populateEntityDropdown(tgtTypeSel, tgtIdSel, item ? item.targetId : null);
    }, 10);
  }
  else if (activeManageTab === 'memory_fragments') {
    formFieldsHTML = `
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">파편 제목</label>
          <input type="text" id="form-title" class="archive-input" value="${item ? item.title : ''}" required placeholder="예: 빗물에 젖은 편지 봉투">
        </div>
        <div class="form-group">
          <label class="archive-label">열람 등급</label>
          <input type="text" id="form-level" class="archive-input" value="${item ? item.level : 'Level 1 : 내부기록'}" placeholder="예: Level 1 : 내부기록">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="archive-label">수집 출처</label>
          <input type="text" id="form-source" class="archive-input" value="${item ? item.source : ''}" placeholder="예: 민우진의 다이브 기록실">
        </div>
        <div class="form-group">
          <label class="archive-label">수집 시기 (Date Collected)</label>
          <input type="text" id="form-date" class="archive-input" value="${item ? item.date : ''}" placeholder="예: 사후 120년 수집">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:1rem;">
        <label class="archive-label" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
          <input type="checkbox" id="form-enableNoise" ${item && item.enableNoise ? 'checked' : ''}>
          이 기록 열람 시 화면 노이즈 적용 (enableNoise)
        </label>
      </div>
      <div class="form-group">
        <label class="archive-label">기억 조각 본문 (Fragment Content)</label>
        <textarea id="form-content" class="archive-textarea" style="height:120px;" placeholder="기억 속에 각인된 고유한 텍스트 또는 묘사를 기입하십시오.">${item ? item.content : ''}</textarea>
      </div>
    `;
  }

  formContainer.innerHTML = `
    <h3 style="font-size: 1.25rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">${formTitle}</h3>
    <form id="record-form">
      ${formFieldsHTML}
      <div class="btn-group">
        ${selectedManageId ? `
          <button type="button" class="archive-btn archive-btn-danger" id="btn-delete-record">기록 파기 (Delete)</button>
        ` : ''}
        <button type="submit" class="archive-btn archive-btn-primary">아카이브 등록 (Save)</button>
      </div>
    </form>
  `;

  // Attach Image File Upload Handler
  const fileInput = document.getElementById('form-portrait') || document.getElementById('form-emblem') || document.getElementById('form-image');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const label = document.getElementById('file-label-text');
      const previewWrap = document.getElementById('image-preview-wrap') || document.getElementById('emblem-preview-wrap');
      const hiddenInput = document.getElementById('form-portrait-base64') || document.getElementById('form-emblem-base64') || document.getElementById('form-image-base64');

      if (file) {
        label.textContent = `${file.name} 로드 완료.`;
        const reader = new FileReader();
        reader.onload = function(evt) {
          hiddenInput.value = evt.target.result;
          previewWrap.innerHTML = `<img class="file-upload-preview" src="${evt.target.result}" />`;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Handle Form Submission
  const form = document.getElementById('record-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveRecord();
  });

  const deleteBtn = document.getElementById('btn-delete-record');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (confirm('경고: 이 조작은 복구할 수 없습니다. 이 영적 기록물을 아카이브에서 완전히 파기하시겠습니까?')) {
        ArchiveStorage.delete(activeManageTab, selectedManageId);
        selectedManageId = null;
        renderManageTabContent();
        showStatusNotification('기록물이 안전하게 소멸 및 소거되었습니다.');
      }
    });
  }
}

function saveRecord() {
  const records = ArchiveStorage.get(activeManageTab);
  const item = selectedManageId ? records.find(r => r.id === selectedManageId) : null;
  const data = {};

  if (activeManageTab === 'concepts') {
    data.title = document.getElementById('form-title').value;
    data.category = document.getElementById('form-category').value;
    data.symbol = document.getElementById('form-symbol').value;
    data.description = document.getElementById('form-description').value;
    data.details = document.getElementById('form-details').value;
  } 
  else if (activeManageTab === 'companies') {
    data.name = document.getElementById('form-name').value;
    data.nameEn = document.getElementById('form-nameEn').value;
    data.hierarchy = document.getElementById('form-hierarchy').value;
    data.status = document.getElementById('form-status').value;
    data.philosophy = document.getElementById('form-philosophy').value;
    data.description = document.getElementById('form-description').value;
    data.emblem = document.getElementById('form-emblem-base64').value;
    
    const orgRaw = document.getElementById('form-organization').value;
    const lines = orgRaw.split('\n');
    const organization = [];
    lines.forEach(line => {
      if (line.includes(':')) {
        const parts = line.split(':');
        const hq = parts[0].trim();
        const depts = parts[1].split(',').map(d => d.trim()).filter(d => d.length > 0);
        if (hq) {
          organization.push({ headquarters: hq, departments: depts });
        }
      }
    });
    data.organization = organization;
  } 
  else if (activeManageTab === 'characters') {
    data.name = document.getElementById('form-name').value;
    data.affiliationType = document.getElementById('form-affiliationType').value;
    data.affiliationName = document.getElementById('form-affiliationName').value;
    data.affiliationDept = document.getElementById('form-affiliationDept').value;
    data.role = document.getElementById('form-role').value;
    data.status = document.getElementById('form-status').value;
    data.catchphrase = document.getElementById('form-catchphrase').value;
    data.quote = document.getElementById('form-quote').value;
    data.despair = document.getElementById('form-despair').value;
    data.enableNoise = document.getElementById('form-enableNoise').checked;
    data.notes = document.getElementById('form-notes').value;
    data.portrait = document.getElementById('form-portrait-base64').value;

    const tagsRaw = document.getElementById('form-tags').value;
    data.tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }
  else if (activeManageTab === 'incidents') {
    data.code = document.getElementById('form-code').value;
    data.title = document.getElementById('form-title').value;
    data.zanhyang = document.getElementById('form-zanhyang').value;
    data.company = document.getElementById('form-company').value;
    data.sealedSetting = document.getElementById('form-sealedSetting').value;
    data.accessLevel = document.getElementById('form-accessLevel').value;
    data.enableNoise = document.getElementById('form-enableNoise').checked;
    data.report = document.getElementById('form-report').value;
    data.description = document.getElementById('form-description').value;
    data.image = document.getElementById('form-image-base64').value;

    const deptsRaw = document.getElementById('form-jurisdictionDepartments').value;
    data.jurisdictionDepartments = deptsRaw.split(',').map(d => d.trim()).filter(d => d.length > 0);

    const persRaw = document.getElementById('form-personnel').value;
    data.personnel = persRaw.split(',').map(p => p.trim()).filter(p => p.length > 0);

    const tagsRaw = document.getElementById('form-tags').value;
    data.tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }
  else if (activeManageTab === 'games') {
    data.title = document.getElementById('form-title').value;
    data.version = document.getElementById('form-version').value;
    data.status = document.getElementById('form-status').value;
    data.date = document.getElementById('form-date').value;
    data.downloadUrl = document.getElementById('form-downloadUrl').value;
    data.externalUrl = document.getElementById('form-externalUrl').value;
    data.description = document.getElementById('form-description').value;
    data.image = document.getElementById('form-image-base64').value;
    
    const incChecks = document.querySelectorAll('input[name="rel-incidents"]:checked');
    data.relatedIncidents = Array.from(incChecks).map(cb => cb.value);

    const charChecks = document.querySelectorAll('input[name="rel-characters"]:checked');
    data.relatedCharacters = Array.from(charChecks).map(cb => cb.value);

    const projRaw = document.getElementById('form-relatedProjects').value;
    data.relatedProjects = projRaw.split(',').map(p => p.trim()).filter(p => p.length > 0);

    const tagsRaw = document.getElementById('form-tags').value;
    data.tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    data.guestbook = item ? (item.guestbook || []) : [];
  }
  else if (activeManageTab === 'timeline') {
    data.year = document.getElementById('form-year').value;
    data.title = document.getElementById('form-title').value;
    data.level = document.getElementById('form-level').value;
    data.enableNoise = document.getElementById('form-enableNoise').checked;
    data.description = document.getElementById('form-description').value;

    const projRaw = document.getElementById('form-relatedProjects').value;
    data.relatedProjects = projRaw.split(',').map(p => p.trim()).filter(p => p.length > 0);

    const charRaw = document.getElementById('form-relatedCharacters').value;
    data.relatedCharacters = charRaw.split(',').map(c => c.trim()).filter(c => c.length > 0);

    const incRaw = document.getElementById('form-relatedIncidents').value;
    data.relatedIncidents = incRaw.split(',').map(i => i.trim()).filter(i => i.length > 0);
  }
  else if (activeManageTab === 'sealed_documents') {
    data.code = document.getElementById('form-code').value;
    data.title = document.getElementById('form-title').value;
    data.level = document.getElementById('form-level').value;
    data.description = document.getElementById('form-description').value;
    data.unlockMethod = document.getElementById('form-unlockMethod').value;
    data.password = document.getElementById('form-password').value;
    data.warningText = document.getElementById('form-warningText').value;
    data.enableNoise = document.getElementById('form-enableNoise').checked;
    data.content = document.getElementById('form-content').value;
  }
  else if (activeManageTab === 'relationships') {
    data.sourceType = document.getElementById('form-sourceType').value;
    data.sourceId = document.getElementById('form-sourceId').value;
    data.targetType = document.getElementById('form-targetType').value;
    data.targetId = document.getElementById('form-targetId').value;
    data.relation = document.getElementById('form-relation').value;
    data.displayMode = document.getElementById('form-displayMode').value;
    data.description = document.getElementById('form-description').value;
  }
  else if (activeManageTab === 'memory_fragments') {
    data.title = document.getElementById('form-title').value;
    data.level = document.getElementById('form-level').value;
    data.source = document.getElementById('form-source').value;
    data.date = document.getElementById('form-date').value;
    data.enableNoise = document.getElementById('form-enableNoise').checked;
    data.content = document.getElementById('form-content').value;
  }

  if (selectedManageId) {
    ArchiveStorage.update(activeManageTab, selectedManageId, data);
    showStatusNotification('기록 아카이브 데이터가 성공적으로 갱신되었습니다.');
  } else {
    const newItem = ArchiveStorage.add(activeManageTab, data);
    selectedManageId = newItem.id;
    showStatusNotification('새로운 기밀 영적 기록이 아카이브에 인덱싱되었습니다.');
  }

  renderManageTabContent();
}



function showStatusNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 2rem;
    left: 2rem;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--accent-red);
    box-shadow: 0 5px 20px rgba(0,0,0,0.1), 0 0 10px var(--accent-red-glow);
    padding: 1rem 1.5rem;
    font-family: var(--font-serif);
    font-size: 0.9rem;
    z-index: 5000;
    pointer-events: none;
    transform: translateY(20px);
    opacity: 0;
    transition: all 0.4s ease;
  `;
  
  notification.innerHTML = `
    <span class="stamp" style="font-size: 0.6rem; vertical-align: middle; margin-right: 0.5rem; transform:none;">기록 갱신</span>
    <span style="vertical-align: middle;">${message}</span>
  `;

  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
  }, 50);

  setTimeout(() => {
    notification.style.transform = 'translateY(20px)';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 400);
  }, 3500);
}

// ==========================================================================
// CARD DETAILS MODAL WINDOW VIEW
// ==========================================================================
function attachCardClickHandlers() {
  const clickCards = document.querySelectorAll('.click-card');
  clickCards.forEach(card => {
    card.addEventListener('click', () => {
      const type = card.getAttribute('data-type');
      const id = card.getAttribute('data-id');
      openDetailsModal(type, id);
    });
  });
}

function openDetailsModal(type, id) {
  const data = ArchiveStorage.get(type === 'character' ? 'characters' : 'incidents');
  const item = data.find(i => i.id === id);
  if (!item) return;

  currentDetailedItem = item;
  updateScreenNoiseState();

  modalContent.innerHTML = '';
  modalOverlay.classList.add('active');

  const isAdmin = checkAdminSession();
  const editBtnHTML = isAdmin ? `
    <button class="archive-btn archive-btn-primary" id="admin-modal-edit" style="font-size:0.8rem; padding: 0.3rem 0.8rem; margin-left: 1rem; vertical-align: middle; cursor: pointer;">
      ✏️ 아카이브 수정
    </button>
  ` : '';

  if (type === 'character') {
    modalContent.innerHTML = `
      <button class="modal-close-btn" id="modal-close">✕</button>
      
      <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
        <!-- Left Portrait side -->
        <div style="flex: 1; min-width: 240px; display: flex; flex-direction: column;">
          <div class="char-portrait-container" style="height: 300px; margin-bottom: 1rem; background-color:#eae8df;">
            ${item.portrait ? `
              <img class="char-portrait-img" src="${item.portrait}" style="opacity: 0.95;">
            ` : `
              <div class="char-portrait-fallback">殘</div>
            `}
            <div class="funeral-ribbon-diagonal"></div>
          </div>
        </div>

        <!-- Right Metadata side -->
        <div style="flex: 1.5; min-width: 280px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <span class="stamp" style="font-size: 0.65rem; margin-bottom: 0.5rem;">${item.status || '확인 불가'}</span>
            <h2 style="font-size: 2.2rem; line-height: 1.1; margin-bottom: 0.5rem;">
              ${item.name} ${editBtnHTML}
            </h2>
            
            <div style="color: var(--text-secondary); font-size: 1rem; margin-bottom: 1rem;">
              소속: [${item.affiliationType}] ${item.affiliationName} / ${item.affiliationDept || '미배정'}
            </div>

            <!-- Catchphrase & Quote Details (New) -->
            ${item.catchphrase ? `<div class="char-catchphrase" style="font-size:1.1rem; margin-bottom: 0.5rem;">“${item.catchphrase}”</div>` : ''}
            ${item.quote ? `<div class="char-quote-box" style="font-size:1rem; margin-bottom: 1.25rem;">“${item.quote}”</div>` : ''}

            <!-- Revised Personnel Details -->
            <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem; margin-bottom: 1rem;">
              <div><strong style="color: var(--text-muted);">직위/역할:</strong> ${item.role || '요원'}</div>
              <div><strong style="color: var(--text-muted);">상태 분류:</strong> ${item.status || '활동 중'}</div>
              <div><strong style="color: var(--text-muted);">관련 프로젝트:</strong> ${item.relatedProjects && item.relatedProjects.length > 0 ? item.relatedProjects.join(', ') : '없음'}</div>
            </div>

            <div style="font-size: 0.8rem; color: var(--text-secondary); border-top: 1px dashed var(--border-color); padding-top: 0.5rem; margin-bottom: 1rem;">
              <div><strong style="color: var(--text-muted);">태그:</strong> ${item.tags && item.tags.length > 0 ? item.tags.map(t => `#${t}`).join(' ') : '없음'}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="funeral-ribbon"></div>

      <!-- Spoiler Despair Section -->
      <div class="despair-container">
        <div class="despair-title">🕯️ 절망 기록</div>
        <div class="despair-block blurred" id="despair-record-text">
          ${item.despair || '기록된 절망의 흔적이 없습니다.'}
        </div>
        <button class="archive-btn" id="btn-toggle-despair" style="margin-top: 0.75rem; font-size: 0.8rem; padding: 0.3rem 0.8rem; cursor: pointer;">절망 보기</button>
      </div>

      <!-- Notes Section -->
      <div style="margin-bottom: 2rem;">
        <h4 style="font-family: var(--font-serif); font-size: 1rem; color: var(--text-primary); margin-bottom: 0.5rem;">인물 상세 분석 및 설명</h4>
        <p style="font-family: var(--font-serif); font-size: 0.95rem; line-height: 1.8; color: var(--text-secondary); white-space: pre-line; text-indent: 10px; margin-bottom: 0.5rem;">
          ${item.notes}
        </p>
      </div>

      <!-- Relationship Mind-map / Table / Card grid -->
      <div style="margin-bottom: 2rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
          <h4 style="font-family: var(--font-serif); font-size: 1.05rem; color: var(--text-primary); margin:0;">
            관련 기록 / 관계도
          </h4>
          <div class="rel-format-selector" style="display:flex; gap:0.25rem;">
            <button class="archive-btn btn-rel-format active" data-format="mindmap" data-id="${item.id}" style="font-size:0.7rem; padding: 0.2rem 0.5rem; cursor:pointer;">마인드맵</button>
            <button class="archive-btn btn-rel-format" data-format="table" data-id="${item.id}" style="font-size:0.7rem; padding: 0.2rem 0.5rem; cursor:pointer;">테이블</button>
            <button class="archive-btn btn-rel-format" data-format="card" data-id="${item.id}" style="font-size:0.7rem; padding: 0.2rem 0.5rem; cursor:pointer;">카드</button>
          </div>
        </div>
        <div id="character-relations-container">
          ${getCharacterRelationshipsHTML(item.id, 'mindmap')}
        </div>
      </div>

      <!-- Character Remarks (Comments) Section -->
      <div class="guestbook-section">
        <h4 style="font-family: var(--font-serif); font-size: 1.05rem; color: var(--text-primary); margin-bottom: 1rem; border-left: 2px solid var(--accent-red); padding-left: 0.5rem; text-transform: uppercase;">
          잔류 기록
        </h4>

        <!-- Comments Container -->
        <div class="visitor-comments-container" id="char-comments-list">
          <!-- Injected dynamically -->
        </div>

        <!-- Add Comment Form -->
        <div class="review-form-box" style="margin-top: 1.5rem;">
          <h4 style="font-size:0.85rem; margin-bottom:0.75rem; font-family:var(--font-serif);">새로운 잔류 기록 등록</h4>
          <form id="char-comment-form">
            <div style="display:flex; gap:1rem; margin-bottom:0.75rem; flex-wrap:wrap;">
              <div style="flex:1; min-width:150px;">
                <label class="archive-label">성함 또는 칭호</label>
                <input type="text" id="comment-author" class="archive-input" required placeholder="예: 익명의 조율사" style="padding: 0.5rem 0.75rem; font-size: 0.85rem;">
              </div>
              <div>
                <label class="archive-label">기록 분류 (Reaction)</label>
                <select id="comment-reaction" class="archive-select" style="padding: 0.5rem 0.75rem; font-size: 0.85rem; height: 38px; width: 140px;">
                  <option value="🕯️">🕯️ 애도 (Mourn)</option>
                  <option value="✿">✿ 기억 (Remember)</option>
                  <option value="✉">✉ 유언 (Will)</option>
                  <option value="⚖">⚖ 기록 (Record)</option>
                </select>
              </div>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
              <label class="archive-label">기록 내용</label>
              <textarea id="comment-content" class="archive-textarea" required style="min-height:60px; padding: 0.5rem 0.75rem; font-size: 0.85rem;" placeholder="망자에 대한 고요한 추모나 관찰 내용을 기입하십시오."></textarea>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">
                * 기록된 내용은 아카이브 보관망(localStorage)에 보존됩니다.
              </span>
              <button type="submit" class="archive-btn archive-btn-primary" style="padding:0.4rem 1rem; font-size:0.8rem;">기록 전송</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Bind despair button click event
    const toggleDespairBtn = document.getElementById('btn-toggle-despair');
    if (toggleDespairBtn) {
      toggleDespairBtn.addEventListener('click', () => {
        const block = document.getElementById('despair-record-text');
        if (block) {
          if (block.classList.contains('blurred')) {
            block.classList.remove('blurred');
            block.classList.add('revealed');
            toggleDespairBtn.textContent = '절망 감추기';
          } else {
            block.classList.add('blurred');
            block.classList.remove('revealed');
            toggleDespairBtn.textContent = '절망 보기';
          }
        }
      });
    }

    // Render list and bind forms
    renderModalCommentsList(item.id);

    const commentForm = document.getElementById('char-comment-form');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const author = document.getElementById('comment-author').value;
        const content = document.getElementById('comment-content').value;
        const reaction = document.getElementById('comment-reaction').value;

        const newComment = {
          id: `char-comment-${Date.now()}`,
          author: author || "익명의 추모객",
          content: content,
          date: new Date().toISOString().split('T')[0],
          reaction: reaction
        };

        saveCharacterComment(item.id, newComment);

        document.getElementById('comment-author').value = '';
        document.getElementById('comment-content').value = '';

        renderModalCommentsList(item.id);
        showStatusNotification('추모 기록이 정상적으로 인덱싱되었습니다.');

        if (currentRoute === 'character') {
          renderCharacter();
        } else if (currentRoute === 'home') {
          renderHome();
        }
      });
    }
  } 
  else if (type === 'incident') {
    modalContent.innerHTML = `
      <button class="modal-close-btn" id="modal-close">✕</button>
      
      <div style="position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
          <span class="incident-code" style="font-size: 1rem;">${item.code}</span>
        </div>
        <h2 style="font-size: 2.2rem; line-height: 1.2; margin-bottom: 1rem; letter-spacing: 0.05em;">
          ${item.title} ${editBtnHTML}
        </h2>
        
        ${item.image ? `
          <div style="width:100%; max-height:220px; overflow:hidden; border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
            <img src="${item.image}" style="width:100%; height:100%; object-fit:cover; opacity:0.9; filter:grayscale(0.6);" />
          </div>
        ` : ''}

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; border: 1px solid var(--border-color); padding: 1rem; background-color: rgba(0,0,0,0.03); margin-bottom: 1.5rem;">
          <div>
            <strong style="color: var(--text-muted); font-size: 0.75rem; display:block;">잔향 등급</strong>
            <span style="font-size: 0.9rem; color:var(--accent-red); font-weight:600;">${item.zanhyang}</span>
          </div>
          <div>
            <strong style="color: var(--text-muted); font-size: 0.75rem; display:block;">대응 주관처</strong>
            <span style="font-size: 0.9rem;">${item.company || '미지정'}</span>
          </div>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <strong style="color: var(--text-muted); font-size: 0.8rem; display:block; margin-bottom: 0.5rem;">관할 부서</strong>
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
            ${item.jurisdictionDepartments && item.jurisdictionDepartments.length > 0 ? item.jurisdictionDepartments.map(d => `
              <span class="incident-dept-chip">${d}</span>
            `).join('') : '<span style="color: var(--text-muted); font-size: 0.9rem;">지정된 관할 부서가 없습니다.</span>'}
          </div>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <strong style="color: var(--text-muted); font-size: 0.8rem; display:block; margin-bottom: 0.5rem;">연루된 소속 영체</strong>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            ${item.personnel && item.personnel.length > 0 ? item.personnel.map(p => `
              <span class="dept-tag">${p}</span>
            `).join('') : '<span style="color: var(--text-muted); font-size: 0.9rem;">지정된 연루 인물 없음</span>'}
          </div>
        </div>

        <div style="margin-bottom: 1.5rem; border-top: 1px dashed var(--border-color); padding-top: 0.75rem;">
          <strong style="color: var(--text-muted); font-size: 0.8rem; display:block; margin-bottom: 0.25rem;">사건 개요</strong>
          <p style="font-family: var(--font-serif); font-size: 0.95rem; color: var(--text-primary);">${item.description || '개요 미작성'}</p>
        </div>

        <div class="funeral-ribbon"></div>

        <div>
          <h4 style="font-family: var(--font-serif); font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.75rem; border-left: 2px solid var(--accent-red); padding-left: 0.5rem;">사건 기밀 경위 보고서</h4>
          <p style="font-family: var(--font-serif); font-size: 1rem; line-height: 1.8; color: var(--text-secondary); text-indent: 10px; word-break: keep-all; white-space: pre-line;">
            ${item.report}
          </p>
        </div>
      </div>
    `;
  }

  // Bind Close Button
  document.getElementById('modal-close').addEventListener('click', closeDetailsModal);

  // Bind Admin Edit Button
  const adminEditBtn = document.getElementById('admin-modal-edit');
  if (adminEditBtn) {
    adminEditBtn.addEventListener('click', () => {
      closeDetailsModal();
      activeManageTab = type === 'character' ? 'characters' : 'incidents';
      selectedManageId = item.id;
      window.history.pushState({}, '', getResolvedPath('manage'));
      navigate('manage');
    });
  }
}

function initModalClose() {
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeDetailsModal();
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeDetailsModal();
    }
  });
}

function closeDetailsModal() {
  modalOverlay.classList.remove('active');
  currentDetailedItem = null;
  updateScreenNoiseState();
}

// ==========================================================================
// COMPONENT ICON SVGS FOR COMPONENT RENDERING
// ==========================================================================
function getCompanyIconSVG(name) {
  if (name.includes('백화')) {
    return `
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" style="width:100%; height:100%;">
        <circle cx="50" cy="50" r="10"/>
        <circle cx="50" cy="50" r="22" stroke-dasharray="3,3"/>
        <ellipse cx="50" cy="50" rx="30" ry="8" transform="rotate(0 50 50)"/>
        <ellipse cx="50" cy="50" rx="30" ry="8" transform="rotate(30 50 50)"/>
        <ellipse cx="50" cy="50" rx="30" ry="8" transform="rotate(60 50 50)"/>
        <ellipse cx="50" cy="50" rx="30" ry="8" transform="rotate(90 50 50)"/>
        <ellipse cx="50" cy="50" rx="30" ry="8" transform="rotate(120 50 50)"/>
        <ellipse cx="50" cy="50" rx="30" ry="8" transform="rotate(150 50 50)"/>
      </svg>
    `;
  } else if (name.includes('염라')) {
    return `
      <svg viewBox="0 0 100 100" fill="none" stroke="var(--accent-red)" stroke-width="2.5" style="width:100%; height:100%;">
        <circle cx="50" cy="50" r="8" fill="var(--accent-red)"/>
        <path d="M 50 20 Q 55 10 70 15 Q 65 30 50 35 Q 35 30 30 15 Q 45 10 50 20 Z" />
        <path d="M 20 50 Q 10 55 15 70 Q 30 65 35 50 Q 30 35 15 30 Q 10 45 20 50 Z" transform="rotate(45 50 50)" />
        <path d="M 50 80 Q 45 90 30 85 Q 35 70 50 65 Q 65 70 70 85 Q 55 90 50 80 Z" />
        <path d="M 80 50 Q 90 45 85 30 Q 70 35 65 50 Q 70 65 85 70 Q 90 55 80 50 Z" transform="rotate(45 50 50)" />
      </svg>
    `;
  } else if (name.includes('삼도천')) {
    return `
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" style="width:100%; height:100%;">
        <path d="M50 20 C42 40 30 50 30 70 C30 80 40 85 50 85 C60 85 70 80 70 70 C70 50 58 40 50 20 Z" />
        <path d="M50 40 C38 52 20 62 20 75 C20 82 30 85 40 85 C45 85 50 80 50 80 C50 80 55 85 60 85 C70 85 80 82 80 75 C80 62 62 52 50 40 Z" />
      </svg>
    `;
  } else {
    return `
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2" style="width:100%; height:100%;">
        <rect x="30" y="30" width="40" height="40" rx="4" transform="rotate(45 50 50)"/>
        <circle cx="50" cy="50" r="10"/>
      </svg>
    `;
  }
}

// ==========================================================================
// LIGHT/DARK THEME MANAGEMENT
// ==========================================================================
function applyTheme() {
  const currentTheme = localStorage.getItem('zj_theme') || 'light';
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  if (isDark) {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('zj_theme', 'light');
  } else {
    document.body.classList.add('dark-mode');
    localStorage.setItem('zj_theme', 'dark');
  }
  updateNavigationHeader();
}

function isDarkMode() {
  return document.body.classList.contains('dark-mode');
}

// ==========================================================================
// ADMINISTRATIVE SESSION VERIFICATION
// ==========================================================================
function checkAdminSession() {
  const loggedIn = localStorage.getItem('zj_admin_logged_in') === 'true';
  if (!loggedIn) return false;

  const loginTime = parseInt(localStorage.getItem('zj_admin_login_time') || '0');
  const oneHour = 60 * 60 * 1000;
  if (Date.now() - loginTime > oneHour) {
    localStorage.removeItem('zj_admin_logged_in');
    localStorage.removeItem('zj_admin_login_time');
    return false;
  }
  
  // Slide session window active update
  localStorage.setItem('zj_admin_login_time', Date.now().toString());
  return true;
}

// ==========================================================================
// DYNAMIC NAVIGATION HEADER RENDERING
// ==========================================================================
function updateNavigationHeader() {
  const navMenu = document.getElementById('nav-menu');
  if (!navMenu) return;

  const isAdmin = checkAdminSession();
  const depth = getPathDepth();
  const prefix = depth > 0 ? '../' : './';

  navMenu.innerHTML = `
    <li><a href="${prefix}index.html" data-route="home">Home</a></li>
    <li><a href="${prefix}world/index.html" data-route="world">세계관</a></li>
    <li><a href="${prefix}company/index.html" data-route="company">회사</a></li>
    <li><a href="${prefix}character/index.html" data-route="character">인물</a></li>
    <li><a href="${prefix}incident/index.html" data-route="incident">주요사건</a></li>
    <li><a href="${prefix}games/index.html" data-route="games">게임배포</a></li>
    <li><a href="${prefix}manage/index.html" data-route="manage" id="nav-manage">${isAdmin ? '기록관리' : '기록관리 🔒'}</a></li>
    <li><a href="${prefix}admin-login/index.html" data-route="admin-login" id="nav-admin-login">${isAdmin ? '로그아웃' : '로그인'}</a></li>
    <li><button id="theme-toggle" class="theme-toggle-btn" aria-label="테마 전환">${isDarkMode() ? '☀' : '🌙'}</button></li>
  `;

  // Highlight active link
  const links = navMenu.querySelectorAll('a');
  links.forEach(link => {
    const linkRoute = link.getAttribute('data-route');
    if (linkRoute === currentRoute) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Re-bind theme toggle click
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }
}

// ==========================================================================
// ADMIN LOGIN FORM VIEW RENDERING
// ==========================================================================
function renderAdminLogin() {
  appContainer.innerHTML = `
    <section class="hero-section">
      <div class="archive-pretitle">ADMINISTRATIVE ACCESS CONTROL</div>
      <h1 class="archive-title">관리자 인증 콘솔</h1>
      <p class="archive-intro">
        사후 기록물 제어 및 아카이브 데이터 편집 권한을 획득하기 위한 보안 검증 화면입니다.
      </p>
    </section>

    <div style="max-width: 400px; margin: 0 auto 4rem auto;">
      <div class="archive-panel paper-texture">
        <h3 style="font-size:1.1rem; margin-bottom:1.5rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem; text-align:center;">
          아카이브 암호 검증
        </h3>
        <form id="admin-login-form">
          <div class="form-group" style="margin-bottom:1.5rem;">
            <label class="archive-label">보안 인증 암호</label>
            <input type="password" id="admin-password" class="archive-input" required placeholder="인증 코드를 입력하십시오.">
          </div>
          <button type="submit" class="archive-btn archive-btn-primary" style="width:100%;">보안 격리 해제</button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('admin-login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = document.getElementById('admin-password').value;
      const hashed = await hashPassword(pwd);
      const savedHash = localStorage.getItem('zj_admin_password_hash') || DEFAULT_PASSWORD_HASH;

      if (hashed === savedHash) {
        const passwordChanged = localStorage.getItem('zj_password_changed') === 'true';
        if (savedHash === DEFAULT_PASSWORD_HASH && !passwordChanged) {
          // Force password change modal before setting logged-in state
          showPasswordChangeModal(true);
        } else {
          localStorage.setItem('zj_admin_logged_in', 'true');
          localStorage.setItem('zj_admin_login_time', Date.now().toString());
          updateNavigationHeader();
          window.history.pushState({}, '', getResolvedPath('manage'));
          navigate('manage');
          showStatusNotification('관리자 권한이 인증되었습니다.');
        }
      } else {
        showStatusNotification('인증 암호가 일치하지 않습니다.');
      }
    });
  }
}

// ==========================================================================
// ADMIN PASSWORD CHANGE MODAL WINDOW VIEW
// ==========================================================================
function showPasswordChangeModal(force = false) {
  // Check if a modal is already open
  const existing = document.getElementById('pw-change-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pw-change-modal-overlay';
  overlay.className = 'detail-modal-overlay active';
  overlay.style.zIndex = '2100'; // Make sure it sits on top of details modal
  
  overlay.innerHTML = `
    <div class="detail-modal paper-texture" style="max-width: 500px; padding: 2.5rem;">
      ${!force ? '<button class="modal-close-btn" id="pw-modal-close">✕</button>' : ''}
      <div class="archive-pretitle" style="text-align:center;">ADMINISTRATIVE SECURITY CONTROL</div>
      <h2 class="archive-title" style="text-align:center; font-size:1.5rem; margin-top:0.5rem; margin-bottom:1rem; letter-spacing: 0.05em;">
        ${force ? '보안 인증 비밀번호 변경' : '비밀번호 변경'}
      </h2>
      <p class="archive-intro" style="text-align:center; font-size:0.85rem; margin-bottom:1.5rem; color:var(--text-muted); line-height:1.5;">
        ${force 
          ? '시스템 보안을 활성화하기 위해 초기 임시 비밀번호를 반드시 새로운 비밀번호로 변경해야 합니다.' 
          : '아카이브 데이터 관리자의 보안 인증 비밀번호를 수정합니다.'}
      </p>

      <form id="pw-change-form">
        ${!force ? `
        <div class="form-group" style="margin-bottom:1.2rem;">
          <label class="archive-label">현재 비밀번호</label>
          <input type="password" id="pw-current" class="archive-input" required placeholder="현재 비밀번호를 입력하십시오.">
        </div>
        ` : ''}
        <div class="form-group" style="margin-bottom:1.2rem;">
          <label class="archive-label">새 비밀번호 (최소 6자)</label>
          <input type="password" id="pw-new" class="archive-input" required placeholder="새로운 비밀번호를 입력하십시오.">
        </div>
        <div class="form-group" style="margin-bottom:1.8rem;">
          <label class="archive-label">새 비밀번호 확인</label>
          <input type="password" id="pw-confirm" class="archive-input" required placeholder="새로운 비밀번호를 다시 입력하십시오.">
        </div>
        
        <div style="display:flex; gap:0.5rem; justify-content:center;">
          ${!force ? '<button type="button" id="pw-cancel" class="archive-btn" style="flex:1;">취소</button>' : ''}
          <button type="submit" class="archive-btn archive-btn-primary" style="flex:1;">비밀번호 적용</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const form = document.getElementById('pw-change-form');
  const closeBtn = document.getElementById('pw-modal-close');
  const cancelBtn = document.getElementById('pw-cancel');

  const closeModal = () => {
    overlay.remove();
    document.removeEventListener('keydown', handleEsc);
  };

  const handleEsc = (e) => {
    if (e.key === 'Escape' && !force) {
      closeModal();
    }
  };

  if (!force) {
    document.addEventListener('keydown', handleEsc);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    // Close on overlay click if not forced
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newPwd = document.getElementById('pw-new').value;
    const confirmPwd = document.getElementById('pw-confirm').value;

    if (newPwd.length < 6) {
      showStatusNotification('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (newPwd !== confirmPwd) {
      showStatusNotification('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    const newHash = await hashPassword(newPwd);
    if (newHash === DEFAULT_PASSWORD_HASH) {
      showStatusNotification('보안을 위해 초기 비밀번호와 다른 비밀번호를 설정하십시오.');
      return;
    }

    // If not forced, check current password
    if (!force) {
      const currentPwd = document.getElementById('pw-current').value;
      const currentHash = await hashPassword(currentPwd);
      const savedHash = localStorage.getItem('zj_admin_password_hash') || DEFAULT_PASSWORD_HASH;
      if (currentHash !== savedHash) {
        showStatusNotification('현재 비밀번호가 일치하지 않습니다.');
        return;
      }
    }

    // Save new hash
    localStorage.setItem('zj_admin_password_hash', newHash);
    localStorage.setItem('zj_password_changed', 'true');
    
    // Mark as logged in
    localStorage.setItem('zj_admin_logged_in', 'true');
    localStorage.setItem('zj_admin_login_time', Date.now().toString());
    updateNavigationHeader();
    
    showStatusNotification('비밀번호가 성공적으로 변경되었습니다.');
    closeModal();

    if (force) {
      // Complete login redirection now that password is secure
      window.history.pushState({}, '', getResolvedPath('manage'));
      navigate('manage');
    } else {
      // Re-render dashboard
      renderManage();
    }
  });
}

// ==========================================================================
// CHARACTER MEMORIAL REMARKS (COMMENTS) DATA STORE
// ==========================================================================
function getCharacterComments(charId) {
  try {
    const allComments = JSON.parse(localStorage.getItem('zj_character_comments')) || {};
    return allComments[charId] || [];
  } catch (e) {
    console.error('Error loading comments', e);
    return [];
  }
}

// Make functions available globally for internal callbacks
window.getCharacterComments = getCharacterComments;

function saveCharacterComment(charId, comment) {
  try {
    const allComments = JSON.parse(localStorage.getItem('zj_character_comments')) || {};
    if (!allComments[charId]) {
      allComments[charId] = [];
    }
    allComments[charId].push(comment);
    localStorage.setItem('zj_character_comments', JSON.stringify(allComments));
    return true;
  } catch (e) {
    console.error('Error saving comment', e);
    return false;
  }
}

function deleteCharacterComment(charId, commentId) {
  try {
    const allComments = JSON.parse(localStorage.getItem('zj_character_comments')) || {};
    if (allComments[charId]) {
      allComments[charId] = allComments[charId].filter(c => c.id !== commentId);
      localStorage.setItem('zj_character_comments', JSON.stringify(allComments));
      return true;
    }
    return false;
  } catch (e) {
    console.error('Error deleting comment', e);
    return false;
  }
}

function initCharacterComments() {
  if (!localStorage.getItem('zj_comments_initialized')) {
    const seed = {
      "char-1": [
        { id: "cc-1", author: "기록실 실습생", content: "민 과장님은 다이브 이후 항상 3분간 눈을 감고 계십니다. 애도의 여운이겠지요.", date: "2026-05-24", reaction: "🕯️" },
        { id: "cc-2", author: "방문객B", content: "편지 조각 속에 서려 있던 가을 잎새의 냄새가 아직 선명합니다.", date: "2026-05-25", reaction: "✿" }
      ],
      "char-2": [
        { id: "cc-3", author: "인도원 서기", content: "심층 판결실의 현악기 소리는 율법의 엄격함을 소리로 빚어낸 것만 같습니다.", date: "2026-05-23", reaction: "⚖" }
      ]
    };
    localStorage.setItem('zj_character_comments', JSON.stringify(seed));
    localStorage.setItem('zj_comments_initialized', 'true');
  }
}

function renderModalCommentsList(charId) {
  const commentsListContainer = document.getElementById('char-comments-list');
  if (!commentsListContainer) return;

  const comments = getCharacterComments(charId);

  if (comments.length === 0) {
    commentsListContainer.innerHTML = `
      <p style="color:var(--text-muted); font-size:0.85rem; font-style:italic; padding: 1rem 0; text-align:center;">
        등록된 추모 기록이 존재하지 않습니다. 첫 흔적을 남겨보십시오.
      </p>
    `;
    return;
  }

  commentsListContainer.innerHTML = comments.map(comment => `
    <div class="visitor-comment-card">
      <div class="visitor-comment-header">
        <strong style="color:var(--text-primary); font-family:var(--font-serif);">${comment.reaction || '🕯️'} ${comment.author}</strong>
        <div>
          <span style="margin-right: 0.5rem;">${comment.date}</span>
          <button class="char-comment-delete-btn comment-delete-btn" data-comment-id="${comment.id}">[소거]</button>
        </div>
      </div>
      <p class="visitor-comment-content" style="margin-top: 0.25rem;">“${comment.content}”</p>
    </div>
  `).join('');

  // Bind deletion handlers
  const deleteBtns = commentsListContainer.querySelectorAll('.char-comment-delete-btn');
  deleteBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const commentId = btn.getAttribute('data-comment-id');
      if (confirm('이 추모의 기록을 완전히 소거하시겠습니까?')) {
        deleteCharacterComment(charId, commentId);
        renderModalCommentsList(charId);
        showStatusNotification('추모 기록이 소거되었습니다.');
        
        if (currentRoute === 'character') {
          renderCharacter();
        } else if (currentRoute === 'home') {
          renderHome();
        }
      }
    });
  });
}

function updateScreenNoiseState() {
  let shouldEnable = false;
  
  if (currentDetailedItem && currentDetailedItem.enableNoise) {
    shouldEnable = true;
  }
  
  const sealedDocs = ArchiveStorage.get('sealed_documents');
  sealedDocs.forEach(doc => {
    if (unlockedSealedDocuments.has(doc.id) && doc.enableNoise) {
      shouldEnable = true;
    }
  });
  
  if (shouldEnable) {
    document.body.classList.add('noise-active');
  } else {
    document.body.classList.remove('noise-active');
  }
}

function getConnectedEntityName(type, id) {
  if (type === 'character') {
    const chars = ArchiveStorage.get('characters');
    const c = chars.find(item => item.id === id);
    return c ? c.name : id;
  } else if (type === 'incident') {
    const incs = ArchiveStorage.get('incidents');
    const i = incs.find(item => item.id === id || item.code === id);
    return i ? `${i.code} ${i.title}` : id;
  } else if (type === 'company') {
    const comps = ArchiveStorage.get('companies');
    const co = comps.find(item => item.id === id || item.name === id);
    return co ? co.name : id;
  }
  return id;
}

function getCharacterRelationshipsHTML(charId, format = 'mindmap') {
  const relationships = ArchiveStorage.get('relationships');
  const characters = ArchiveStorage.get('characters');
  const incidents = ArchiveStorage.get('incidents');
  const companies = ArchiveStorage.get('companies');
  
  const matches = relationships.filter(rel => 
    (rel.sourceType === 'character' && rel.sourceId === charId) ||
    (rel.targetType === 'character' && rel.targetId === charId)
  );

  if (matches.length === 0) {
    return `<p style="color:var(--text-muted); font-size:0.9rem; font-style:italic;">연동된 기밀 관계/사건 기록이 없습니다.</p>`;
  }

  const resolvedRelations = matches.map(rel => {
    let isSource = rel.sourceType === 'character' && rel.sourceId === charId;
    let peerType = isSource ? rel.targetType : rel.sourceType;
    let peerId = isSource ? rel.targetId : rel.sourceId;
    
    let peerName = '';
    let peerSub = '';
    
    if (peerType === 'character') {
      const c = characters.find(item => item.id === peerId);
      peerName = c ? c.name : peerId;
      peerSub = c ? `[인물] ${c.affiliationName || ''}` : '인물';
    } else if (peerType === 'incident') {
      const i = incidents.find(item => item.id === peerId || item.code === peerId);
      peerName = i ? i.title : peerId;
      peerSub = i ? `[사건] ${i.code}` : '사건';
    } else if (peerType === 'company') {
      const co = companies.find(item => item.id === peerId || item.name === peerId);
      peerName = co ? co.name : peerId;
      peerSub = `[기업] ${peerName}`;
    }

    return {
      peerType,
      peerId,
      peerName,
      peerSub,
      relation: rel.relation,
      description: rel.description
    };
  });

  const currentChar = characters.find(c => c.id === charId);
  const currentCharName = currentChar ? currentChar.name : '본인';

  if (format === 'mindmap') {
    return `
      <div class="relation-mindmap">
        <div class="relation-node-center">${currentCharName}</div>
        <div class="relation-branches">
          ${resolvedRelations.map(rel => `
            <div class="relation-branch-card">
              <div class="relation-label">${rel.relation}</div>
              <strong style="color: var(--text-primary);">${rel.peerName}</strong>
              <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom: 0.25rem;">${rel.peerSub}</div>
              <div class="relation-desc">${rel.description}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (format === 'table') {
    return `
      <div style="overflow-x: auto; margin-top: 1rem; border: 1px solid var(--border-color); border-radius: 4px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; font-family: var(--font-serif); text-align: left;">
          <thead>
            <tr style="background-color: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
              <th style="padding: 0.6rem 1rem; color: var(--text-primary); width: 25%;">대상</th>
              <th style="padding: 0.6rem 1rem; color: var(--text-primary); width: 20%;">종류</th>
              <th style="padding: 0.6rem 1rem; color: var(--text-primary); width: 20%;">관계 정의</th>
              <th style="padding: 0.6rem 1rem; color: var(--text-primary); width: 35%;">상세 내역</th>
            </tr>
          </thead>
          <tbody>
            ${resolvedRelations.map(rel => `
              <tr style="border-bottom: 1px solid var(--border-color); background-color: var(--bg-panel);">
                <td style="padding: 0.6rem 1rem; font-weight: 600;">${rel.peerName}</td>
                <td style="padding: 0.6rem 1rem; color: var(--text-secondary);">${rel.peerSub}</td>
                <td style="padding: 0.6rem 1rem; color: var(--accent-red);">${rel.relation}</td>
                <td style="padding: 0.6rem 1rem; color: var(--text-secondary);">${rel.description}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (format === 'card') {
    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem;">
        ${resolvedRelations.map(rel => `
          <div class="archive-panel paper-texture" style="padding: 1rem; font-size: 0.85rem; border: 1px solid var(--border-color); background-color: var(--bg-panel);">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; align-items:center;">
              <span class="stamp" style="font-size:0.6rem; transform:none; padding: 0.1rem 0.3rem;">${rel.relation}</span>
              <span style="font-size:0.7rem; color:var(--text-muted);">${rel.peerSub}</span>
            </div>
            <h5 style="font-size: 1rem; font-family: var(--font-serif); margin-bottom:0.5rem; color: var(--text-primary);">${rel.peerName}</h5>
            <p style="font-size:0.75rem; color:var(--text-secondary); line-height: 1.4;">${rel.description}</p>
          </div>
        `).join('')}
      </div>
    `;
  }
  return '';
}

function renderTimeline() {
  const timeline = ArchiveStorage.get('timeline');
  if (timeline.length === 0) {
    return `<p style="color:var(--text-muted); text-align:center; padding: 2rem 0;">등록된 세계관 연표 기록이 없습니다.</p>`;
  }

  const itemsHTML = timeline.map(item => {
    return `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-year">${item.year}</div>
        <div class="archive-panel timeline-card paper-texture" style="background-color: var(--bg-panel);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <h4 style="font-size: 1.15rem; font-family: var(--font-serif);">${item.title}</h4>
            <span class="stamp" style="font-size: 0.65rem;">${item.level}</span>
          </div>
          <p style="font-family: var(--font-serif); font-size: 0.95rem; color: var(--text-secondary); line-height: 1.7; word-break:keep-all;">
            ${item.description}
          </p>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.75rem; display:flex; flex-wrap:wrap; gap:0.75rem; border-top: 1px dashed var(--border-color); padding-top: 0.5rem;">
            ${item.relatedProjects && item.relatedProjects.length > 0 ? `<span><strong>연계 프로젝트:</strong> ${item.relatedProjects.join(', ')}</span>` : ''}
            ${item.relatedCharacters && item.relatedCharacters.length > 0 ? `<span><strong>연계 인물:</strong> ${item.relatedCharacters.join(', ')}</span>` : ''}
            ${item.relatedIncidents && item.relatedIncidents.length > 0 ? `<span><strong>연계 사건:</strong> ${item.relatedIncidents.join(', ')}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="timeline-container">
      ${itemsHTML}
    </div>
  `;
}

function renderWorldVaults() {
  const memoryFragments = ArchiveStorage.get('memory_fragments');
  const sealedDocuments = ArchiveStorage.get('sealed_documents');

  // Left Column: Memory Fragments
  const fragsHTML = memoryFragments.map(frag => `
    <div class="archive-panel paper-texture" style="margin-bottom: 1.5rem; border-left: 2.5px solid var(--accent-red); background-color: var(--bg-panel);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
        <span class="stamp" style="font-size: 0.65rem;">${frag.level}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${frag.date || ''}</span>
      </div>
      <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem; font-family: var(--font-serif); color: var(--text-primary);">${frag.title}</h4>
      <p style="font-family: var(--font-serif); font-size: 0.95rem; line-height: 1.7; color: var(--text-secondary); white-space: pre-line;">
        “${frag.content}”
      </p>
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.75rem; text-align: right; border-top: 1px dashed var(--border-color); padding-top: 0.4rem;">
        수집 출처: ${frag.source || '미기입'}
      </div>
    </div>
  `).join('') || '<p style="color:var(--text-muted); font-size:0.9rem; font-style:italic;">기억 파편이 존재하지 않습니다.</p>';

  // Right Column: Sealed Documents
  const docsHTML = sealedDocuments.map(doc => {
    const isUnlocked = unlockedSealedDocuments.has(doc.id) || (doc.unlockMethod === 'admin' && checkAdminSession());
    
    if (isUnlocked) {
      return `
        <div class="sealed-doc-card" id="doc-${doc.id}">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
            <div>
              <span class="stamp stamp-sealed" style="font-size: 0.65rem; margin-bottom: 0.5rem;">${doc.level}</span>
              <h4 style="font-size: 1.15rem; margin-bottom: 0.25rem; font-family: var(--font-serif); color: var(--text-primary);">${doc.title}</h4>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${doc.description}</div>
            </div>
            <button class="archive-btn btn-lock-doc" data-id="${doc.id}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; cursor: pointer;">다시 봉인</button>
          </div>
          <div class="sealed-content-body">
            ${doc.content}
          </div>
        </div>
      `;
    } else {
      let securityInputHTML = '';
      if (doc.unlockMethod === 'click') {
        securityInputHTML = `
          <button class="archive-btn archive-btn-primary btn-unlock-click" data-id="${doc.id}" style="margin-top: 1rem; width:100%; cursor: pointer;">문서 영적 봉인 해제</button>
        `;
      } else if (doc.unlockMethod === 'password') {
        securityInputHTML = `
          <div style="margin-top: 1rem; display:flex; gap:0.5rem;">
            <input type="password" class="archive-input vault-pw-input" placeholder="암호를 입력하십시오" style="flex:1; font-size:0.85rem; padding: 0.4rem 0.6rem; height:34px;">
            <button class="archive-btn archive-btn-primary btn-unlock-pw" data-id="${doc.id}" style="font-size:0.8rem; padding: 0.4rem 0.8rem; height:34px; cursor: pointer;">해독</button>
          </div>
        `;
      } else if (doc.unlockMethod === 'admin') {
        securityInputHTML = `
          <div style="margin-top: 1rem; font-size:0.8rem; color: var(--accent-red); font-family:var(--font-serif); border: 1px dashed var(--accent-red); padding: 0.5rem; background-color: rgba(143,28,31,0.02);">
            [보안 등급 부족] 관리자 세션 로그인이 필요한 기밀 봉인 문서입니다.
          </div>
        `;
      }

      return `
        <div class="sealed-doc-card sealed" id="doc-${doc.id}">
          <div class="sealed-overlay">
            <div style="font-size: 1.7rem; margin-bottom: 0.5rem; color: var(--accent-red);">🔒</div>
            <h4 style="font-size: 1.1rem; margin-bottom: 0.25rem; font-family: var(--font-serif); color: var(--accent-red);">${doc.title}</h4>
            <span class="stamp" style="font-size: 0.65rem; margin-bottom: 0.75rem;">${doc.level}</span>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.5rem 0; word-break:keep-all;">
              ${doc.warningText || '보안 격벽이 활성화되어 있어 요약 정보를 볼 수 없습니다.'}
            </p>
            ${securityInputHTML}
          </div>
        </div>
      `;
    }
  }).join('') || '<p style="color:var(--text-muted); font-size:0.9rem; font-style:italic;">봉인 문서가 존재하지 않습니다.</p>';

  return `
    <div class="vault-grid">
      <div>
        <h3 style="font-family: var(--font-serif); font-size: 1.3rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; color: var(--text-primary);">
          ✿ 기억 파편
        </h3>
        ${fragsHTML}
      </div>
      <div>
        <h3 style="font-family: var(--font-serif); font-size: 1.3rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; color: var(--text-primary);">
          ⚖ 봉인 문서 보관소
        </h3>
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
          ${docsHTML}
        </div>
      </div>
    </div>
  `;
}

function initVaultEventHandlers() {
  document.addEventListener('click', (e) => {
    // 1. Click unlock
    const unlockClickBtn = e.target.closest('.btn-unlock-click');
    if (unlockClickBtn) {
      const docId = unlockClickBtn.getAttribute('data-id');
      unlockedSealedDocuments.add(docId);
      updateScreenNoiseState();
      renderWorld();
      showStatusNotification('문서 봉인이 영적 각인으로 해제되었습니다.');
      return;
    }

    // 2. Password unlock
    const unlockPwBtn = e.target.closest('.btn-unlock-pw');
    if (unlockPwBtn) {
      const docId = unlockPwBtn.getAttribute('data-id');
      const card = e.target.closest('.sealed-doc-card');
      const pwInput = card.querySelector('.vault-pw-input');
      const password = pwInput ? pwInput.value : '';
      
      const doc = ArchiveStorage.get('sealed_documents').find(d => d.id === docId);
      if (doc && doc.password === password) {
        unlockedSealedDocuments.add(docId);
        updateScreenNoiseState();
        renderWorld();
        showStatusNotification('암호가 정상 해독되었습니다.');
      } else {
        showStatusNotification('경고: 인증 암호가 부정확합니다.');
      }
      return;
    }

    // 3. Lock again
    const lockBtn = e.target.closest('.btn-lock-doc');
    if (lockBtn) {
      const docId = lockBtn.getAttribute('data-id');
      unlockedSealedDocuments.delete(docId);
      updateScreenNoiseState();
      renderWorld();
      showStatusNotification('문서가 다시 암호화 봉인되었습니다.');
      return;
    }

    // 4. Relation Format Selector Click
    const relBtn = e.target.closest('.btn-rel-format');
    if (relBtn) {
      const format = relBtn.getAttribute('data-format');
      const charId = relBtn.getAttribute('data-id');
      const container = document.getElementById('character-relations-container');
      if (container) {
        container.innerHTML = getCharacterRelationshipsHTML(charId, format);
        const buttons = relBtn.closest('.rel-format-selector').querySelectorAll('.btn-rel-format');
        buttons.forEach(btn => {
          if (btn === relBtn) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }
      return;
    }
  });

  // Handle enter key on password input
  document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const pwInput = e.target.closest('.vault-pw-input');
      if (pwInput) {
        e.preventDefault();
        const card = pwInput.closest('.sealed-doc-card');
        const submitBtn = card.querySelector('.btn-unlock-pw');
        if (submitBtn) {
          submitBtn.click();
        }
      }
    }
  });
}
