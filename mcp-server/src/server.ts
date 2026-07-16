import { createServer } from "node:http";

import { createHttpHandler } from "./app.js";
import { buildRuntime } from "./runtime.js";

if (process.env.NODE_ENV !== "test") {
  const runtime = buildRuntime();
  const server = createServer(createHttpHandler(runtime));
  server.listen(runtime.config.port, "127.0.0.1", () => {
    process.stdout.write(
      `Locked and Lean MCP listening on http://127.0.0.1:${runtime.config.port}\n`,
    );
  });
}
