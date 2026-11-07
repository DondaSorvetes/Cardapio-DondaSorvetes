#!/usr/bin/env node
/**
 * Gera os ícones do app do painel no celular (PWA) a partir do ícone do app Windows.
 * O logo tem faixas transparentes em cima e embaixo: no celular ficaria "cortado",
 * então vai sobre o mesmo roxo do fundo do logo.
 *
 *   node scripts/pwa/generate-admin-icons.cjs
 */
const path = require("node:path");
const fs = require("node:fs");
const sharp = require("sharp");

const SOURCE = path.join(__dirname, "../../desktop/assets/icon.png");
const OUT = path.join(__dirname, "../../public/pwa");
const BACKGROUND = "#3A0E22";

/** Faixa opaca do logo (sem as bordas transparentes), em PNG. */
async function opaqueLogo() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = (x, y) => data[(y * info.width + x) * info.channels + 3];
  let top = 0;
  while (top < info.height - 1 && alpha(info.width >> 1, top) < 250) top++;
  let bottom = info.height - 1;
  while (bottom > top && alpha(info.width >> 1, bottom) < 250) bottom--;
  // Margem de 2 px para não pegar a borda serrilhada.
  return sharp(SOURCE).extract({ left: 0, top: top + 2, width: info.width, height: bottom - top - 3 }).png().toBuffer();
}

/**
 * Quadrado com o logo ocupando logoScale da largura; o resto é a própria borda do
 * logo estendida (extendWith: "copy"), então o fundo continua sem emenda visível.
 */
async function icon(logo, file, size, logoScale) {
  const meta = await sharp(logo).metadata();
  const side = Math.round(meta.width / logoScale);
  const padX = Math.round((side - meta.width) / 2);
  const padY = Math.round((side - meta.height) / 2);
  const square = await sharp(logo)
    .extend({ left: padX, right: side - meta.width - padX, top: padY, bottom: side - meta.height - padY, extendWith: "copy" })
    .png()
    .toBuffer();
  await sharp(square)
    .resize(size, size)
    .flatten({ background: BACKGROUND })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, file));
  console.log(`${file} ${size}x${size}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const logo = await opaqueLogo();
  await icon(logo, "admin-192.png", 192, 0.92);
  await icon(logo, "admin-512.png", 512, 0.92);
  // "maskable": Android recorta em círculo/gota; o logo fica dentro da zona segura (80%).
  await icon(logo, "admin-maskable-512.png", 512, 0.74);
  await icon(logo, "admin-apple-180.png", 180, 0.9);

  // App do entregador (mobile/entregador/assets), mesmo logo.
  const APP = path.join(__dirname, "../../mobile/entregador/assets");
  const out = (file) => path.join("..", "..", "mobile", "entregador", "assets", file).replace(/\\/g, "/");
  await icon(logo, out("icon.png"), 1024, 0.9);
  // Ícone adaptativo do Android: frente com o logo na zona segura (~61%) + fundo liso.
  await icon(logo, out("android-icon-foreground.png"), 1024, 0.62);
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BACKGROUND } })
    .png()
    .toFile(path.join(APP, "android-icon-background.png"));
  await icon(logo, out("splash-icon.png"), 1024, 0.96);
  console.log("app do entregador: icon, android-icon-foreground/background, splash-icon");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
