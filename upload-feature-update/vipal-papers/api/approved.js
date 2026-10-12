// GET /api/approved - public list of papers you approved (the site merges it with papers.js)
import { json, readApproved } from "./_lib.js";

export async function GET() {
  try { return json({ papers: await readApproved() }, 200, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }); }
  catch { return json({ papers: [] }); }
}
