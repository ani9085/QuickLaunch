# QuickLaunch Build Policy

QuickLaunch는 앞으로 **Tauri 전용 Windows 데스크톱 앱**으로 빌드하고 배포합니다.

## 기준

- 공식 빌드 대상은 Tauri입니다.
- Electron 런타임, Electron Builder, Electron 자동 업데이트는 사용하지 않습니다.
- 릴리스 파일은 `npm run build` 또는 `npx tauri build`로 생성된 Tauri 설치 파일을 사용합니다.
- 앱은 외부 서버에 접속하지 않는 완전 오프라인 배포를 기준으로 합니다.
- 라이브러리와 공지는 앱 안에서 JSON 파일로 내보내고, 사용자는 그 파일을 가져와 갱신합니다.

## 버전업

1. `package.json`의 `version`을 올립니다.
2. `src-tauri/tauri.conf.json`의 `version`을 같은 값으로 맞춥니다.
3. 필요하면 `src/renderer.js`의 `APP_VERSION` 또는 앱 설정의 버전 표기를 맞춥니다.
4. `npm install` 후 `npm run build`로 Tauri 설치 파일을 생성합니다.
5. GitHub Releases에는 Tauri 설치 파일만 업로드합니다.

## 저장소 정리 원칙

- Electron 전용 파일과 설정은 저장소에 다시 추가하지 않습니다.
- `node_modules/`, `src-tauri/target/`, `src-tauri/gen/`은 로컬 생성물이며 커밋하지 않습니다.
- `src/admin-config.js`는 관리자 비밀번호 주입용 로컬 파일이므로 커밋하지 않습니다.
