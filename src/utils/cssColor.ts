function numericToken(value: string): number {
  return Number.parseFloat(value);
}

function parseHue(value: string): number | null {
  const token = value.trim().toLowerCase();
  const number = numericToken(token.replace(/(?:deg|rad|turn)$/, ""));
  if (!Number.isFinite(number)) return null;
  if (token.endsWith("rad")) return number;
  if (token.endsWith("turn")) return number * Math.PI * 2;
  return number * Math.PI / 180;
}

function gammaEncode(linear: number): number {
  const value = linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

/** Convert one CSS OKLCH color to an sRGB string supported by html2canvas 1.4. */
export function normalizeOklchColor(value: string): string {
  const match = value.trim().match(/^oklch\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:deg|rad|turn)?)\s*(?:\/\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?))?\s*\)$/i);
  if (!match) return value;

  const lightness = match[1].endsWith("%") ? numericToken(match[1]) / 100 : numericToken(match[1]);
  const chroma = match[2].endsWith("%") ? numericToken(match[2]) * 0.004 : numericToken(match[2]);
  const hue = parseHue(match[3]);
  const alphaToken = match[4] || "1";
  const alpha = alphaToken.endsWith("%") ? numericToken(alphaToken) / 100 : numericToken(alphaToken);
  if (![lightness, chroma, alpha].every(Number.isFinite) || hue === null) return value;

  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.2914855480 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  const red = gammaEncode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = gammaEncode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = gammaEncode(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);

  const normalizedAlpha = Math.min(1, Math.max(0, alpha));
  if (normalizedAlpha >= 1) return `rgb(${red}, ${green}, ${blue})`;
  const alphaText = Number(normalizedAlpha.toFixed(3)).toString();
  return `rgba(${red}, ${green}, ${blue}, ${alphaText})`;
}

/** Replace OKLCH color functions embedded in values such as box-shadow. */
export function normalizeOklchColorsInCssValue(value: string): string {
  return value.replace(/oklch\([^)]*\)/gi, color => normalizeOklchColor(color));
}
