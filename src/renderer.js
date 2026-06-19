/* ============================ QuickLaunch 렌더러 ============================ */
const LAYOUTS = {
  "3x3": { cols: 3, rows: 3 },
  "5x3": { cols: 5, rows: 3 },
  "5x4": { cols: 5, rows: 4 },
};

let state = null;
let editMode = false;
let editingSlot = null; // 편집 중인 슬롯 인덱스
let draft = null; // 편집 모달 임시 데이터

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ------------------------------- 초기화 ------------------------------- */
function defaultState() {
  return {
    activeDeckId: "deck1",
    decks: [
      { id: "deck1", name: "기본", layout: "5x3", items: {} },
    ],
    settings: { globalHotkey: "CommandOrControl+Shift+Space", theme: "dark" },
  };
}

async function init() {
  const loaded = await window.api.loadData();
  state = loaded && loaded.decks ? loaded : defaultState();
  // 첫 실행이면 라이브러리 일부를 기본 덱에 미리 채워줌
  if (!loaded) seedDefaultDeck();
  applyTheme();
  buildIconGrid();
  buildColorGrid();
  renderAll();
  bindEvents();
  $("#hotkeyHint").textContent = "전역 단축키: " + state.settings.globalHotkey;
}

function seedDefaultDeck() {
  const deck = state.decks[0];
  const picks = [
    SHORTCUT_LIBRARY[0].items[0], // 나라장터
    SHORTCUT_LIBRARY[1].items[0], // 홈택스
    SHORTCUT_LIBRARY[2].items[1], // 택배조회
    SHORTCUT_LIBRARY[2].items[2], // 환율
    SHORTCUT_LIBRARY[3].items[0], // Excel
    SHORTCUT_LIBRARY[3].items[4], // 다운로드 폴더
    SHORTCUT_LIBRARY[4].items[0], // Gmail
    SHORTCUT_LIBRARY[5].items[3], // 저장 단축키
  ];
  picks.forEach((p, i) => {
    deck.items[i] = { ...p };
  });
}

function persist() {
  window.api.saveData(state);
}

function activeDeck() {
  return state.decks.find((d) => d.id === state.activeDeckId) || state.decks[0];
}

/* ------------------------------- 렌더링 ------------------------------- */
function renderAll() {
  renderDeckTabs();
  renderLayoutSwitch();
  renderGrid();
}

function renderDeckTabs() {
  const wrap = $("#deckTabs");
  wrap.innerHTML = "";
  state.decks.forEach((d) => {
    const b = document.createElement("button");
    b.className = "deck-tab" + (d.id === state.activeDeckId ? " active" : "");
    b.textContent = d.name;
    b.onclick = () => {
      state.activeDeckId = d.id;
      persist();
      renderAll();
    };
    wrap.appendChild(b);
  });
}

function renderLayoutSwitch() {
  const layout = activeDeck().layout;
  $$("#layoutSwitch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.layout === layout);
  });
}

function renderGrid() {
  const deck = activeDeck();
  const { cols, rows } = LAYOUTS[deck.layout];
  const total = cols * rows;
  const grid = $("#grid");
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.classList.toggle("editing", editMode);
  grid.innerHTML = "";

  const query = $("#searchInput").value.trim().toLowerCase();

  for (let i = 0; i < total; i++) {
    const item = deck.items[i];
    const tile = document.createElement("div");

    const dim =
      query &&
      item &&
      !(item.label || "").toLowerCase().includes(query) &&
      !(item.target || "").toLowerCase().includes(query);

    if (item) {
      tile.className = "tile";
      tile.style.background = item.color || "#2d3748";
      tile.style.opacity = dim ? "0.25" : "1";
      tile.innerHTML = `
        ${item.textOnly ? "" : `<span class="tile-icon">${item.icon || "📁"}</span>`}
        <span class="tile-label">${escapeHtml(item.label || "")}</span>
        <span class="badge">${typeBadge(item.type)}</span>
        ${editMode ? '<span class="edit-pencil">✏️</span>' : ""}
      `;
      tile.title = item.target || "";
      tile.onclick = () => (editMode ? openEdit(i) : runItem(item));
    } else {
      tile.className = "tile empty";
      tile.innerHTML = `<span class="tile-icon">＋</span>`;
      tile.onclick = () => editMode && openEdit(i);
      if (!editMode) tile.style.cursor = "default";
    }
    grid.appendChild(tile);
  }
  $("#emptyHint").classList.toggle(
    "hidden",
    Object.keys(deck.items).length > 0 || editMode
  );
}

