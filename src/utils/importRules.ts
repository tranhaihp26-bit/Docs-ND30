import type { SourceBlock, StructuredImport } from "../shared/schemas/document.schema.ts";
import { isPlaceholderValue, LOCATION_AND_DATE_REGEX } from "../shared/schemas/document.schema.ts";
import catalog from "../canonical/nd30/rules.generated.json";

export type ImportReviewStatus = "PASS" | "NEEDS_REVIEW" | "NOT_EVALUATED" | "NOT_APPLICABLE";
export type ImportReviewRegion = "source" | "header" | "metadata" | "body" | "footer" | "appendix" | "other";
export interface ImportReviewCheck {
  id: string;
  region: ImportReviewRegion;
  label: string;
  status: ImportReviewStatus;
  detail: string;
  sourceLocator?: string;
  sourceBlockIds?: string[];
}

const officialHd05 = "Hướng dẫn 05-HD/VPTW (27/5/2026)";
const canonicalRules = new Map(catalog.rules.map(rule => [rule.id, rule]));
const upper = (text: string) => text === text.toLocaleUpperCase("vi-VN");
const clean = (text: string | null | undefined) => (text || "").trim();
const normalize = (text: string | null | undefined) => clean(text).replace(/\s+/g, " ");

function tableShapeIntact(block: SourceBlock): boolean {
  if (block.kind !== "table") return true;
  const shape = block.tableShape;
  const rows = block.tableData;
  return Boolean(shape && rows && rows.length === shape.rows && rows.every(row => row.length <= shape.columns));
}

