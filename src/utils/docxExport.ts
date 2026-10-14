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
  WidthType, BorderStyle, AlignmentType, convertMillimetersToTwip, PageOrientation 
} from "docx";
import type { DocumentFormatType } from "../shared/schemas/document.schema.ts";

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
export function convertHtmlToDocxElements(html: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

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

          const docxRows = trElements.map(tr => {
            const cellElements = Array.from(tr.children).filter(
              c => c.tagName.toLowerCase() === "td" || c.tagName.toLowerCase() === "th"
            );
            return new TableRow({
              children: cellElements.map(cell => {
                const isHeader = cell.tagName.toLowerCase() === "th";
                const cellRuns = parseInlineNodes(cell);
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
                          size: 24, // 12pt
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

      // Xử lý các thẻ tiêu đề (H1, H2, H3) theo chuẩn NĐ 30
      if (tagName === "h1") {
        elements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 180, after: 80, line: 276 },
            children: [
              new TextRun({
                text: textContent.toUpperCase(),
                bold: true,
                size: 28, // 14pt
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
            spacing: { before: 140, after: 60, line: 276 },
            children: [
              new TextRun({
                text: textContent.toUpperCase(),
                bold: true,
                size: 26, // 13pt
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
            spacing: { before: 100, after: 60, line: 276 },
            children: [
              new TextRun({
                text: textContent,
                bold: true,
                size: 26, // 13pt
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
          elements.push(
            new Paragraph({
              bullet: tagName === "ul" ? { level: 0 } : undefined,
              indent: { left: 720 },
              spacing: { before: 40, after: 40, line: 276 },
              children: parseInlineNodes(li),
            })
          );
        });
        return;
      }

      // Xử lý đoạn văn thông thường (<p>, <div>)
      const runs = parseInlineNodes(child);
      const isArticleHeader = /^(Điều\s+\d+|Khoản\s+\d+|Điểm\s+[a-zđ])/i.test(textContent);
      
      elements.push(
        new Paragraph({
          alignment,
          indent: isCentered || isRight ? undefined : { firstLine: 720 }, // Thụt đầu dòng 1.27cm theo NĐ 30
          spacing: {
            before: isArticleHeader ? 120 : 60,
            after: 60,
            line: 276, // Dãn dòng 1.15 chuẩn
          },
          children: runs.length > 0 ? runs : [new TextRun({ text: textContent, font: "Times New Roman", size: 26 })],
        })
      );
    });

    return elements;
  }

  // Fallback: Parser cho môi trường Node.js / Server-side hỗ trợ cả đoạn văn và bảng biểu HTML
  const blockRegex = /<table[\s\S]*?<\/table>|<(?:p|div|h[1-3]|li)[\s\S]*?<\/(?:p|div|h[1-3]|li)>|[^<]+/gi;
  const blocks = html.match(blockRegex) || [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().startsWith("<table")) {
      const rowMatches = trimmed.match(/<tr[\s\S]*?<\/tr>/gi) || [];
      if (rowMatches.length > 0) {
        const docxRows = rowMatches.map(trHtml => {
          const cellMatches = trHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
          return new TableRow({
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
                        size: 24,
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

    // Xử lý đoạn văn
    const text = trimmed.replace(/<[^>]*>/g, "").trim();
    if (text) {
      elements.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 720 },
          spacing: { before: 60, after: 60, line: 276 },
          children: [
            new TextRun({ text, font: "Times New Roman", size: 26 }),
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
function parseInlineNodes(element: Element): TextRun[] {
  const runs: TextRun[] = [];

  const traverse = (node: Node, currentFormat: { bold: boolean; italic: boolean; underline: boolean }) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        runs.push(
          new TextRun({
            text,
            font: "Times New Roman",
            size: 26, // 13pt
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
export function generateND30DocxDocument(data: DocumentFormatType): Document {
  const isParty = data.regime === "party";
  const bodyParagraphs = convertHtmlToDocxElements(data.bodyHtml);

  const nationalHeader1Text = isParty
    ? "ĐẢNG CỘNG SẢN VIỆT NAM"
    : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 26, // 13pt
            color: "000000",
          },
          paragraph: {
            spacing: { line: 276, before: 60, after: 60 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: ND30_PAGE_SIZE,
            margin: ND30_PAGE_MARGINS,
          },
        },
        children: [
          // ==========================================
          // 1. HEADER KHỐI ĐẦU TRANG (BẢNG ẨN 2 CỘT)
          // ==========================================
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
                              size: 24, // 12pt, in hoa, đứng
                            }),
                          ],
                        }),
                      ] : []),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { line: 240, after: 20 },
                        children: [
                          new TextRun({
                            text: data.orgHeader2.toUpperCase(),
                            font: "Times New Roman",
                            size: 26, // 13pt, in hoa, đứng, đậm
                            bold: true,
                          }),
                        ],
                      }),
                      // Vạch kẻ nét liền dưới tên cơ quan ban hành (dài từ 1/3 đến 1/2 độ dài dòng chữ)
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
                            size: 26, // 13pt
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
                            size: isParty ? 26 : 24, // 12pt - 13pt, in hoa, đứng, đậm
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
                              size: 26, // 13pt, chữ thường, đứng, đậm
                              bold: true,
                            }),
                          ],
                        }),
                        // Vạch kẻ nét liền dưới tiêu ngữ (bằng độ dài của dòng chữ)
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
                      // Địa danh và ngày, tháng, năm ban hành (cỡ 13-14, chữ thường, nghiêng)
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { line: 240, after: 60 },
                        children: [
                          new TextRun({
                            text: data.locationAndDate,
                            font: "Times New Roman",
                            size: 26, // 13pt
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

          // Khoảng cách trống
          new Paragraph({ text: "", spacing: { after: 120 } }),

          // ==========================================
          // 2. TÊN LOẠI VĂN BẢN (IN HOA, ĐỨNG, ĐẬM, 14PT, CHÍNH GIỮA)
          // ==========================================
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 60, line: 276 },
            children: [
              new TextRun({
                text: data.documentType.toUpperCase(),
                font: "Times New Roman",
                size: 28, // 14pt
                bold: true,
              }),
            ],
          }),

          // ==========================================
          // 3. TRÍCH YẾU NỘI DUNG VĂN BẢN (CỠ 13-14PT, ĐẬM/NGHIÊNG)
          // ==========================================
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 180, line: 276 },
            children: [
              new TextRun({
                text: data.subject,
                font: "Times New Roman",
                size: 26, // 13pt
                bold: true,
                italics: true,
              }),
            ],
          }),

          // ==========================================
          // 4. TOÀN BỘ NỘI DUNG VĂN BẢN (TỪ TIPTAP HTML)
          // ==========================================
          ...bodyParagraphs,

          // Khoảng cách trống trước khối chữ ký
          new Paragraph({ text: "", spacing: { after: 180 } }),

          // ==========================================
          // 5. KHỐI CHỮ KÝ & NƠI NHẬN (BẢNG ẨN 2 CỘT)
          // ==========================================
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
                      ...data.recipients
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
                      ...data.signTitle
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
                                size: 26, // 13pt
                                bold: true,
                              }),
                            ],
                          })
                        ),
                      // Lời ghi chú "(Ký, ghi rõ họ tên và đóng dấu)"
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
                            text: data.signName,
                            font: "Times New Roman",
                            size: 26, // 13pt
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