function typeBadge(type) {
  return (
    { url: "🌐", app: "🖥️", file: "📄", folder: "📂", command: "⌘", hotkey: "⌨️" }[
      type
    ] || ""
  );
}

/* ------------------------------- 액션 실행 ------------------------------- */
async function runItem(item) {
  setStatus(`실행: ${item.label}`);
  const res = await window.api.run(item);
  if (res && res.ok === false) {
    toast("실행 실패: " + (res.error || "알 수 없는 오류"));
    setStatus("실행 실패: " + item.label);
  } else {
    setStatus("완료: " + item.label);
  }
}

/* ------------------------------- 편집 모달 ------------------------------- */
function openEdit(slot) {
  editingSlot = slot;
  const existing = activeDeck().items[slot];
  draft = existing
    ? { ...existing }
    : { label: "", type: "url", target: "", icon: "📁", color: COLOR_PALETTE[0], textOnly: false };

  $("#editTitle").textContent = existing ? "바로가기 편집" : "바로가기 추가";
  $("#deleteBtn").classList.toggle("hidden", !existing);

  // 폼 채우기
  $("#f_label").value = draft.label || "";
  $("#f_type").value = draft.type === "hotkey" ? "url" : draft.type;
  $("#f_target").value = draft.target || "";
  $("#f_hk_label").value = draft.label || "";
  $("#f_hk_combo").value = draft.type === "hotkey" ? draft.target : "";
  updatePreview();
  syncIconColorSelection();
  togglePickPathBtn();

  // 탭: 기존이 hotkey면 hotkey탭, 아니면 custom(편집) / 신규는 library
  switchTab(existing ? (draft.type === "hotkey" ? "hotkey" : "custom") : "library");
  show("editModal");
}

function collectDraftFromActiveTab() {
  const tab = $(".tab.active").dataset.tab;
  if (tab === "custom") {
    draft.label = $("#f_label").value.trim();
    draft.type = $("#f_type").value;
    draft.target = $("#f_target").value.trim();
  } else if (tab === "hotkey") {
    draft.label = $("#f_hk_label").value.trim();
    draft.type = "hotkey";
    draft.target = $("#f_hk_combo").value.trim();
  }
  // library 탭은 클릭 시 즉시 draft에 반영됨
}

function saveEdit() {
  collectDraftFromActiveTab();
  if (!draft.label) return toast("이름을 입력하세요.");
  if (draft.type !== "hotkey" && !draft.target) return toast("대상을 입력하세요.");
  if (draft.type === "hotkey" && !draft.target) return toast("키 조합을 입력하세요.");
  activeDeck().items[editingSlot] = { ...draft };
  persist();
  hide("editModal");
  renderGrid();
  setStatus("저장됨: " + draft.label);
}

function deleteItem() {
  delete activeDeck().items[editingSlot];
  persist();
  hide("editModal");
  renderGrid();
}

function updatePreview() {
  $("#previewIcon").textContent = draft.textOnly ? "Aa" : draft.icon || "📁";
  $("#previewTile").style.background = draft.color || COLOR_PALETTE[0];
}

/* --------------------------- 아이콘 / 색상 그리드 --------------------------- */
function buildIconGrid() {
  const grid = $("#iconGrid");
  grid.innerHTML = "";
  ALL_ICONS.forEach((ic) => {
    const s = document.createElement("span");
    s.textContent = ic;
    s.onclick = () => {
      draft.icon = ic;
      draft.textOnly = false;
      updatePreview();
      syncIconColorSelection();
    };
    grid.appendChild(s);
  });
}

function buildColorGrid() {
  const grid = $("#colorGrid");
  grid.innerHTML = "";
  COLOR_PALETTE.forEach((c) => {
    const s = document.createElement("span");
    s.style.background = c;
    s.dataset.color = c;
    s.onclick = () => {
      draft.color = c;
      updatePreview();
      syncIconColorSelection();
    };
    grid.appendChild(s);
  });
}

function syncIconColorSelection() {
  $$("#iconGrid span").forEach((s) =>
    s.classList.toggle("sel", s.textContent === draft.icon && !draft.textOnly)
  );
  $$("#colorGrid span").forEach((s) =>
    s.classList.toggle("sel", s.dataset.color === draft.color)
  );
}