export function buildImportReview(source: StructuredImport, selectedRegime: "administrative" | "party"): ImportReviewCheck[] {
  const result: ImportReviewCheck[] = [];
  const add = (id: string, region: ImportReviewRegion, label: string, status: ImportReviewStatus, detail: string, blockIds: string[] = []) => {
    const rule = canonicalRules.get(id);
    result.push({ id, region, label, status, detail,
      sourceLocator: rule?.source?.locator || (id.startsWith("HD05.") ? officialHd05 : undefined),
      sourceBlockIds: blockIds });
  };
  const field = (name: string) => source.fields[name];
  const value = (name: string) => clean(field(name)?.value);
  const ids = (name: string) => field(name)?.sourceBlockIds || [];
  const fieldCheck = (id: string, region: ImportReviewRegion, label: string, name: string, valid: (v: string) => boolean) => {
    const item = field(name);
    const text = value(name);
    const status: ImportReviewStatus = !text || item?.status === "missing" || item?.status === "ambiguous" || !valid(text)
      ? "NEEDS_REVIEW" : "PASS";
    add(id, region, label, status, status === "PASS" ? "Đối chiếu được với chữ trong tệp nguồn." : "Thiếu, chưa hoàn chỉnh hoặc cần đối chiếu với tệp gốc.", ids(name));
  };

  const blocks = source.blocks;
  if (!blocks) {
    add("IMPORT.SOURCE_OWNERSHIP", "source", "Toàn vẹn khối nguồn", "NOT_EVALUATED", "Chưa có danh sách khối nguồn để đối chiếu.");
  } else {
    const blockIds = blocks.map(b => b.id);
    const exactOrder = blockIds.length === source.source.blockCount && blockIds.length === source.order.length &&
      blockIds.every((id, index) => id === source.order[index]) && new Set(blockIds).size === blockIds.length;
    add("IMPORT.SOURCE_OWNERSHIP", "source", "Toàn vẹn khối nguồn", exactOrder ? "PASS" : "NEEDS_REVIEW",
      exactOrder ? `${blockIds.length} khối, đúng thứ tự và mỗi khối có một vai trò.` : "Số lượng, thứ tự hoặc định danh khối không khớp tệp nguồn.", blockIds);
  }
  const detected = source.source.detectedRegime;
  add("IMPORT.REGIME_MATCH", "source", "Chế độ văn bản", !detected || detected === "unknown" ? "NOT_EVALUATED" : detected === selectedRegime ? "PASS" : "NEEDS_REVIEW",
    detected && detected !== "unknown" ? `Tệp cho thấy chế độ ${detected}; đang chọn ${selectedRegime}.` : "Chưa đủ bằng chứng quốc hiệu/Đảng hiệu để xác định chế độ.");

  if (selectedRegime === "administrative") {
    fieldCheck("ND30.PL1.I.II.1A.NATIONAL_HEADER_TEXT", "header", "Quốc hiệu", "nationalHeader1", v => normalize(v) === "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
    fieldCheck("ND30.PL1.I.II.1B.MOTTO_TEXT", "header", "Tiêu ngữ", "nationalHeader2", v => normalize(v) === "Độc lập - Tự do - Hạnh phúc");
    fieldCheck("ND30.PL1.I.II.2B.ISSUER_UPPERCASE", "header", "Tên cơ quan ban hành viết hoa", "orgHeader2", upper);
    if (value("orgHeader1")) fieldCheck("ND30.PL1.I.II.2B.PARENT_UPPERCASE", "header", "Tên cơ quan cấp trên viết hoa", "orgHeader1", upper);
    else add("ND30.PL1.I.II.2B.PARENT_UPPERCASE", "header", "Cơ quan cấp trên", "NOT_APPLICABLE", "Tệp không có cơ quan cấp trên.");
    add("ND30.PL1.I.II.2B.ISSUER_UNDERLINE_RANGE", "header", "Đường kẻ dưới cơ quan", "NOT_EVALUATED", "Cần đo chiều dài đường kẻ trên bản Word/Preview.");
    add("ND30.PL1.I.II.1B.MOTTO_UNDERLINE_LENGTH", "header", "Đường kẻ dưới tiêu ngữ", "NOT_EVALUATED", "Cần đo theo chiều dài chữ tiêu ngữ trên bản Word/Preview.");
    fieldCheck("ND30.PL1.I.II.5B.TYPE_UPPERCASE", "metadata", "Tên loại văn bản viết hoa", "documentType", upper);
  } else {
    fieldCheck("HD05.I.1.TITLE_TEXT", "header", "Tiêu đề Đảng", "nationalHeader1", v => normalize(v) === "ĐẢNG CỘNG SẢN VIỆT NAM");
    add("HD05.I.2.ISSUER_STAR", "header", "Dấu sao dưới tên cơ quan Đảng", "NOT_EVALUATED", "Cần kiểm tra vị trí dấu sao trên tệp Word gốc.");
    add("HD05.I.1.TITLE_LINE", "header", "Đường liền dưới tiêu đề Đảng", "NOT_EVALUATED", "Cần đo trên bản Word/Preview.");
    fieldCheck("HD05.I.5.TYPE_PRESENT", "metadata", "Tên loại văn bản Đảng", "documentType", v => !isPlaceholderValue(v));
  }

  fieldCheck("IMPORT.REFERENCE_COMPLETE", "metadata", "Số và ký hiệu", "referenceNumber", v => /^Số\s*:?\s*\S+/i.test(v) && !isPlaceholderValue(v));
  fieldCheck("ND30.PL1.I.II.4B.ISSUE_DATE_FULL", "metadata", "Địa danh, ngày ban hành", "locationAndDate", v => LOCATION_AND_DATE_REGEX.test(v) && !isPlaceholderValue(v));
  fieldCheck("IMPORT.SUBJECT_PRESENT", "metadata", "Trích yếu", "subject", v => !isPlaceholderValue(v));
  const isOfficialLetter = /^CÔNG VĂN\b/i.test(value("documentType"));
  if (selectedRegime === "administrative" && !isOfficialLetter) {
    add("ND30.PL1.I.II.5B.NAMED_SUBJECT_BOLD", "metadata", "Trích yếu chữ đậm", "NOT_EVALUATED", "Cần kiểm tra định dạng Word của trích yếu.", ids("subject"));
    add("ND30.PL1.I.II.5B.NAMED_SUBJECT_UNDERLINE_RANGE", "metadata", "Đường kẻ dưới trích yếu", "NOT_EVALUATED", "Cần đo trên bản Word/Preview; quy tắc 5a không dùng cho công văn.", ids("subject"));
  } else if (selectedRegime === "party" && !isOfficialLetter) {
    add("HD05.I.5.FIVE_HYPHENS", "metadata", "Năm dấu gạch nối dưới trích yếu", "NOT_EVALUATED", "Cần kiểm tra tệp Word gốc, riêng văn bản có trích yếu 5a.", ids("subject"));
  }

  const bodyBlocks = blocks?.filter(b => b.role === "body") || [];
  add("IMPORT.BODY_PRESENT", "body", "Nội dung chính", source.body.sourceBlockIds.length && normalize(source.body.html.replace(/<[^>]+>/g, " ")) ? "PASS" : "NEEDS_REVIEW",
    `${source.body.sourceBlockIds.length} khối nội dung chính.`, source.body.sourceBlockIds);
  const bodyTables = bodyBlocks.filter(b => b.kind === "table");
  add("IMPORT.BODY_TABLE_CELLS", "body", "Bảng trong thân", bodyTables.length ? bodyTables.every(tableShapeIntact) ? "PASS" : "NEEDS_REVIEW" : "NOT_APPLICABLE",
    bodyTables.length ? `${bodyTables.length} bảng; đối chiếu số hàng/cột/ô trích xuất.` : "Không có bảng trong thân.", bodyTables.map(b => b.id));
  if (selectedRegime === "administrative") {
    add("ND30.PL1.I.II.6E.BODY_SIZE", "body", "Cỡ chữ thân văn bản", "NOT_EVALUATED", "Parser chưa đo phông/cỡ chữ hiệu dụng từng đoạn Word.");
    add("ND30.PL1.I.II.6E.BODY_LINE_SPACING_RANGE", "body", "Giãn dòng thân văn bản", "NOT_EVALUATED", "Parser chưa đo giãn dòng hiệu dụng từng đoạn Word.");
  }

  const signatureTables = blocks?.filter(b => b.role === "signature" && b.kind === "table") || [];
  add("IMPORT.SIGNATURE_TABLE", "footer", "Bảng ký nhiều người", source.signatureHtml ? signatureTables.length && signatureTables.every(tableShapeIntact) ? "PASS" : "NEEDS_REVIEW" : "NOT_APPLICABLE",
    source.signatureHtml ? `${signatureTables.length} bảng ký được giữ riêng; kiểm tra tên và vị trí từng người.` : "Không có bảng ký nhiều người được nhận diện.", signatureTables.map(b => b.id));
  const hasSignature = Boolean(source.signatureHtml || value("signTitle") || value("signName"));
  add("IMPORT.SIGNATURE_PRESENT", "footer", "Phần ký", hasSignature ? "PASS" : "NEEDS_REVIEW",
    hasSignature ? "Có phần ký trong nguồn; phải đối chiếu trực quan chức vụ và họ tên." : "Chưa tìm thấy phần ký.", [...ids("signTitle"), ...ids("signName")]);
  const isMinutes = /^BIÊN BẢN\b/i.test(value("documentType"));
  add("IMPORT.RECIPIENTS", "footer", "Nơi nhận", isMinutes && !value("recipients") ? "NOT_APPLICABLE" : value("recipients") ? "PASS" : "NEEDS_REVIEW",
    isMinutes && !value("recipients") ? "Biên bản nguồn không có Nơi nhận; không tự thêm." : value("recipients") ? "Có Nơi nhận trong nguồn." : "Chưa tìm thấy Nơi nhận.", ids("recipients"));

  const appendixBlocks = source.appendices.flatMap(a => a.blocks);
  const appendixTables = appendixBlocks.filter(b => b.kind === "table");
  add("IMPORT.APPENDIX_OWNERSHIP", "appendix", "Phụ lục và thứ tự nguồn", source.appendices.length ? source.appendices.every(a => a.sourceBlockIds.length === a.blocks.length && a.blocks.every((b, i) => b.id === a.sourceBlockIds[i])) ? "PASS" : "NEEDS_REVIEW" : "NOT_APPLICABLE",
    `${source.appendices.length} phụ lục, ${appendixBlocks.length} khối.`, appendixBlocks.map(b => b.id));
  add("IMPORT.APPENDIX_TABLE_CELLS", "appendix", "Bảng phụ lục", appendixTables.length ? appendixTables.every(tableShapeIntact) ? "PASS" : "NEEDS_REVIEW" : "NOT_APPLICABLE",
    appendixTables.length ? `${appendixTables.length} bảng cần đối chiếu đủ từng ô.` : "Không có bảng phụ lục.", appendixTables.map(b => b.id));
  if (selectedRegime === "administrative" && source.appendices.length) {
    add("ND30.PL1.I.III.1B.APPENDIX_TITLE_UPPERCASE", "appendix", "Tên phụ lục viết hoa", source.appendices.every(a => upper(a.title)) ? "PASS" : "NEEDS_REVIEW",
      "Kiểm tra chữ tiêu đề trên các phụ lục.", source.appendices.flatMap(a => a.sourceBlockIds.slice(0, 1)));
  }
  add("IMPORT.UNCLASSIFIED", "other", "Khối chưa phân loại", source.unclassified.length ? "NEEDS_REVIEW" : "PASS",
    `${source.unclassified.length} khối cần gán hoặc giữ để xử lý tiếp.`, source.unclassified.map(b => b.id));
  return result;
}
