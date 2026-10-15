import assert from "node:assert/strict";
import { normalizeOklchColor, normalizeOklchColorsInCssValue } from "../src/utils/cssColor.ts";

assert.equal(normalizeOklchColor("oklch(0.627955 0.257683 29.234)"), "rgb(255, 0, 0)", "PDF export must convert a CSS OKLCH color to an html2canvas-compatible sRGB value");
assert.equal(normalizeOklchColor("oklch(0.627955 0.257683 29.234 / 50%)"), "rgba(255, 0, 0, 0.5)", "PDF export must preserve alpha while normalizing colors");
assert.equal(normalizeOklchColorsInCssValue("0 1px 2px oklch(0.627955 0.257683 29.234 / 50%)"), "0 1px 2px rgba(255, 0, 0, 0.5)", "composite CSS values must have unsupported color functions normalized");
assert.equal(normalizeOklchColorsInCssValue("rgb(12, 34, 56)"), "rgb(12, 34, 56)", "already supported color values must remain unchanged");

console.log("PDF color normalization covers Tailwind OKLCH values and alpha colors");
