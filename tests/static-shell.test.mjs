import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("部署入口为全部静态资源附带版本参数", () => {
  for (const resource of ["styles.css", "core.js", "store.js", "ble.js", "app.js"]) {
    assert.match(index, new RegExp(`\\./${resource.replace(".", "\\.")}\\?v=[^\"']+`));
  }
});
