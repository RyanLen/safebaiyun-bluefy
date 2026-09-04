import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const workflow = fs.readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");

test("前端入口和 CI 使用 TypeScript 构建链", () => {
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
  assert.equal(packageJson.scripts.build, "vite build");
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
