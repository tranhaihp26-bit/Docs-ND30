import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ADMINISTRATIVE_DOCUMENT_TYPES } from "../src/utils/documentStructure.ts";
import { parseLocalFile } from "../src/utils/localFileImport.ts";
import { loadPilotTestFile, loadPilotTestManifest } from "../src/utils/pilotTestDocuments.ts";

const fixtureFetch: typeof fetch = async input => {
  const pathname = new URL(input.toString(), "http://pilot.local").pathname;
  const assetPath = join(process.cwd(), "public", pathname.replace(/^\//, ""));
  try {
    return new Response(await readFile(assetPath), { status: 200 });
  } catch {
    return new Response("Not found", { status: 404 });
  }
};

const items = await loadPilotTestManifest(fixtureFetch);
assert.equal(items.length, ADMINISTRATIVE_DOCUMENT_TYPES.length * 3, "there must be three DOCX pilot cases for every administrative document type");

const counts = new Map<string, number>();
for (const item of items) counts.set(item.documentType, (counts.get(item.documentType) || 0) + 1);
for (const type of ADMINISTRATIVE_DOCUMENT_TYPES) {
  assert.equal(counts.get(type.name), 3, `${type.name} must have exactly three pilot cases`);
}

for (const item of items) {
  const file = await loadPilotTestFile(item, fixtureFetch);
  const parsed = await parseLocalFile(file);
  const expectedType = item.documentType.toLocaleUpperCase("vi-VN");
  const typeDefinition = ADMINISTRATIVE_DOCUMENT_TYPES.find(type => type.name === item.documentType);
  assert.equal(parsed.structured?.fields.documentType.value, expectedType, `${item.id} must parse its document type`);
  assert.equal(parsed.structured?.source.detectedRegime, "administrative", `${item.id} must use the administrative header regime`);
  assert.match(parsed.structured?.fields.orgHeader1.value || "", /CƠ QUAN PILOT HÀNG HẢI/);
  assert.match(parsed.structured?.fields.orgHeader2.value || "", /TRUNG TÂM KIỂM THỬ VĂN BẢN/);
  assert.match(parsed.structured?.fields.referenceNumber.value || "", /PILOT/);
  assert.ok(parsed.structured?.body.sourceBlockIds.length >= 3, `${item.id} must contain multiple body blocks`);
  for (const outline of typeDefinition?.bodyOutline || []) {
    assert.ok(parsed.structured?.body.html.includes(outline), `${item.id} must include the ${outline} body section`);
  }
  assert.ok(parsed.structured?.appendices.length >= 1, `${item.id} must exercise appendix parsing`);
  assert.match(parsed.structured?.appendices[0]?.html || "", /dữ liệu giả lập/i);
  if (item.scenario.startsWith("Bảng")) {
    assert.match(parsed.structured?.body.html || "", /<table\b/i, `${item.id} must retain its body table`);
  }
  if (item.scenario.startsWith("Danh sách")) {
    assert.match(parsed.structured?.body.html || "", /Thực hiện bước thứ nhất/, `${item.id} must retain its numbered body items`);
  }
  if (item.documentType === "Biên bản") {
    assert.equal(parsed.structured?.fields.locationAndDate.value, null, `${item.id} keeps meeting time in the body instead of the header date`);
    assert.match(parsed.structured?.body.html || "", /Thời gian:/, `${item.id} must retain meeting time in the body`);
    assert.equal(parsed.structured?.signatureBlocks?.length, 2, `${item.id} must preserve secretary and chairperson as separate signers`);
  } else {
    assert.ok(parsed.structured?.fields.locationAndDate.value, `${item.id} must include an issue date`);
    assert.ok(parsed.structured?.fields.signName.value, `${item.id} must include a signer`);
    assert.ok(parsed.structured?.fields.recipients.value, `${item.id} must include recipients`);
  }
}

console.log(`All ${items.length} synthetic administrative pilot DOCX files parse with the expected structural fields`);
