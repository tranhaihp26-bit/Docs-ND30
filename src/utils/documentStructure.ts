/** Editable guidance for the body of each administrative document type. */
export type AdministrativeOutlineGroup =
  | "decision"
  | "directive"
  | "program"
  | "report"
  | "minutes"
  | "proposal"
  | "agreement"
  | "correspondence"
  | "short-form";

export interface AdministrativeDocumentTypeStructure {
  name: string;
  abbreviation: string;
  sampleFormAvailable: boolean;
  headerIssueDateAvailable?: boolean;
  outlineGroup: AdministrativeOutlineGroup;
  bodyOutline: string[];
  outlineIsSuggestion: true;
}

/**
 * Nghị định 30 names 29 administrative document types. Appendix III gives
 * specimen layouts for 25; the other four use an adaptable outline. The body
 * outlines below are drafting aids, not mandatory per-type legal structures.
 */
export const ADMINISTRATIVE_DOCUMENT_TYPES: AdministrativeDocumentTypeStructure[] = [
  { name: "Nghị quyết", abbreviation: "NQ", sampleFormAvailable: true, outlineGroup: "decision", bodyOutline: ["Căn cứ và lý do ban hành", "Nghị quyết về nội dung chính", "Tổ chức thực hiện và hiệu lực"], outlineIsSuggestion: true },
  { name: "Quyết định", abbreviation: "QĐ", sampleFormAvailable: true, outlineGroup: "decision", bodyOutline: ["Căn cứ ban hành", "Điều 1: nội dung quyết định", "Điều khoản thi hành, trách nhiệm và hiệu lực"], outlineIsSuggestion: true },
  { name: "Chỉ thị", abbreviation: "CT", sampleFormAvailable: true, outlineGroup: "directive", bodyOutline: ["Bối cảnh và yêu cầu", "Nhiệm vụ/chỉ đạo theo từng đơn vị", "Tổ chức thực hiện, kiểm tra và báo cáo"], outlineIsSuggestion: true },
  { name: "Quy chế", abbreviation: "QC", sampleFormAvailable: true, outlineGroup: "decision", bodyOutline: ["Phạm vi, đối tượng, nguyên tắc", "Quyền hạn, trách nhiệm và quy trình", "Tổ chức thực hiện"], outlineIsSuggestion: true },
  { name: "Quy định", abbreviation: "QyĐ", sampleFormAvailable: true, outlineGroup: "decision", bodyOutline: ["Phạm vi, đối tượng và giải thích", "Quy tắc/tiêu chuẩn theo điều khoản", "Trách nhiệm và thi hành"], outlineIsSuggestion: true },
  { name: "Thông cáo", abbreviation: "TC", sampleFormAvailable: true, outlineGroup: "correspondence", bodyOutline: ["Sự việc hoặc chủ trương cần thông tin", "Thông tin chính đã được xác minh", "Đầu mối/liên hệ khi phù hợp"], outlineIsSuggestion: true },
  { name: "Thông báo", abbreviation: "TB", sampleFormAvailable: true, outlineGroup: "correspondence", bodyOutline: ["Sự việc/căn cứ cần thông báo", "Nội dung, thời gian và đối tượng thực hiện", "Đầu mối phối hợp hoặc lưu ý"], outlineIsSuggestion: true },
  { name: "Hướng dẫn", abbreviation: "HD", sampleFormAvailable: true, outlineGroup: "directive", bodyOutline: ["Mục đích, phạm vi áp dụng", "Trình tự/hồ sơ/cách thực hiện", "Trách nhiệm phối hợp và giải đáp"], outlineIsSuggestion: true },
  { name: "Chương trình", abbreviation: "CTr", sampleFormAvailable: true, outlineGroup: "program", bodyOutline: ["Mục tiêu và yêu cầu", "Nhiệm vụ, mốc thời gian, đầu mối", "Nguồn lực, phối hợp và theo dõi"], outlineIsSuggestion: true },
  { name: "Kế hoạch", abbreviation: "KH", sampleFormAvailable: true, outlineGroup: "program", bodyOutline: ["Mục đích, yêu cầu", "Nội dung, tiến độ và đơn vị chủ trì", "Tổ chức thực hiện, nguồn lực và báo cáo"], outlineIsSuggestion: true },
  { name: "Phương án", abbreviation: "PA", sampleFormAvailable: true, outlineGroup: "program", bodyOutline: ["Mục tiêu, căn cứ và hiện trạng", "Phương án lựa chọn, nguồn lực và rủi ro", "Tổ chức thực hiện và đánh giá"], outlineIsSuggestion: true },
  { name: "Đề án", abbreviation: "ĐA", sampleFormAvailable: true, outlineGroup: "program", bodyOutline: ["Sự cần thiết, căn cứ và hiện trạng", "Mục tiêu, nội dung, nguồn lực và tác động", "Tiến độ, tổ chức thực hiện và kiến nghị"], outlineIsSuggestion: true },
  { name: "Dự án", abbreviation: "DA", sampleFormAvailable: true, outlineGroup: "program", bodyOutline: ["Mục tiêu, phạm vi và căn cứ", "Hạng mục, tiến độ, kinh phí và quản trị rủi ro", "Nghiệm thu, vận hành và trách nhiệm"], outlineIsSuggestion: true },
  { name: "Báo cáo", abbreviation: "BC", sampleFormAvailable: true, outlineGroup: "report", bodyOutline: ["Bối cảnh, kỳ báo cáo và căn cứ", "Kết quả/số liệu, hạn chế và nguyên nhân", "Nhiệm vụ tiếp theo, kiến nghị"], outlineIsSuggestion: true },
  { name: "Biên bản", abbreviation: "BB", sampleFormAvailable: true, headerIssueDateAvailable: false, outlineGroup: "minutes", bodyOutline: ["Thời gian, địa điểm và thành phần", "Diễn biến, ý kiến và nội dung ghi nhận", "Kết luận/thỏa thuận và thời điểm kết thúc"], outlineIsSuggestion: true },
  { name: "Tờ trình", abbreviation: "TTr", sampleFormAvailable: true, outlineGroup: "proposal", bodyOutline: ["Căn cứ và sự cần thiết", "Nội dung, phương án và tác động", "Kiến nghị cấp có thẩm quyền xem xét"], outlineIsSuggestion: true },
  { name: "Hợp đồng", abbreviation: "HĐ", sampleFormAvailable: false, outlineGroup: "agreement", bodyOutline: ["Thông tin và tư cách các bên", "Đối tượng, nghĩa vụ, giá trị và thời hạn", "Vi phạm, giải quyết tranh chấp và hiệu lực"], outlineIsSuggestion: true },
  { name: "Công văn", abbreviation: "", sampleFormAvailable: true, outlineGroup: "correspondence", bodyOutline: ["Bối cảnh và căn cứ trao đổi", "Nội dung trao đổi hoặc đề nghị", "Thời hạn, phối hợp và lời kết"], outlineIsSuggestion: true },
  { name: "Công điện", abbreviation: "CĐ", sampleFormAvailable: true, outlineGroup: "directive", bodyOutline: ["Tình huống và yêu cầu xử lý", "Nhiệm vụ khẩn, đơn vị chịu trách nhiệm và hạn hoàn thành", "Chế độ thông tin, báo cáo"], outlineIsSuggestion: true },
  { name: "Bản ghi nhớ", abbreviation: "BGN", sampleFormAvailable: false, outlineGroup: "agreement", bodyOutline: ["Bối cảnh và mục đích ghi nhớ", "Nội dung/đầu việc các bên thống nhất", "Thời hạn, đầu mối và giá trị áp dụng"], outlineIsSuggestion: true },
  { name: "Bản thỏa thuận", abbreviation: "BTT", sampleFormAvailable: false, outlineGroup: "agreement", bodyOutline: ["Thông tin các bên và mục tiêu", "Điều khoản thống nhất, trách nhiệm và tiến độ", "Sửa đổi, chấm dứt và hiệu lực"], outlineIsSuggestion: true },
  { name: "Giấy ủy quyền", abbreviation: "GUQ", sampleFormAvailable: true, outlineGroup: "short-form", bodyOutline: ["Người ủy quyền và người được ủy quyền", "Phạm vi, thời hạn và giới hạn ủy quyền", "Trách nhiệm và xác nhận của các bên"], outlineIsSuggestion: true },
  { name: "Giấy mời", abbreviation: "GM", sampleFormAvailable: true, outlineGroup: "short-form", bodyOutline: ["Kính mời và mục đích", "Thời gian, địa điểm và thành phần", "Chuẩn bị, xác nhận tham dự và liên hệ"], outlineIsSuggestion: true },
  { name: "Giấy giới thiệu", abbreviation: "GGT", sampleFormAvailable: true, outlineGroup: "short-form", bodyOutline: ["Giới thiệu người được cử đi liên hệ", "Nội dung/công việc và nơi đến", "Thời hạn và đề nghị phối hợp"], outlineIsSuggestion: true },
  { name: "Giấy nghỉ phép", abbreviation: "GNP", sampleFormAvailable: true, outlineGroup: "short-form", bodyOutline: ["Thông tin người xin nghỉ", "Thời gian, lý do và bàn giao công việc", "Ý kiến phê duyệt"], outlineIsSuggestion: true },
  { name: "Phiếu gửi", abbreviation: "PG", sampleFormAvailable: true, outlineGroup: "short-form", bodyOutline: ["Nơi gửi, nơi nhận và tài liệu", "Mục đích gửi và yêu cầu xử lý", "Số lượng/phương thức hoặc xác nhận giao nhận"], outlineIsSuggestion: true },
  { name: "Phiếu chuyển", abbreviation: "PC", sampleFormAvailable: true, outlineGroup: "short-form", bodyOutline: ["Đơn vị/người chuyển và nơi nhận", "Nội dung/tài liệu được chuyển", "Ý kiến chỉ đạo, hạn và theo dõi xử lý"], outlineIsSuggestion: true },
  { name: "Phiếu báo", abbreviation: "PB", sampleFormAvailable: true, outlineGroup: "short-form", bodyOutline: ["Nội dung cần báo và đối tượng nhận", "Thông tin, thời điểm hoặc trạng thái", "Đầu mối phản hồi khi cần"], outlineIsSuggestion: true },
  { name: "Thư công", abbreviation: "", sampleFormAvailable: false, outlineGroup: "correspondence", bodyOutline: ["Lời chào và bối cảnh", "Nội dung trao đổi", "Lời kết và đầu mối liên hệ"], outlineIsSuggestion: true },
];

