import assert from "node:assert/strict";
import {
  ADMINISTRATIVE_DOCUMENT_TYPES,
  hasAdministrativeHeaderIssueDate,
  getAdministrativeDocumentStructure,
  getSignatureBlocksFromTable,
  type DocumentSignatureBlock,
} from "../src/utils/documentStructure.ts";
import { MINUTES_TEMPLATE } from "../src/utils/minutesTemplate.ts";

assert.equal(ADMINISTRATIVE_DOCUMENT_TYPES.length, 29, "Nghị định 30 type catalog must cover all 29 types");
assert.equal(new Set(ADMINISTRATIVE_DOCUMENT_TYPES.map(type => type.name)).size, 29, "document type names must be unique");
assert.equal(ADMINISTRATIVE_DOCUMENT_TYPES.filter(type => type.sampleFormAvailable).length, 25);
assert.deepEqual(
  ADMINISTRATIVE_DOCUMENT_TYPES.filter(type => !type.sampleFormAvailable).map(type => type.abbreviation),
  ["HĐ", "BGN", "BTT", ""],
  "the four types without dedicated sample forms should be explicit",
);

for (const type of ADMINISTRATIVE_DOCUMENT_TYPES) {
  assert.ok(type.bodyOutline.length >= 2, `${type.name} must have a useful editable body outline`);
  assert.equal(type.outlineIsSuggestion, true, `${type.name} outline must be labeled as guidance`);
}

assert.equal(getAdministrativeDocumentStructure("BIÊN BẢN")?.outlineGroup, "minutes");
assert.equal(getAdministrativeDocumentStructure("Quyết định")?.outlineGroup, "decision");
assert.equal(getAdministrativeDocumentStructure("CÔNG VĂN")?.sampleFormAvailable, true);
assert.equal(hasAdministrativeHeaderIssueDate("BIÊN BẢN HỌP"), false, "Mẫu 1.9 records meeting time in the body");
assert.equal(hasAdministrativeHeaderIssueDate("CÔNG VĂN"), true, "other form layouts retain the common issue-date header");
assert.equal(getAdministrativeDocumentStructure("Hợp đồng")?.sampleFormAvailable, false);
assert.equal(getAdministrativeDocumentStructure("VĂN BẢN TÙY CHỈNH"), undefined);

const importedSigners = getSignatureBlocksFromTable([
  ["THƯ KÝ", "CHỦ TỌA"],
  ["(Ký, ghi rõ họ tên)", "(Ký, ghi rõ họ tên)"],
  ["Nguyễn An", "Trần Bình"],
]);
assert.deepEqual(importedSigners.map(({ role, name }) => ({ role, name })), [
  { role: "THƯ KÝ", name: "Nguyễn An" },
  { role: "CHỦ TỌA", name: "Trần Bình" },
]);
assert.deepEqual(getSignatureBlocksFromTable([["không rõ"], ["chữ ký"]]), [], "ambiguous signatures are not silently guessed");

const minuteSigners = MINUTES_TEMPLATE.defaultData.signatureBlocks as DocumentSignatureBlock[];
assert.deepEqual(minuteSigners.map(({ role }) => role), ["THƯ KÝ", "CHỦ TỌA"]);
assert.ok(!MINUTES_TEMPLATE.defaultData.bodyHtml.includes("<table"), "minutes signatures must be outside the main body editor");
assert.ok(!MINUTES_TEMPLATE.defaultData.bodyHtml.includes("THƯ KÝ (người ghi biên bản)"), "body may retain secretary as an event participant, but not the signature block");
assert.ok(!MINUTES_TEMPLATE.defaultData.bodyHtml.includes("[Chữ ký thư ký và chủ tọa"));

console.log("Document structure and external signer block checks passed");
