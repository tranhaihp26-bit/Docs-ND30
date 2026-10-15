import assert from "node:assert/strict";
import { assignUnclassifiedBlock, deriveImportStatus, updateImportField } from "../src/utils/importReview.ts";
import { buildImportReview } from "../src/utils/importRules.ts";
import type { StructuredImport } from "../src/shared/schemas/document.schema.ts";

function source(): StructuredImport {
  return {
    source: { filename: "ke-hoach.docx", type: "docx", blockCount: 2 },
    fields: {
      documentType: { value: "KẾ HOẠCH", confidence: "high", status: "extracted", sourceBlockIds: ["block-0"] },
      signName: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    },
    body: { html: "<p>Nội dung chính</p>", sourceBlockIds: ["block-1"] },
    appendices: [],
    unclassified: [],
    order: ["block-0", "block-1"],
  };
}

const initial = source();
assert.equal(deriveImportStatus(initial, true), "needs_review");
assert.equal(deriveImportStatus(initial, false), "needs_review");

const edited = updateImportField(initial, "signName", "Nguyễn Văn B");
assert.equal(initial.fields.signName.value, null);
assert.equal(edited.fields.signName.value, "Nguyễn Văn B");
assert.equal(edited.fields.signName.status, "user_confirmed");
assert.equal(deriveImportStatus(edited, true), "confirmed");
assert.equal(deriveImportStatus(edited, false), "needs_review");

const unresolved = { ...edited, unclassified: [{ id: "block-2", index: 2, kind: "table" as const, text: "Bảng chưa gán", role: "unclassified" as const }] };
assert.equal(deriveImportStatus(unresolved, true), "needs_review");