export interface DocumentSignatureBlock {
  id: string;
  role: string;
  instruction: string;
  name: string;
  sourceBlockIds?: string[];
  status?: "extracted" | "needs_review" | "user_confirmed";
}

export function getAdministrativeDocumentStructure(documentType: string): AdministrativeDocumentTypeStructure | undefined {
  const normalized = documentType.trim().toLocaleUpperCase("vi-VN").replace(/\s+/g, " ");
  return ADMINISTRATIVE_DOCUMENT_TYPES.find(type => {
    const name = type.name.toLocaleUpperCase("vi-VN");
    return normalized === name || normalized.startsWith(`${name} `);
  });
}

/** Mẫu 1.9 records meeting time in its body instead of a header issue-date line. */
export function hasAdministrativeHeaderIssueDate(documentType: string): boolean {
  return getAdministrativeDocumentStructure(documentType)?.headerIssueDateAvailable !== false;
}

const decodeCellLines = (cell: string): string[] => cell
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(?:p|div|li)>/gi, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .split(/\r?\n/)
  .map(line => line.replace(/\s+/g, " ").trim())
  .filter(Boolean);

const isSignatureInstruction = (line: string) => /^\(?(?:ký|ky|ghi rõ|đóng dấu|dong dau)/i.test(line);
const isRoleLabel = (line: string) => {
  const letters = line.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 && line === line.toLocaleUpperCase("vi-VN") && line.length <= 96 && !isSignatureInstruction(line);
};

/** Convert a row-major signature table into one editable block per signer. */
export function getSignatureBlocksFromTable(rows: string[][]): DocumentSignatureBlock[] {
  const columnCount = Math.max(0, ...rows.map(row => row.length));
  if (columnCount < 2 || rows.length === 0) return [];

  const columns = Array.from({ length: columnCount }, (_, columnIndex) =>
    rows.flatMap(row => decodeCellLines(row[columnIndex] || "")),
  );
  const candidates: Array<DocumentSignatureBlock | undefined> = columns.map((lines, index): DocumentSignatureBlock | undefined => {
    const roleIndex = lines.findIndex(isRoleLabel);
    if (roleIndex < 0) return undefined;
    const role = lines[roleIndex];
    const rest = lines.filter((line, lineIndex) => lineIndex !== roleIndex && !isSignatureInstruction(line));
    const instruction = lines.find(isSignatureInstruction) || "(Ký, ghi rõ họ tên)";
    return {
      id: `signer-${index + 1}`,
      role,
      instruction,
      name: rest.at(-1) || "",
      status: "extracted" as const,
    };
  });

  // Require at least two recognizable signatory roles; arbitrary body tables
  // remain reviewable source blocks rather than being reinterpreted as signers.
  const recognized = candidates.filter((block): block is DocumentSignatureBlock => block !== undefined);
  return recognized.length >= 2 ? recognized : [];
}

/** Migration path for legacy drafts that embedded the minutes signature table in bodyHtml. */
export function separateEmbeddedSignatureTables(bodyHtml: string, documentType: string): {
  bodyHtml: string;
  signatureBlocks: DocumentSignatureBlock[];
} {
  if (!/BIÊN\s+BẢN/i.test(documentType)) return { bodyHtml, signatureBlocks: [] };
  const tableRegex = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
  let signatureBlocks: DocumentSignatureBlock[] = [];
  const nextBody = bodyHtml.replace(tableRegex, table => {
    if (signatureBlocks.length) return table;
    const cells = Array.from(table.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi), match => match[1] || "");
    const rows: string[][] = [];
    const trMatches = Array.from(table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), match => match[1] || "");
    for (const tr of trMatches) {
      rows.push(Array.from(tr.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi), match => match[1] || ""));
    }
    const parsed = getSignatureBlocksFromTable(rows.length ? rows : [cells]);
    if (!parsed.length) return table;
    signatureBlocks = parsed;
    return "";
  });
  return { bodyHtml: nextBody, signatureBlocks };
}
