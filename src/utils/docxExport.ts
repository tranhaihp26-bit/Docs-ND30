/**
 * @file docxExport.ts
 * @description Trình xuất file Microsoft Word (.docx) chuẩn theo Phụ lục I Nghị định số 30/2020/NĐ-CP
 * về công tác văn thư và Hướng dẫn số 05-HD/VPTW về thể thức văn bản Đảng.
 * 
 * CÁC QUY CHUẨN BẮT BUỘC ĐÃ ĐƯỢC CẤU HÌNH CỨNG (DETERMINISTIC):
 * - Khổ giấy: A4 (210mm x 297mm), định hướng dọc (Portrait).
 * - Phông chữ mặc định: Times New Roman.
 * - Cỡ chữ nội dung mặc định: 13pt (size = 26 half-points).
 * - Lề trang (Margins):
 *   + Lề trên: 20mm (1134 dxa)
 *   + Lề dưới: 20mm (1134 dxa)
 *   + Lề trái: 30mm (1701 dxa)
 *   + Lề phải: 15mm (850 dxa)
 * - Dãn dòng (Line spacing): 1.15 đến 1.25 (line = 276).
 * - Thụt đầu dòng (First line indent): 1.27cm (720 dxa).
 */

import { 
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
  WidthType, BorderStyle, AlignmentType, convertMillimetersToTwip, PageOrientation,
  Header, PageNumber, LevelFormat
} from "docx";
import { type DocumentFormatType, isPlaceholderValue } from "../shared/schemas/document.schema.ts";

/**
 * Interface cho Style Profile của chế độ văn bản (Nghị định 30 vs Hướng dẫn 05)
 */
export interface DocumentStyleProfile {
  regime: "administrative" | "party";
  bodyFontSize: number;          // Cỡ chữ nội dung (13pt vs 14pt)
  heading1FontSize: number;      // Cỡ chữ H1 (14pt vs 15pt)
  heading2FontSize: number;      // Cỡ chữ H2 (13pt vs 14pt)
  heading3FontSize: number;      // Cỡ chữ H3 (13pt vs 14pt)
  documentTypeFontSize: number;  // Cỡ chữ tên loại văn bản (14pt vs 15pt)
  orgHeader1FontSize: number;    // Cỡ chữ cơ quan cấp trên (12pt)
  orgHeader2FontSize: number;    // Cỡ chữ cơ quan ban hành (13pt)
  nationalHeader1FontSize: number; // Cỡ chữ Quốc hiệu/Đảng (13pt vs 14pt)
  nationalHeader2FontSize: number; // Cỡ chữ Tiêu ngữ (13pt vs 0)
  signTitleFontSize: number;     // Cỡ chữ Chức vụ (13pt vs 14pt)
  signNameFontSize: number;      // Cỡ chữ Họ tên người ký (13pt vs 14pt)
  pageNumberFontSize: number;    // Cỡ chữ số trang (13pt vs 14pt)
}

/**
 * Trả về Style Profile theo Nghị định 30/2020/NĐ-CP (Hành chính) hoặc Hướng dẫn 05-HD/VPTW (Đảng)
 */
export function getStyleProfile(regime: "administrative" | "party" = "administrative"): DocumentStyleProfile {
  if (regime === "party") {
    return {
      regime: "party",
      bodyFontSize: 14,
      heading1FontSize: 15,
      heading2FontSize: 14,
      heading3FontSize: 14,
      documentTypeFontSize: 15,
      orgHeader1FontSize: 14, // 14pt cho tên cơ quan cấp trên
      orgHeader2FontSize: 14, // 14pt cho tên cơ quan ban hành
      nationalHeader1FontSize: 15, // 15pt cho ĐẢNG CỘNG SẢN VIỆT NAM
      nationalHeader2FontSize: 0,
      signTitleFontSize: 14, // 14pt cho chức danh người ký
      signNameFontSize: 14, // 14pt cho tên người ký
      pageNumberFontSize: 14, // 14pt cho số trang
    };
  }
  return {
    regime: "administrative",
    bodyFontSize: 13,
    heading1FontSize: 14,
    heading2FontSize: 13,
    heading3FontSize: 13,
    documentTypeFontSize: 14,
    orgHeader1FontSize: 12,
    orgHeader2FontSize: 13,
    nationalHeader1FontSize: 13,
    nationalHeader2FontSize: 13,
    signTitleFontSize: 13,
    signNameFontSize: 13,
    pageNumberFontSize: 13,
  };
}

