/* ============================ QuickLaunch 렌더러 ============================ */
// 빌드(코드) 기본 버전. 라이브러리 외 다른 부분을 수정해 새 exe를 배포할 때 올리세요.
// 관리자 설정에서 덮어쓰면 state.settings.appVersion 이 우선합니다.
const APP_VERSION = "1.0.0";

function appVersion() {
  return (state && state.settings && state.settings.appVersion) || APP_VERSION;
}

function renderVersion() {
  const el = $("#brandVersion");
  if (el) el.textContent = "v" + appVersion();
}

// 그리드 크기: 가로(cols)/세로(rows) 를 3~8 범위에서 자유 조절 (기본=최소 3×3)
const GRID_MIN = 3;
const GRID_MAX = 8;

function clampGrid(n) {
  n = parseInt(n, 10) || GRID_MIN;
  return Math.max(GRID_MIN, Math.min(GRID_MAX, n));
}

// 덱의 cols/rows 를 반환 (구버전 layout 문자열도 호환)
function deckGrid(deck) {
  deck = deck || activeDeck();
  if (deck.cols == null || deck.rows == null) {
    const m = /^(\d+)x(\d+)$/.exec(deck.layout || "");
    deck.cols = m ? clampGrid(m[1]) : GRID_MIN;
    deck.rows = m ? clampGrid(m[2]) : GRID_MIN;
    delete deck.layout;
  }
  return { cols: clampGrid(deck.cols), rows: clampGrid(deck.rows) };
}

let state = null;
let editMode = false;
let editingSlot = null; // 편집 중인 슬롯 인덱스
let draft = null; // 편집 모달 임시 데이터
const SAFE_ITEM_TYPES = new Set(["url", "app", "file", "folder", "hotkey"]);
const DEFAULT_ICON = "📁";
const DEFAULT_COLOR = "#2d3748";
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ROBOT_ICON_RE = /^assets\/robots\/[\w-]+\.png$/;
let editTypeTargetLocked = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ------------------------------- 초기화 ------------------------------- */
// 모드별 타일/여백 크기
//  normal = 기본 창(100px), lite = 작게(50px)
const SIZES = {
  normal: { tile: 100, gap: 8, pad: 12, icon: 30, label: 11, innerGap: 5 },
  lite: { tile: 50, gap: 5, pad: 8, icon: 25, label: 8, innerGap: 1 },
};

function defaultState() {
  return {
    activeDeckId: "deck1",
    decks: [
      { id: "deck1", name: "기본", cols: 4, rows: 3, items: {} },
    ],
    settings: {
      globalHotkey: "CommandOrControl+Shift+Space",
      theme: "dark",
      liteMode: false,
      seenMessageIds: [],
    },
    library: null, // 관리자가 앱에서 편집/가져온 라이브러리 (libraryEdited=true일 때 사용)
    libraryEdited: false, // 관리자가 편집했거나 라이브러리 파일을 가져왔는지
    messages: [], // 공지 (라이브러리 파일에 함께 담겨 배포/가져오기)
  };
}

// 우선순위: (관리자 편집/가져온 라이브러리) > 코드 기본값(SHORTCUT_LIBRARY)
function getLibrary() {
  if (state.libraryEdited && Array.isArray(state.library) && state.library.length)
    return state.library;
  return SHORTCUT_LIBRARY;
}

function isLibraryCatalogItem(item) {
  return getLibrary().some((cat) =>
    (cat.items || []).some(
      (it) => it.label === item.label && it.type === item.type && it.target === item.target
    )
  );
}

function safeString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeIcon(icon) {
  const s = String(icon ?? "").trim();
  if (ROBOT_ICON_RE.test(s)) return s;
  return s.slice(0, 32) || DEFAULT_ICON;
}

function isImageIcon(icon) {
  return ROBOT_ICON_RE.test(String(icon ?? "").trim());
}

function renderIconHtml(icon, cls = "tile-icon") {
  if (isImageIcon(icon)) {
    return `<img class="${cls}-img" src="${icon}" alt="" draggable="false" />`;
  }
  return `<span class="${cls}">${escapeHtml(sanitizeIcon(icon))}</span>`;
}

function sanitizeColor(color, fallback = DEFAULT_COLOR) {
  const value = safeString(color, 16);
  return HEX_COLOR_RE.test(value) ? value : fallback;
}

function sanitizeItem(item, opts = {}) {
  if (!item || typeof item !== "object") return null;
  const type = safeString(item.type, 20);
  if (!SAFE_ITEM_TYPES.has(type)) return null;
  const safe = {
    ...item,
    type,
    label: safeString(item.label, 120),
    target: safeString(item.target, 2048),
    icon: sanitizeIcon(item.icon),
    color: sanitizeColor(item.color),
    textOnly: !!item.textOnly,
  };
  if (safe.libraryLocked || (opts.inferLibraryLocked && isLibraryCatalogItem(safe))) {
    safe.libraryLocked = true;
  }
  return safe;
}

function sanitizeItemsMap(items) {
  const cleaned = {};
  Object.entries(items || {}).forEach(([slot, item]) => {
    const safe = sanitizeItem(item, { inferLibraryLocked: true });
    if (safe) cleaned[slot] = safe;
  });
  return cleaned;
}

