import assert from "node:assert/strict";
import { segmentSourceBlocks } from "../src/server/structuralSegmenter.ts";
import { composeImportedBodyHtml } from "../src/utils/importReview.ts";

const source = segmentSourceBlocks([
  { id: "type", index: 0, kind: "paragraph", text: "CÔNG VĂN", role: "unclassified" },
  { id: "subject", index: 1, kind: "paragraph", text: "V/v phối hợp thực hiện nhiệm vụ", role: "unclassified" },
  { id: "blank", index: 2, kind: "paragraph", text: "", role: "unclassified" },
  { id: "to", index: 3, kind: "paragraph", text: "Kính gửi:", role: "unclassified" },
  { id: "recipient", index: 4, kind: "paragraph", text: "Sở Giao thông vận tải", role: "unclassified" },
  { id: "body", index: 5, kind: "paragraph", text: "Đề nghị quý cơ quan phối hợp thực hiện...", html: "<p>Đề nghị quý cơ quan phối hợp thực hiện...</p>", role: "unclassified" },
], { filename: "cong-van.docx", fileType: "docx" });

assert.equal(source.fields.addressee?.value, "Sở Giao thông vận tải");
assert.equal(source.fields.addressee?.sourceBlockIds[0], "to");
assert.equal(source.blocks?.find(block => block.id === "recipient")?.role, "metadata");
assert.equal(source.blocks?.find(block => block.id === "blank")?.role, "separator");
assert.ok(!composeImportedBodyHtml(source).includes("Kính gửi"), "the recipient component is outside the body editor");
assert.ok(composeImportedBodyHtml(source).includes("phối hợp thực hiện"), "body paragraphs remain intact");

console.log("Addressee/body separation checks passed");
