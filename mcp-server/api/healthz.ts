import type { IncomingMessage, ServerResponse } from "node:http";

import { createHttpHandler } from "../src/app.js";
import { buildRuntime } from "../src/runtime.js";

const handler = createHttpHandler(buildRuntime());

export default function healthz(
  request: IncomingMessage,
  response: ServerResponse,
) {
  request.url = "/healthz";
  return handler(request, response);
}