const companyMinutes: StructuredImport = {
  source: { filename: "bien-ban.docx", type: "docx", blockCount: 4, detectedRegime: "administrative" },
  fields: {
    orgHeader1: { value: "TỔNG CÔNG TY BẢO ĐẢM\nAN TOÀN HÀNG HẢI VIỆT NAM", confidence: "high", status: "extracted", sourceBlockIds: ["header"] },
    orgHeader2: { value: "CÔNG TY HOA TIÊU HÀNG HẢI MIỀN BẮC", confidence: "high", status: "extracted", sourceBlockIds: ["header"] },
    nationalHeader1: { value: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", confidence: "high", status: "extracted", sourceBlockIds: ["header"] },
    nationalHeader2: { value: "Độc lập - Tự do - Hạnh phúc", confidence: "high", status: "extracted", sourceBlockIds: ["header"] },
    referenceNumber: { value: "Số: …/BB", confidence: "high", status: "extracted", sourceBlockIds: ["header"] },
    locationAndDate: { value: "Hải Phòng, ngày … tháng … năm 2026", confidence: "medium", status: "ambiguous", sourceBlockIds: ["header"] },
    documentType: { value: "BIÊN BẢN", confidence: "high", status: "extracted", sourceBlockIds: ["title"] },
    subject: { value: "Về việc làm việc", confidence: "high", status: "extracted", sourceBlockIds: ["subject"] },
    signTitle: { value: "THƯ KÝ", confidence: "high", status: "extracted", sourceBlockIds: ["sign"] },
    signName: { value: "Nguyễn Văn B", confidence: "high", status: "extracted", sourceBlockIds: ["sign"] },
    recipients: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
  },
  body: { html: "<p>Nội dung làm việc</p>", sourceBlockIds: ["body"] },
  signatureHtml: "<table><tr><td>Đại diện</td><td>Cán bộ</td><td>Thư ký</td></tr></table>",
  appendices: [], unclassified: [], order: ["header", "title", "subject", "body", "sign"],
  blocks: [
    { id: "header", index: 0, kind: "table", text: "Đầu văn bản", role: "header", tableShape: {rows:1, columns:2}, tableData:[["Công ty", "Quốc hiệu"]] },
    { id: "title", index: 1, kind: "paragraph", text: "BIÊN BẢN", role: "metadata" },
    { id: "subject", index: 2, kind: "paragraph", text: "Về việc làm việc", role: "metadata" },
    { id: "body", index: 3, kind: "paragraph", text: "Nội dung làm việc", role: "body" },
    { id: "sign", index: 4, kind: "table", text: "Đại diện | Cán bộ | Thư ký", role: "signature", tableShape: {rows:1, columns:3}, tableData:[["Đại diện", "Cán bộ", "Thư ký"]] },
  ],
};
companyMinutes.source.blockCount = 5;
const review = buildImportReview(companyMinutes, "administrative");
assert.equal(review.find(c => c.id === "ND30.PL1.I.II.1A.NATIONAL_HEADER_TEXT")?.status, "PASS");
assert.equal(review.find(c => c.id === "ND30.PL1.I.II.2B.ISSUER_UPPERCASE")?.status, "PASS");
assert.equal(review.find(c => c.id === "IMPORT.REFERENCE_COMPLETE")?.status, "NEEDS_REVIEW");
assert.equal(review.find(c => c.id === "IMPORT.SOURCE_OWNERSHIP")?.status, "PASS");
assert.equal(review.find(c => c.id === "IMPORT.SIGNATURE_TABLE")?.status, "PASS");
assert.equal(review.find(c => c.id === "ND30.PL1.I.II.2B.ISSUER_UNDERLINE_RANGE")?.status, "NOT_EVALUATED");
assert.equal(review.find(c => c.id === "IMPORT.RECIPIENTS")?.status, "NOT_APPLICABLE");
assert.equal(deriveImportStatus(companyMinutes, true), "needs_review", "Placeholder number/date must remain unresolved");
assert.equal(buildImportReview(companyMinutes, "party").find(c => c.id === "IMPORT.REGIME_MATCH")?.status, "NEEDS_REVIEW");

const missingSignatureCell: StructuredImport = {
  ...companyMinutes,
  blocks: companyMinutes.blocks!.map(block => block.id === "sign"
    ? { ...block, tableData: [["Đại diện", "Cán bộ"]] } : block),
};
assert.equal(buildImportReview(missingSignatureCell, "administrative").find(c => c.id === "IMPORT.SIGNATURE_TABLE")?.status,
  "NEEDS_REVIEW", "A missing cell must not pass table preservation");

const doubleOwnedBody: StructuredImport = {
  ...companyMinutes,
  appendices: [{ id: "app", title: "PHỤ LỤC", html: "<p>Nội dung làm việc</p>",
    blocks: [companyMinutes.blocks![3]], sourceBlockIds: ["body"], extractionStatus: "needs_review" }],
};
assert.equal(buildImportReview(doubleOwnedBody, "administrative").find(c => c.id === "IMPORT.SOURCE_OWNERSHIP")?.status,
  "NEEDS_REVIEW", "One source block must not belong to both body and appendix");

const withUnknown: StructuredImport = {
  ...companyMinutes,
  source: { ...companyMinutes.source, blockCount: 6 },
  blocks: [...companyMinutes.blocks!, { id: "extra", index: 5, kind: "paragraph", text: "Nội dung bổ sung", html: "<p>Nội dung bổ sung</p>", role: "unclassified" }],
  unclassified: [{ id: "extra", index: 5, kind: "paragraph", text: "Nội dung bổ sung", html: "<p>Nội dung bổ sung</p>", role: "unclassified" }],
  order: [...companyMinutes.order, "extra"],
};
const assignedBody = assignUnclassifiedBlock(withUnknown, "extra", "body");
assert.equal(assignedBody.unclassified.length, 0);
assert.ok(assignedBody.body.sourceBlockIds.includes("extra"));
assert.ok(assignedBody.body.html.includes("Nội dung bổ sung"));
assert.equal(assignedBody.blocks?.find(b => b.id === "extra")?.role, "body");
assert.equal(withUnknown.unclassified.length, 1, "Manual assignment must not mutate parsed source");
const assignedAppendix = assignUnclassifiedBlock(withUnknown, "extra", "appendix");
assert.equal(assignedAppendix.appendices.length, 1);
assert.equal(assignedAppendix.appendices[0].extractionStatus, "needs_review");
assert.equal(assignedAppendix.appendices[0].sourceBlockIds[0], "extra");
console.log("[PASS] Import review requires explicit approval and leaves missing/unclassified content for review");
