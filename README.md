# ⚡ QuickLaunch

자주 쓰는 사이트·앱·파일·폴더·명령어·키보드 단축키를 타일 그리드에 등록해 한 번의 클릭으로 실행합니다. 배포자가 미리 만든 **구매업무 추천 라이브러리**를 기본 제공하며, 프로필을 파일로 내보내고 가져와 팀원과 공유할 수 있습니다.

> Windows 데스크톱 앱 (Electron). 로컬에서만 동작하며 외부로 데이터를 전송하지 않습니다.

## ✨ 주요 기능

| 기능 | 설명 |
| --- | --- |
| **그리드 레이아웃** | `3×3`, `5×3`, `5×4` 전환 — 선택 시 **창 크기 자동 조정** |
| **기본 / Lite 모드** | 기본 100×100px, Lite 50×50px. 브랜드 옆 **"기본/Lite" 알약 버튼**으로 전환 |
| **관리자 잠금** | 🛠️ 라이브러리 관리에 비밀번호 잠금 (설정에서 지정/해제) |
| **원격 동기화** | 관리자가 올린 라이브러리·공지를 사용자 앱이 시작 시 받아옴 (사내 서버/인트라넷 URL 지정 가능, 오프라인 시 캐시 사용) |
| **바로가기 유형** | 웹사이트(URL) · **앱/프로그램(.exe) 실행** · 파일 · 폴더 · 명령어 · **키보드 단축키 전송** |
| **3가지 추가 방식** | ① 라이브러리에서 선택 ② 직접 입력 ③ 키보드 단축키 캡처 |
| **구매업무 라이브러리** | 나라장터·홈택스·관세청·환율·택배조회 등 배포자 큐레이션 |
| **라이브러리 관리(관리자)** | 앱 내에서 추천 바로가기 추가·수정·삭제, 라이브러리 단위 내보내기/가져오기 |
| **아이콘 스킨** | 100여 개 이모지 아이콘 + 60색(진한색·**파스텔**·중성색) 팔레트, 텍스트만 표시 |
| **앱 테마 10종** | 다크·블랙·차콜·그레이·라이트·화이트·네이비·포레스트·와인·샌드 |
| **내보내기/가져오기** | 프로필을 `.json`으로 저장·공유 (덱 단위 병합) |
| **여러 덱(프로필)** | 업무별로 탭을 나눠 관리 |
| **전역 단축키** | `Ctrl+Shift+Space`로 어디서나 창 열기/숨기기 |
| **트레이 상주 / 검색 / 편집 모드** | 닫아도 트레이 상주, 타일 검색, 편집 모드에서 추가·수정·삭제 |

## 🚀 개발 실행

```bash
npm install
npm start
```

## 🪶 Tauri 경량 빌드 (권장 — ~1.7MB 설치파일)

Electron(~75MB) 대신 **Tauri**(Rust + OS WebView2)로 빌드하면 동일 기능에 용량이 대폭 줄어듭니다.

| | Electron | **Tauri** |
| --- | --- | --- |
| 실행 파일 | ~75MB | **4.3MB** |
| 설치 파일 | ~74MB | **1.7MB** |

UI(`src/`)는 그대로 재사용하며, 네이티브 브리지는 `src-tauri/`(Rust) + `src/tauri-api.js`가 담당합니다.

```bash
# 사전 준비: Rust(rustup) + Visual Studio Build Tools(C++) + WebView2
npm install
npx tauri build          # → src-tauri/target/release/bundle/nsis/QuickLaunch_1.0.0_x64-setup.exe
npx tauri dev            # 개발 실행
```

전역 단축키·트레이·파일 다이얼로그·원격 동기화·SendKeys·**자동 업데이트** 모두 Tauri에서 동작합니다.

### 자동 업데이트 (Tauri updater)

앱 시작 시 `https://github.com/ani9085/QuickLaunch/releases/latest/download/latest.json`을 확인해, 더 높은 버전이 있으면 서명 검증 후 다운로드하고 재시작 시 적용합니다. 공개키는 `tauri.conf.json`에 들어 있습니다.

