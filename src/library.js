/* 배포자 제공 — 구매인력이 자주 쓰는 바로가기 라이브러리
 * 사용자는 여기서 골라 자신의 덱에 추가할 수 있음. (type/target/icon/color/label) */
window.SHORTCUT_LIBRARY = [
  {
    category: "업무 도구",
    items: [
      { label: "Excel", type: "command", target: "start excel", icon: "📊", color: "#22543d" },
      { label: "PowerPoint", type: "command", target: "start powerpnt", icon: "📽️", color: "#c05621" },
      { label: "Outlook", type: "command", target: "start outlook", icon: "📨", color: "#2b6cb0" },
      { label: "메모장", type: "app", target: "notepad.exe", icon: "📝", color: "#4a5568" },
      { label: "계산기", type: "app", target: "calc.exe", icon: "🧮", color: "#744210" },
      { label: "캡처 도구", type: "command", target: "start ms-screenclip:", icon: "📷", color: "#553c9a" },
      { label: "다운로드 폴더", type: "folder", target: "%USERPROFILE%\\Downloads", icon: "📂", color: "#2d3748" },
    ],
  },
];
