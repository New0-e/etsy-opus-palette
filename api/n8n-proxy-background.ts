import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { IncomingMessage } from "http";

export const config = { api: { bodyParser: false } };

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/generate-background";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/generate-background";

function getRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Test-Mode");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const isTest = req.headers["x-test-mode"] === "1";
  const target = isTest ? WEBHOOK_TEST : WEBHOOK_PROD;
  const contentType = req.headers["content-type"] || "";

  const rawBody = await getRawBody(req);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: { "content-type": contentType },
      body: rawBody,
      signal: AbortSignal.timeout(280_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[n8n-proxy-background] fetch error (${isTest ? "test" : "prod"}):`, msg);
    return res.status(502).json({ error: "n8n unreachable", detail: msg });
  }

  const upstreamContentType = upstream.headers.get("content-type") ?? "";
  res.setHeader("Content-Type", upstreamContentType);

  if (upstreamContentType.startsWith("image/")) {
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(buffer);
  } else {
    const text = await upstream.text();
    console.log(`[n8n-proxy-background] status=${upstream.status} mode=${isTest ? "test" : "prod"} body=${text.slice(0, 200)}`);
    res.status(upstream.status).send(text);
  }
}
