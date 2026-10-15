import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseLocalFile } from "../src/utils/localFileImport.ts";
import { composeImportedBodyHtml } from "../src/utils/importReview.ts";
import { detectEmbeddedSignature } from "../src/utils/docxExport.ts";

const bytes = await readFile(new URL("./fixtures/step1-smoke.docx", import.meta.url));
const file = new File([new Uint8Array(bytes)], "step1-smoke.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
const parsed = await parseLocalFile(file);
assert.ok(parsed.structured, "DOCX must produce a structured import");
const source = parsed.structured;
assert.equal(source.source.type, "docx");
assert.equal(source.source.detectedRegime, "administrative");
assert.equal(source.fields.orgHeader1.value, "TỔNG CÔNG TY BẢO ĐẢM\nAN TOÀN HÀNG HẢI VIỆT NAM");
assert.equal(source.fields.orgHeader2.value, "CÔNG TY HOA TIÊU HÀNG HẢI MIỀN BẮC");
assert.match(source.body.html, /Nội dung thử nghiệm/);
assert.ok(source.signatureHtml?.includes("Nguyễn Văn Mẫu"), "the signer table must stay in the signature region");
assert.ok(source.signatureHtml?.includes("Trần Văn Mẫu"));
assert.ok(source.signatureHtml?.includes("Lê Văn Mẫu"));
assert.equal(source.fields.signTitle.value, null, "multi-person signature must not become an extra single signer");
assert.equal(source.fields.signName.value, null, "multi-person signature must not become an extra single signer");
assert.equal(detectEmbeddedSignature(composeImportedBodyHtml(source)), true);
assert.equal(source.appendices.length, 1);
assert.match(source.appendices[0].html, /Kiểm tra bước nhập/);
const sourceText = source.blocks?.map(block => block.text).join("\n") || "";
for (const name of ["Nguyễn Văn Mẫu", "Trần Văn Mẫu", "Lê Văn Mẫu", "Kiểm tra bước nhập"]) {
  assert.ok(sourceText.includes(name), `${name} must remain in source blocks`);
}
console.log(`DOCX smoke import passed: ${source.source.blockCount} blocks, ${source.appendices.length} appendices`);
