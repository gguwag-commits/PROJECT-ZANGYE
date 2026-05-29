/**
 * PROJECT : 잔계 (殘界) - Residual Afterlife Corporate Archive
 * Data Layer & LocalStorage Manager (Revised for Bright Theme & Games Console)
 */

const DEFAULT_CONCEPTS = [
  {
    id: "concept-1",
    title: "죽은 영혼",
    category: "영체 분류",
    description: "육체의 죽음 이후 사후 세계로 유입된 의식의 잔해. 현세에서의 기억과 감정 상태에 따라 다양한 보존 등급으로 분류됩니다.",
    details: "사망 시점의 뇌파와 감정적 충격에 따라 영혼은 안정형부터 붕괴형까지 총 5단계로 나뉩니다. 사후 법인들은 이 영혼들을 안전하게 분해하거나, 정화하여 다음 단계로 환생시키거나, 영구 보존하는 업무를 수행합니다. 특히 강한 미련을 가진 영혼은 소멸 과정에서 유해한 잔류 기억을 방출하므로 특별 관리가 필요합니다.",
    symbol: "魂"
  },
  {
    id: "concept-2",
    title: "잔류 기억",
    category: "기록 물질",
    description: "영혼이 붕괴되거나 소멸할 때 남기는 고농도의 감정 정보. 물리적 혹은 영적 공간에 고착되어 왜곡된 왜곡장을 형성합니다.",
    details: "잔류 기억은 단순히 지나간 기억이 아니라, 시각화되고 물리적 영향력을 행사할 수 있는 반-에너지 물질입니다. 한 서린 기억은 주변 사물을 오염시키며, 이를 방치할 경우 공간 자체가 정서 재난 지역으로 변질됩니다. 사후 기업들은 이 잔류 기억을 특수 기록 매체에 흡수하여 암호화 보존 처리합니다.",
    symbol: "憶"
  },
  {
    id: "concept-3",
    title: "정서 재난",
    category: "기상 재해",
    description: "미해결된 원념과 슬픔, 증오 등의 잔류 기억들이 임계점을 넘어 융합되면서 발생하는 초자연적 감정 변형 현상.",
    details: "가장 흔한 등급의 재난은 '만가(輓歌) 폭풍'으로, 폭풍 내부에 진입한 영혼들은 사망 시점의 트라우마를 무한히 재경험하게 됩니다. 2급 이상의 정서 재난은 현실 장벽을 일시적으로 침식하여 산 자의 세계에 환각이나 물리적 붕괴를 일으키기도 합니다. 모든 사후 법인은 재난 발생 즉시 진압 및 오염원 차단 의무를 지닙니다.",
    symbol: "災"
  },
  {
    id: "concept-4",
    title: "미해결 의식",
    category: "영적 특이점",
    description: "육체의 소멸을 인지하지 못하거나 극단적인 부정으로 인해 저승의 인도 절차를 거부하고 정체된 사후 자아.",
    details: "자신이 죽었다는 사실 자체를 거부하는 의식으로, 스스로 만든 왜곡된 기억 공간(루프) 속에 갇혀 살아가게 됩니다. 백화상조의 주요 업무 중 하나는 이들의 기억 루프에 침입해 현실을 자각시키고 마지막 애도를 집행함으로써 의식을 해방하는 것입니다.",
    symbol: "結"
  }
];

