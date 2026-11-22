/* ===== Lines to Fill (multi halaman) =====
   Local Storage:
   - ltf_users   : { username: { password, level, score, highScore, solved, history[] } }
   - ltf_session : username yang sedang login
   Catatan: password disimpan polos HANYA untuk simulasi belajar. */

const LS_USERS = "ltf_users";
const LS_SESSION = "ltf_session";
const $ = (s) => document.querySelector(s);
const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
const page = document.body.dataset.page;

/* ---------- Local Storage helper ---------- */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(LS_USERS)) || {}; }
  catch (e) { return {}; }
}
function saveUsers(u) { localStorage.setItem(LS_USERS, JSON.stringify(u)); }
function getSession() { return localStorage.getItem(LS_SESSION); }
function currentUser() {
  const name = getSession();
  const users = getUsers();
  return name && users[name] ? { name, data: users[name] } : null;
}
function updateUser(mutator) {
  const users = getUsers();
  const name = getSession();
  if (!name || !users[name]) return;
  mutator(users[name]);
  saveUsers(users);
}

/* ---------- Navigasi & penjaga halaman ---------- */
function go(p) { location.href = p + ".html"; }

let redirecting = false;
if (["dashboard", "game"].includes(page) && !currentUser()) { redirecting = true; go("login"); }
if (["login", "register"].includes(page) && currentUser()) { redirecting = true; go("dashboard"); }

function setMsg(id, text, type) {
  const el = $(id);
  el.textContent = text;
  el.className = "msg " + (type || "");
}

function logout() {
  stopTimer();
  localStorage.removeItem(LS_SESSION); // hanya hapus sesi, data akun & skor tetap
  go("index");
}
on("#btn-logout-dash", "click", logout);
on("#btn-logout-game", "click", logout);

/* ---------- Register ---------- */
on("#form-register", "submit", (e) => {
  e.preventDefault();
  const username = $("#reg-username").value.trim();
  const pass = $("#reg-password").value;
  const confirm = $("#reg-confirm").value;

  if (!/^[A-Za-z0-9_]{4,16}$/.test(username))
    return setMsg("#msg-register", "Username 4-16 karakter: huruf, angka, atau garis bawah.", "error");
  if (pass.length < 6)
    return setMsg("#msg-register", "Password minimal 6 karakter.", "error");
  if (pass !== confirm)
    return setMsg("#msg-register", "Konfirmasi password tidak sama.", "error");

  const users = getUsers();
  const taken = Object.keys(users).some((u) => u.toLowerCase() === username.toLowerCase());
  if (taken)
    return setMsg("#msg-register", "Username sudah dipakai. Pilih username lain.", "error");

  users[username] = { password: pass, level: 1, score: 0, highScore: 0, solved: 0, history: [] };
  saveUsers(users);
  setMsg("#msg-register", "Registrasi berhasil. Mengarahkan ke login...", "success");
  e.target.reset();
  setTimeout(() => {
    window.location.href = "login.html";
  }, 1000);
});