/**
 * Định nghĩa kích thước khổ giấy A4 chuẩn (210mm x 297mm) theo Phụ lục I Nghị định 30/2020/NĐ-CP
 */
export const ND30_PAGE_SIZE = {
  width: convertMillimetersToTwip(210),   // 210mm = 11906 twips (dxa)
  height: convertMillimetersToTwip(297),  // 297mm = 16838 twips (dxa)
  orientation: PageOrientation.PORTRAIT,
};

/**
 * Định nghĩa kích thước lề trang chuẩn Nghị định 30/2020/NĐ-CP (Phụ lục I Mục I.3)
 */
export const ND30_PAGE_MARGINS = {
  top: convertMillimetersToTwip(20),     // 20mm = 1134 dxa
  bottom: convertMillimetersToTwip(20),  // 20mm = 1134 dxa
  left: convertMillimetersToTwip(30),    // 30mm = 1701 dxa
  right: convertMillimetersToTwip(15),   // 15mm = 850 dxa
};

/** Đường viền ẩn cho các bảng cấu trúc 2 cột (Header, Signature) */
const INVISIBLE_CELL_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

/**
 * Chuyển đổi mã HTML từ Tiptap Editor thành danh sách Paragraph & Table trong DOCX
 */
export function convertHtmlToDocxElements(
  html: string,
  regime: "administrative" | "party" = "administrative"
): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const profile = getStyleProfile(regime);
  const defaultHalfPoints = profile.bodyFontSize * 2;

  // Sử dụng DOMParser nếu chạy trong môi trường trình duyệt
  if (typeof window !== "undefined" && typeof window.DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const container = doc.body.firstElementChild || doc.body;

    Array.from(container.children).forEach((child) => {
      const tagName = child.tagName.toLowerCase();
      const styleAttr = child.getAttribute("style") || "";
      const textContent = child.textContent?.trim() || "";
      if (!textContent && tagName !== "table") return;

      const isCentered = styleAttr.includes("center") || /^(QUYẾT ĐỊNH:|NGHỊ QUYẾT:|BAN HÀNH:)/i.test(textContent);
      const isRight = styleAttr.includes("right");

      let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED;
      if (isCentered) alignment = AlignmentType.CENTER;
      else if (isRight) alignment = AlignmentType.RIGHT;

      // Xử lý bảng biểu HTML nếu có
      if (tagName === "table") {
        const trElements = Array.from(child.querySelectorAll("tr"));
        if (trElements.length > 0) {
          const isHiddenTable = styleAttr.includes("border: none") || child.classList.contains("border-none");
          const tableBorders = isHiddenTable
            ? {
                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
              }
            : {
                top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
              };

          const docxRows = trElements.map((tr, index) => {
            const cellElements = Array.from(tr.children).filter(
              c => c.tagName.toLowerCase() === "td" || c.tagName.toLowerCase() === "th"
            );
            const isHeaderRow = index === 0 && Array.from(tr.children).some(c => c.tagName.toLowerCase() === "th");

            return new TableRow({
              cantSplit: true,
              tableHeader: isHeaderRow,
              children: cellElements.map(cell => {
                const isHeader = cell.tagName.toLowerCase() === "th";
                const cellRuns = parseInlineNodes(cell, defaultHalfPoints);
                return new TableCell({
                  borders: isHiddenTable ? INVISIBLE_CELL_BORDER : undefined,
                  margins: { top: 100, bottom: 100, left: 140, right: 140 },
                  children: [
                    new Paragraph({
                      alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
                      spacing: { line: 240, before: 40, after: 40 },
                      children: cellRuns.length > 0 ? cellRuns : [
                        new TextRun({
                          text: cell.textContent?.trim() || "",
                          font: "Times New Roman",
                          size: (profile.bodyFontSize - 1) * 2, // 12pt hoặc 13pt cho ô bảng
                          bold: isHeader,
                        }),
                      ],
                    }),
                  ],
                });
              }),
            });
          });

          elements.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: tableBorders,
              rows: docxRows,
            })
          );
          return;
        }
      }

      // Xử lý các thẻ tiêu đề (H1, H2, H3) theo profile
      if (tagName === "h1") {
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            keepNext: true,
            spacing: { before: 180, after: 80, line: 276 },
            children: [
              new TextRun({
                text: textContent.toUpperCase(),
                bold: true,
                size: profile.heading1FontSize * 2,
                font: "Times New Roman",
              }),
            ],
          })
        );
        return;
      }

      if (tagName === "h2") {
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            keepNext: true,
            spacing: { before: 140, after: 60, line: 276 },
            children: [
              new TextRun({
                text: textContent.toUpperCase(),
                bold: true,
                size: profile.heading2FontSize * 2,
                font: "Times New Roman",
              }),
            ],
          })
        );
        return;
      }

      if (tagName === "h3") {
        elements.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            indent: { firstLine: 720 }, // 1.27cm
            keepNext: true,
            spacing: { before: 100, after: 60, line: 276 },
            children: [
              new TextRun({
                text: textContent,
                bold: true,
                size: profile.heading3FontSize * 2,
                font: "Times New Roman",
              }),
            ],
          })
        );
        return;
      }

      // Xử lý danh sách (ul/ol)
      if (tagName === "ul" || tagName === "ol") {
        Array.from(child.children).forEach((li) => {
          const inlineRuns = parseInlineNodes(li, defaultHalfPoints);

          elements.push(
            new Paragraph({
              bullet: tagName === "ul" ? { level: 0 } : undefined,
              numbering: tagName === "ol" ? { reference: "nd30-numbered-list", level: 0 } : undefined,
              indent: { left: 720 },
              spacing: { before: 40, after: 40, line: 276 },
              children: inlineRuns.length > 0 ? inlineRuns : [
                new TextRun({ text: li.textContent?.trim() || "", font: "Times New Roman", size: defaultHalfPoints })
              ],
            })
          );
        });
        return;
      }

      // Xử lý đoạn văn thông thường (<p>, <div>)
      const runs = parseInlineNodes(child, defaultHalfPoints);
      const isArticleHeader = /^(Điều\s+\d+|Khoản\s+\d+|Điểm\s+[a-zđ]|Phần\s+[I|V|X]+)/i.test(textContent);
      
      elements.push(
        new Paragraph({
          alignment,
          indent: isCentered || isRight ? undefined : { firstLine: 720 }, // Thụt đầu dòng 1.27cm
          keepNext: isArticleHeader,
          spacing: {
            before: isArticleHeader ? 120 : 60,
            after: 60,
            line: 276, // Dãn dòng 1.15 chuẩn
          },
          children: runs.length > 0 ? runs : [new TextRun({ text: textContent, font: "Times New Roman", size: defaultHalfPoints })],
        })
      );
    });

    return elements;
  }

  // Fallback: Parser cho môi trường Node.js / Server-side hỗ trợ cả đoạn văn, danh sách và bảng biểu HTML
  const blockRegex = /<table[\s\S]*?<\/table>|<ol[\s\S]*?<\/ol>|<ul[\s\S]*?<\/ul>|<(?:p|div|h[1-3]|li)[\s\S]*?<\/(?:p|div|h[1-3]|li)>|[^<]+/gi;
  const blocks = html.match(blockRegex) || [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // 1. Xử lý Bảng
    if (trimmed.toLowerCase().startsWith("<table")) {
      const rowMatches = trimmed.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      if (rowMatches.length > 0) {
        const docxRows = rowMatches.map((trHtml, rowIndex) => {
          const cellMatches = trHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
          const isThRow = rowIndex === 0 && trHtml.toLowerCase().includes("<th");

          return new TableRow({
            cantSplit: true,
            tableHeader: isThRow,
            children: cellMatches.map(cellHtml => {
              const isTh = cellHtml.toLowerCase().startsWith("<th");
              const cellText = cellHtml.replace(/<[^>]*>/g, "").trim();
              return new TableCell({
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                },
                children: [
                  new Paragraph({
                    alignment: isTh ? AlignmentType.CENTER : AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: cellText,
                        font: "Times New Roman",
                        size: (profile.bodyFontSize - 1) * 2,
                        bold: isTh,
                      }),
                    ],
                  }),
                ],
              });
            }),
          });
        });

        elements.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: docxRows,
          })
        );
        continue;
      }
    }

    // 2. Xử lý Danh sách (ol, ul)
    if (trimmed.toLowerCase().startsWith("<ol") || trimmed.toLowerCase().startsWith("<ul")) {
      const isOl = trimmed.toLowerCase().startsWith("<ol");
      const liMatches = trimmed.match(/<li[\s\S]*?<\/li>/gi) || [];
      liMatches.forEach((liHtml) => {
        const text = liHtml.replace(/<[^>]*>/g, "").trim();
        elements.push(
          new Paragraph({
            bullet: !isOl ? { level: 0 } : undefined,
            numbering: isOl ? { reference: "nd30-numbered-list", level: 0 } : undefined,
            indent: { left: 720 },
            spacing: { before: 40, after: 40, line: 276 },
            children: [
              new TextRun({ text, font: "Times New Roman", size: defaultHalfPoints }),
            ],
          })
        );
      });
      continue;
    }

    // 3. Xử lý Đoạn văn
    const text = trimmed.replace(/<[^>]*>/g, "").trim();
    if (text) {
      const isArticleHeader = /^(Điều\s+\d+|Khoản\s+\d+|Điểm\s+[a-zđ]|Phần\s+[I|V|X]+)/i.test(text);
      elements.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 720 },
          keepNext: isArticleHeader,
          spacing: { before: 60, after: 60, line: 276 },
          children: [
            new TextRun({ text, font: "Times New Roman", size: defaultHalfPoints }),
          ],
        })
      );
    }
  }

  return elements;
}