const DEFAULT_COMPANIES = [
  {
    id: "company-1",
    name: "백화상조 (白花喪弔)",
    nameEn: "BAEKHWA SANGJO",
    philosophy: "마지막 순간의 애도를 통해 영혼의 온전한 소멸을 돕는다.",
    organization: [
      {
        headquarters: "기록관리본부",
        departments: ["잔류기록부", "문서봉인과", "기억분류실"]
      },
      {
        headquarters: "의식운영본부",
        departments: ["장례의식부", "호흡등록과"]
      }
    ],
    status: "정상 운영 (기록 보유량 최다)",
    hierarchy: "사후 행정원 산하 특수 집행 법인",
    description: "망자의 유해와 마지막 정서를 기록하고 장례 절차를 집행하여 안전한 소멸을 인도하는 국영 애도 법인. 가장 오래된 사후 기업 중 하나로, 수많은 망자의 마지막 소원과 유언을 암호화하여 '백화 전당(白花殿)'에 영구히 보존하고 있습니다.",
    emblem: "" 
  },
  {
    id: "company-2",
    name: "염라관리공단 (閻羅管理公團)",
    nameEn: "YEOMRA CONTROL BOARD",
    philosophy: "철저한 율법과 수치화된 감정 통제를 통해 정서적 균형을 유지한다.",
    organization: [
      {
        headquarters: "영체심사처",
        departments: ["기초대기과", "심층판결실"]
      },
      {
        headquarters: "정서치안본부",
        departments: ["치안국", "재난대응반"]
      }
    ],
    status: "경계 상태 (정서 재난 급증 대응 중)",
    hierarchy: "중앙 사법 정화 연합회 직속 공기업",
    description: "모든 유입 영혼의 공과 과를 수치로 환산하고, 영혼의 파동 및 공명 수치를 통제하는 초국가적 사후 사법 기관. 감정의 과잉으로 인한 정서 재난을 예방하고 차단하기 위해 엄격한 영혼 모니터링 시스템을 가동하며, 법률 위반 영체를 감금 및 격리합니다.",
    emblem: ""
  },
  {
    id: "company-3",
    name: "삼도천 물류 (三途川物流)",
    nameEn: "SAMDOCHEON LOGISTICS",
    philosophy: "가장 무거운 기억조차 안전하게 흐르고 도달하도록 운반한다.",
    organization: [
      {
        headquarters: "운송관리본부",
        departments: ["영로개척과", "배차운영실"]
      },
      {
        headquarters: "보안본부",
        departments: ["화물보안팀", "유품운송지부"]
      }
    ],
    status: "주의 (구역간 영적 전이 불안정)",
    hierarchy: "민간 자본 연합 수송 운송 협회",
    description: "잔계의 광활한 영적 영역들 사이에서 영혼들과 추출된 잔류 기억, 유품을 안전하게 운송하는 종합 물류 법인. 삼도천의 거친 파동을 억제하고 새로운 항로를 개척하여 고립된 소외 영혼들을 본토 아카이브로 이송하는 특수 임무를 수행합니다.",
    emblem: ""
  }
];

