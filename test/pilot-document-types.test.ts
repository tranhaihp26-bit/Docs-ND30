import assert from "node:assert/strict";
import { ADMINISTRATIVE_DOCUMENT_TYPES } from "../src/utils/documentStructure.ts";
import { segmentSourceBlocks } from "../src/server/structuralSegmenter.ts";

const header = {
  id: "header",
  index: 0,
  kind: "table" as const,
  text: "CÔNG TY PILOT | CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
  tableShape: { rows: 1, columns: 2 },
  tableData: [["CÔNG TY HOA TIÊU HÀNG HẢI MIỀN BẮC", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc"]],
};

for (const [index, type] of ADMINISTRATIVE_DOCUMENT_TYPES.entries()) {
  const blocks = [
    header,
    { id: "date", index: 1, kind: "paragraph" as const, text: "Hải Phòng, ngày 15 tháng 10 năm 2026" },
    { id: "number", index: 2, kind: "paragraph" as const, text: `Số: ${index + 1}/PILOT` },
    { id: "type", index: 3, kind: "paragraph" as const, text: type.name.toLocaleUpperCase("vi-VN") },
    { id: "subject", index: 4, kind: "paragraph" as const, text: `V/v kiểm thử ${type.name.toLocaleLowerCase("vi-VN")}` },
    { id: "body", index: 5, kind: "paragraph" as const, text: "Nội dung giả lập phục vụ kiểm tra định dạng." },
  ];
  const parsed = segmentSourceBlocks(blocks, { filename: `${type.abbreviation || "other"}.docx`, fileType: "docx" });
  assert.equal(
    parsed.fields.documentType.value,
    type.name.toLocaleUpperCase("vi-VN"),
    `${type.name} must be detected as the document type`,
  );
}

console.log(`All ${ADMINISTRATIVE_DOCUMENT_TYPES.length} administrative document types are recognized`);
