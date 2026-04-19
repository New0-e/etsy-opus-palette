import type { VercelResponse } from "@vercel/node";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "";

export function setCorsHeaders(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*");
  res.setHeader("Vary", "Origin");
}