const DEFAULT_CHARACTERS = [
  {
    id: "char-1",
    name: "민우진",
    affiliationType: "회사",
    affiliationName: "백화상조 (白花喪弔)",
    affiliationDept: "기억수집과",
    role: "과장 / 기억수집가",
    status: "활동 중 (유보 상태)",
    catchphrase: "죽음 이후에도 출근하는 기록관",
    quote: "이름은 가장 오래 남는 오염입니다.",
    notes: "백화상조의 베테랑 기억수집가. 망자의 깊은 원한 속에 직접 다이브하여 정서를 정화하는 능력이 탁월하나, 고독한 단독 임무를 고집하는 경향이 있음.",
    despair: "망자의 기억 속에 너무 깊이 다이브한 나머지, 자신이 현세에서 사랑했던 가족의 얼굴조차 기억하지 못합니다. 백화상조 금고에 보관된 어떤 편지가 사실 자신의 유언장이라는 것을 직감하면서도, 이를 열어볼 권한이 없어 매일 밤 남의 기억 속을 방황하고 있습니다.",
    relatedProjects: ["PJT-애도기록"],
    tags: ["기억수집", "베테랑"],
    portrait: "",
    enableNoise: false
  },
  {
    id: "char-2",
    name: "연해인",
    affiliationType: "회사",
    affiliationName: "염라관리공단 (閻羅管理公團)",
    affiliationDept: "영체심사처",
    role: "수석 판관",
    status: "경고 (정서 과공명 감지)",
    catchphrase: "율법과 주파수의 조율사",
    quote: "모든 슬픔은 격리되어 수치로 수렴될 뿐입니다.",
    notes: "공명 수치를 분석하여 영체의 다음 행선지를 심사하는 냉철한 성격의 수석 판관. 법과 규칙을 엄격하게 고수하나 최근 규격 외의 감정 주파수를 지닌 영체를 만나 공명 수치가 비정상적으로 급증함.",
    despair: "타인의 주파수를 분류하고 율법을 엄수해 왔으나, 자신에게 부여된 판결의 기한이 이미 만료되었음을 뒤늦게 깨달았습니다. 자신이 단지 공단의 시스템 유지를 위해 만들어진 기계적 영체(인공지능 잔재)에 불과하며, 스스로를 위한 어떤 환생이나 소멸조차 허락되지 않는다는 사실에 절망하고 있습니다.",
    relatedProjects: ["PJT-율법정비"],
    tags: ["판관", "규정준수"],
    portrait: "",
    enableNoise: false
  },
  {
    id: "char-3",
    name: "지호식",
    affiliationType: "회사",
    affiliationName: "삼도천 물류 (三途川物流)",
    affiliationDept: "영로개척과",
    role: "운송기사",
    status: "실종 (수색 진행 중)",
    catchphrase: "삼도천 서부의 항로 개척기사",
    quote: "안개 속에서 들리는 소리는 무조건 무시해야 해.",
    notes: "삼도천 서부 지류의 극도로 불안정한 영로를 개척하던 운송 기사. 최근 불법으로 반출된 '잔류 기억 봉인석'을 운송하던 중 갑작스럽게 발생한 정서 폭풍에 휩쓸려 행방이 묘연해짐.",
    despair: "그가 운송하던 봉인석은 사실 자신의 깨진 기억의 핵이었습니다. 삼도천 서부의 깊은 안개 속에서 마주한 것은 적조의 괴물이 아니라, 자신이 살아서 겪었던 가장 치욕스럽고 어두운 도피의 순간이었으며, 그는 스스로 그 기억 속으로 빠져들어가 구출을 거부하고 있습니다.",
    relatedProjects: ["PJT-삼도수송"],
    tags: ["운송", "실종자"],
    portrait: "",
    enableNoise: true
  }
];

const DEFAULT_INCIDENTS = [
  {
    id: "incident-1",
    code: "INC-092",
    title: "서부 망량의 난",
    zanhyang: "적조",
    company: "염라관리공단 (閻羅管理公團)",
    jurisdictionDepartments: ["재난대응반", "영로개척과"],
    personnel: ["지호식", "민우진"],
    report: "삼도천 서부 지류에서 수백 년간 정체되어 있던 기억 파편들이 동시다발적으로 공명하며 거대한 망가 폭풍을 형성함. 폭풍의 중심에서 오래전 유실된 것으로 판명되었던 백화상조의 임시 아카이브 창고 일부가 실체화되는 초자연적 비현실화 현상이 관측됨. 본부 치안국이 급히 파견되어 장벽을 보수했으나, 기사 지호식이 폭풍 내부로 함몰되며 실종됨.",
    description: "삼도천 운송 루트 붕괴 및 아카이브 일부 침식 사고.",
    tags: ["재난", "삼도천"],
    image: "",
    sealedSetting: "unsealed",
    accessLevel: "Level 2 : 제한열람",
    enableNoise: true
  },
  {
    id: "incident-2",
    code: "INC-404",
    title: "백화 전당 기록 누출 사태",
    zanhyang: "잔화",
    company: "백화상조 (白花喪弔)",
    jurisdictionDepartments: ["기록해제실", "영체심사처"],
    personnel: ["민우진", "연해인"],
    report: "망자의 유언과 미련이 보존된 백화 전당 제4금고의 보안 진공 격벽에 균열이 생겨 수십 편의 망자 유언장이 잔계 전역의 공공 통신망으로 누출됨. 해당 기록들은 '염라관리공단'에 의해 규격 외 감정 오염물로 임시 분류되어 차단 조치됨. 조사 결과 외부 침입 흔적은 없으며, 영혼들 자체의 공명이 격벽을 붕괴시킨 것으로 추측됨. 연해인 판관이 조사 총괄로 임명됨.",
    description: "사후 보관소 금고 격벽 붕괴 및 유언장 외부 유출 사건.",
    tags: ["기밀유출", "기록관실"],
    image: "",
    sealedSetting: "unsealed",
    accessLevel: "Level 2 : 제한열람",
    enableNoise: false
  }
];

