import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { IncomingMessage } from "http";

export const config = { api: { bodyParser: false } };

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/0075596e-85d8-4549-bb28-80ba00a727b9";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/0075596e-85d8-4549-bb28-80ba00a727b9";

function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Test-Mode");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const isTest = req.headers["x-test-mode"] === "1";
  const target = isTest ? WEBHOOK_TEST : WEBHOOK_PROD;
  const contentType = req.headers["content-type"] || "";

  const rawBody = await getRawBody(req);

  const upstream = await fetch(target, {
    method: "POST",
    headers: { "content-type": contentType },
    body: rawBody,
  });

  const text = await upstream.text();
  res.status(upstream.status).send(text);
}