function sanitizeLibrary(lib) {
  if (!Array.isArray(lib)) return [];
  return lib
    .map((cat) => ({
      ...cat,
      items: (Array.isArray(cat.items) ? cat.items : []).map(sanitizeItem).filter(Boolean),
    }))
    .filter((cat) => cat.items.length);
}

function sanitizeState() {
  if (Array.isArray(state.library)) state.library = sanitizeLibrary(state.library);
  (state.decks || []).forEach((deck) => {
    deck.items = sanitizeItemsMap(deck.items);
  });
}

async function init() {
  const loaded = await window.api.loadData();
  state = loaded && loaded.decks ? loaded : defaultState();
  sanitizeState();
  // 누락 필드 보정 (구버전 데이터 호환)
  if (!state.settings) state.settings = defaultState().settings;
  if (state.settings.liteMode === undefined) state.settings.liteMode = false;
  if (!state.settings.theme) state.settings.theme = "dark";
  if (!Array.isArray(state.settings.seenMessageIds)) state.settings.seenMessageIds = [];
  if (!Array.isArray(state.messages)) state.messages = [];
  // 첫 실행이면 라이브러리 일부를 기본 덱에 미리 채워줌
  if (!loaded) seedDefaultDeck();
  applyTheme();
  buildIconGrid();
  buildColorGrid();
  buildThemeGrid();
  renderAll();
  bindEvents();
  fitWindow();
  $("#hotkeyHint").textContent = "전역 단축키: " + state.settings.globalHotkey;
  renderInboxBadge(); // 공지 미읽음 배지
  renderVersion();
}