**새 버전 배포 절차(관리자):**
```bash
# 1) 버전 올리기: src-tauri/tauri.conf.json 의 "version" 을 예: 1.0.1 로 수정
# 2) 서명 키로 빌드 (개인키는 ~/.tauri/ql_updater.key, git에 없음)
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/ql_updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npx tauri build
# 3) GitHub에 새 릴리스(tag v1.0.1) 생성하고 아래 3개 업로드:
#    QuickLaunch_1.0.1_x64-setup.exe, *.sig, latest.json(버전/서명/url 갱신)
```
> ⚠️ 개인키(`ql_updater.key`)를 잃어버리면 더 이상 서명된 업데이트를 낼 수 없습니다 — 안전하게 보관하세요.

## 📦 exe 빌드 (Electron 레거시)

```bash
npm run dist
```

`release/` 폴더에 설치형(NSIS) 및 무설치 포터블 `.exe`가 생성됩니다.

## ⌨️ 키보드 단축키 전송 방식

키보드 단축키 타입은 Windows `SendKeys`(PowerShell)로 현재 포커스된 창에 키 입력을 전송합니다.
`Ctrl`/`Alt`/`Shift` + 키 조합을 지원합니다. (Windows 키 조합은 제외)

## 🗂️ 데이터 저장 위치

설정과 덱은 `%APPDATA%/QuickLaunch/quicklaunch-data.json`에 저장됩니다.

## 🌐 원격 동기화 (라이브러리 중앙 갱신 · 전체 쪽지)

기본값으로 이 저장소(`ani9085/QuickLaunch`)의 `library.json`·`messages.json`을 바라봅니다. 앱 시작 시(및 설정 → "지금 동기화") 받아오며, 실패하면 마지막 캐시/로컬 라이브러리로 계속 동작합니다. Electron `net`을 쓰므로 **시스템 프록시를 따라가** 사내망에서도 유리합니다.

**library.json** (관리자: 🛠️ 라이브러리 관리 → "라이브러리 내보내기"로 생성)
```json
{ "version": 1, "library": [
  { "category": "업무 도구", "items": [
    { "label": "Excel", "type": "command", "target": "start excel", "icon": "📊", "color": "#22543d" }
  ] }
] }
```

**messages.json** (관리자: 🛠️ → "📢 전체 쪽지 보내기"로 생성) — 배열. 새 `id`는 사용자 쪽지함(📬)에 미읽음으로 표시되고 자동으로 한 번 뜸
```json
[
  { "id": 1, "title": "배포 안내", "body": "설치해 주셔서 감사합니다.", "date": "2026-06-20" }
]
```

> ⚠️ **저장소가 private이면** `raw.githubusercontent.com` 접근과 자동 업데이트가 동작하지 않습니다 — 저장소를 **public으로 전환**하거나, `library.json`/`messages.json`과 업데이트 파일을 **사내 웹서버(인트라넷 URL)**에 올려 설정에서 URL을 바꾸세요.

## 🔄 자동 업데이트

`electron-updater` + GitHub Releases. 앱 시작 시 새 버전을 확인해 자동 다운로드하고, 받으면 재시작을 안내합니다(설정에서 수동 확인도 가능). 배포자는 버전을 올리고 `npm run publish`로 릴리스를 올리면 됩니다(`GH_TOKEN` 필요, **public 저장소 권장**).

## 🔒 관리자 잠금

🛠️ 라이브러리 관리는 관리자 비밀번호로 보호됩니다. 비밀번호는 [src/renderer.js](src/renderer.js)의 `ADMIN_PASSWORD` 상수에 고정되어 있으며, 변경하려면 값을 바꾸고 다시 빌드하세요.

## 🧩 라이브러리 커스터마이징 (배포자용)

`src/library.js`의 `SHORTCUT_LIBRARY` 배열을 수정해 조직 전용 추천 바로가기를 배포할 수 있습니다.
`src/icons.js`에서 아이콘·색상 팔레트를 확장할 수 있습니다.

## 📄 라이선스

MIT © ani9085
