const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("toasts are rendered: the Toaster is mounted once for the whole app", () => {
  const providers = fs.readFileSync("src/app/providers.tsx", "utf8");
  assert.match(providers, /import \{ Toaster \} from "@\/components\/ui\/sonner"/);
  assert.match(providers, /<Toaster \/>/);
  const sonner = fs.readFileSync("src/components/ui/sonner.tsx", "utf8");
  assert.match(sonner, /^"use client";/);
  // Embaixo ficam as barras de navegação do cardápio e do painel no celular.
  assert.match(sonner, /position="top-center"/);
  assert.match(sonner, /safe-area-inset-top/);
});