function seedDefaultDeck() {
  const deck = state.decks[0];
  const L = SHORTCUT_LIBRARY;
  const picks = [
    L[0]?.items[0], // Excel
    L[0]?.items[1], // PowerPoint
    L[0]?.items[2], // Outlook
    L[0]?.items[3], // 메모장
    L[0]?.items[4], // 계산기
    L[0]?.items[5], // 캡처 도구
    L[0]?.items[6], // 다운로드 폴더
  ].filter(Boolean);
  picks.forEach((p, i) => {
    deck.items[i] = makeLibraryDeckItem(p);
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
  // 덱이 하나뿐이면 탭을 숨김 (중복되는 "기본" 라벨 제거)
  wrap.classList.toggle("hidden", state.decks.length <= 1);
  if (state.decks.length <= 1) return;
  state.decks.forEach((d) => {
    const b = document.createElement("button");
    b.className = "deck-tab" + (d.id === state.activeDeckId ? " active" : "");
    b.textContent = d.name;
    b.onclick = () => {
      state.activeDeckId = d.id;
      persist();
      renderAll();
      fitWindow();
    };
    wrap.appendChild(b);
  });
}

function renderLayoutSwitch() {
  const { cols, rows } = deckGrid();
  if ($("#colVal")) $("#colVal").textContent = cols;
  if ($("#rowVal")) $("#rowVal").textContent = rows;
}

function renderGrid() {
  applySizeVars();
  const deck = activeDeck();
  const { cols, rows } = deckGrid(deck);
  const total = cols * rows;
  const grid = $("#grid");
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
      const tileColor = sanitizeColor(item.color);
      tile.className = "tile";
      tile.style.background = tileColor;
      // 밝은(파스텔) 배경엔 어두운 글자색
      tile.style.color = isLightColor(tileColor) ? "#1a1d23" : "#fff";
      tile.style.opacity = dim ? "0.25" : "1";
      tile.innerHTML = `
        ${item.textOnly ? "" : renderIconHtml(item.icon)}
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
    { url: "🌐", app: "🖥️", file: "📄", folder: "📂", hotkey: "⌨️" }[
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
  editTypeTargetLocked = !!(existing && existing.libraryLocked);
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
  applyEditLock();
  togglePickPathBtn();

  // 탭: 기존이 hotkey면 hotkey탭, 아니면 custom(편집) / 신규는 library
  switchTab(existing ? (draft.type === "hotkey" ? "hotkey" : "custom") : "library");
  show("editModal");
}

function collectDraftFromActiveTab() {
  const tab = $(".tab.active").dataset.tab;
  if (tab === "custom") {
    draft.label = $("#f_label").value.trim();
    if (!editTypeTargetLocked) {
      draft.type = $("#f_type").value;
      draft.target = $("#f_target").value.trim();
    }
  } else if (tab === "hotkey") {
    draft.label = $("#f_hk_label").value.trim();
    if (!editTypeTargetLocked) {
      draft.type = "hotkey";
      draft.target = $("#f_hk_combo").value.trim();
    }
  }
  // library 탭은 클릭 시 즉시 draft에 반영됨
}

function saveEdit() {
  collectDraftFromActiveTab();
  const safeDraft = sanitizeItem(draft);
  if (!safeDraft) return toast("지원하지 않는 유형입니다.");
  if (!safeDraft.label) return toast("이름을 입력하세요.");
  if (safeDraft.type !== "hotkey" && !safeDraft.target) return toast("대상을 입력하세요.");
  if (safeDraft.type === "hotkey" && !safeDraft.target) return toast("키 조합을 입력하세요.");
  activeDeck().items[editingSlot] = { ...safeDraft };
  persist();
  hide("editModal");
  renderGrid();
  setStatus("저장됨: " + safeDraft.label);
}

function deleteItem() {
  delete activeDeck().items[editingSlot];
  persist();
  hide("editModal");
  renderGrid();
}

function updatePreview() {
  const iconEl = $("#previewIcon");
  const icon = draft.textOnly ? null : draft.icon;
  if (draft.textOnly) {
    iconEl.textContent = "Aa";
  } else if (isImageIcon(icon)) {
    iconEl.innerHTML = `<img src="${icon}" style="width:100%;height:100%;object-fit:cover;border-radius:4px" alt="" />`;
  } else {
    iconEl.textContent = sanitizeIcon(icon);
  }
  $("#previewTile").style.background = sanitizeColor(draft.color, COLOR_PALETTE[0]);
}

/* --------------------------- 아이콘 / 색상 그리드 --------------------------- */
function buildIconGrid() {
  const grid = $("#iconGrid");
  grid.innerHTML = "";
  // 로봇 마스코트 섹션
  const robotTitle = document.createElement("div");
  robotTitle.className = "icon-cat-title";
  robotTitle.textContent = "로봇 마스코트";
  grid.appendChild(robotTitle);
  const robotRow = document.createElement("div");
  robotRow.className = "icon-row-robots";
  (window.ROBOT_ICONS || []).forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.dataset.icon = src;
    img.className = "icon-robot-thumb";
    img.draggable = false;
    img.onclick = () => {
      draft.icon = src;
      draft.textOnly = false;
      updatePreview();
      syncIconColorSelection();
    };
    robotRow.appendChild(img);
  });
  grid.appendChild(robotRow);
  // 이모지 아이콘
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
  const wrap = $("#colorGrid");
  wrap.className = ""; // 그룹 컨테이너로 사용
  wrap.innerHTML = "";
  COLOR_GROUPS.forEach((group) => {
    const title = document.createElement("div");
    title.className = "color-group-title";
    title.textContent = group.name;
    wrap.appendChild(title);
    const g = document.createElement("div");
    g.className = "color-grid";
    group.colors.forEach((c) => {
      const s = document.createElement("span");
      s.style.background = c;
      s.dataset.color = c;
      s.onclick = () => {
        draft.color = c;
        updatePreview();
        syncIconColorSelection();
      };
      g.appendChild(s);
    });
    wrap.appendChild(g);
  });
}

/* 앱 테마 스와치 (설정) */
function buildThemeGrid() {
  const grid = $("#themeGrid");
  grid.innerHTML = "";
  THEMES.forEach((t) => {
    const el = document.createElement("div");
    el.className = "theme-swatch" + (t.key === state.settings.theme ? " sel" : "");
    el.innerHTML = `
      <span class="sw-bar">
        <i style="background:${t.vars["--bg"]}"></i>
        <i style="background:${t.vars["--bg-3"]}"></i>
        <i style="background:${t.vars["--accent"]}"></i>
      </span>${t.name}`;
    el.onclick = () => {
      state.settings.theme = t.key;
      applyTheme();
      persist();
      buildThemeGrid();
    };
    grid.appendChild(el);
  });
}

function syncIconColorSelection() {
  $$("#iconGrid img.icon-robot-thumb").forEach((img) =>
    img.classList.toggle("sel", img.dataset.icon === draft.icon && !draft.textOnly)
  );
  $$("#iconGrid span").forEach((s) =>
    s.classList.toggle("sel", s.textContent === draft.icon && !draft.textOnly)
  );
  $$("#colorGrid span").forEach((s) =>
    s.classList.toggle("sel", s.dataset.color === draft.color)
  );
}

/* ------------------------------- 라이브러리 ------------------------------- */
function makeLibraryDeckItem(item) {
  const safe = sanitizeItem(item);
  return safe ? { ...safe, textOnly: false, libraryLocked: true } : null;
}

function buildLibPicker() {
  const wrap = $("#libPicker");
  wrap.innerHTML = "";
  getLibrary().forEach((cat) => {
    const title = document.createElement("div");
    title.className = "lib-cat-title";
    title.textContent = cat.category;
    wrap.appendChild(title);
    const items = document.createElement("div");
    items.className = "lib-items";
    cat.items.forEach((it) => {
      items.appendChild(makeLibItem(it, () => {
        draft = makeLibraryDeckItem(it);
        if (!draft) return toast("지원하지 않는 유형입니다.");
        editTypeTargetLocked = true;
        updatePreview();
        syncIconColorSelection();
        $("#f_label").value = it.label;
        $("#f_type").value = it.type === "hotkey" ? "url" : it.type;
        $("#f_target").value = it.target;
        $("#f_hk_label").value = it.label;
        $("#f_hk_combo").value = it.type === "hotkey" ? it.target : "";
        applyEditLock();
        switchTab(draft.type === "hotkey" ? "hotkey" : "custom");
        toast("선택됨: " + it.label + " — 저장을 누르세요");
      }));
    });
    wrap.appendChild(items);
  });
}

function makeLibItem(it, onClick) {
  const el = document.createElement("div");
  el.className = "lib-item";
  const iconHtml = isImageIcon(it.icon)
    ? `<img class="li-icon-img" src="${it.icon}" alt="" />`
    : `<span class="li-icon">${escapeHtml(sanitizeIcon(it.icon))}</span>`;
  el.innerHTML = `${iconHtml}
    <span class="li-text">${escapeHtml(it.label)}<small>${escapeHtml(it.target)}</small></span>`;
  el.onclick = onClick;
  return el;
}

function buildLibraryFull() {
  const wrap = $("#libraryFull");
  wrap.innerHTML = "";
  getLibrary().forEach((cat) => {
    const title = document.createElement("div");
    title.className = "lib-cat-title";
    title.textContent = cat.category;
    wrap.appendChild(title);
    const items = document.createElement("div");
    items.className = "lib-items";
    cat.items.forEach((it) => {
      items.appendChild(
        makeLibItem(it, () => {
          const item = makeLibraryDeckItem(it);
          if (item) addToFirstEmpty(item);
        })
      );
    });
    wrap.appendChild(items);
  });
}

function addToFirstEmpty(item) {
  const deck = activeDeck();
  const g = deckGrid(deck);
  const total = g.cols * g.rows;
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

/* ----------------------------- 관리자 잠금 ----------------------------- */
// 관리자 비밀번호는 비공개 파일(src/admin-config.js, git 제외)에서 주입.
// 그 파일이 없으면 아래 자리표시자가 쓰이며, 실제 비번은 공개 소스에 없음.
const ADMIN_PASSWORD = window.ADMIN_PW || "CHANGE_ME_IN_admin-config.js";
let adminUnlocked = false; // 세션 동안 유지

let pwResolver = null;
function askPassword(title, hint) {
  return new Promise((resolve) => {
    pwResolver = resolve;
    $("#pwTitle").textContent = title;
    $("#pwHint").textContent = hint || "";
    $("#pwInput").value = "";
    show("pwModal");
    setTimeout(() => $("#pwInput").focus(), 50);
  });
}
function resolvePw(val) {
  hide("pwModal");
  const r = pwResolver;
  pwResolver = null;
  if (r) r(val);
}

// 🛠️ 라이브러리 관리 진입 게이트 (고정 비밀번호)
async function requestAdminAccess() {
  if (adminUnlocked) return openLibMgr();
  const pw = await askPassword("🔒 관리자 인증", "라이브러리 관리는 관리자만 접근할 수 있습니다.");
  if (pw === null) return;
  if (pw === ADMIN_PASSWORD) {
    adminUnlocked = true;
    openLibMgr();
  } else {
    toast("비밀번호가 올바르지 않습니다.");
  }
}

/* 공지 (라이브러리 파일에 함께 담겨 배포) */
function renderInboxBadge() {
  const btn = $("#msgBtn");
  if (!btn) return;
  const seen = state.settings.seenMessageIds || [];
  const unread = (state.messages || []).filter((m) => !seen.includes(m.id)).length;
  let badge = btn.querySelector(".msg-badge");
  if (unread > 0) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "msg-badge";
      btn.appendChild(badge);
    }
    badge.textContent = unread > 9 ? "9+" : unread;
  } else if (badge) {
    badge.remove();
  }
}

function openInbox(auto) {
  const list = $("#inboxList");
  list.innerHTML = "";
  const msgs = state.messages || [];
  if (!msgs.length) {
    list.innerHTML = '<p class="hint">받은 공지가 없습니다.</p>';
  } else {
    msgs
      .slice()
      .reverse()
      .forEach((m) => {
        const el = document.createElement("div");
        el.className = "inbox-msg";
        el.innerHTML = `<div class="im-head"><span class="im-title">📩 ${escapeHtml(
          m.title
        )}</span><span class="im-date">${escapeHtml(m.date)}</span></div>
          <div class="im-body">${escapeHtml(m.body)}</div>`;
        list.appendChild(el);
      });
  }
  // 모두 읽음 처리
  const seen = new Set(state.settings.seenMessageIds || []);
  msgs.forEach((m) => seen.add(m.id));
  state.settings.seenMessageIds = [...seen];
  persist();
  renderInboxBadge();
  show("inboxModal");
}

/* ------------------------- 라이브러리 관리 (관리자) ------------------------- */
let libMgrEditing = null; // {ci, ii} 또는 null

function ensureLibraryCopy() {
  // 아직 직접 편집한 적이 없으면 항상 현재 기준 라이브러리(코드/원격)에서 새로 복사
  if (!state.libraryEdited || !Array.isArray(state.library)) {
    state.library = JSON.parse(JSON.stringify(getLibrary()));
  }
}

// 앱 내 편집 발생 시 호출 — 이후부터 코드 기본값 대신 편집본을 사용
function markLibraryEdited() {
  state.libraryEdited = true;
}

function openLibMgr() {
  ensureLibraryCopy();
  buildLmPickers();
  clearLibForm();
  renderLibMgr();
  renderNcList();
  $("#s_version").value = appVersion();
  show("libMgrModal");
}

function renderLibMgr() {
  const list = $("#libMgrList");
  list.innerHTML = "";
  const catSet = new Set();
  state.library.forEach((cat, ci) => {
    catSet.add(cat.category);
    cat.items.forEach((it, ii) => {
      const row = document.createElement("div");
      row.className = "libmgr-row";
      row.innerHTML = `
        ${renderIconHtml(it.icon, "lr-icon")}
        <span class="lr-main">${escapeHtml(it.label)}<small>${typeBadge(it.type)} ${escapeHtml(it.target)}</small></span>
        <span class="lr-cat">${escapeHtml(cat.category)}</span>
        <button class="mini-btn" data-edit>수정</button>
        <button class="mini-btn danger" data-del>삭제</button>`;
      row.querySelector("[data-edit]").onclick = () => loadLibForm(ci, ii);
      row.querySelector("[data-del]").onclick = () => {
        markLibraryEdited();
        cat.items.splice(ii, 1);
        if (cat.items.length === 0) state.library.splice(ci, 1);
        persist();
        renderLibMgr();
      };
      list.appendChild(row);
    });
  });
  const dl = $("#lm_cat_list");
  dl.innerHTML = "";
  catSet.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    dl.appendChild(o);
  });
}

function loadLibForm(ci, ii) {
  libMgrEditing = { ci, ii };
  const it = state.library[ci].items[ii];
  $("#lm_label").value = it.label || "";
  $("#lm_category").value = state.library[ci].category;
  $("#lm_type").value = it.type || "url";
  $("#lm_target").value = it.target || "";
  $("#lm_icon").value = sanitizeIcon(it.icon);
  $("#lm_color").value = sanitizeColor(it.color);
  updateLmPreview();
  $("#lm_addBtn").textContent = "✎ 수정 내용 저장";
}

function clearLibForm() {
  libMgrEditing = null;
  ["lm_label", "lm_category", "lm_target"].forEach((id) => ($("#" + id).value = ""));
  $("#lm_type").value = "url";
  $("#lm_icon").value = "📁";
  $("#lm_color").value = "#2d3748";
  updateLmPreview();
  $("#lm_addBtn").textContent = "＋ 라이브러리에 추가 / 수정";
}

// 라이브러리 관리 — 아이콘/색상 시각 선택기
let lmPickersBuilt = false;
function buildLmPickers() {
  if (lmPickersBuilt) return;
  lmPickersBuilt = true;
  const ig = $("#lm_iconGrid");
  ig.innerHTML = "";
  // 로봇 마스코트 섹션
  const robotTitle = document.createElement("div");
  robotTitle.className = "icon-cat-title";
  robotTitle.textContent = "로봇 마스코트";
  ig.appendChild(robotTitle);
  const robotRow = document.createElement("div");
  robotRow.className = "icon-row-robots";
  (window.ROBOT_ICONS || []).forEach((src) => {
    const img = document.createElement("img");
    img.src = src;
    img.dataset.icon = src;
    img.className = "icon-robot-thumb";
    img.draggable = false;
    img.onclick = () => {
      $("#lm_icon").value = src;
      updateLmPreview();
    };
    robotRow.appendChild(img);
  });
  ig.appendChild(robotRow);
  ALL_ICONS.forEach((ic) => {
    const s = document.createElement("span");
    s.textContent = ic;
    s.onclick = () => {
      $("#lm_icon").value = ic;
      updateLmPreview();
    };
    ig.appendChild(s);
  });
  const cg = $("#lm_colorGrid");
  cg.innerHTML = "";
  COLOR_GROUPS.forEach((group) => {
    const title = document.createElement("div");
    title.className = "color-group-title";
    title.textContent = group.name;
    cg.appendChild(title);
    const g = document.createElement("div");
    g.className = "color-grid";
    group.colors.forEach((c) => {
      const s = document.createElement("span");
      s.style.background = c;
      s.dataset.color = c;
      s.onclick = () => {
        $("#lm_color").value = c;
        updateLmPreview();
      };
      g.appendChild(s);
    });
    cg.appendChild(g);
  });
}

function updateLmPreview() {
  const iconVal = sanitizeIcon($("#lm_icon").value);
  const color = sanitizeColor($("#lm_color").value);
  const pv = $("#lm_preview");
  if (pv) {
    if (isImageIcon(iconVal)) {
      pv.innerHTML = `<img src="${iconVal}" style="width:100%;height:100%;object-fit:cover;border-radius:4px" alt="" />`;
      pv.style.background = "transparent";
    } else {
      pv.textContent = iconVal;
      pv.style.background = color;
    }
    pv.style.color = isLightColor(color) ? "#1a1d23" : "#fff";
  }
  $$("#lm_iconGrid img.icon-robot-thumb").forEach((img) =>
    img.classList.toggle("sel", img.dataset.icon === iconVal)
  );
  $$("#lm_iconGrid span").forEach((s) =>
    s.classList.toggle("sel", s.textContent === iconVal)
  );
  $$("#lm_colorGrid span").forEach((s) =>
    s.classList.toggle("sel", s.dataset.color === color)
  );
}

function libMgrAddOrUpdate() {
  markLibraryEdited();
  ensureLibraryCopy();
  const label = $("#lm_label").value.trim();
  const category = $("#lm_category").value.trim() || "기타";
  const type = $("#lm_type").value;
  const target = $("#lm_target").value.trim();
  const icon = sanitizeIcon($("#lm_icon").value);
  const color = sanitizeColor($("#lm_color").value);
  if (!label) return toast("이름을 입력하세요.");
  if (!target) return toast("대상을 입력하세요.");
  if (!SAFE_ITEM_TYPES.has(type)) return toast("지원하지 않는 유형입니다.");
  const item = sanitizeItem({ label, type, target, icon, color });
  if (!item) return toast("지원하지 않는 유형입니다.");
  if (libMgrEditing) {
    const { ci, ii } = libMgrEditing;
    state.library[ci].items.splice(ii, 1);
    if (state.library[ci].items.length === 0) state.library.splice(ci, 1);
  }
  let cat = state.library.find((c) => c.category === category);
  if (!cat) {
    cat = { category, items: [] };
    state.library.push(cat);
  }
  cat.items.push(item);
  persist();
  clearLibForm();
  renderLibMgr();
  toast("저장됨: " + label);
}

// 라이브러리 + 공지를 하나의 로컬 파일로 내보내기 (관리자 → 배포)
async function libMgrExport() {
  ensureLibraryCopy();
  const json = JSON.stringify(
    {
      __quicklaunchLibrary: true,
      version: 1,
      library: state.library,
      messages: state.messages || [],
    },
    null,
    2
  );
  const res = await window.api.exportSave(json);
  if (res.ok) toast("라이브러리 + 공지 내보냄: " + res.path);
  else if (!res.canceled) toast("내보내기 실패: " + res.error);
}

// 공지 작성 → 로컬 state.messages 에 추가 (라이브러리 내보내기에 함께 담김)
function noticeAdd() {
  const title = $("#nc_title").value.trim();
  const body = $("#nc_body").value.trim();
  if (!title) return toast("공지 제목을 입력하세요.");
  if (!Array.isArray(state.messages)) state.messages = [];
  state.messages.push({
    id: Date.now(),
    title,
    body,
    date: new Date().toISOString().slice(0, 10),
  });
  markLibraryEdited();
  persist();
  $("#nc_title").value = "";
  $("#nc_body").value = "";
  renderNcList();
  renderInboxBadge();
  toast("공지 추가됨");
}

// libMgr 안의 작성된 공지 목록 (삭제 가능)
function renderNcList() {
  const wrap = $("#nc_list");
  if (!wrap) return;
  wrap.innerHTML = "";
  (state.messages || []).forEach((m, i) => {
    const row = document.createElement("div");
    row.className = "nc-row";
    row.innerHTML = `<span class="nc-t">📢 ${escapeHtml(m.title)} <small>${escapeHtml(m.date)}</small></span>`;
    const del = document.createElement("button");
    del.className = "mini-btn danger";
    del.textContent = "삭제";
    del.onclick = () => {
      state.messages.splice(i, 1);
      markLibraryEdited();
      persist();
      renderNcList();
      renderInboxBadge();
    };
    row.appendChild(del);
    wrap.appendChild(row);
  });
}

// 설정 → 라이브러리 파일 가져오기 (바로가기 + 공지 함께 갱신)
async function importLibrary() {
  const res = await window.api.importOpen();
  if (res.canceled) return;
  if (!res.ok) return toast("가져오기 실패: " + res.error);
  try {
    const data = JSON.parse(res.data);
    const lib = data.library || (Array.isArray(data) ? data : null);
    if (!lib || !Array.isArray(lib)) throw new Error("라이브러리 파일이 아닙니다.");
    const cleanedLib = sanitizeLibrary(lib);
    if (!cleanedLib.length) throw new Error("가져올 수 있는 바로가기가 없습니다.");
    state.library = cleanedLib;
    if (Array.isArray(data.messages)) state.messages = data.messages;
    markLibraryEdited();
    persist();
    renderInboxBadge();
    toast("라이브러리 갱신됨 (" + cleanedLib.length + "개 카테고리)");
  } catch (e) {
    toast("가져오기 실패: " + e.message);
  }
}

function libMgrReset() {
  if (!confirm("라이브러리를 코드 기본값(library.js)으로 되돌릴까요?")) return;
  state.libraryEdited = false;
  state.library = null;
  ensureLibraryCopy(); // 코드 기본값에서 다시 채움
  persist();
  clearLibForm();
  renderLibMgr();
  toast("기본값으로 복원됨");
}

/* ----------------------------- 덱 내보내기/가져오기 ----------------------------- */
// 현재 덱 1개만 내보내기 (확인 후)
async function doExport() {
  const deck = activeDeck();
  const g = deckGrid(deck);
  const count = Object.keys(deck.items || {}).length;
  if (!confirm(`현재 덱 "${deck.name}" (${g.cols}×${g.rows}, 바로가기 ${count}개)을(를) 파일로 내보내시겠습니까?`))
    return;
  const json = JSON.stringify(
    { __quicklaunchDeck: true, version: 1, deck: { name: deck.name, cols: g.cols, rows: g.rows, items: deck.items } },
    null,
    2
  );
  const res = await window.api.exportSave(json);
  if (res.ok) toast("덱 내보냄: " + res.path);
  else if (!res.canceled) toast("내보내기 실패: " + res.error);
}

// 덱 파일 가져오기 → 새 덱으로 추가 (구버전 프로필도 호환)
async function doImport() {
  const res = await window.api.importOpen();
  if (res.canceled) return;
  if (!res.ok) return toast("가져오기 실패: " + res.error);
  try {
    const data = JSON.parse(res.data);
    let added = 0;
    const addDeckObj = (d) => {
      const id = "deck" + Date.now() + Math.floor(Math.random() * 1000);
      state.decks.push({
        id,
        name: (d.name || "덱") + " (가져옴)",
        cols: clampGrid(d.cols || 4),
        rows: clampGrid(d.rows || 3),
        items: sanitizeItemsMap(d.items),
      });
      state.activeDeckId = id;
      added++;
    };
    if (data.deck) addDeckObj(data.deck);
    else if (Array.isArray(data.decks)) data.decks.forEach(addDeckObj);
    else throw new Error("덱 파일이 아닙니다.");
    persist();
    renderAll();
    fitWindow();
    toast("덱 가져옴 (" + added + "개)");
  } catch (e) {
    toast("가져오기 실패: " + e.message);
  }
}

/* ------------------------------- 설정/덱 관리 ------------------------------- */
function openSettings() {
  $("#s_hotkey").value = state.settings.globalHotkey;
  buildThemeGrid();
  updateModeLabel();
  switchSettingsTab("general");
  show("settingsModal");
}

function switchSettingsTab(name) {
  $$("#settingsTabs .tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.stab === name)
  );
  $$('#settingsModal .stab-pane').forEach((p) =>
    p.classList.toggle("active", p.dataset.spane === name)
  );
}

function updateModeLabel() {
  const el = $("#s_modeLabel");
  if (el) el.textContent = "현재: " + (state.settings.liteMode ? "Lite (50px)" : "기본 (100px)");
}

function updateModePill() {
  $("#modeToggle").textContent = state.settings.liteMode ? "Lite" : "기본";
}

function toggleLiteMode() {
  state.settings.liteMode = !state.settings.liteMode;
  persist();
  updateModePill();
  updateModeLabel();
  renderGrid();
  fitWindow();
  toast(state.settings.liteMode ? "Lite 창 (50px)" : "기본 창 (100px)");
}

async function applyHotkey() {
  const accel = $("#s_hotkey").value.trim();
  state.settings.globalHotkey = accel;
  persist();
  await window.api.registerHotkey(accel);
  $("#hotkeyHint").textContent = "전역 단축키: " + accel;
}

function applyTheme() {
  const key = state.settings.theme || "dark";
  const theme = THEMES.find((t) => t.key === key) || THEMES[0];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

// 모드/레이아웃에 맞춰 타일 크기 CSS 변수 적용 후 창 크기 자동 조정
function applySizeVars() {
  const s = state.settings.liteMode ? SIZES.lite : SIZES.normal;
  const { cols } = deckGrid();
  const root = document.documentElement;
  root.style.setProperty("--cols", cols);
  root.style.setProperty("--tile", s.tile + "px");
  root.style.setProperty("--gap", s.gap + "px");
  root.style.setProperty("--stage-pad", s.pad + "px");
  root.style.setProperty("--icon-size", s.icon + "px");
  root.style.setProperty("--label-size", s.label + "px");
  root.style.setProperty("--tile-inner-gap", s.innerGap + "px");
  document.body.classList.toggle("lite", !!state.settings.liteMode);
}

// 목표 콘텐츠 폭에서 헤더가 몇 줄로 접히는지 미리 측정 (실제 리사이즈 전에 결정)
function measureHeaderHeight(contentW) {
  const tb = document.querySelector(".topbar");
  const prev = tb.style.width;
  tb.style.width = contentW + "px"; // box-sizing:border-box → 콘텐츠 폭 기준 줄바꿈
  const h = tb.offsetHeight;
  tb.style.width = prev;
  return h;
}

function fitWindow() {
  applySizeVars();
  const s = state.settings.liteMode ? SIZES.lite : SIZES.normal;
  const { cols, rows } = deckGrid();
  const gridW = cols * s.tile + (cols - 1) * s.gap;
  const gridH = rows * s.tile + (rows - 1) * s.gap;
  const contentW = Math.max(gridW + s.pad * 2, 340);
  // 목표 폭에서의 헤더 높이를 미리 측정 → 스크롤 없이 한 번에 정확히 맞춤
  const headerH = measureHeaderHeight(contentW);
  const statusH = document.querySelector(".statusbar").offsetHeight || 30;
  const contentH = headerH + statusH + gridH + s.pad * 2 + 2; // +2: 반올림 여유
  window.api.resizeWindow(contentW, contentH);
}

function addDeck() {
  const name = $("#newDeckName").value.trim() || "새 덱";
  const id = "deck" + Date.now();
  state.decks.push({ id, name, cols: 4, rows: 3, items: {} });
  state.activeDeckId = id;
  $("#newDeckName").value = "";
  persist();
  renderAll();
  fitWindow();
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
  buildThemeGrid();
  renderAll();
  fitWindow();
  hide("settingsModal");
}

/* ------------------------------- 탭/모달 헬퍼 ------------------------------- */
function switchTab(name) {
  $$("#editTabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$('#editModal .tab-pane').forEach((p) =>
    p.classList.toggle("active", p.dataset.pane === name)
  );
}

function applyEditLock() {
  const locked = editTypeTargetLocked;
  const type = draft ? draft.type : "";
  $("#libraryLockHint").classList.toggle("hidden", !locked);
  $("#f_type").disabled = locked;
  $("#f_target").readOnly = locked;
  $("#f_hk_combo").dataset.locked = locked ? "1" : "";
  $$("#editTabs .tab").forEach((tab) => {
    const name = tab.dataset.tab;
    tab.disabled =
      locked &&
      ((type === "hotkey" && name !== "hotkey") || (type !== "hotkey" && name !== "custom"));
  });
}

function show(id) { $("#" + id).classList.remove("hidden"); }
function hide(id) { $("#" + id).classList.add("hidden"); }

function togglePickPathBtn() {
  const type = $("#f_type").value;
  const show = type === "app" || type === "file" || type === "folder";
  $("#pickPathBtn").classList.toggle("hidden", editTypeTargetLocked || !show);
}

/* ------------------------------- 이벤트 바인딩 ------------------------------- */
function bindEvents() {
  // 그리드 크기 조절 (가로/세로 +/−) — 변경 시 창 자동 리사이즈(스크롤 없음)
  function adjustGrid(axis, delta) {
    const deck = activeDeck();
    const g = deckGrid(deck);
    if (axis === "cols") deck.cols = clampGrid(g.cols + delta);
    else deck.rows = clampGrid(g.rows + delta);
    persist();
    renderAll();
    fitWindow();
  }
  $("#colMinus").onclick = () => adjustGrid("cols", -1);
  $("#colPlus").onclick = () => adjustGrid("cols", 1);
  $("#rowMinus").onclick = () => adjustGrid("rows", -1);
  $("#rowPlus").onclick = () => adjustGrid("rows", 1);

  // 창 크기 모드 토글 (기본 ↔ Lite) — 브랜드 옆 라벨
  $("#modeToggle").onclick = toggleLiteMode;
  updateModePill();

  // 공지사항
  $("#msgBtn").onclick = () => openInbox(false);

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
  $("#settingsBtn").onclick = openSettings;
  $("#quitBtn").onclick = () => window.api.quitApp();

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
    if (hk.dataset.locked === "1") return;
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

  // 설정 — 일반
  $("#s_hotkey").onchange = applyHotkey;
  $("#s_modeToggle").onclick = toggleLiteMode;
  $("#addDeckBtn").onclick = addDeck;
  $("#renameDeckBtn").onclick = renameDeck;
  $("#deleteDeckBtn").onclick = deleteDeck;
  $("#resetBtn").onclick = resetAll;

  // 설정 — 탭 전환 (관리자 탭은 비밀번호 필요)
  $$("#settingsTabs .tab").forEach((t) => {
    t.onclick = () => {
      if (t.dataset.stab === "admin" && !adminUnlocked) {
        requestAdminAccess(); // 비밀번호 → 라이브러리 관리 열림
        return;
      }
      switchSettingsTab(t.dataset.stab);
    };
  });

  // 설정 — 가져오기/보내기
  $("#s_libImportBtn").onclick = importLibrary;
  $("#s_deckExportBtn").onclick = doExport;
  $("#s_deckImportBtn").onclick = doImport;

  // 설정 — 관리자
  $("#s_versionApply").onclick = () => {
    const v = $("#s_version").value.trim();
    state.settings.appVersion = v || undefined;
    persist();
    renderVersion();
    toast("버전 표기: v" + appVersion());
  };
  $("#s_libMgrBtn").onclick = () => {
    hide("settingsModal");
    requestAdminAccess();
  };

  // 비밀번호 모달
  $("#pwOk").onclick = () => resolvePw($("#pwInput").value);
  $("#pwCancel").onclick = () => resolvePw(null);
  $('[data-close="pwModal"]').onclick = () => resolvePw(null);
  $("#pwInput").onkeydown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); resolvePw($("#pwInput").value); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); resolvePw(null); }
  };

  // 라이브러리 관리자 폼
  $("#lm_addBtn").onclick = libMgrAddOrUpdate;
  $("#lm_exportBtn").onclick = libMgrExport;
  $("#lm_resetBtn").onclick = libMgrReset;
  $("#nc_addBtn").onclick = noticeAdd;

  // ESC로 모달 닫기
  document.onkeydown = (e) => {
    if (e.key !== "Escape") return;
    if (pwResolver) resolvePw(null); // 대기 중인 비번 프롬프트 정리
    $$(".modal:not(.hidden)").forEach((m) => m.classList.add("hidden"));
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
