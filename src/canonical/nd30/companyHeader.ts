/** Organization profile: fixed display header ONLY for newly-created administrative templates.
 * Source of the text and layout: the user-approved Company_HoaTieu_Fixed_Header_A4.docx.
 * Source of legal rule constraints: the user's canonical ND30 repository, not legacy Markdown.
 */
import {
  AlignmentType, BorderStyle, TableLayoutType, Table, TableCell, TableRow, Paragraph,
  TextRun, WidthType, convertMillimetersToTwip,
} from "docx";

export const COMPANY_HEADER_PROFILE_ID = "hoa-tieu-mien-bac-administrative-v1" as const;
export const COMPANY_HEADER_PARENT = "TỔNG CÔNG TY BẢO ĐẢM AN TOÀN HÀNG HẢI VIỆT NAM";
export const COMPANY_HEADER_ISSUER = "CÔNG TY HOA TIÊU HÀNG HẢI MIỀN BẮC";
export const COMPANY_NATIONAL_HEADER = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
export const COMPANY_MOTTO = "Độc lập - Tự do - Hạnh phúc";

export const COMPANY_HEADER_GEOMETRY_MM = Object.freeze({
  pageWidth: 210, pageHeight: 297,
  marginTop: 20, marginBottom: 20, marginLeft: 30, marginRight: 15,
  headerWidth: 165, bodyWidth: 155,
  leftColumn: 75, rightColumn: 90,
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

/** Company header 165 mm = 75 mm issuer + 90 mm national; contains NO visible table grid. */
export function createCompanyHeaderTable(referenceNumber?: string, locationAndDate?: string): Table {
  const geo = COMPANY_HEADER_GEOMETRY_MM;
  return new Table({
    width: { size: TW(geo.headerWidth), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [TW(geo.leftColumn), TW(geo.rightColumn)],
    borders: INVISIBLE,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: TW(geo.leftColumn), type: WidthType.DXA },
            borders: INVISIBLE,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              centered([RUN("TỔNG CÔNG TY BẢO ĐẢM", 12), new TextRun({ break: 1 }), RUN("AN TOÀN HÀNG HẢI VIỆT NAM", 12)]),
              centered([RUN("CÔNG TY HOA TIÊU", 12, true), new TextRun({ break: 1 }), RUN("HÀNG HẢI MIỀN BẮC", 12, true)]),
              divider(20),
            ],
          }),
          new TableCell({
            width: { size: TW(geo.rightColumn), type: WidthType.DXA },
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
            width: { size: TW(geo.leftColumn), type: WidthType.DXA },
            borders: INVISIBLE,
            children: [centered([RUN(referenceNumber?.trim() || "Số: …/…", 13)])],
          }),
          new TableCell({
            width: { size: TW(geo.rightColumn), type: WidthType.DXA },
            borders: INVISIBLE,
            children: [centered([RUN(locationAndDate?.trim() || "Hải Phòng, ngày … tháng … năm …", 13, false, true)])],
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
