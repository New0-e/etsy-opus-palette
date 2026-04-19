import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { code, redirect_uri, code_verifier } = req.body ?? {};

  if (!code || !redirect_uri || !code_verifier) {
    return res.status(400).json({ error: "Paramètres manquants" });
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: (process.env.VITE_GOOGLE_CLIENT_ID ?? "").trim(),
      client_secret: (process.env.GOOGLE_CLIENT_SECRET ?? "").trim(),
      redirect_uri,
      code_verifier,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return res.status(400).json({ error: data.error_description ?? data.error ?? "Échec de l'échange" });
  }

  return res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in });
}