/**
 * Trích xuất các node inline (strong, em, u, text) trong một thẻ HTML
 */
function parseInlineNodes(element: Element, fontSizeHalfPoints: number = 26): TextRun[] {
  const runs: TextRun[] = [];

  const traverse = (node: Node, currentFormat: { bold: boolean; italic: boolean; underline: boolean }) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        runs.push(
          new TextRun({
            text,
            font: "Times New Roman",
            size: fontSizeHalfPoints,
            bold: currentFormat.bold,
            italics: currentFormat.italic,
            underline: currentFormat.underline ? {} : undefined,
          })
        );
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const newFormat = {
        bold: currentFormat.bold || tag === "strong" || tag === "b",
        italic: currentFormat.italic || tag === "em" || tag === "i",
        underline: currentFormat.underline || tag === "u",
      };

      Array.from(el.childNodes).forEach((childNode) => {
        traverse(childNode, newFormat);
      });
    }
  };

  Array.from(element.childNodes).forEach((child) => {
    traverse(child, { bold: false, italic: false, underline: false });
  });

  return runs;
}

/**
 * Tạo đối tượng `Document` của thư viện `docx` với bố cục chuẩn Nghị định 30/2020/NĐ-CP
 * 
 * @param data Dữ liệu văn bản tuân thủ DocumentFormatType
 * @returns Instance Document của `docx`
 */
