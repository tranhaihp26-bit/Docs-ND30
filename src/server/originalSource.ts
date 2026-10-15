import { createHash } from "node:crypto";
import JSZip from "jszip";
import mammoth from "mammoth";
import type { SourceBlock } from "../shared/schemas/document.schema.ts";

export interface OriginalSourceEvidence {
  sha256: string;
  text: string;
  extractionMethod: "mammoth_docx" | "utf8_txt";
  fileType: "docx" | "txt";
  byteLength: number;
  detectedFeatures: string[];
  notEvaluatedFeatures: string[];
}

export interface SourceTextReconciliation {
  status: "matched" | "mismatch" | "not_evaluated";
  coverage: "text_only" | "partial";
  sourceTokenCount: number;
  parsedTokenCount: number;
  firstMismatchAt?: number;
}

const NOT_EVALUATED_LAYOUT = [
  "Ngắt trang, căn lề, chiều rộng đường kẻ, vị trí hình ảnh và bố cục trang Word chưa được render để đối chiếu.",
];

async function inspectDocxFeatures(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  const names = Object.keys(zip.files);
  const uncompressedBytes = Object.values(zip.files).reduce((sum, entry) => {
    const size = (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0;
    return sum + size;
  }, 0);
  if (uncompressedBytes > 100 * 1024 * 1024) throw new Error("DOCX giải nén vượt giới hạn rà soát 100 MB.");
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("DOCX thiếu word/document.xml.");
  const detected: string[] = [];
  const hasInBody = (label: string, expression: RegExp) => { if (expression.test(documentXml)) detected.push(label); };

  const hasVisiblePartContent = async (patterns: RegExp[]) => {
    const partNames = names.filter(name => patterns.some(pattern => pattern.test(name)));
    for (const name of partNames) {
      const part = await zip.file(name)?.async("string");
      if (part && /<w:(?:t|tbl|drawing|pict)\b[^>]*>[\s\S]*?\S[\s\S]*?<\/w:(?:t|tbl|drawing|pict)>/i.test(part)) return true;
    }
    return false;
  };
  if (await hasVisiblePartContent([/^word\/header\d*\.xml$/i])) detected.push("Tệp có header chứa nội dung riêng trong OOXML; bộ trích xuất chưa đưa vùng này vào các khối thân.");
  if (await hasVisiblePartContent([/^word\/footer\d*\.xml$/i])) detected.push("Tệp có footer chứa nội dung riêng trong OOXML; bộ trích xuất chưa đưa vùng này vào các khối thân.");
  const footnotesXml = await zip.file("word/footnotes.xml")?.async("string");
  if (footnotesXml && /<w:footnote\b[^>]*w:id=["'](?!-)[^"']+["'][^>]*>[\s\S]*?<w:t(?:\s[^>]*)?>\s*[^<\s]/i.test(footnotesXml)) {
    detected.push("Tệp có footnote chứa văn bản; chưa đối chiếu nội dung footnote.");
  }
  const endnotesXml = await zip.file("word/endnotes.xml")?.async("string");
  if (endnotesXml && /<w:endnote\b[^>]*w:id=["'](?!-)[^"']+["'][^>]*>[\s\S]*?<w:t(?:\s[^>]*)?>\s*[^<\s]/i.test(endnotesXml)) {
    detected.push("Tệp có endnote chứa văn bản; chưa đối chiếu nội dung endnote.");
  }
  const commentsXml = await zip.file("word/comments.xml")?.async("string");
  if (commentsXml && /<w:comment\b[^>]*>[\s\S]*?<w:t(?:\s[^>]*)?>\s*[^<\s]/i.test(commentsXml)) {
    detected.push("Tệp có comments chứa văn bản; chưa đối chiếu nội dung nhận xét.");
  }
  hasInBody("Tệp có text box; nội dung text box chưa được đảm bảo trích xuất đầy đủ.", /<w:txbxContent\b/i);
  hasInBody("Tệp có ảnh hoặc drawing; chưa chạy OCR và chưa đánh giá vị trí ảnh.", /<(?:w:drawing|w:pict|a:blip)\b/i);
  hasInBody("Tệp có ngắt trang tường minh; chưa xác nhận vị trí trang sau khi render.", /<w:br\b[^>]*w:type=["']page["']/i);
  hasInBody("Tệp có section break bên trong nội dung; chưa xác nhận lề/khổ giấy riêng của từng section.", /<w:pPr\b[^>]*>[\s\S]*?<w:sectPr\b[\s\S]*?<\/w:pPr>/i);
  hasInBody("Tệp có field code; nội dung trường động có thể khác giá trị hiển thị trong Word.", /<(?:w:fldChar|w:instrText)\b/i);
  hasInBody("Tệp có nội dung theo dõi sửa đổi; chưa xác nhận trạng thái hiển thị trong Word.", /<w:(?:ins|del)\b/i);
  return detected;
}

/** Extract original content independently of the browser's structural parser. The bytes stay in memory. */
export async function extractOriginalSourceEvidence(fileName: string, buffer: Buffer): Promise<OriginalSourceEvidence> {
  const extension = fileName.toLowerCase().split(".").pop();
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (extension === "txt") {
    if (buffer.includes(0)) throw new Error("Tệp TXT có dữ liệu nhị phân, không thể rà soát an toàn.");
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
    catch { throw new Error("Tệp TXT không dùng mã hóa UTF-8 hợp lệ."); }
    if (!text.trim()) throw new Error("Không có nội dung văn bản trong file TXT gốc.");
    return { sha256, text, extractionMethod: "utf8_txt", fileType: "txt", byteLength: buffer.byteLength,
      detectedFeatures: [], notEvaluatedFeatures: [...NOT_EVALUATED_LAYOUT] };
  }
  if (extension !== "docx") throw new Error("Chỉ hỗ trợ đối chiếu file DOCX hoặc TXT.");
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error("File DOCX không có chữ ký ZIP hợp lệ.");
  }
  try {
    const detectedFeatures = await inspectDocxFeatures(buffer);
    const raw = await mammoth.extractRawText({ buffer });
    const text = raw.value;
    if (!text.trim()) throw new Error("Không trích xuất được văn bản từ file DOCX gốc.");
    return { sha256, text, extractionMethod: "mammoth_docx", fileType: "docx", byteLength: buffer.byteLength,
      detectedFeatures, notEvaluatedFeatures: [...NOT_EVALUATED_LAYOUT] };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Không trích xuất")) throw error;
    throw new Error("Không thể đọc cấu trúc DOCX gốc để đối chiếu.");
  }
}

function words(text: string): string[] {
  return text.normalize("NFC").match(/[\p{L}\p{N}]+/gu)?.map(token => token.toLocaleLowerCase("vi-VN")) || [];
}

/** Compare the independently extracted source's word sequence with the browser parser's ordered blocks. */
export function compareSourceToParsedBlocks(sourceText: string, blocks: SourceBlock[], hasUnsupportedFeatures = false): SourceTextReconciliation {
  const sourceTokens = words(sourceText);
  const parsedTokens = words(blocks.map(block => block.text).join("\n"));
  let firstMismatchAt: number | undefined;
  const length = Math.min(sourceTokens.length, parsedTokens.length);
  for (let index = 0; index < length; index++) {
    if (sourceTokens[index] !== parsedTokens[index]) { firstMismatchAt = index; break; }
  }
  if (firstMismatchAt === undefined && sourceTokens.length !== parsedTokens.length) firstMismatchAt = length;
  const status = firstMismatchAt === undefined ? "matched" : "mismatch";
  return {
    status,
    coverage: hasUnsupportedFeatures ? "partial" : "text_only",
    sourceTokenCount: sourceTokens.length,
    parsedTokenCount: parsedTokens.length,
    ...(firstMismatchAt === undefined ? {} : { firstMismatchAt }),
  };
}

export function getOriginalSourceVisualLimitations(evidence: OriginalSourceEvidence): string[] {
  return [...evidence.notEvaluatedFeatures, ...evidence.detectedFeatures];
}
