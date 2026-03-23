import serverless from "serverless-http";
import { createServer } from "../server/index.js";

const app = createServer();
const handler = serverless(app);

export default async function vercelApiHandler(req: any, res: any) {
  if (typeof req.url === "string" && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }

  return handler(req, res);
}
