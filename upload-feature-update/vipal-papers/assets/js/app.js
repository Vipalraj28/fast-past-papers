/* =========================================================
   Vipal Raj Past Papers  -  app.js
   Is file mein website ki saari FUNCTIONALITY hai. Sections:
     1. Settings            6. Papers list banana
     2. Chhote helpers      7. Subject buttons + years
     3. Theme (dark/light)  8. Buttons ke clicks
     4. Toast message       9. Preview window
     5. Filter / search    10. papers.json load karna
   Data kahan se aata hai? organize.py ek file "papers.json" banati hai,
   aur ye code usi ko parh kar poori site banata hai.
   ========================================================= */


/* ---------- 1. SETTINGS ---------- */
const DATA_FILE   = "papers.json";  // organize.py is file ko banati hai
const NEW_DAYS    = 14;             // itne din tak paper par "New" badge rahega
const STAGGER_MAX = 12;             // pehli 12 rows ek ek kar ke aati hain (animation)


/* ---------- 2. CHHOTE HELPERS ---------- */
const $ = selector => document.querySelector(selector);

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Browser mein cheezein yaad rakhna (theme, saved papers). Fail ho to site phir bhi chalti hai.
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value)    { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }
};

// File ke naam mein < > jaise characters ko safe banata hai
const esc = text => String(text).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 1400000 bytes  ->  "1.3 MB"
const fileSize = bytes => bytes > 1048576
  ? (bytes / 1048576).toFixed(1) + " MB"
  : Math.max(1, Math.round(bytes / 1024)) + " KB";

// Kya ye paper haal hi mein add hua?
const isNew = paper => paper.added && (Date.now() / 1000 - paper.added) < NEW_DAYS * 86400;

// Numbers ko 0 se upar tak ginte hue dikhana (hero ke stats)
function countUp(el, target) {
  if (reduceMotion || target === 0) { el.textContent = target; return; }
  const start = performance.now(), duration = 800;
  const tick = now => {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));  // shuru mein tez, aakhir mein slow
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}


/* ---------- STATE: site ki current halat ---------- */
let all = [];                                   // saare papers (papers.json se)
let subjectNames = [];                          // saare subject folders (khali bhi)
let subject = "All";                            // kaunsa subject select hai
let saved = new Set(store.get("saved", []));    // saved papers ki list
const flags = { solved: false, saved: false };  // "Solved only" aur "Saved" button on/off


/* ---------- 3. THEME (dark / light) ---------- */
const root = document.documentElement;

// Pehli baar: phone/laptop ki apni setting dekho. Baad mein: jo user ne chuna wo.
root.dataset.theme = store.get("theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

$("#themeBtn").onclick = () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  store.set("theme", root.dataset.theme);
};


/* ---------- 4. TOAST (neeche chota message) ---------- */
let toastTimer;
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}


/* ---------- 5. FILTER / SEARCH ----------
   Search, subject, exam type, year, solved, saved - sab yahan check hote hain. */
// Ye aam lafz search mein ignore hote hain, warna "pf lab past papers" par kuch na milta
const IGNORE = new Set(["past", "paper", "papers", "fast", "nuces", "question", "questions",
  "solution", "solutions", "with", "all", "course", "courses", "of", "for", "the", "and", "a"]);

function filtered() {
  const words = $("#q").value.toLowerCase().split(/[\s,]+/)      // "coal mid 2" -> ["coal","mid","2"]
    .filter(w => w && !IGNORE.has(w));
  const type  = $("#type").value;
  const year  = $("#year").value;

  return all
    .filter(p => {
      if (subject !== "All" && p.subject !== subject) return false;
      if (type && p.type !== type) return false;
      if (year && String(p.year) !== year) return false;
      if (flags.solved && !p.solved) return false;
      if (flags.saved && !saved.has(p.file)) return false;

      // Search: har lafz paper ke title/subject/type/year mein milna chahiye
      const text = [p.title, p.subject, p.type, p.year, p.solved ? "solved" : "", p.file].join(" ").toLowerCase();
      return words.every(w => text.includes(w));
    })
    // Naya year pehle, phir A-Z
    .sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
}


/* ---------- 6. PAPERS LIST BANANA ---------- */

// Ek paper ki ek row ka HTML
function rowHTML(p, i) {
  const isSaved = saved.has(p.file);
  return `
    <li class="row" data-t="${esc(p.type)}" style="--i:${Math.min(i, STAGGER_MAX)}">
      <div>
        <h2>${esc(p.title)}</h2>
        <div class="meta">
          <span>${esc(p.subject)}</span>
          <span>${esc(p.type)}</span>
          ${p.year ? `<span>${p.year}</span>` : ""}
          ${p.solved ? '<span class="ok">Solved</span>' : ""}
          ${isNew(p) ? '<span class="new">New</span>' : ""}
          <span>${fileSize(p.size)}</span>
        </div>
      </div>
      <div class="acts">
        <button class="btn" data-a="view" data-f="${esc(p.file)}">Preview</button>
        <a class="btn main" href="${encodeURI(p.file)}" download>Download</a>
        <button class="btn" data-a="save" data-f="${esc(p.file)}" aria-pressed="${isSaved}">${isSaved ? "Saved" : "Save"}</button>
      </div>
    </li>`;
}