const DEFAULT_GAMES = [
  {
    id: "game-1",
    title: "망량의 흔적",
    version: "v1.2.0",
    status: "배포중",
    downloadUrl: "https://zj-archive.github.io/mourning-echoes/download",
    externalUrl: "https://zj-archive.github.io/mourning-echoes",
    description: "삼도천 서부 지류에서 발생한 정서 폭풍에 갇힌 운전사의 무선 통신 신호를 해독해 추적하는 아날로그 감정 오퍼레이터 시뮬레이션 게임입니다. 백화상조 기록관 시점에서 실종 기사의 유언 단서를 분석해 나가야 합니다.",
    relatedProjects: ["PJT-삼도수송", "PJT-애도기록"],
    relatedIncidents: ["INC-092"],
    relatedCharacters: ["지호식", "민우진"],
    image: "",
    date: "2026-05-15",
    tags: ["텍스트어드벤처", "사후세계", "기밀아카이브"],
    enableNoise: false,
    guestbook: [
      { id: "g-1", rating: 5, author: "방문객A", content: "특유의 차분하면서도 묵직한 가라앉은 분위기가 마음에 들어요.", date: "2026-05-20" },
      { id: "g-2", rating: 4, author: "기록보존과", content: "localStorage로 이뤄진 시스템 보관망 테마가 정말 잘 어울립니다.", date: "2026-05-22" }
    ]
  },
  {
    id: "game-2",
    title: "PROJECT : 잔계 - 기록실 체험판",
    version: "v0.1.0",
    status: "제작중",
    downloadUrl: "#",
    externalUrl: "#",
    description: "잔계 세계관의 기록실을 탐색하며 인물, 사건, 봉인문서를 확인하는 짧은 체험판입니다.",
    relatedProjects: ["잔계 기록실"],
    relatedIncidents: ["INC-001"],
    relatedCharacters: ["서유진", "강림"],
    image: "",
    date: "2026-05-26",
    tags: ["체험판", "세계관", "기록실", "어드벤처"],
    enableNoise: false,
    guestbook: []
  }
];

const DEFAULT_TIMELINE = [
  {
    id: "time-1",
    year: "사후력 03년",
    title: "사후 법인 연합 공동 서고(書庫) 인가",
    description: "잔계에 잔류한 영혼의 사후 유품 수송 및 감정 정화 절차를 체계적으로 기록하기 위해 백화상조 주도로 '공동 아카이브' 설립 조약이 인가되었습니다.",
    level: "Level 1 : 내부기록",
    relatedProjects: ["PJT-애도기록"],
    relatedCharacters: ["민우진"],
    relatedIncidents: [],
    enableNoise: false
  },
  {
    id: "time-2",
    year: "사후력 12년",
    title: "염라 치안본부 및 재난대응부서 신설",
    description: "이상 감정 공명으로 인한 공간 균열과 침식 현상(정서 재난)이 빈번해짐에 따라 염라관리공단이 발족하였으며, 율법에 의거한 격리 단속이 시행되었습니다.",
    level: "Level 1 : 내부기록",
    relatedProjects: ["PJT-율법정비"],
    relatedCharacters: ["연해인"],
    relatedIncidents: [],
    enableNoise: false
  },
  {
    id: "time-3",
    year: "사후력 105년",
    title: "서부 삼도천 침식 사고 (INC-092)",
    description: "삼도천 서부 지류에서 보관함 봉인이 침식되면서 거대한 망가 폭풍이 발생하였습니다. 이 사고로 삼도천 물류 운송 기사 지호식 요원이 폭풍 속으로 실종되었습니다.",
    level: "Level 2 : 제한열람",
    relatedProjects: ["PJT-삼도수송"],
    relatedCharacters: ["지호식", "민우진"],
    relatedIncidents: ["INC-092"],
    enableNoise: true
  }
];