/* ------------------------------- 라이브러리 ------------------------------- */
function buildLibPicker() {
  const wrap = $("#libPicker");
  wrap.innerHTML = "";
  SHORTCUT_LIBRARY.forEach((cat) => {
    const title = document.createElement("div");
    title.className = "lib-cat-title";
    title.textContent = cat.category;
    wrap.appendChild(title);
    const items = document.createElement("div");
    items.className = "lib-items";
    cat.items.forEach((it) => {
      items.appendChild(makeLibItem(it, () => {
        draft = { ...it, textOnly: false };
        updatePreview();
        syncIconColorSelection();
        $("#f_label").value = it.label;
        $("#f_type").value = it.type === "hotkey" ? "url" : it.type;
        $("#f_target").value = it.target;
        toast("선택됨: " + it.label + " — 저장을 누르세요");
      }));
    });
    wrap.appendChild(items);
  });
}

function makeLibItem(it, onClick) {
  const el = document.createElement("div");
  el.className = "lib-item";
  el.innerHTML = `<span class="li-icon">${it.icon}</span>
    <span class="li-text">${escapeHtml(it.label)}<small>${escapeHtml(it.target)}</small></span>`;
  el.onclick = onClick;
  return el;
}

function buildLibraryFull() {
  const wrap = $("#libraryFull");
  wrap.innerHTML = "";
  SHORTCUT_LIBRARY.forEach((cat) => {
    const title = document.createElement("div");
    title.className = "lib-cat-title";
    title.textContent = cat.category;
    wrap.appendChild(title);
    const items = document.createElement("div");
    items.className = "lib-items";
    cat.items.forEach((it) => {
      items.appendChild(
        makeLibItem(it, () => {
          addToFirstEmpty({ ...it, textOnly: false });
        })
      );
    });
    wrap.appendChild(items);
  });
}

function addToFirstEmpty(item) {
  const deck = activeDeck();
  const total = LAYOUTS[deck.layout].cols * LAYOUTS[deck.layout].rows;
  for (let i = 0; i < total; i++) {
    if (!deck.items[i]) {
      deck.items[i] = item;
      persist();
      renderGrid();
      toast("추가됨: " + item.label);
      return;
    }
  }
  toast("빈 칸이 없습니다. 레이아웃을 키우거나 덱을 추가하세요.");
}

/* ------------------------------- 가져오기/내보내기 ------------------------------- */
async function doExport() {
  const json = JSON.stringify(state, null, 2);
  const res = await window.api.exportSave(json);
  if (res.ok) toast("내보내기 완료: " + res.path);
  else if (!res.canceled) toast("내보내기 실패: " + res.error);
}

async function doImport() {
  const res = await window.api.importOpen();
  if (res.canceled) return;
  if (!res.ok) return toast("가져오기 실패: " + res.error);
  try {
    const data = JSON.parse(res.data);
    if (!data.decks) throw new Error("올바른 프로필 파일이 아닙니다.");
    // 병합: 가져온 덱을 새 id로 추가
    data.decks.forEach((d) => {
      const newId = "deck" + Date.now() + Math.floor(Math.random() * 1000);
      state.decks.push({ ...d, id: newId, name: d.name + " (가져옴)" });
    });
    persist();
    renderAll();
    toast("가져오기 완료: " + data.decks.length + "개 덱 추가");
  } catch (e) {
    toast("가져오기 실패: " + e.message);
  }
}

/* ------------------------------- 설정/덱 관리 ------------------------------- */
function openSettings() {
  $("#s_hotkey").value = state.settings.globalHotkey;
  $("#s_theme").value = state.settings.theme;
  show("settingsModal");
}

async function applyHotkey() {
  const accel = $("#s_hotkey").value.trim();
  state.settings.globalHotkey = accel;
  persist();
  await window.api.registerHotkey(accel);
  $("#hotkeyHint").textContent = "전역 단축키: " + accel;
}

function applyTheme() {
  document.body.classList.toggle("light", state.settings.theme === "light");
}

function addDeck() {
  const name = $("#newDeckName").value.trim() || "새 덱";
  const id = "deck" + Date.now();
  state.decks.push({ id, name, layout: "5x3", items: {} });
  state.activeDeckId = id;
  $("#newDeckName").value = "";
  persist();
  renderAll();
}

function renameDeck() {
  const name = $("#newDeckName").value.trim();
  if (!name) return toast("새 이름을 입력 칸에 적으세요.");
  activeDeck().name = name;
  $("#newDeckName").value = "";
  persist();
  renderAll();
}

