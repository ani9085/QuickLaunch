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
// 기본 원격 동기화 위치 = GitHub 'QuickLaunch' 저장소 (raw)
const DEFAULT_REMOTE_LIB =
  "https://raw.githubusercontent.com/ani9085/QuickLaunch/main/library.json";
const DEFAULT_REMOTE_MSG =
  "https://raw.githubusercontent.com/ani9085/QuickLaunch/main/messages.json";

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
      { id: "deck1", name: "기본", layout: "5x3", items: {} },
    ],
    settings: {
      globalHotkey: "CommandOrControl+Shift+Space",
      theme: "dark",
      liteMode: false,
      remoteSync: true,
      remoteUrl: DEFAULT_REMOTE_LIB,
      noticeUrl: DEFAULT_REMOTE_MSG,
      lastNoticeId: null,
      seenMessageIds: [],
    },
    library: null, // 관리자가 앱에서 편집한 사본 (libraryEdited=true일 때만 사용)
    libraryEdited: false, // 관리자가 앱 내에서 직접 편집했는지
    remoteLibrary: null, // 원격 동기화 캐시 (오프라인 시에도 사용)
    messages: [], // 관리자 쪽지/공지 (원격 messages.json 캐시)
  };
}

// 우선순위: (원격 동기화 켜짐+수신) > (관리자가 앱에서 편집) > 코드 기본값(SHORTCUT_LIBRARY)
// 코드(library.js)를 기준으로 삼아, 재빌드 시 라이브러리 변경이 항상 반영되게 함.
function getLibrary() {
  if (
    state.settings.remoteSync &&
    Array.isArray(state.remoteLibrary) &&
    state.remoteLibrary.length
  )
    return state.remoteLibrary;
  if (state.libraryEdited && Array.isArray(state.library) && state.library.length)
    return state.library;
  return SHORTCUT_LIBRARY;
}

async function init() {
  const loaded = await window.api.loadData();
  state = loaded && loaded.decks ? loaded : defaultState();
  // 누락 필드 보정 (구버전 데이터 호환)
  if (!state.settings) state.settings = defaultState().settings;
  if (state.settings.liteMode === undefined) state.settings.liteMode = false;
  if (!state.settings.theme) state.settings.theme = "dark";
  // 원격 동기화 기본값 보정 (구버전 데이터)
  if (!state.settings.remoteUrl) state.settings.remoteUrl = DEFAULT_REMOTE_LIB;
  if (!state.settings.noticeUrl) state.settings.noticeUrl = DEFAULT_REMOTE_MSG;
  if (state.settings.remoteSync === undefined) state.settings.remoteSync = true;
  if (!Array.isArray(state.settings.seenMessageIds)) state.settings.seenMessageIds = [];
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
  renderInboxBadge(); // 캐시된 쪽지의 미읽음 배지
  // 자동 업데이트 상태 알림
  if (window.api.onUpdateStatus)
    window.api.onUpdateStatus((d) => {
      if (d.state === "available") setStatus("업데이트 확인됨: v" + d.version + " 내려받는 중…");
      else if (d.state === "progress") setStatus("업데이트 다운로드 " + d.percent + "%");
      else if (d.state === "downloaded") setStatus("업데이트 준비됨: v" + d.version);
    });
  syncRemote(false); // 시작 시 백그라운드 동기화 (실패해도 무방)
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
    L[1]?.items[3], // 저장 단축키
  ].filter(Boolean);
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
  const layout = activeDeck().layout;
  $$("#layoutSwitch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.layout === layout);
  });
}

