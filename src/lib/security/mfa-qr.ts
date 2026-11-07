/** Supabase returns raw SVG in a data URI; encode it so newlines and # cannot break the image URL. */
export function mfaQrImageSource(value: string): string {
  const source = value.trim();
  const comma = source.indexOf(',');
  const header = source.slice(0, comma);
  if (comma < 0 || !/^data:image\/svg\+xml(?:;[^,]*)?$/i.test(header)) throw Error('Formato de QR code inválido.');
  const payload = source.slice(comma + 1);
  if (/;base64$/i.test(header)) return `${header},${payload.replace(/\s/g, '')}`;
  const svg = payload.trimStart().startsWith('<') ? payload : decodeURIComponent(payload);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}
