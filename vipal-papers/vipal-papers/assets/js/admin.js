/* =========================================================
   admin.js - owner approval page (opened from the email link)
   The link contains ?id=...&t=... (signed token). Without it nothing works.
   ========================================================= */
(function () {
  const $ = s => document.querySelector(s);
  const q = new URLSearchParams(location.search);
  const id = q.get("id"), t = q.get("t");
  const box = $("#box");
  const TYPES = ["Mid 1", "Mid 2", "Mid", "Final", "Quiz", "Assignment", "Other"];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const subjects = (window.PAPERS_DATA && window.PAPERS_DATA.subjects) || [];

  async function load() {
    const r = await fetch(`/api/review?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return (box.innerHTML = `<p>${esc(d.error || "Could not load.")}</p>`);
    show(d.meta);
  }

  function show(m) {
    const isImg = ["png", "jpg", "webp"].includes(m.ext);
    const subs = [...new Set([m.subject, ...subjects])];
    box.innerHTML = `
      <h2>Review upload</h2>
      ${isImg ? `<img src="${esc(m.fileUrl)}" alt="paper">` : `<iframe src="${esc(m.fileUrl)}" title="paper"></iframe>`}
      <p class="hint">You can correct the details before approving.</p>
      <label>Subject <select id="aSubject">${subs.map(s => `<option ${s === m.subject ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      <label>Exam <select id="aType">${TYPES.map(x => `<option ${x === m.type ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label>Year <input id="aYear" type="number" value="${m.year || ""}"></label>
      <label class="check"><input id="aSolved" type="checkbox" ${m.solved ? "checked" : ""}> Solved</label>
      <p id="aMsg" role="status"></p>
      <div class="formacts">
        <button class="btn bad" id="rej">Reject (delete)</button>
        <button class="btn good" id="app">Approve</button>
      </div>`;
    $("#app").onclick = () => act("approve");
    $("#rej").onclick = () => confirm("Delete this upload?") && act("reject");
  }

  async function act(action) {
    $("#aMsg").textContent = "Working...";
    const body = { id, t, action, subject: $("#aSubject").value, type: $("#aType").value, year: $("#aYear").value, solved: $("#aSolved").checked };
    const r = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    box.innerHTML = r.ok
      ? `<h2>${d.status === "approved" ? "Approved. It will show on the site within about a minute." : "Rejected and deleted."}</h2>`
      : `<p>${esc(d.error || "Failed.")}</p>`;
  }

  if (!id || !t) box.innerHTML = "<p>This page only works from the link in your approval email.</p>"; else load();
})();
