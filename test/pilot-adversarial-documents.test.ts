import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildImportReview } from "../src/utils/importRules.ts";
import { parseLocalFile } from "../src/utils/localFileImport.ts";
import { loadPilotTestCatalog, loadPilotTestFile, type PilotTestDocument } from "../src/utils/pilotTestDocuments.ts";

const fixtureFetch: typeof fetch = async input => {
  const pathname = new URL(input.toString(), "http://pilot.local").pathname;
  const assetPath = join(process.cwd(), "public", pathname.replace(/^\//, ""));
  try {
    return new Response(await readFile(assetPath), { status: 200 });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};

const response = await fixtureFetch("/pilot-tests/adversarial-manifest.json");
assert.equal(response.ok, true, "the adversarial pilot catalog must load");
const items = await response.json() as PilotTestDocument[];
assert.equal(items.length, 9, "the advanced suite must contain nine synthetic DOCX cases");
assert.equal((await loadPilotTestCatalog(fixtureFetch)).length, 96, "the combined pilot selector must include standard and advanced cases");
for (const group of ["complex", "format-error", "data-error"] as const) {
  assert.equal(items.filter(item => item.testGroup === group).length, 3, `${group} must contain three cases`);
}
assert.equal(new Set(items.map(item => item.id)).size, items.length, "advanced case IDs must be unique");

const expectedConflictText: Record<string, string[]> = {
  "adv-data-cong-van": ["18/CV-PILOT", "81/CV-PILOT", "31 tháng 2 năm 2026", "05/03/2026"],
  "adv-data-bien-ban": ["15 giờ 00 phút", "14 giờ 30 phút", "8 người", "9 người", "11/BB-PILOT", "17/BB-PILOT"],
  "adv-data-quyet-dinh": ["04/QĐ-PILOT", "40/QĐ-PILOT", "31 tháng 2 năm 2026", "01/02/2026", "Lê Văn A", "Lê Văn B"],
};

for (const item of items) {
  assert.ok(item.testFocus, `${item.id} must explain its test objective`);
  const file = await loadPilotTestFile(item, fixtureFetch);
  const parsed = await parseLocalFile(file);
  const source = parsed.structured;
  assert.ok(source, `${item.id} must produce structured parse output`);
  assert.equal(source.source.blockCount, parsed.blockCount, `${item.id} must preserve the extracted block count`);
  assert.ok(source.blocks && source.blocks.length > 0, `${item.id} must retain source blocks`);
  assert.equal(new Set(source.blocks.map(block => block.id)).size, source.blocks.length, `${item.id} source block IDs must remain unique`);
  assert.ok(source.body.sourceBlockIds.length >= 1, `${item.id} must retain its main body`);
  assert.ok(parsed.text.trim().length > 250, `${item.id} must not parse as blank content`);

  if (item.testGroup === "complex") {
    assert.ok(source.source.blockCount >= 30, `${item.id} must stress long-document block handling`);
    assert.ok(source.appendices.length > 0, `${item.id} must contain an appendix`);
  }
  if (item.testGroup === "format-error") {
    const checks = buildImportReview(source, "administrative");
    assert.equal(checks.find(check => check.id === "IMPORT.SOURCE_OWNERSHIP")?.status, "PASS", `${item.id} must keep source block ownership intact`);
    assert.ok(checks.some(check => check.region === "header" && check.status === "NEEDS_REVIEW"), `${item.id} must expose at least one header issue for manual review`);
    if (item.id === "adv-format-cong-van") {
      assert.equal(source.fields.locationAndDate.status, "ambiguous", "a malformed date at the header must remain a date candidate for review");
      assert.match(source.fields.locationAndDate.value || "", /Hải Phòng.*15 tháng 10 năm 2026/, "the date candidate must be placed in the date field");
      assert.ok(![source.fields.orgHeader1.value, source.fields.orgHeader2.value].some(value => value?.includes("15-10-2026")), "a date candidate must not be assigned to an organization field");
    }
  }
  if (item.testGroup === "data-error") {
    for (const fragment of expectedConflictText[item.id]) {
      assert.ok(parsed.text.includes(fragment), `${item.id} must retain conflicting source value: ${fragment}`);
    }
  }
}

console.log(`All ${items.length} adversarial DOCX files parse; complex blocks, malformed headers, and contradictory source values are preserved for pilot review.`);
