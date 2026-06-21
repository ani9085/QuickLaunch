/* 배포자 제공 — 자주 쓰는 바로가기 라이브러리
 * 사용자는 여기서 골라 자신의 덱에 추가할 수 있음. (type/target/icon/color/label) */
window.SHORTCUT_LIBRARY = [
  {
    category: "업무 도구",
    items: [
      { label: "Excel", type: "app", target: "excel.exe", icon: "📊", color: "#22543d" },
      { label: "PowerPoint", type: "app", target: "powerpnt.exe", icon: "📽️", color: "#c05621" },
      { label: "Outlook", type: "app", target: "outlook.exe", icon: "📨", color: "#2b6cb0" },
      { label: "메모장", type: "app", target: "notepad.exe", icon: "📝", color: "#4a5568" },
      { label: "계산기", type: "app", target: "calc.exe", icon: "🧮", color: "#744210" },
      { label: "캡처 도구", type: "url", target: "ms-screenclip:", icon: "📷", color: "#553c9a" },
      { label: "다운로드 폴더", type: "folder", target: "%USERPROFILE%\\Downloads", icon: "📂", color: "#2d3748" },
    ],
  },
  {
    category: "AI 도구",
    items: [
      { label: "Claude", type: "app", target: "shell:AppsFolder\\Claude_pzs8sxrjxfjjc!Claude", icon: "🧠", color: "#6b46c1" },
      { label: "Codex", type: "app", target: "shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App", icon: "⚙️", color: "#2b6cb0" },
      { label: "ChatGPT", type: "app", target: "chatgpt.exe", icon: "💬", color: "#2f855a" },
      { label: "Antigravity", type: "app", target: "%LOCALAPPDATA%\\Programs\\antigravity\\Antigravity.exe", icon: "🚀", color: "#553c9a" },
    ],
  },
];
