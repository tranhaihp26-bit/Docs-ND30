import assert from "node:assert/strict";
import { buildAuditChunks, parseAuditResponse, runImportAiAudit } from "../src/server/importAiAudit.ts";
import type { AuditInput, AuditRegion } from "../src/shared/aiImportAudit.ts";

const extracted = (value: string | null, sourceBlockIds: string[] = []) => ({
  value, confidence: value ? "high" as const : "low" as const,
  status: value ? "extracted" as const : "missing" as const, sourceBlockIds,
});

function fixture(): AuditInput {
  const blocks = [
    { id: "h-1", index: 0, kind: "paragraph" as const, text: "CƠ QUAN CẤP TRÊN", role: "header" as const, style: "Bold" },
    { id: "m-1", index: 1, kind: "paragraph" as const, text: "BIÊN BẢN", role: "metadata" as const },
    { id: "b-1", index: 2, kind: "paragraph" as const, text: "BODY_SOURCE_SENTINEL", html: "<p>BODY_HTML_SENTINEL</p>", role: "body" as const },
    { id: "s-1", index: 3, kind: "table" as const, text: "CHỮ KÝ NGUỒN", role: "signature" as const,
      tableShape: { rows: 1, columns: 1 }, tableData: [["CHỮ KÝ Ô"]] },
    { id: "r-1", index: 4, kind: "paragraph" as const, text: "NƠI NHẬN NGUỒN", role: "recipients" as const },
    { id: "sep-1", index: 5, kind: "paragraph" as const, text: "DẤU NGĂN", role: "separator" as const },
    { id: "a-1", index: 6, kind: "table" as const, text: "BẢNG PHỤ LỤC NGUỒN", role: "appendix" as const,
      tableShape: { rows: 1, columns: 1 }, tableData: [["Ô PHỤ LỤC"]] },
    { id: "u-1", index: 7, kind: "paragraph" as const, text: "CHƯA PHÂN LOẠI", role: "unclassified" as const },
  ];
  return {
    standardType: "state",
    document: {
      orgHeader1: "CƠ QUAN CẤP TRÊN", orgHeader2: "CƠ QUAN BAN HÀNH",
      nationalHeader1: "QUỐC HIỆU", nationalHeader2: "TIÊU NGỮ",
      referenceNumber: "Số: 01", locationAndDate: "Hải Phòng, ngày 01 tháng 10 năm 2026",
      documentType: "BIÊN BẢN", subject: "TRÍCH YẾU", bodyHtml: "<p>BODY_DRAFT_SENTINEL</p>",
      signTitle: "CHỨC VỤ", signName: "NGƯỜI KÝ", recipients: "NƠI NHẬN",
      appendices: [{ id: "appendix-1", title: "PHỤ LỤC", html: "APPENDIX_DRAFT_SENTINEL" }],
    },
    structuredImport: {
      source: { type: "docx", blockCount: blocks.length },
      fields: {
        orgHeader1: extracted("CƠ QUAN CẤP TRÊN", ["h-1"]),
        orgHeader2: extracted("CƠ QUAN BAN HÀNH", ["h-1"]),
        nationalHeader1: extracted("QUỐC HIỆU", ["h-1"]),
        nationalHeader2: extracted("TIÊU NGỮ", ["h-1"]),
        referenceNumber: extracted("Số: 01", ["m-1"]),
        locationAndDate: extracted("Hải Phòng, ngày 01 tháng 10 năm 2026", ["m-1"]),
        documentType: extracted("BIÊN BẢN", ["m-1"]),
        subject: extracted("TRÍCH YẾU", ["m-1"]),
        signTitle: extracted("CHỨC VỤ", ["s-1"]), signName: extracted("NGƯỜI KÝ", ["s-1"]),
        recipients: extracted("NƠI NHẬN", ["r-1"]),
        customParsedField: extracted("EXTRA_PARSED_FIELD_SENTINEL", ["m-1"]),
      },
      body: { html: "<p>BODY_PARSED_AGGREGATE_SENTINEL</p>", sourceBlockIds: ["b-1"] },
      signatureHtml: "<table>SIGNATURE_HTML_SENTINEL</table>",
      appendices: [{ id: "appendix-1", title: "PHỤ LỤC", html: "APPENDIX_SOURCE_SENTINEL", blocks: [blocks[6]],
        sourceBlockIds: ["a-1"], extractionStatus: "needs_review", tables: [{ rows: 1, columns: 1, data: [["APPENDIX_TABLE_SENTINEL"]] }] }],
      unclassified: [blocks[7]], blocks, order: blocks.map(block => block.id),
    },
  };
}

