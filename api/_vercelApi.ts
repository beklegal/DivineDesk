import { createServer } from "../server/index.js";
import { normalizeVercelFunctionUrl } from "../lib/vercel-routing.js";

const app = createServer();

export function createVercelApiHandler(mountPrefix: string) {
  return async function vercelApiHandler(req: any, res: any) {
    const originalUrl = typeof req.url === "string" ? req.url : null;
    const requestId =
      typeof req.headers?.["x-vercel-id"] === "string"
        ? req.headers["x-vercel-id"]
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = Date.now();

    req.url = normalizeVercelFunctionUrl(req.url, mountPrefix);
    req.requestId = requestId;

    console.info(
      `[vercel-api] request ${JSON.stringify({
        requestId,
        mountPrefix,
        method: req.method,
        originalUrl,
        normalizedUrl: req.url,
      })}`,
    );

    res.on?.("finish", () => {
      console.info(
        `[vercel-api] response ${JSON.stringify({
          requestId,
          mountPrefix,
          method: req.method,
          originalUrl,
          normalizedUrl: req.url,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
        })}`,
      );
    });

    return app(req, res);
  };
}
