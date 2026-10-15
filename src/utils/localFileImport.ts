import { extractBlocksFromDocx, extractBlocksFromTxt } from "../server/blockExtractor.ts";
import { segmentSourceBlocks } from "../server/structuralSegmenter.ts";
import { parseImportResponse, type ParsedImport } from "./importState.ts";

export async function parseLocalFile(file: File): Promise<ParsedImport & { blockCount: number }> {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "docx" && extension !== "txt") {
    throw new Error("Định dạng file không được hỗ trợ. Vui lòng chọn .docx hoặc .txt.");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("Tệp tin quá lớn. Kích thước tối đa cho phép là 25 MB.");
  }

  let extracted;
  if (extension === "txt") {
    const content = await file.text();
    extracted = extractBlocksFromTxt(content);
  } else {
    try {
      extracted = await extractBlocksFromDocx(await file.arrayBuffer());
    } catch {
      throw new Error("Tệp tin không đúng định dạng Microsoft Word (DOCX) hợp lệ hoặc đã bị hỏng.");
    }
  }

  const structured = segmentSourceBlocks(extracted.blocks, {
    filename: file.name,
    fileType: extension,
  });
  const parsed = parseImportResponse(file.name, {
    success: true,
    text: extracted.rawText,
    html: extracted.rawHtml,
    fileType: extension,
    structured,
  });
  return { ...parsed, blockCount: extracted.blocks.length };
}