export function detectEmbeddedSignature(bodyHtml: string): boolean {
  if (!bodyHtml || typeof bodyHtml !== "string") return false;

  const hasRecipients = /NƠI NHẬN\s*:/i.test(bodyHtml);
  const hasFormula = /\b(TM\.|T\/M\.|KT\.|TL\.|TUQ\.)\b/i.test(bodyHtml);

  // If both Nơi nhận and a signature formula appear in the document, signature block is embedded
  if (hasRecipients && hasFormula) {
    return true;
  }

  // Check for signature block lines (standalone short lines with signature titles)
  const paragraphs = bodyHtml.split(/<\/p>|<\/div>|<br\s*\/?>/i);
  for (const p of paragraphs) {
    const textOnly = p.replace(/<[^>]+>/g, "").trim().toUpperCase();
    if (textOnly.length > 0 && textOnly.length <= 60) {
      const isSignatureLine =
        /^TM\.\s+/i.test(textOnly) ||
        /^T\/M\.\s+/i.test(textOnly) ||
        /^KT\.\s+/i.test(textOnly) ||
        /^TL\.\s+/i.test(textOnly) ||
        /^TUQ\.\s+/i.test(textOnly) ||
        textOnly === "GIÁM ĐỐC" ||
        textOnly === "CHỦ TỊCH" ||
        textOnly === "BÍ THƯ" ||
        textOnly === "TRƯỞNG BAN" ||
        textOnly === "TỔNG GIÁM ĐỐC" ||
        textOnly === "PHÓ GIÁM ĐỐC" ||
        textOnly === "PHÓ CHỦ TỊCH";

      if (isSignatureLine && (hasRecipients || hasFormula)) {
        return true;
      }
    }
  }

  return false;
}

