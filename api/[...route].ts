import { createServer } from "../server/index.js";

const app = createServer();

export default async function vercelApiHandler(req: any, res: any) {
  const originalUrl = typeof req.url === "string" ? req.url : null;
  const requestId =
    typeof req.headers?.["x-vercel-id"] === "string"
      ? req.headers["x-vercel-id"]
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();

  if (typeof req.url === "string" && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }

  console.info(
    `[vercel-api] request ${JSON.stringify({
      requestId,
      method: req.method,
      originalUrl,
      normalizedUrl: req.url,
    })}`,
  );

  res.on?.("finish", () => {
    console.info(
      `[vercel-api] response ${JSON.stringify({
        requestId,
        method: req.method,
        originalUrl,
        normalizedUrl: req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      })}`,
    );
  });

  req.requestId = requestId;
  return app(req, res);
}
