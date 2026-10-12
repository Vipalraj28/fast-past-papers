/* =========================================================
   upload.js - "Upload paper" button and form (visitors)
   Flow: form -> POST /api/upload -> paper is PENDING + owner gets an email.
   Nothing shows on the website until the owner approves it (admin.html).
   ========================================================= */
(function () {
  const $ = s => document.querySelector(s);
  const dlg = $("#upDlg"), form = $("#upForm"), msg = $("#upMsg");
  const TYPES = ["Mid 1", "Mid 2", "Final", "Quiz", "Assignment", "Other"];
  const LAB_TYPES = ["Mid", "Final"];                       // labs only have Mid and Final
  const MAX = 4 * 1024 * 1024;                              // must match MAX_BYTES in api/_lib.js

  const say = (text, cls = "") => { msg.textContent = text; msg.className = cls; };
  const fill = (el, items) => el.innerHTML = items.map(i => `<option>${i}</option>`).join("");

  // Subjects: from papers.js if present, otherwise from the subject buttons on the page
  function subjects() {
    const fromData = window.PAPERS_DATA && window.PAPERS_DATA.subjects;
    if (fromData && fromData.length) return fromData;
    return [...document.querySelectorAll(".chip[data-s]")].map(b => b.dataset.s).filter(s => s !== "All");
  }
  function fillTypes() { fill($("#upType"), /\blab$/i.test($("#upSubject").value) ? LAB_TYPES : TYPES); }

  $("#uploadBtn").onclick = () => {
    fill($("#upSubject"), subjects());
    fillTypes();
    say("");
    dlg.showModal();
  };
  $("#upSubject").addEventListener("change", fillTypes);
  $("#upCancel").onclick = () => dlg.close();

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const file = $("#upFile").files[0];
    if (!file) return say("Please choose a file.", "err");
    if (file.size > MAX) return say("File is bigger than 4 MB. Please compress it first.", "err");

    $("#upSend").disabled = true;
    say("Sending...");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: new FormData(form) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        say("Thank you! Your paper was sent for review.", "ok");
        form.reset();
        setTimeout(() => dlg.close(), 2200);
      } else {
        say(data.error || "Upload failed. Please try again.", "err");
      }
    } catch {
      say("Upload only works on the live website, not on your laptop copy.", "err");
    }
    $("#upSend").disabled = false;
  });
})();
