import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".expo",
  "coverage",
  "dist",
  "docs",
  "node_modules",
  "tmp",
]);
const ignoredFiles = new Set([
  ".env.example",
  "AGENTS.md",
  "scripts/check-prohibited-openai-api.mjs",
]);
const sourceExtensions = new Set([
  ".cjs",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".toml",
  ".yaml",
  ".yml",
]);
const prohibited = [
  /api\.openai\.com/i,
  /OPENAI_API_KEY/,
  /responses\.create/i,
  /chat\.completions/i,
  /openai\.responses/i,
];

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolute = join(directory, entry.name);
    const projectPath = relative(root, absolute).replaceAll("\\", "/");

    if (entry.isDirectory()) files.push(...(await collect(absolute)));
    if (
      entry.isFile() &&
      sourceExtensions.has(extname(entry.name)) &&
      !ignoredFiles.has(projectPath)
    ) {
      files.push({ absolute, projectPath });
    }
  }

  return files;
}

const findings = [];
for (const file of await collect(root)) {
  const contents = await readFile(file.absolute, "utf8");
  for (const pattern of prohibited) {
    if (pattern.test(contents))
      findings.push(`${file.projectPath}: ${pattern}`);
  }
}

if (findings.length) {
  console.error(
    "Unauthorized OpenAI model API usage detected:\n" + findings.join("\n"),
  );
  process.exit(1);
}

console.log("No unauthorized OpenAI model API usage detected.");
