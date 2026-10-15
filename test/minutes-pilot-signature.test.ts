import assert from "node:assert/strict";
import { segmentSourceBlocks } from "../src/server/structuralSegmenter.ts";

const parsed = segmentSourceBlocks([
  {
    id: "header", index: 0, kind: "table", text: "Cơ quan | Quốc hiệu",
    tableShape: { rows: 1, columns: 2 },
    tableData: [["CƠ QUAN PILOT", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc"]],
  },
  { id: "type", index: 1, kind: "paragraph", text: "BIÊN BẢN" },
  { id: "subject", index: 2, kind: "paragraph", text: "Về việc kiểm thử ghi nhận cuộc họp" },
  { id: "time", index: 3, kind: "paragraph", text: "Thời gian: 08 giờ 30 phút, ngày 15 tháng 10 năm 2026." },
  {
    id: "signature", index: 4, kind: "table", text: "THƯ KÝ | CHỦ TỌA",
    tableShape: { rows: 3, columns: 2 },
    tableData: [
      ["THƯ KÝ", "CHỦ TỌA"],
      ["(Ký, ghi rõ họ tên)", "(Ký, ghi rõ họ tên)"],
      ["Nguyễn Văn Mẫu", "Trần Thị Mẫu"],
    ],
  },
], { filename: "bien-ban-pilot.docx", fileType: "docx" });

assert.deepEqual((parsed.signatureBlocks || []).map(({ role, name }) => ({ role, name })), [
  { role: "THƯ KÝ", name: "Nguyễn Văn Mẫu" },
  { role: "CHỦ TỌA", name: "Trần Thị Mẫu" },
]);
assert.ok(parsed.body.html.includes("Thời gian:"), JSON.stringify({ body: parsed.body, fields: parsed.fields, blocks: (parsed.blocks || []).map(({ text, role }) => ({ text, role })) }));
assert.ok(!parsed.body.html.includes("THƯ KÝ"), "the two-column signer table must stay outside the body");

console.log("Two-column pilot minutes signature is segmented as signer blocks");
