import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("部署入口使用同源 Vite 模块且不依赖 CDN", () => {
  assert.match(index, /id="root"/);
  assert.match(index, /src\/main\.tsx/);
  assert.match(index, /__SAFEBAIYUN_REACT__/);
  assert.doesNotMatch(index, /https?:\/\//);
});