const DEFAULT_SEALED_DOCUMENTS = [
  {
    id: "sealed-1",
    code: "DOC-01",
    title: "백화상조 극비 다이브 안전 규정",
    level: "Level 3 : 봉인기록",
    description: "기억 수집 요원의 영혼 침식 방지를 위한 동기화 지침서.",
    warningText: "[경고] 본 문서는 영체 기억 속으로 다이브하는 현장 요원들의 정신 붕괴와 동기화 오염을 막기 위한 지침입니다. 열람 시 잔류 감정 전이 위험이 있습니다.",
    unlockMethod: "click",
    password: "",
    content: "기억 수집 요원은 망자의 의식에 다이브할 때 180초를 초과하여 동화되어서는 안 됩니다. 이를 초과할 경우 자신의 현세 기억과 망자의 미련이 섞이는 '기억 침식 현상'이 일어나 영구 격리 구역으로 이송될 수 있습니다.",
    enableNoise: false
  },
  {
    id: "sealed-2",
    code: "DOC-02",
    title: "삼도천 침식 분석 보고서 (INC-092 분석본)",
    level: "Level 2 : 제한열람",
    description: "INC-092 당시 수거된 차량 기록 장치의 암호 해독본.",
    warningText: "[기밀] INC-092 (서부 망량의 난) 당시 수거된 차량 기록 장치의 암호 해독 기록입니다. 암호는 해당 사건 코드를 대문자로 기입하십시오.",
    unlockMethod: "password",
    password: "INC-092",
    content: "지호식 요원의 차량은 안개 속에서 비정상적인 징 소리와 환각에 노출되었던 것으로 확인되었습니다. 삼도천 물류 보안팀은 당시 차량에 적재되어 있던 봉인석이 단순 탈취가 아닌 내부인의 공모에 의한 폭주였을 가능성을 강하게 시사하고 있습니다.",
    enableNoise: true
  },
  {
    id: "sealed-3",
    code: "DOC-03",
    title: "수인(囚人) 1급 격리자 명부",
    level: "Level 4 : 관리자전용",
    description: "자아 붕괴 영체 중 특이 현상을 보이는 격리자 세부 명단.",
    warningText: "[통제] 관리자 등급 전용 격리자 기록부입니다. 관리자 세션이 로그인된 브라우저에서만 자동 잠금 해제됩니다.",
    unlockMethod: "admin",
    password: "",
    content: "염라관리공단 지하 깊은 곳에 봉인된 영체들은 자아가 완전히 붕괴되었으나, 잔향 수치가 E등급(공백) 상태를 유지하고 있어 소멸이 불가능합니다. 이 중 '서유진'으로 식별된 영체는 자가 공명을 통해 주변의 소리 장벽을 지속적으로 균열시키는 특이 행동을 보이고 있습니다.",
    enableNoise: true
  }
];

const DEFAULT_RELATIONSHIPS = [
  {
    id: "rel-1",
    sourceType: "character",
    sourceId: "char-1",
    targetType: "character",
    targetId: "char-3",
    relation: "추적자 / 실종자",
    description: "민우진은 서부 망량의 난으로 실종된 지호식을 구출하기 위해 삼도천의 위험 지역을 자발적으로 모니터링 중입니다.",
    displayMode: "mindmap"
  },
  {
    id: "rel-2",
    sourceType: "character",
    sourceId: "char-2",
    targetType: "character",
    targetId: "char-1",
    relation: "감시자 / 피규제자",
    description: "연해인은 민우진의 기억 침식 위험 수치가 한계점에 근접하자, 그의 다이브 횟수와 백화 전당 접근 권한을 철저히 제한하고 감시하고 있습니다.",
    displayMode: "mindmap"
  },
  {
    id: "rel-3",
    sourceType: "character",
    sourceId: "char-3",
    targetType: "incident",
    targetId: "incident-1",
    relation: "실종 피해자",
    description: "서부 망량의 난 발생 당시 물류 차량 운송 중 폭풍 속으로 삼켜져 실종 처리되었습니다.",
    displayMode: "table"
  }
];