/* ---------- Login ---------- */
on("#form-login", "submit", (e) => {
  e.preventDefault();
  const username = $("#log-username").value.trim();
  const pass = $("#log-password").value;
  const users = getUsers();
  const key = Object.keys(users).find((u) => u.toLowerCase() === username.toLowerCase());

  if (!key || users[key].password !== pass)
    return setMsg("#msg-login", "Username atau password salah.", "error");

  localStorage.setItem(LS_SESSION, key);
  setMsg("#msg-login", "Login berhasil.", "success");
  setTimeout(() => go("dashboard"), 400);
});

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const u = currentUser();
  $("#dash-name").textContent = u.name;
  $("#dash-level").textContent = u.data.level;
  $("#dash-score").textContent = u.data.score;
  $("#dash-high").textContent = u.data.highScore;
  $("#dash-solved").textContent = u.data.solved;
  const ul = $("#dash-history");
  ul.innerHTML = "";
  if (!u.data.history.length) {
    ul.innerHTML = "<li><span>Belum ada permainan. Tekan Mulai untuk bermain.</span></li>";
  } else {
    u.data.history.forEach((h) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>Level ${h.level} &middot; ${h.time}s</span><b>+${h.score}</b>`;
      ul.appendChild(li);
    });
  }
}
on("#btn-play", "click", () => go("game"));
on("#btn-howto", "click", () => { $("#howto").hidden = !$("#howto").hidden; });
on("#btn-back", "click", () => go("dashboard"));
on("#btn-win-dash", "click", () => go("dashboard"));

/* ---------- Pembuat level (selalu bisa diselesaikan) ---------- */
function seededRandom(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function makeLevel(n) {
  const size = Math.min(3 + Math.ceil(n / 2), 8);
  const rand = seededRandom(n * 7919 + 13);
  const minLen = Math.floor(size * size * (n < 3 ? 0.9 : 0.75));
  let best = null;

  for (let attempt = 0; attempt < 400; attempt++) {
    const sr = Math.floor(rand() * size), sc = Math.floor(rand() * size);
    const seen = new Set([sr * size + sc]);
    const path = [sr * size + sc];
    const free = (r, c) => r >= 0 && c >= 0 && r < size && c < size && !seen.has(r * size + c);
    const degree = (r, c) => DIRS.filter(([dr, dc]) => free(r + dr, c + dc)).length;

    while (true) {
      const cur = path[path.length - 1];
      const r = Math.floor(cur / size), c = cur % size;
      const opts = DIRS.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => free(a, b));
      if (!opts.length) break;
      opts.sort((p, q) => degree(p[0], p[1]) - degree(q[0], q[1]));
      const pick = rand() < 0.75 ? opts[0] : opts[Math.floor(rand() * opts.length)];
      const idx = pick[0] * size + pick[1];
      seen.add(idx); path.push(idx);
    }
    if (!best || path.length > best.length) best = path;
    if (best.length >= minLen) break;
  }
  return { size, start: best[0], open: new Set(best), total: best.length };
}

/* ---------- Game ---------- */
let G = null;
let timerId = null;
function stopTimer() { clearInterval(timerId); timerId = null; }

function startLevel(n) {
  stopTimer();
  $("#overlay").hidden = true;
  const lv = makeLevel(n);
  G = { level: n, ...lv, path: [lv.start], seconds: 0, started: false, done: false, dragging: false };
  buildBoard();
  render();
  $("#hud-level").textContent = n;
  $("#hud-time").textContent = "0";
  $("#hud-score").textContent = currentUser().data.score;
}

function buildBoard() {
  const board = $("#board");
  board.style.setProperty("--n", G.size);
  board.innerHTML = "";
  for (let i = 0; i < G.size * G.size; i++) {
    const d = document.createElement("div");
    d.className = "cell" + (G.open.has(i) ? "" : " wall");
    d.dataset.i = i;
    board.appendChild(d);
  }
}

function render() {
  const cells = $("#board").children;
  const inPath = new Set(G.path);
  for (let i = 0; i < cells.length; i++) {
    const el = cells[i];
    el.querySelectorAll(".seg").forEach((s) => s.remove());
    if (!G.open.has(i)) continue;
    el.classList.toggle("filled", inPath.has(i));
    el.classList.toggle("start", i === G.start);
    el.classList.toggle("head", i === G.path[G.path.length - 1]);
  }
  for (let k = 0; k < G.path.length - 1; k++) addSeg(G.path[k], G.path[k + 1]);
  $("#hud-fill").textContent = G.path.length + "/" + G.total;
}

function addSeg(a, b) {
  const dir = b - a === 1 ? "right" : b - a === -1 ? "left" : b - a === G.size ? "down" : "up";
  const opposite = { right: "left", left: "right", down: "up", up: "down" };
  makeSeg(a, dir); makeSeg(b, opposite[dir]);
}
function makeSeg(i, dir) {
  const s = document.createElement("span");
  const horiz = dir === "left" || dir === "right";
  s.className = "seg " + (horiz ? "h" : "v");
  const ext = "calc(50% + 2px)";
  if (dir === "left") { s.style.left = "-2px"; s.style.width = ext; }
  if (dir === "right") { s.style.right = "-2px"; s.style.width = ext; }
  if (dir === "up") { s.style.top = "-2px"; s.style.height = ext; }
  if (dir === "down") { s.style.bottom = "-2px"; s.style.height = ext; }
  $("#board").children[i].appendChild(s);
}

function adjacent(a, b) {
  const n = G.size;
  return Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs((a % n) - (b % n)) === 1;
}

function tryMove(i) {
  if (!G || G.done || !G.open.has(i)) return;
  const last = G.path[G.path.length - 1];
  if (i === last) return;

  if (G.path.length > 1 && i === G.path[G.path.length - 2]) {
    G.path.pop();
  } else if (adjacent(last, i) && !G.path.includes(i)) {
    if (!G.started) startTimer();
    G.path.push(i);
  } else return;

  render();
  if (G.path.length === G.total) win();
}

function startTimer() {
  G.started = true;
  timerId = setInterval(() => {
    G.seconds++;
    $("#hud-time").textContent = G.seconds;
  }, 1000);
}

function cellFromEvent(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el && el.closest(".cell");
  return cell ? Number(cell.dataset.i) : null;
}

function win() {
  G.done = true;
  stopTimer();
  const bonus = Math.max(0, 60 - G.seconds) * 5;
  const gained = G.level * 100 + bonus;

  updateUser((d) => {
    d.score += gained;
    d.solved += 1;
    d.highScore = Math.max(d.highScore, gained);
    if (G.level >= d.level) d.level = G.level + 1;
    d.history.unshift({ level: G.level, time: G.seconds, score: gained });
    d.history = d.history.slice(0, 5);
  });

  $("#hud-score").textContent = currentUser().data.score;
  $("#win-text").textContent =
    `Level ${G.level} selesai dalam ${G.seconds} detik. Skor +${gained} (bonus waktu ${bonus}).`;
  $("#overlay").hidden = false;
}

function initGame() {
  const board = $("#board");
  board.addEventListener("pointerdown", (e) => {
    G.dragging = true;
    const i = cellFromEvent(e);
    if (i !== null) tryMove(i);
  });
  board.addEventListener("pointermove", (e) => {
    if (!G.dragging) return;
    const i = cellFromEvent(e);
    if (i !== null) tryMove(i);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
    board.addEventListener(ev, () => { G.dragging = false; })
  );
  on("#btn-undo", "click", () => {
    if (G.done || G.path.length <= 1) return;
    G.path.pop();
    render();
  });
  on("#btn-restart", "click", () => startLevel(G.level));
  on("#btn-next", "click", () => startLevel(currentUser().data.level));
  startLevel(currentUser().data.level);
}

/* ---------- Mulai sesuai halaman ---------- */
if (!redirecting) {
  if (page === "dashboard") renderDashboard();
  if (page === "game") initGame();
}