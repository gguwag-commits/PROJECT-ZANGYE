#!/bin/bash

# Exit on error
set -e

echo "=================================================="
echo "      PROJECT : 잔계 (殘界) GitHub Pages 배포"
echo "=================================================="

# 1. Git 저장소 초기화 여부 확인
if [ ! -d .git ]; then
    echo "[INFO] Git 저장소를 초기화합니다..."
    git init
    git branch -M main
else
    echo "[INFO] 기존 Git 저장소를 사용합니다."
fi

# 2. 원격 origin 저장소 확인
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
    echo "[WARNING] 원격 저장소(remote origin) 주소가 설정되어 있지 않습니다."
    echo "GitHub 저장소 URL을 입력해 주세요."
    echo "예: https://github.com/사용자이름/저장소이름.git"
    read -p "URL 입력: " input_url
    
    if [ -z "$input_url" ]; then
        echo "[ERROR] 원격 저장소 URL이 입력되지 않았습니다. 배포를 종료합니다."
        exit 1
    fi
    
    git remote add origin "$input_url"
    echo "[SUCCESS] 원격 저장소가 설정되었습니다: $input_url"
else
    echo "[INFO] 원격 저장소 연결됨: $REMOTE_URL"
fi

# 3. 파일 스테이징 및 커밋
echo "[INFO] 변경 사항을 로컬 저장소에 커밋합니다..."
git add .
git commit -m "deploy: 아카이브 웹사이트 최신화" || echo "[INFO] 변경 사항이 없어 커밋을 건너뜁니다."

# 4. GitHub로 푸시
echo "[INFO] GitHub 저장소(main 브라우저)로 변경 사항을 업로드 중..."
git push -u origin main --force

echo "=================================================="
echo "    [SUCCESS] 배포 스크립트 실행이 완료되었습니다."
echo "=================================================="
echo "GitHub 저장소의 [Settings] > [Pages] 메뉴로 이동하여:"
echo "1. Build and deployment Source를 'Deploy from a branch'로 설정"
echo "2. Branch를 'main' / Root '/' 폴더로 설정하고 [Save] 버튼을 클릭하세요."
echo "수 분 뒤 웹사이트가 온라인에 활성화됩니다."
echo "=================================================="
