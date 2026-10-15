/** Organization profile: fixed display header for selected company documents.
 * Source of the visual layout: the original Tieu ngu chuan.docx supplied by the user.
 * Source of legal rule constraints: the user's canonical ND30 repository, not legacy Markdown.
 */
import {
  AlignmentType, BorderStyle, TableLayoutType, Table, TableCell, TableRow, Paragraph,
  TextRun, WidthType, convertMillimetersToTwip,
} from "docx";

export const COMPANY_HEADER_PROFILE_ID = "hoa-tieu-mien-bac-administrative-v1" as const;
export const COMPANY_HEADER_PARENT_LINES = ["TỔNG CÔNG TY BẢO ĐẢM", "AN TOÀN HÀNG HẢI VIỆT NAM"] as const;
export const COMPANY_HEADER_ISSUER_LINES = ["CÔNG TY HOA TIÊU HÀNG HẢI MIỀN BẮC"] as const;
export const COMPANY_HEADER_PARENT = COMPANY_HEADER_PARENT_LINES.join(" ");
export const COMPANY_HEADER_ISSUER = COMPANY_HEADER_ISSUER_LINES.join(" ");
export const COMPANY_NATIONAL_HEADER = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
export const COMPANY_MOTTO = "Độc lập - Tự do - Hạnh phúc";

/** Match only the named company; whitespace from DOCX table cells is not significant. */
export function matchesCompanyHeader(parent: string | null | undefined, issuer: string | null | undefined): boolean {
  const normalize = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim().toLocaleUpperCase("vi-VN");
  return normalize(parent) === normalize(COMPANY_HEADER_PARENT)
    && normalize(issuer) === normalize(COMPANY_HEADER_ISSUER);
}

// Measured from the source Word table: 5187 + 5245 twips, indented -874 twips.
// Its wider footprint is deliberate: both 12 pt bold headings stay on one line
// while the table remains inside the physical A4 page.
const SOURCE_TABLE_TWIPS = Object.freeze({ width: 10432, left: 5187, right: 5245, indent: -874 });
const mm = (twips: number) => twips * 25.4 / 1440;

export const COMPANY_HEADER_GEOMETRY_MM = Object.freeze({
  pageWidth: 210, pageHeight: 297,
  marginTop: 20, marginBottom: 20, marginLeft: 30, marginRight: 15,
  headerWidth: mm(SOURCE_TABLE_TWIPS.width), bodyWidth: 155,
  leftColumn: mm(SOURCE_TABLE_TWIPS.left), rightColumn: mm(SOURCE_TABLE_TWIPS.right),
  headerIndent: mm(SOURCE_TABLE_TWIPS.indent),
  bodyInset: 5,
});

const NO_BORDER = Object.freeze({
  style: BorderStyle.NONE, size: 0, color: "auto",
});
const INVISIBLE = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};
const TW = (mm: number) => convertMillimetersToTwip(mm);
const RUN = (text: string, size: number, bold = false, italic = false) =>
  new TextRun({ text, font: "Times New Roman", size: size * 2, bold, italics: italic });

/** A real OOXML paragraph border, not a sequence of hyphens. */
function divider(indentEachSideMm: number) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    indent: { left: TW(indentEachSideMm), right: TW(indentEachSideMm) },
    border: { bottom: { color: "000000", style: BorderStyle.SINGLE, size: 6, space: 1 } },
    spacing: { line: 110, before: 0, after: 70 },
    children: [RUN(" ", 5)],
  });
}

const centered = (runs: TextRun[], after = 30) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { line: 240, before: 0, after },
  keepLines: true,
  children: runs,
});
const rightAligned = (runs: TextRun[]) => new Paragraph({
  alignment: AlignmentType.RIGHT,
  spacing: { line: 240, before: 0, after: 30 },
  keepLines: true,
  children: runs,
});

/** Company header follows the source Word table; contains NO visible table grid. */
export function createCompanyHeaderTable(referenceNumber?: string, locationAndDate?: string): Table {
  return new Table({
    width: { size: SOURCE_TABLE_TWIPS.width, type: WidthType.DXA },
    indent: { size: SOURCE_TABLE_TWIPS.indent, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [SOURCE_TABLE_TWIPS.left, SOURCE_TABLE_TWIPS.right],
    borders: INVISIBLE,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: SOURCE_TABLE_TWIPS.left, type: WidthType.DXA },
            borders: INVISIBLE,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              centered([RUN(COMPANY_HEADER_PARENT_LINES[0], 12), new TextRun({ break: 1 }), RUN(COMPANY_HEADER_PARENT_LINES[1], 12)]),
              centered([RUN(COMPANY_HEADER_ISSUER, 12, true)]),
              divider(28.25),
            ],
          }),
          new TableCell({
            width: { size: SOURCE_TABLE_TWIPS.right, type: WidthType.DXA },
            borders: INVISIBLE,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              centered([RUN(COMPANY_NATIONAL_HEADER, 12, true)]),
              centered([RUN(COMPANY_MOTTO, 13, true)]),
              divider(21),
            ],
          }),
        ],
      }),
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: SOURCE_TABLE_TWIPS.left, type: WidthType.DXA },
            borders: INVISIBLE,
            children: [centered([RUN(referenceNumber?.trim() || "Số: …/…", 13)])],
          }),
          new TableCell({
            width: { size: SOURCE_TABLE_TWIPS.right, type: WidthType.DXA },
            borders: INVISIBLE,
            children: [rightAligned([RUN(locationAndDate?.trim() || "Hải Phòng, ngày … tháng … năm …", 13, false, true)])],
          }),
        ],
      }),
    ],
  });
}

export function applyCompanyProfile<T extends object>(input: T): T & {headerProfile: typeof COMPANY_HEADER_PROFILE_ID} {
  return {
    ...input,
    headerProfile: COMPANY_HEADER_PROFILE_ID,
    orgHeader1: COMPANY_HEADER_PARENT,
    orgHeader2: COMPANY_HEADER_ISSUER,
    nationalHeader1: COMPANY_NATIONAL_HEADER,
    nationalHeader2: COMPANY_MOTTO,
    locationAndDate: typeof (input as any).locationAndDate === "string" &&
      (input as any).locationAndDate.trim() && !(input as any).locationAndDate.includes("[Địa danh]")
      ? (input as any).locationAndDate : "Hải Phòng, ngày … tháng … năm …",
  };
}

export const LOCKED_COMPANY_FIELDS = new Set([
  "orgHeader1", "orgHeader2", "nationalHeader1", "nationalHeader2",
]);