// Poori list dobara banao. animate=true ho to rows ek ek kar ke aati hain.
function render(animate = false) {
  const list = filtered();

  $("#count").textContent = list.length + (list.length === 1 ? " paper" : " papers");
  $("#savedN").textContent = saved.size;
  $("#list").classList.toggle("anim", animate && !reduceMotion);

  if (list.length) {
    $("#list").innerHTML = list.map(rowHTML).join("");
  } else {
    // Khali list: do alag message (papers hi nahi hain / filter se kuch nahi mila)
    $("#list").innerHTML = `<li class="empty">${all.length
      ? ($("#q").value.trim()
          ? `Nothing found for "${esc($("#q").value.trim())}". Try fewer words, like "pf mid 2024", or pick All.`
          : "No paper matches these filters. Change the filters or pick All.")
      : "No papers yet. Put files in <code>inbox/</code> and run <code>python organize.py</code>."}</li>`;
  }
}


/* ---------- 7. SUBJECT BUTTONS + YEARS ---------- */
function buildChips() {
  // Har subject ke kitne papers hain, ginti
  const counts = {};
  all.forEach(p => counts[p.subject] = (counts[p.subject] || 0) + 1);

  // Folders ke subjects + papers ke subjects, dono mila kar (khali subject ka count 0 dikhega)
  const names = ["All", ...[...new Set([...subjectNames, ...Object.keys(counts)])].sort()];
  $("#subjects").innerHTML = names.map(n =>
    `<button class="chip" aria-pressed="${n === subject}" data-s="${esc(n)}">${esc(n)}<b>${n === "All" ? all.length : (counts[n] || 0)}</b></button>`
  ).join("");

  // Year wala dropdown: jo years papers mein hain wohi dikhao
  const years = [...new Set(all.map(p => p.year).filter(Boolean))].sort((a, b) => b - a);
  $("#year").innerHTML = '<option value="">All years</option>' + years.map(y => `<option>${y}</option>`).join("");
}

// Hero ke teen numbers
function buildStats() {
  countUp($("#statPapers"), all.length);
  countUp($("#statSubjects"), new Set(all.map(p => p.subject)).size);
  countUp($("#statSolved"), all.filter(p => p.solved).length);
}


/* ---------- 8. BUTTONS KE CLICKS ---------- */

// Subject button dabane par
$("#subjects").onclick = e => {
  const btn = e.target.closest("[data-s]");
  if (!btn) return;
  subject = btn.dataset.s;
  buildChips();
  render(true);
};

// Row ke andar ke buttons (Preview / Save / Download)
$("#list").onclick = e => {
  if (e.target.closest("a[download]")) return toast("Download started");

  const btn = e.target.closest("[data-a]");
  if (!btn) return;
  const file = btn.dataset.f;

  if (btn.dataset.a === "save") {
    // Save <-> Unsave
    if (saved.has(file)) { saved.delete(file); toast("Removed from saved"); }
    else                 { saved.add(file);    toast("Saved to your list"); }
    store.set("saved", [...saved]);
    render();
  } else {
    openPaper(all.find(p => p.file === file));
  }
};

// Search likhte waqt (animation nahi, warna har lafz par jhilmil hoga)
$("#q").addEventListener("input", () => render());

// Dropdown badalne par (animation ke saath)
["#type", "#year"].forEach(sel => $(sel).addEventListener("input", () => render(true)));

$("#solved").onclick = e => {
  flags.solved = !flags.solved;
  e.currentTarget.setAttribute("aria-pressed", flags.solved);
  render(true);
};

$("#savedBtn").onclick = e => {
  flags.saved = !flags.saved;
  e.currentTarget.setAttribute("aria-pressed", flags.saved);
  render(true);
};

// Keyboard shortcut: "/" dabao to search khul jati hai
document.addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement.tagName !== "INPUT") {
    e.preventDefault();
    $("#q").focus();
  }
});


/* ---------- 9. PREVIEW WINDOW ---------- */
function openPaper(p) {
  const url = encodeURI(p.file);
  const ext = p.file.split(".").pop().toLowerCase();

  $("#dt").textContent = p.title;
  $("#dl").href = url;

  if (ext === "pdf") {
    $("#dbody").innerHTML = `<iframe src="${url}" title="${esc(p.title)}"></iframe>`;
  } else if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
    $("#dbody").innerHTML = `<img src="${url}" alt="${esc(p.title)}">`;
  } else {
    $("#dbody").innerHTML = '<p class="empty" style="margin:20px">This file type cannot be previewed. Use Download.</p>';
  }
  $("#dlg").showModal();
}

$("#dx").onclick = () => $("#dlg").close();
$("#dlg").addEventListener("close", () => $("#dbody").innerHTML = "");  // band karte hi PDF hata do


/* ---------- 10. papers.json LOAD KARNA ---------- */
// Data milte hi poori site bana do
function start(data) {
  all = data.papers || [];
  subjectNames = data.subjects || [];
  buildChips();
  buildStats();
  render(true);
  mergeApproved();
}

// Owner ne jo community papers approve kiye wo bhi list mein jod do (sirf live site par chalta hai)
function mergeApproved() {
  fetch("/api/approved")
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d || !d.papers || !d.papers.length) return;
      all = all.concat(d.papers);
      buildChips();
      buildStats();
      render();
    })
    .catch(() => { /* laptop par ya double-click par ye API nahi hoti, koi baat nahi */ });
}

if (window.PAPERS_DATA) {
  // papers.js se (double-click par bhi chalta hai)
  start(window.PAPERS_DATA);
} else {
  // papers.json se (Live Server / localhost par)
  fetch(DATA_FILE, { cache: "no-cache" })
    .then(r => r.json())
    .then(start)
    .catch(() => {
      $("#list").innerHTML = '<li class="empty">Could not load papers. Run <code>python organize.py</code> once, then refresh.</li>';
    });
}
