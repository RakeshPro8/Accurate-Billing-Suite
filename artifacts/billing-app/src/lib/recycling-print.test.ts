import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("invoice, recycling, and thermal print modes remain mutually isolated", async () => {
  const css = await readFile(new URL("../index.css", import.meta.url), "utf8");
  assert.match(css, /\.recycling-print-area\s*\{\s*display:\s*none\s*!important;/);
  assert.match(css, /body\.recycling-mode[^}]+\.invoice-print-area:not\(\.recycling-print-area\)[^{]*\{[^}]*display:\s*none\s*!important;/s);
  assert.match(css, /body\.recycling-mode[^}]+\.recycling-print-area[^{]*\{[^}]*display:\s*block\s*!important;/s);
  assert.match(css, /body\.receipt-mode[^}]+\.recycling-print-area[^}]+display:\s*none\s*!important;/s);
});