function deleteDeck() {
  if (state.decks.length <= 1) return toast("마지막 덱은 삭제할 수 없습니다.");
  state.decks = state.decks.filter((d) => d.id !== state.activeDeckId);
  state.activeDeckId = state.decks[0].id;
  persist();
  renderAll();
}

function resetAll() {
  if (!confirm("모든 덱과 설정을 초기화할까요? 되돌릴 수 없습니다.")) return;
  state = defaultState();
  seedDefaultDeck();
  persist();
  applyTheme();
  renderAll();
  hide("settingsModal");
}

/* ------------------------------- 탭/모달 헬퍼 ------------------------------- */
function switchTab(name) {
  $$("#editTabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$('#editModal .tab-pane').forEach((p) =>
    p.classList.toggle("active", p.dataset.pane === name)
  );
}

function show(id) { $("#" + id).classList.remove("hidden"); }
function hide(id) { $("#" + id).classList.add("hidden"); }

function togglePickPathBtn() {
  const type = $("#f_type").value;
  const show = type === "app" || type === "file" || type === "folder";
  $("#pickPathBtn").classList.toggle("hidden", !show);
}

/* ------------------------------- 이벤트 바인딩 ------------------------------- */
function bindEvents() {
  // 레이아웃 전환
  $$("#layoutSwitch button").forEach((b) => {
    b.onclick = () => {
      activeDeck().layout = b.dataset.layout;
      persist();
      renderAll();
    };
  });

  // 편집 모드 토글
  $("#editToggle").onclick = () => {
    editMode = !editMode;
    $("#editToggle").classList.toggle("on", editMode);
    setStatus(editMode ? "편집 모드 — 칸을 눌러 편집/추가" : "준비됨");
    renderGrid();
  };

  // 검색
  $("#searchInput").oninput = () => renderGrid();

  // 상단 버튼
  $("#libraryBtn").onclick = () => { buildLibraryFull(); show("libraryModal"); };
  $("#exportBtn").onclick = doExport;
  $("#importBtn").onclick = doImport;
  $("#settingsBtn").onclick = openSettings;

  // 모달 닫기 (x, data-close)
  $$("[data-close]").forEach((b) => (b.onclick = () => hide(b.dataset.close)));

  // 편집 탭
  $$("#editTabs .tab").forEach((t) => {
    t.onclick = () => {
      collectDraftFromActiveTab();
      switchTab(t.dataset.tab);
      if (t.dataset.tab === "library") buildLibPicker();
    };
  });

  // 직접입력: 유형 변경 → 찾아보기 버튼
  $("#f_type").onchange = togglePickPathBtn;
  $("#pickPathBtn").onclick = async () => {
    const mode = $("#f_type").value === "folder" ? "folder" : "file";
    const p = await window.api.pickPath(mode);
    if (p) $("#f_target").value = p;
  };

  // 텍스트만 사용
  $("#textOnlyBtn").onclick = () => {
    draft.textOnly = !draft.textOnly;
    updatePreview();
    syncIconColorSelection();
    toast(draft.textOnly ? "텍스트만 표시" : "아이콘 표시");
  };

  // 저장/삭제
  $("#saveBtn").onclick = saveEdit;
  $("#deleteBtn").onclick = deleteItem;

  // 키보드 단축키 캡처
  const hk = $("#f_hk_combo");
  hk.onkeydown = (e) => {
    e.preventDefault();
    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    const key = e.key;
    if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
      hk.value = parts.join("+");
    }
  };

  // 설정
  $("#s_hotkey").onchange = applyHotkey;
  $("#s_theme").onchange = () => {
    state.settings.theme = $("#s_theme").value;
    applyTheme();
    persist();
  };
  $("#addDeckBtn").onclick = addDeck;
  $("#renameDeckBtn").onclick = renameDeck;
  $("#deleteDeckBtn").onclick = deleteDeck;
  $("#resetBtn").onclick = resetAll;

  // ESC로 모달 닫기
  document.onkeydown = (e) => {
    if (e.key === "Escape") $$(".modal:not(.hidden)").forEach((m) => m.classList.add("hidden"));
  };
}

/* ------------------------------- 유틸 ------------------------------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function setStatus(t) { $("#statusText").textContent = t; }
let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

window.addEventListener("DOMContentLoaded", init);
