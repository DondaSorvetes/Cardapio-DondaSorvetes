function rgb(value: string): number[] | null {
  const hex = value.replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex))
    return [...hex].map((char) => parseInt(char + char, 16));
  if (/^[\da-f]{6}$/i.test(hex))
    return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const match = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  return match ? match.slice(1).map(Number) : null;
}
export function contrastRatio(first: string, second: string): number | null {
  const a = rgb(first),
    b = rgb(second);
  if (!a || !b) return null;
  const luminance = (channels: number[]) =>
    channels
      .map((value) => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      })
      .reduce(
        (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
        0,
      );
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Keep the configured badge background; correct only unreadable foregrounds. */
export function readableTagForeground(
  background: string,
  foreground: string,
): string {
  const ratio = contrastRatio(background, foreground);
  if (ratio === null || ratio >= 4.5) return foreground;
  return (
    ["#2A1A22", "#000000", "#FFFFFF"].find(
      (color) => (contrastRatio(background, color) ?? 0) >= 4.5,
    ) ?? foreground
  );
}