const input = fixture();
const chunks = buildAuditChunks(input);
const contents = chunks.flatMap(chunk => {
  const parsed = JSON.parse(chunk.text);
  assert.ok(Array.isArray(parsed.items), "each model request is valid structured JSON");
  return parsed.items.map((item: { content?: string }) => item.content || "");
}).join("\n");
for (const sentinel of [
  "CƠ QUAN CẤP TRÊN", "BIÊN BẢN", "BODY_SOURCE_SENTINEL", "BODY_HTML_SENTINEL",
  "CHỮ KÝ NGUỒN", "CHỮ KÝ Ô", "NƠI NHẬN NGUỒN", "DẤU NGĂN", "BẢNG PHỤ LỤC NGUỒN",
  "Ô PHỤ LỤC", "CHƯA PHÂN LOẠI", "EXTRA_PARSED_FIELD_SENTINEL", "BODY_DRAFT_SENTINEL",
  "BODY_PARSED_AGGREGATE_SENTINEL", "SIGNATURE_HTML_SENTINEL", "APPENDIX_DRAFT_SENTINEL",
  "APPENDIX_SOURCE_SENTINEL",
  "APPENDIX_TABLE_SENTINEL",
]) assert.ok(contents.includes(sentinel), `audit input includes ${sentinel}`);
assert.ok(!chunks.some(chunk => chunk.text.includes("filename")), "source filename is not sent to the model");

const longText = "LONG_BODY_SENTINEL_" + "nội dung dài ".repeat(2400);
const longInput = fixture();
longInput.structuredImport.blocks = [{ id: "long-body", index: 0, kind: "paragraph", role: "body", text: longText }];
longInput.structuredImport.body = { html: "", sourceBlockIds: ["long-body"] };
longInput.structuredImport.appendices = [];
longInput.structuredImport.unclassified = [];
longInput.structuredImport.fields = {};
const longChunks = buildAuditChunks(longInput).filter(chunk => chunk.region === "body");
const longPieces = longChunks.flatMap(chunk => JSON.parse(chunk.text).items)
  .filter((item: { blockId?: string; contentKind?: string; origin?: string }) => item.blockId === "long-body" && item.origin === "Khối nguồn đã parse")
  .sort((a: { part?: number }, b: { part?: number }) => (a.part || 1) - (b.part || 1));
assert.ok(longPieces.length > 1, "oversized source blocks are split across requests");
assert.equal(longPieces.map((item: { content: string }) => item.content).join(""), longText, "chunking preserves every source character in order");

const validFinding = {
  category: "format", severity: "attention", fieldKey: "subject",
  observation: "Trích yếu đang viết hoa.", recommendation: "Đối chiếu quy tắc tên loại và trích yếu.",
};
assert.equal(parseAuditResponse(JSON.stringify({ summary: "ok", findings: [validFinding] }), "metadata", new Set(), new Set(["subject"])).findings.length, 1);
assert.throws(() => parseAuditResponse(JSON.stringify({ summary: "x", findings: [{ ...validFinding, fieldKey: "not-parsed" }] }), "metadata", new Set(), new Set(["subject"])));
assert.throws(() => parseAuditResponse(JSON.stringify({ summary: "x", findings: [{ ...validFinding, fieldKey: undefined, blockId: "outside-chunk" }] }), "metadata", new Set(["inside-chunk"]), new Set(["subject"])));

const generatedRegions: AuditRegion[] = [];
const report = await runImportAiAudit(input, async prompt => {
  const region = prompt.match(/Vùng: .*\((\w+)\)/)?.[1] as AuditRegion;
  generatedRegions.push(region);
  return { text: JSON.stringify({ summary: `Đã rà soát ${region}.`, findings: [], visualLimitations: [] }), model: "test-model" };
});
assert.equal(report.scope, "complete");
assert.equal(report.reviewedChunks, report.totalChunks);
assert.deepEqual(new Set(generatedRegions), new Set(["header", "metadata", "body", "footer", "appendix", "other"]));
assert.equal(report.sections.find(section => section.region === "header")?.status, "no_finding");
assert.equal(report.sections.find(section => section.region === "appendix")?.status, "no_finding");

let failedRegion: AuditRegion | "" = "";
const partial = await runImportAiAudit(input, async prompt => {
  const region = prompt.match(/Vùng: .*\((\w+)\)/)?.[1] as AuditRegion;
  if (!failedRegion) failedRegion = region;
  if (region === failedRegion) throw new Error("simulated model failure");
  return { text: JSON.stringify({ summary: "ok", findings: [], visualLimitations: [] }), model: "test-model" };
});
assert.equal(partial.scope, "partial");
assert.equal(partial.sections.find(section => section.region === failedRegion)?.status, "not_evaluated");

console.log("AI import audit tests passed");
