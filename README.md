# 관찰 기록실

현재 구현 범위는 **아이디 입력 → 문장 따라 쓰기 → 틀린 그림 찾기 → JSON 다운로드**입니다. 아이디 확인 뒤 마우스로 문장을 쓰고, 두 그림 위에서 움직인 마우스 위치를 기록합니다. 마지막 `완료하고 JSON 다운로드` 버튼을 누르면 두 과제의 기록이 하나의 파일로 내려받아집니다.

과제 진행 중 기록은 페이지 메모리에만 있습니다. JSON 다운로드 전에 새로고침하거나 탭을 닫으면 사라집니다. 비밀번호 확인이나 서버 전송은 없습니다.

## 로컬에서 확인

`index.html`을 브라우저에서 열면 됩니다. 외부 패키지나 빌드 단계가 필요하지 않습니다.

## GitHub Pages 배포

1. 이 폴더의 `index.html`, `style.css`, `app.js`, `assets/`를 GitHub 저장소 루트에 올립니다.
2. 저장소의 **Settings → Pages**에서 배포 소스를 **Deploy from a branch**로 선택합니다.
3. 브랜치를 `main`, 폴더를 `/(root)`로 지정하고 저장합니다.
4. Pages가 제공한 주소에서 두 과제를 수행하고 JSON 다운로드를 확인합니다.

이 앱은 상대 경로(`./style.css`, `./app.js`)를 사용하므로 `https://사용자명.github.io/저장소명/` 형태의 프로젝트 사이트에서도 동작합니다. GitHub Pages는 정적 HTML·CSS·JavaScript를 게시할 수 있습니다. [GitHub Pages 공식 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
