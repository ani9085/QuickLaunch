/* 배포자 제공 — 구매인력이 자주 쓰는 바로가기 라이브러리
 * 사용자는 여기서 골라 자신의 덱에 추가할 수 있음. (type/target/icon/color/label) */
window.SHORTCUT_LIBRARY = [
  {
    category: "조달/입찰",
    items: [
      { label: "나라장터(G2B)", type: "url", target: "https://www.g2b.go.kr", icon: "🏛️", color: "#1a365d" },
      { label: "국가종합전자조달", type: "url", target: "https://www.g2b.go.kr/index.jsp", icon: "📋", color: "#2c5282" },
      { label: "조달청", type: "url", target: "https://www.pps.go.kr", icon: "🏢", color: "#2b6cb0" },
      { label: "공공데이터포털", type: "url", target: "https://www.data.go.kr", icon: "🌐", color: "#285e61" },
      { label: "전자입찰", type: "url", target: "https://www.g2b.go.kr/pn/pnz/bid/EgovBidPbac.do", icon: "🗳️", color: "#22543d" },
    ],
  },
  {
    category: "세무/회계",
    items: [
      { label: "홈택스", type: "url", target: "https://www.hometax.go.kr", icon: "🧾", color: "#742a2a" },
      { label: "전자세금계산서", type: "url", target: "https://www.hometax.go.kr", icon: "📑", color: "#9b2c2c" },
      { label: "위택스(지방세)", type: "url", target: "https://www.wetax.go.kr", icon: "🏦", color: "#744210" },
      { label: "여신금융협회", type: "url", target: "https://www.crefia.or.kr", icon: "💳", color: "#553c9a" },
      { label: "사업자등록 조회", type: "url", target: "https://www.hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index.xml", icon: "🔍", color: "#4a5568" },
    ],
  },
  {
    category: "거래처/물류",
    items: [
      { label: "관세청 UNI-PASS", type: "url", target: "https://unipass.customs.go.kr", icon: "🛃", color: "#2d3748" },
      { label: "택배 조회", type: "url", target: "https://search.naver.com/search.naver?query=택배조회", icon: "📦", color: "#c05621" },
      { label: "환율 정보", type: "url", target: "https://finance.naver.com/marketindex/", icon: "💱", color: "#2f855a" },
      { label: "기업정보(나이스)", type: "url", target: "https://www.nicebizinfo.com", icon: "🏭", color: "#2c5282" },
      { label: "사업자 진위확인", type: "url", target: "https://www.ftc.go.kr/bizCommPop.do", icon: "✅", color: "#38a169" },
    ],
  },
  {
    category: "업무 도구",
    items: [
      { label: "Excel 새 문서", type: "command", target: "start excel", icon: "📊", color: "#22543d" },
      { label: "메모장", type: "app", target: "notepad.exe", icon: "📝", color: "#4a5568" },
      { label: "계산기", type: "app", target: "calc.exe", icon: "🧮", color: "#744210" },
      { label: "캡처 도구", type: "command", target: "start ms-screenclip:", icon: "📷", color: "#553c9a" },
      { label: "다운로드 폴더", type: "folder", target: "%USERPROFILE%\\Downloads", icon: "📂", color: "#2d3748" },
    ],
  },
  {
    category: "협업/메일",
    items: [
      { label: "Gmail", type: "url", target: "https://mail.google.com", icon: "📧", color: "#9b2c2c" },
      { label: "네이버 메일", type: "url", target: "https://mail.naver.com", icon: "✉️", color: "#22543d" },
      { label: "Outlook", type: "url", target: "https://outlook.office.com", icon: "📨", color: "#2b6cb0" },
      { label: "구글 드라이브", type: "url", target: "https://drive.google.com", icon: "🗂️", color: "#2f855a" },
      { label: "구글 캘린더", type: "url", target: "https://calendar.google.com", icon: "📅", color: "#3182ce" },
    ],
  },
  {
    category: "단축키 예시",
    items: [
      { label: "복사", type: "hotkey", target: "Ctrl+C", icon: "📋", color: "#4a5568" },
      { label: "붙여넣기", type: "hotkey", target: "Ctrl+V", icon: "📎", color: "#4a5568" },
      { label: "전체선택", type: "hotkey", target: "Ctrl+A", icon: "☑️", color: "#4a5568" },
      { label: "저장", type: "hotkey", target: "Ctrl+S", icon: "💾", color: "#2c5282" },
      { label: "값만 붙여넣기", type: "hotkey", target: "Ctrl+Shift+V", icon: "📐", color: "#553c9a" },
    ],
  },
];