function renderGrid() {
  applySizeVars();
  const deck = activeDeck();
  const { cols, rows } = LAYOUTS[deck.layout];
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
      tile.className = "tile";
      tile.style.background = item.color || "#2d3748";
      // 밝은(파스텔) 배경엔 어두운 글자색
      tile.style.color = isLightColor(item.color) ? "#1a1d23" : "#fff";
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
  getLibrary().forEach((cat) => {
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

/* ----------------------- 원격 동기화 (라이브러리/공지) ----------------------- */
// 앱 시작 시/수동으로 호출. 실패해도 로컬/캐시로 계속 동작 (오프라인 안전)
async function syncRemote(manual) {
  const s = state.settings;
  if (!s.remoteSync && !manual) return;
  if (!s.remoteUrl && !s.noticeUrl) {
    if (manual) toast("동기화할 URL이 설정되지 않았습니다.");
    return;
  }
  let okCount = 0;
  // 1) 라이브러리
  if (s.remoteUrl) {
    try {
      const res = await window.api.fetchUrl(s.remoteUrl);
      if (!res.ok) throw new Error(res.error || "HTTP " + res.status);
      const data = JSON.parse(res.body);
      const lib = data.library || (Array.isArray(data) ? data : null);
      if (!lib || !Array.isArray(lib)) throw new Error("라이브러리 형식 아님");
      state.remoteLibrary = lib;
      okCount++;
      // 열려 있으면 갱신
      if (!$("#editModal").classList.contains("hidden")) buildLibPicker();
      if (!$("#libraryModal").classList.contains("hidden")) buildLibraryFull();
    } catch (e) {
      setStatus("라이브러리 동기화 실패(로컬 사용): " + e.message);
    }
  }
  // 2) 쪽지/공지 (관리자 → 전체 브로드캐스트). 배열 또는 단일 객체 모두 지원
  if (s.noticeUrl) {
    try {
      const res = await window.api.fetchUrl(s.noticeUrl);
      if (res.ok) {
        const data = JSON.parse(res.body);
        let msgs = Array.isArray(data)
          ? data
          : data.messages || (data.title ? [data] : []);
        msgs = msgs
          .filter((m) => m && m.title)
          .map((m) => ({
            id: String(m.id != null ? m.id : m.date || m.title),
            title: m.title,
            body: m.body || "",
            date: m.date || "",
          }));
        state.messages = msgs;
        okCount++;
        renderInboxBadge();
        const unread = msgs.filter((m) => !s.seenMessageIds.includes(m.id));
        if (unread.length) openInbox(true); // 새 쪽지 있으면 자동 표시
      }
    } catch (e) {
      /* 쪽지는 조용히 무시 */
    }
  }
  persist(); // 캐시 저장
  updateSyncStatus();
  if (manual) toast(okCount ? "동기화 완료" : "동기화 실패 — URL/네트워크 확인");
}

/* 쪽지함 (받은 공지 목록) */
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
    list.innerHTML = '<p class="hint">받은 쪽지가 없습니다.</p>';
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

function updateSyncStatus() {
  const el = $("#s_syncStatus");
  if (!el) return;
  const s = state.settings;
  el.textContent = s.remoteSync
    ? "상태: 사용 중" + (state.remoteLibrary ? " · 라이브러리 동기화됨" : " · 아직 받지 못함")
    : "상태: 사용 안 함 (로컬 라이브러리 사용)";
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
  clearLibForm();
  renderLibMgr();
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
        <span class="lr-icon">${it.icon || "📁"}</span>
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
  $("#lm_icon").value = it.icon || "";
  $("#lm_color").value = it.color || "";
  $("#lm_addBtn").textContent = "✎ 수정 내용 저장";
}

function clearLibForm() {
  libMgrEditing = null;
  ["lm_label", "lm_category", "lm_target", "lm_icon", "lm_color"].forEach(
    (id) => ($("#" + id).value = "")
  );
  $("#lm_type").value = "url";
  $("#lm_addBtn").textContent = "＋ 라이브러리에 추가 / 수정";
}

function libMgrAddOrUpdate() {
  markLibraryEdited();
  ensureLibraryCopy();
  const label = $("#lm_label").value.trim();
  const category = $("#lm_category").value.trim() || "기타";
  const type = $("#lm_type").value;
  const target = $("#lm_target").value.trim();
  const icon = $("#lm_icon").value.trim() || "📁";
  const color = $("#lm_color").value.trim() || "#2d3748";
  if (!label) return toast("이름을 입력하세요.");
  if (!target) return toast("대상을 입력하세요.");
  const item = { label, type, target, icon, color };
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

async function libMgrExport() {
  ensureLibraryCopy();
  const json = JSON.stringify(
    { __quicklaunchLibrary: true, version: 1, library: state.library },
    null,
    2
  );
  const res = await window.api.exportSave(json);
  if (res.ok) toast("라이브러리 내보냄: " + res.path);
  else if (!res.canceled) toast("내보내기 실패: " + res.error);
}

async function libMgrImport() {
  const res = await window.api.importOpen();
  if (res.canceled) return;
  if (!res.ok) return toast("가져오기 실패: " + res.error);
  try {
    const data = JSON.parse(res.data);
    const lib = data.library || (Array.isArray(data) ? data : null);
    if (!lib || !Array.isArray(lib)) throw new Error("라이브러리 형식이 아닙니다.");
    state.library = lib;
    markLibraryEdited();
    persist();
    renderLibMgr();
    toast("라이브러리 가져옴 (" + lib.length + "개 카테고리)");
  } catch (e) {
    toast("가져오기 실패: " + e.message);
  }
}

async function noticeExport() {
  const title = $("#nc_title").value.trim();
  const body = $("#nc_body").value.trim();
  if (!title) return toast("쪽지 제목을 입력하세요.");
  const msg = {
    id: Date.now(),
    title,
    body,
    date: new Date().toISOString().slice(0, 10),
  };
  // messages.json = 배열. 기존 원격 쪽지가 있으면 합쳐서 누적
  const existing = Array.isArray(state.messages) ? state.messages : [];
  const messages = [...existing, msg];
  const res = await window.api.exportSave(JSON.stringify(messages, null, 2));
  if (res.ok)
    toast("messages.json 내보냄 — GitHub 'QuickLaunch'에 올리면 전원에게 전달됩니다");
  else if (!res.canceled) toast("내보내기 실패: " + res.error);
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
    fitWindow();
    toast("가져오기 완료: " + data.decks.length + "개 덱 추가");
  } catch (e) {
    toast("가져오기 실패: " + e.message);
  }
}

/* ------------------------------- 설정/덱 관리 ------------------------------- */
function openSettings() {
  $("#s_hotkey").value = state.settings.globalHotkey;
  buildThemeGrid();
  updateModeLabel();
  $("#s_remoteSync").checked = !!state.settings.remoteSync;
  $("#s_remoteUrl").value = state.settings.remoteUrl || "";
  $("#s_noticeUrl").value = state.settings.noticeUrl || "";
  updateSyncStatus();
  show("settingsModal");
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
  const { cols } = LAYOUTS[activeDeck().layout];
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
  const { cols, rows } = LAYOUTS[activeDeck().layout];
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

function show(id) { $("#" + id).classList.remove("hidden"); }
function hide(id) { $("#" + id).classList.add("hidden"); }

function togglePickPathBtn() {
  const type = $("#f_type").value;
  const show = type === "app" || type === "file" || type === "folder";
  $("#pickPathBtn").classList.toggle("hidden", !show);
}

/* ------------------------------- 이벤트 바인딩 ------------------------------- */
function bindEvents() {
  // 레이아웃 전환 — 창 크기 자동 조정
  $$("#layoutSwitch button").forEach((b) => {
    b.onclick = () => {
      activeDeck().layout = b.dataset.layout;
      persist();
      renderAll();
      fitWindow();
    };
  });

  // 창 크기 모드 토글 (기본 ↔ Lite) — 브랜드 옆 라벨
  $("#modeToggle").onclick = toggleLiteMode;
  updateModePill();

  // 라이브러리 관리(관리자)
  $("#libMgrBtn").onclick = requestAdminAccess;

  // 쪽지함
  $("#msgBtn").onclick = () => openInbox(false);

  // 업데이트 수동 확인
  $("#s_updateBtn").onclick = async () => {
    $("#s_updateStatus").textContent = "확인 중…";
    const r = await window.api.checkUpdate();
    if (!r.ok) $("#s_updateStatus").textContent = r.error || "확인 실패";
    else $("#s_updateStatus").textContent = "최신 여부 확인 중… (있으면 자동 다운로드)";
  };

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
  $("#s_modeToggle").onclick = toggleLiteMode;
  $("#addDeckBtn").onclick = addDeck;
  $("#renameDeckBtn").onclick = renameDeck;
  $("#deleteDeckBtn").onclick = deleteDeck;
  $("#resetBtn").onclick = resetAll;

  // 원격 동기화
  $("#s_remoteSync").onchange = () => {
    state.settings.remoteSync = $("#s_remoteSync").checked;
    persist();
    updateSyncStatus();
    if (state.settings.remoteSync) syncRemote(false);
  };
  $("#s_remoteUrl").onchange = () => {
    state.settings.remoteUrl = $("#s_remoteUrl").value.trim();
    persist();
  };
  $("#s_noticeUrl").onchange = () => {
    state.settings.noticeUrl = $("#s_noticeUrl").value.trim();
    persist();
  };
  $("#s_syncNow").onclick = () => {
    state.settings.remoteUrl = $("#s_remoteUrl").value.trim();
    state.settings.noticeUrl = $("#s_noticeUrl").value.trim();
    persist();
    syncRemote(true);
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
  $("#lm_importBtn").onclick = libMgrImport;
  $("#lm_resetBtn").onclick = libMgrReset;
  $("#nc_exportBtn").onclick = noticeExport;

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