export function generateND30DocxDocument(data: DocumentFormatType): Document {
  const isParty = data.regime === "party";
  const profile = getStyleProfile(data.regime);
  const bodyParagraphs = convertHtmlToDocxElements(data.bodyHtml, data.regime);

  const nationalHeader1Text = isParty
    ? "ĐẢNG CỘNG SẢN VIỆT NAM"
    : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";

  const topHtmlUpper = data.bodyHtml ? data.bodyHtml.slice(0, 1500).toUpperCase() : "";

  const hasEmbeddedHeader = topHtmlUpper.includes("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM") || topHtmlUpper.includes("ĐẢNG CỘNG SẢN VIỆT NAM");
  const hasEmbeddedSignature = detectEmbeddedSignature(data.bodyHtml);

  const isHeaderPlaceholder = (!data.orgHeader2 || isPlaceholderValue(data.orgHeader2)) && (!data.referenceNumber || isPlaceholderValue(data.referenceNumber));
  const isSignaturePlaceholder = (!data.signTitle || isPlaceholderValue(data.signTitle)) && (!data.signName || isPlaceholderValue(data.signName));

  const shouldRenderHeader = !hasEmbeddedHeader && !isHeaderPlaceholder && (Boolean(data.orgHeader2) || Boolean(data.referenceNumber));
  const shouldRenderSignature = !hasEmbeddedSignature && !isSignaturePlaceholder && (Boolean(data.signTitle) || Boolean(data.signName));

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: profile.bodyFontSize * 2, // 26 (13pt) cho nhà nước, 28 (14pt) cho Đảng
            color: "000000",
          },
          paragraph: {
            spacing: { line: 276, before: 60, after: 60 },
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "nd30-numbered-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
                run: {
                  font: "Times New Roman",
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          titlePage: true, // Bật chế độ trang đầu riêng (không hiển thị header/số trang ở trang 1)
          page: {
            size: ND30_PAGE_SIZE,
            margin: ND30_PAGE_MARGINS,
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Times New Roman",
                    size: profile.pageNumberFontSize * 2,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ==========================================
          // 1. HEADER KHỐI ĐẦU TRANG (BẢNG ẨN 2 CỘT)
          // ==========================================
          ...(shouldRenderHeader ? [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
              },
              rows: [
                new TableRow({
                  children: [
                    // Cột trái: Tên cơ quan chủ quản, Tên cơ quan ban hành, Số ký hiệu
                    new TableCell({
                      width: { size: 45, type: WidthType.PERCENTAGE },
                      borders: INVISIBLE_CELL_BORDER,
                      children: [
                        ...(data.orgHeader1 ? [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { line: 240, after: 20 },
                            children: [
                              new TextRun({
                                text: data.orgHeader1.toUpperCase(),
                                font: "Times New Roman",
                                size: profile.orgHeader1FontSize * 2, // 12pt (24 half-pt)
                              }),
                            ],
                          }),
                        ] : []),
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { line: 240, after: 20 },
                          children: [
                            new TextRun({
                              text: (data.orgHeader2 || "").toUpperCase(),
                              font: "Times New Roman",
                              size: profile.orgHeader2FontSize * 2, // 13pt (26 half-pt)
                              bold: true,
                            }),
                          ],
                        }),
                        // Vạch kẻ nét liền dưới tên cơ quan ban hành
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { line: 160, after: 60 },
                          children: [
                            new TextRun({
                              text: "----------------",
                              font: "Times New Roman",
                              size: 20,
                            }),
                          ],
                        }),
                        // Số, ký hiệu văn bản (cỡ 13, thường, đứng)
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { line: 240, after: 60 },
                          children: [
                            new TextRun({
                              text: data.referenceNumber,
                              font: "Times New Roman",
                              size: profile.bodyFontSize * 2,
                            }),
                          ],
                        }),
                      ],
                    }),

                    // Cột phải: Quốc hiệu, Tiêu ngữ, Địa danh & Ngày tháng năm
                    new TableCell({
                      width: { size: 55, type: WidthType.PERCENTAGE },
                      borders: INVISIBLE_CELL_BORDER,
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { line: 240, after: 20 },
                          children: [
                            new TextRun({
                              text: nationalHeader1Text,
                              font: "Times New Roman",
                              size: profile.nationalHeader1FontSize * 2,
                              bold: true,
                            }),
                          ],
                        }),
                        ...(!isParty && data.nationalHeader2 ? [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { line: 240, after: 20 },
                            children: [
                              new TextRun({
                                text: data.nationalHeader2,
                                font: "Times New Roman",
                                size: profile.nationalHeader2FontSize * 2,
                                bold: true,
                              }),
                            ],
                          }),
                          // Vạch kẻ nét liền dưới tiêu ngữ
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { line: 160, after: 60 },
                            children: [
                              new TextRun({
                                text: "----------------------",
                                font: "Times New Roman",
                                size: 20,
                              }),
                            ],
                          }),
                        ] : []),
                        // Địa danh và ngày, tháng, năm ban hành
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { line: 240, after: 60 },
                          children: [
                            new TextRun({
                              text: data.locationAndDate,
                              font: "Times New Roman",
                              size: profile.bodyFontSize * 2,
                              italics: true,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            new Paragraph({ text: "", spacing: { after: 120 } }),
          ] : []),

          // ==========================================
          // 2. TÊN LOẠI VĂN BẢN & TRÍCH YẾU (NẾU BẢO TRÌ BÊN NGOÀI)
          // ==========================================
          ...(shouldRenderHeader && data.documentType ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              keepNext: true,
              spacing: { before: 120, after: 60, line: 276 },
              children: [
                new TextRun({
                  text: data.documentType.toUpperCase(),
                  font: "Times New Roman",
                  size: profile.documentTypeFontSize * 2,
                  bold: true,
                }),
              ],
            }),
          ] : []),

          ...(shouldRenderHeader && data.subject ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              keepNext: true,
              spacing: { before: 60, after: 180, line: 276 },
              children: [
                new TextRun({
                  text: data.subject,
                  font: "Times New Roman",
                  size: profile.bodyFontSize * 2,
                  bold: true,
                  italics: true,
                }),
              ],
            }),
          ] : []),

          // ==========================================
          // 4. TOÀN BỘ NỘI DUNG VĂN BẢN (TỪ TIPTAP HTML)
          // ==========================================
          ...bodyParagraphs,

          // Khoảng cách trống trước khối chữ ký
          new Paragraph({ text: "", spacing: { after: 180 } }),

          // ==========================================
          // 5. KHỐI CHỮ KÝ & NƠI NHẬN (BẢNG ẨN 2 CỘT)
          // ==========================================
          ...(shouldRenderSignature ? [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
              },
              rows: [
                new TableRow({
                  children: [
                    // Cột trái: Nơi nhận (cỡ 12pt, nghiêng, đậm; các dòng con cỡ 11pt, thường)
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: INVISIBLE_CELL_BORDER,
                      children: [
                        new Paragraph({
                          spacing: { line: 240, after: 40 },
                          children: [
                            new TextRun({
                              text: "Nơi nhận:",
                              font: "Times New Roman",
                              size: 24, // 12pt
                              bold: true,
                              italics: true,
                            }),
                          ],
                        }),
                        ...(data.recipients || "Như trên;\nLưu: VT.")
                          .split("\n")
                          .map(line => line.trim())
                          .filter(Boolean)
                          .map(line => 
                            new Paragraph({
                              spacing: { line: 220, before: 20, after: 20 },
                              children: [
                                new TextRun({
                                  text: line.startsWith("-") ? line : `- ${line}`,
                                  font: "Times New Roman",
                                  size: 22, // 11pt
                                }),
                              ],
                            })
                          ),
                      ],
                    }),

                    // Cột phải: Chức vụ, chữ ký, họ và tên
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: INVISIBLE_CELL_BORDER,
                      children: [
                        // Chức vụ (in hoa, đứng, đậm, cỡ 13-14pt)
                        ...(data.signTitle || "[CHỨC VỤ]")
                          .split("\n")
                          .map(line => line.trim())
                          .filter(Boolean)
                          .map(line =>
                            new Paragraph({
                              alignment: AlignmentType.CENTER,
                              spacing: { line: 240, after: 20 },
                              children: [
                                new TextRun({
                                  text: line.toUpperCase(),
                                  font: "Times New Roman",
                                  size: profile.signTitleFontSize * 2,
                                  bold: true,
                                }),
                              ],
                            })
                          ),
                        // Lời ghi chú "(Ký, đóng dấu)"
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { line: 240, after: 40 },
                          children: [
                            new TextRun({
                              text: "(Ký, đóng dấu)",
                              font: "Times New Roman",
                              size: 20, // 10pt
                              italics: true,
                            }),
                          ],
                        }),
                        // Khoảng trống ký tên
                        new Paragraph({ text: "", spacing: { before: 240, after: 360 } }),
                        // Họ và tên người ký (chữ thường, đứng, đậm, cỡ 13-14pt)
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          spacing: { line: 240, before: 120 },
                          children: [
                            new TextRun({
                              text: data.signName || "[Họ và tên người ký]",
                              font: "Times New Roman",
                              size: profile.signNameFontSize * 2,
                              bold: true,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ] : []),
        ],
      },
    ],
  });
}

/**
 * Hàm chính thực thi việc xuất file DOCX và kích hoạt tải về máy của người dùng
 * 
 * @param documentJson Đối tượng văn bản chuẩn DocumentFormatType
 * @param customFileName Tên file tùy biến (tùy chọn)
 */
export async function exportToDocx(
  documentJson: DocumentFormatType,
  customFileName?: string
): Promise<void> {
  const docxInstance = generateND30DocxDocument(documentJson);
  const blob = await Packer.toBlob(docxInstance);

  const cleanDocType = (documentJson.documentType || "Van_Ban")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\d_]/g, "");

  const fileName = customFileName || `${cleanDocType}_ChuanND30.docx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default exportToDocx;