const DEFAULT_MEMORY_FRAGMENTS = [
  {
    id: "frag-1",
    title: "빗물에 젖은 편지 봉투",
    content: "보내는 이의 이름 부분이 검게 얼룩져 읽을 수 없다. '...내가 그곳에 도착할 때쯤엔 모든 꽃이 졌겠지...'라는 문장만 겨우 판독된다.",
    level: "Level 1 : 내부기록",
    source: "민우진의 다이브 기록실",
    date: "사후 120년 수집",
    enableNoise: false
  },
  {
    id: "frag-2",
    title: "녹슨 톱니바퀴 회중시계",
    content: "오전 03시 14분에 바늘이 멈춰 서 있다. 태엽을 감아도 더 이상 작동하지 않으며, 초침을 돌리려고 하면 멀리서 징 소리가 희미하게 울려 퍼진다.",
    level: "Level 2 : 제한열람",
    source: "지호식 요원의 삼도 유품",
    date: "사후 15년 수집",
    enableNoise: true
  }
];

export class ArchiveStorage {
  static migrateEnglishParentheses() {
    const cleanStr = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/\s*\([A-Za-z\s\-]+\)/g, "").trim();
    };

    const cleanArray = (arr) => {
      if (!Array.isArray(arr)) return arr;
      return arr.map(cleanStr);
    };

    // Migrate existing entries in localStorage
    const keys = ["concepts", "characters", "incidents", "games", "timeline"];
    keys.forEach(key => {
      try {
        const raw = localStorage.getItem(`zj_${key}`);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            let changed = false;
            list.forEach(item => {
              if (key === "concepts" || key === "incidents" || key === "games" || key === "timeline") {
                const oldTitle = item.title;
                item.title = cleanStr(item.title);
                if (oldTitle !== item.title) changed = true;
              }
              if (key === "characters") {
                const oldName = item.name;
                item.name = cleanStr(item.name);
                if (oldName !== item.name) changed = true;
              }
              if (key === "incidents" && item.personnel) {
                const oldPers = JSON.stringify(item.personnel);
                item.personnel = cleanArray(item.personnel);
                if (oldPers !== JSON.stringify(item.personnel)) changed = true;
              }
              if (key === "games" && item.relatedCharacters) {
                const oldChars = JSON.stringify(item.relatedCharacters);
                item.relatedCharacters = cleanArray(item.relatedCharacters);
                if (oldChars !== JSON.stringify(item.relatedCharacters)) changed = true;
              }
              if (key === "timeline" && item.relatedCharacters) {
                const oldChars = JSON.stringify(item.relatedCharacters);
                item.relatedCharacters = cleanArray(item.relatedCharacters);
                if (oldChars !== JSON.stringify(item.relatedCharacters)) changed = true;
              }
            });
            if (changed) {
              localStorage.setItem(`zj_${key}`, JSON.stringify(list));
            }
          }
        }
      } catch (e) {
        console.error(`Migration error for ${key}`, e);
      }
    });
  }

  static init() {
    // Run dynamic text migrations first to clean up existing databases
    this.migrateEnglishParentheses();

    if (!localStorage.getItem("zj_initialized")) {
      localStorage.setItem("zj_initialized", "true");
    }

    if (!localStorage.getItem("zj_concepts")) localStorage.setItem("zj_concepts", JSON.stringify(DEFAULT_CONCEPTS));
    if (!localStorage.getItem("zj_companies")) localStorage.setItem("zj_companies", JSON.stringify(DEFAULT_COMPANIES));
    if (!localStorage.getItem("zj_characters")) localStorage.setItem("zj_characters", JSON.stringify(DEFAULT_CHARACTERS));
    if (!localStorage.getItem("zj_incidents")) localStorage.setItem("zj_incidents", JSON.stringify(DEFAULT_INCIDENTS));
    if (!localStorage.getItem("zj_games")) localStorage.setItem("zj_games", JSON.stringify(DEFAULT_GAMES));
    if (!localStorage.getItem("zj_timeline")) localStorage.setItem("zj_timeline", JSON.stringify(DEFAULT_TIMELINE));
    if (!localStorage.getItem("zj_sealed_documents")) localStorage.setItem("zj_sealed_documents", JSON.stringify(DEFAULT_SEALED_DOCUMENTS));
    if (!localStorage.getItem("zj_relationships")) localStorage.setItem("zj_relationships", JSON.stringify(DEFAULT_RELATIONSHIPS));
    if (!localStorage.getItem("zj_memory_fragments")) localStorage.setItem("zj_memory_fragments", JSON.stringify(DEFAULT_MEMORY_FRAGMENTS));
  }

  static get(key) {
    this.init();
    try {
      const rawData = JSON.parse(localStorage.getItem(`zj_${key}`)) || [];
      
      return rawData.map(item => {
        // Clean up obsolete fields for backward compatibility/clarity
        if (key === 'characters') {
          delete item.deathStatus;
          delete item.spiritGrade;
          delete item.resonanceValue;
          delete item.corruptionLevel;
          delete item.memoryFragments;
          delete item.relatedIncidents;
          delete item.badge;
          
          if (item.despair === undefined) {
            item.despair = "";
          }
          if (item.enableNoise === undefined) {
            item.enableNoise = false;
          }
        } 
        else if (key === 'incidents') {
          delete item.badge;
          delete item.status;
          delete item.processingStatus;
          delete item.securityLevelBadge;
          delete item.residue;
          
          if (item.sealedSetting === undefined) {
            item.sealedSetting = "unsealed";
          }
          if (item.accessLevel === undefined) {
            item.accessLevel = "Level 2 : 제한열람";
          }
          if (item.enableNoise === undefined) {
            item.enableNoise = false;
          }
        }
        else if (key === 'companies') {
          delete item.symbolicFlower;
        }
        return item;
      });
    } catch (e) {
      console.error(`Error reading ${key} from storage`, e);
      return [];
    }
  }

  static save(key, data) {
    localStorage.setItem(`zj_${key}`, JSON.stringify(data));
  }

  static add(key, item) {
    const data = this.get(key);
    item.id = `${key}-${Date.now()}`;
    data.push(item);
    this.save(key, data);
    return item;
  }

  static update(key, id, updatedItem) {
    const data = this.get(key);
    const index = data.findIndex(item => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updatedItem, id };
      this.save(key, data);
      return true;
    }
    return false;
  }

  static delete(key, id) {
    let data = this.get(key);
    data = data.filter(item => item.id !== id);
    this.save(key, data);
    return true;
  }

  static reset() {
    localStorage.removeItem("zj_concepts");
    localStorage.removeItem("zj_companies");
    localStorage.removeItem("zj_characters");
    localStorage.removeItem("zj_incidents");
    localStorage.removeItem("zj_games");
    localStorage.removeItem("zj_timeline");
    localStorage.removeItem("zj_sealed_documents");
    localStorage.removeItem("zj_relationships");
    localStorage.removeItem("zj_memory_fragments");
    localStorage.removeItem("zj_initialized");
    localStorage.removeItem("zj_admin_password_hash");
    localStorage.removeItem("zj_password_changed");
    localStorage.removeItem("zj_admin_logged_in");
    localStorage.removeItem("zj_admin_login_time");
    this.init();
  }
}
