// Owner only. GET = load a pending paper for preview. POST = approve or reject it.
// Every request needs the signed token that is inside your approval email link.
import { store, json, validToken, cleanFields, findPending, readApproved, writeApproved } from "./_lib.js";

export async function GET(request) {
  const u = new URL(request.url), id = u.searchParams.get("id");
  if (!validToken(id, u.searchParams.get("t"))) return json({ error: "Not allowed" }, 403);
  const p = await findPending(id);
  return p ? json({ meta: p.meta }, 200, { "Cache-Control": "no-store" }) : json({ error: "Already handled or not found." }, 404);
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request" }, 400); }
  if (!validToken(body.id, body.t)) return json({ error: "Not allowed" }, 403);

  const p = await findPending(body.id);
  if (!p) return json({ error: "Already handled or not found." }, 404);

  if (body.action === "reject") {                       // delete everything of this upload
    await store.del(p.blobs.map((b) => b.url));
    return json({ ok: true, status: "rejected" });
  }
  if (body.action !== "approve") return json({ error: "Bad action" }, 400);

  // You may correct subject / type / year before approving
  const f = cleanFields({ subject: body.subject, type: body.type, year: body.year, solved: body.solved });
  if (!f) return json({ error: "Please check subject, exam type and year." }, 400);

  const title = [f.subject, f.type, f.year, f.solved ? "solved" : ""].filter(Boolean).join(" ");
  const approved = await readApproved();
  approved.push({ subject: f.subject, title, file: p.meta.fileUrl, year: f.year, type: f.type, solved: f.solved,
                  size: p.meta.size, added: Math.floor(Date.now() / 1000), community: true });
  await writeApproved(approved);

  const metaBlob = p.blobs.filter((b) => b.pathname.startsWith(`pending/${body.id}/meta`)); // keep the paper file itself
  await store.del(metaBlob.map((b) => b.url));
  return json({ ok: true, status: "approved" });
}
