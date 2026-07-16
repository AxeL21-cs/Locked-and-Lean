import type { IncomingMessage, ServerResponse } from "node:http";

import { createHttpHandler } from "../src/app.js";
import { buildRuntime } from "../src/runtime.js";

const handler = createHttpHandler(buildRuntime());

export default function protectedResource(
  request: IncomingMessage,
  response: ServerResponse,
) {
  request.url = "/.well-known/oauth-protected-resource";
  return handler(request, response);
}
