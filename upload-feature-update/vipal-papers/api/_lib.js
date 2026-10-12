// =========================================================
// api/_lib.js - shared helpers for the upload + approval system
// (Files starting with _ are NOT public URLs on Vercel.)
//
// ENVIRONMENT VARIABLES (set in Vercel > Project > Settings > Environment Variables):
//   OWNER_EMAIL       your email, approval mails come here
//   RESEND_API_KEY    from resend.com (free account, sign up with the SAME email as OWNER_EMAIL)
//   APPROVAL_SECRET   any long random text. Only you know it. Signs the approve links
//   SITE_URL          your live site, e.g. https://fast-past-papers-vipal.vercel.app (no / at end)
//   BLOB_READ_WRITE_TOKEN   added automatically when you create a Blob store in Vercel
// =========================================================
import { put, list, del } from "@vercel/blob";
import { createHmac, timingSafeEqual } from "node:crypto";

export const TYPES = ["Mid 1", "Mid 2", "Mid", "Final", "Quiz", "Assignment", "Other"];
export const MAX_BYTES = 4 * 1024 * 1024;   // Vercel functions accept ~4.5 MB requests
export const MAX_PENDING = 100;             // stops strangers from filling your storage

// Small wrapper around file storage. Tests replace these functions.
export const store = {
  put: (path, body, opts = {}) => put(path, body, { access: "public", addRandomSuffix: true, ...opts }),
  list: async (prefix) => (await list({ prefix, limit: 1000 })).blobs,
  del: (urls) => del(urls),
  getJson: async (url) => { const r = await fetch(url, { cache: "no-store" }); return r.ok ? r.json() : null; },
};

// Sends the approval email through Resend (plain REST call, no extra package)
export const mail = {
  async send(subject, html) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Past Papers <onboarding@resend.dev>", to: [process.env.OWNER_EMAIL], subject, html }),
    });
    if (!r.ok) throw new Error("Email failed: " + r.status);
  },
};

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });

// Approve links are signed so nobody can guess them
export const sign = (id) => createHmac("sha256", process.env.APPROVAL_SECRET || "").update(id).digest("hex").slice(0, 32);
export function validToken(id, token) {
  if (!process.env.APPROVAL_SECRET || !id || !token) return false;
  const a = Buffer.from(sign(id)), b = Buffer.from(String(token));
  return a.length === b.length && timingSafeEqual(a, b);
}

// Checks the real file type from its first bytes (not from the file name)
export function sniff(bytes) {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { ext: "pdf", mime: "application/pdf" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", mime: "image/png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return { ext: "webp", mime: "image/webp" };
  return null;
}

// Cleans what the uploader typed. Returns null if something is wrong.
export function cleanFields(f) {
  const subject = String(f.subject || "").trim();
  const type = String(f.type || "").trim();
  const year = f.year ? Number(f.year) : null;
  if (!/^[\p{L}\p{N} &-]{2,60}$/u.test(subject)) return null;
  if (!TYPES.includes(type)) return null;
  if (year !== null && !(Number.isInteger(year) && year >= 2000 && year <= 2035)) return null;
  return { subject, type, year, solved: f.solved === true || f.solved === "on" || f.solved === "true" };
}

// The list of approved (live) community papers is one JSON file in storage
export async function readApproved() {
  const found = (await store.list("approved.json")).find((b) => b.pathname === "approved.json");
  const data = found ? await store.getJson(found.url) : null;
  return Array.isArray(data) ? data : [];
}
export const writeApproved = (arr) =>
  store.put("approved.json", JSON.stringify(arr), { addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });

export async function findPending(id) {
  if (!/^[a-f0-9]{16}$/.test(id || "")) return null;
  const blobs = await store.list(`pending/${id}/`);
  const meta = blobs.find((b) => b.pathname.startsWith(`pending/${id}/meta`));
  return meta ? { blobs, meta: await store.getJson(meta.url) } : null;
}
