// POST /api/upload  - a visitor sends a paper. It is stored as PENDING and you get an email.
// Nothing becomes public on the site until you approve it.
import { store, mail, json, sign, sniff, cleanFields, MAX_BYTES, MAX_PENDING } from "./_lib.js";
import { randomBytes } from "node:crypto";

export async function POST(request) {
  let form;
  try { form = await request.formData(); } catch { return json({ error: "Bad request" }, 400); }

  // Hidden "website" field: real people leave it empty, bots fill it. Pretend success.
  if (form.get("website")) return json({ ok: true });

  const fields = cleanFields({ subject: form.get("subject"), type: form.get("type"), year: form.get("year"), solved: form.get("solved") });
  if (!fields) return json({ error: "Please check subject, exam type and year." }, 400);

  const file = form.get("file");
  if (!file || typeof file === "string" || !file.size) return json({ error: "Please choose a file." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "File is too big. Maximum 4 MB. Please compress it." }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return json({ error: "Only PDF, JPG, PNG or WEBP files are allowed." }, 415);

  if ((await store.list("pending/")).length >= MAX_PENDING * 2)
    return json({ error: "Too many papers are waiting for review. Please try again later." }, 503);

  const id = randomBytes(8).toString("hex");
  const stored = await store.put(`pending/${id}/paper.${kind.ext}`, bytes, { contentType: kind.mime });
  const meta = { id, ...fields, ext: kind.ext, size: file.size, fileUrl: stored.url, uploadedAt: new Date().toISOString() };
  await store.put(`pending/${id}/meta.json`, JSON.stringify(meta), { contentType: "application/json" });

  const link = `${process.env.SITE_URL}/admin.html?id=${id}&t=${sign(id)}`;
  await mail.send(
    `New paper to approve: ${fields.subject} ${fields.type} ${fields.year || ""}`.trim(),
    `<p>Someone uploaded a paper.</p>
     <p><b>${fields.subject}</b> | ${fields.type} | ${fields.year || "year not given"} | ${fields.solved ? "solved" : "not marked solved"} | ${(file.size / 1024).toFixed(0)} KB</p>
     <p><a href="${link}">Open to preview, then Approve or Reject</a></p>
     <p>It will NOT appear on the website until you approve it.</p>`
  );
  return json({ ok: true });
}
