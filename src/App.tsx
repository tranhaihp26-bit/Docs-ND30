import React, { useState, useRef } from "react";
import { 
  FileText, Upload, Sparkles, Download, Printer, History, RotateCcw, 
  CheckCircle2, AlertCircle, LayoutTemplate, Edit3, Eye, 
  Save, Wand2, RefreshCw, Maximize2, Minimize2, Check,
  ArrowRight, FileCheck, Layers
} from "lucide-react";
import { 
  Document, Packer, Paragraph, TextRun, AlignmentType, 
  Table, TableRow, TableCell, WidthType, BorderStyle 
} from "docx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface DocumentState {
  orgHeader1: string;
  orgHeader2: string;
  nationalHeader1: string;
  nationalHeader2: string;
  locationAndDate: string;
  documentType: string;
  referenceNumber: string;
  subject: string;
  bodyHtml: string;
  signTitle: string;
  signName: string;
  recipients: string;
}

interface Version {
  id: string;
  timestamp: string;
  title: string;
  data: DocumentState;
}

const DEFAULT_DOC: DocumentState = {
  orgHeader1: "ỦY BAN NHÂN DÂN THÀNH PHỐ HÀ NỘI",
  orgHeader2: "VĂN PHÒNG ỦY BAN",
  nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
  nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
  locationAndDate: "Hà Nội, ngày 13 tháng 10 năm 2026",
  documentType: "QUYẾT ĐỊNH",
  referenceNumber: "Số: 456/QĐ-UBND",
  subject: "V/v ban hành quy định thể thức và kỹ thuật trình bày văn bản theo Nghị định 30/2020/NĐ-CP",
  bodyHtml: `
    <p><strong>Căn cứ Luật Tổ chức chính quyền địa phương ngày 19 tháng 6 năm 2015; Luật sửa đổi, bổ sung một số điều của Luật Tổ chức Chính phủ và Luật Tổ chức chính quyền địa phương ngày 22 tháng 11 năm 2019;</strong></p>
    <p><strong>Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;</strong></p>
    <p><strong>Xét đề nghị của Chánh Văn phòng Ủy ban nhân dân thành phố;</strong></p>
    
    <p style="text-align: center;"><strong>QUYẾT ĐỊNH:</strong></p>
    
    <p><strong>Điều 1.</strong> Ban hành kèm theo Quyết định này Quy định về công tác văn thư, thể thức và kỹ thuật soạn thảo, ban hành văn bản hành chính theo đúng tiêu chuẩn Nghị định số 30/2020/NĐ-CP của Chính phủ.</p>
    <p><strong>Điều 2.</strong> Quy định này áp dụng đối với tất cả các sở, ban, ngành, Ủy ban nhân dân các quận, huyện, thị xã và các đơn vị sự nghiệp công lập trực thuộc thành phố.</p>
    <p><strong>Điều 3.</strong> Quyết định này có hiệu lực thi hành kể từ ngày ký. Chánh Văn phòng Ủy ban nhân dân thành phố, Giám đốc các Sở, Thủ trưởng các cơ quan, đơn vị liên quan chịu trách nhiệm thi hành Quyết định này./.</p>
  `,
  signTitle: "TM. ỦY BAN NHÂN DÂN\nCHỦ TỊCH",
  signName: "Trần Văn Bình",
  recipients: "Như Điều 3;\nThường trực Thành ủy (để b/c);\nThường trực HĐND TP (để b/c);\nLưu: VT, CTHĐ."
};

const SAMPLE_RAW_TEXT = `UBND TP HÀ NỘI - SỞ TƯ PHÁP
Số: 89/BC-STP
Hà nội ngày 10-10-2026
BÁO CÁO
Về việc kết quả rà soát, kiểm tra văn bản quy phạm pháp luật quý 3 năm 2026

Kính gửi: Ủy ban nhân dân thành phố Hà Nội

Thực hiện nhiệm vụ được giao tại Kế hoạch số 12/KH-UBND của UBND thành phố, Sở Tư pháp báo cáo kết quả như sau:
1. Về tình hình triển khai: Sở đã chủ trì phối hợp với các sở, ban ngành kiểm tra toàn bộ 145 văn bản quy phạm pháp luật ban hành trong 9 tháng đầu năm.
2. Kết quả đạt được: Đa số văn bản tuân thủ đúng thẩm quyền, thể thức theo Nghị định 30/2020/NĐ-CP. Phát hiện 03 văn bản có sai sót về trích yếu và số ký hiệu đã được đôn đốc sửa đổi kịp thời.
3. Đề xuất kiến nghị: Đề nghị các đơn vị tiếp tục tăng cường tập huấn công tác văn thư, ứng dụng phần mềm chuẩn hóa thể thức tự động.

Nơi nhận: Như kính gửi; Giám đốc Sở; Lưu VT.
GIÁM ĐỐC: Nguyễn Hải Đăng`;

const TEMPLATES = [
  {
    id: "qd",
    name: "Quyết định hành chính",
    desc: "Mẫu Quyết định cá biệt chuẩn NĐ 30/2020/NĐ-CP",
    type: "state"
  },
  {
    id: "cv",
    name: "Công văn hành chính",
    desc: "Mẫu Công văn gửi cơ quan, tổ chức, cá nhân",
    type: "state"
  },
  {
    id: "kh",
    name: "Kế hoạch công tác",
    desc: "Mẫu Kế hoạch triển khai nhiệm vụ năm/quý",
    type: "state"
  },
  {
    id: "tt",
    name: "Tờ trình phê duyệt",
    desc: "Mẫu Tờ trình xin chủ trương, ngân sách, nhân sự",
    type: "state"
  },
  {
    id: "tb",
    name: "Thông báo kết luận",
    desc: "Mẫu Thông báo ý kiến chỉ đạo của lãnh đạo",
    type: "state"
  },
  {
    id: "nq_dang",
    name: "Nghị quyết của Đảng",
    desc: "Chuẩn theo Hướng dẫn số 05-HD/VPTW",
    type: "party"
  }
];

// Helper to convert HTML body string to rich DOCX paragraphs
function parseHtmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const cleanHtml = html.replace(/\r?\n/g, " ");
  // Match paragraphs, headings, list items
  const blockRegex = /<(p|h[1-6]|li)([^>]*)>(.*?)<\/\1>/gi;
  let match;

  while ((match = blockRegex.exec(cleanHtml)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const content = match[3];

    const isCentered = attrs.includes("text-align: center") || /^(QUYẾT ĐỊNH|NGHỊ QUYẾT|BÁO CÁO)/i.test(content.replace(/<[^>]*>/g, "").trim());
    const isHeading = tag.startsWith("h");

    // Extract inline bold, italics, text
    const runs: TextRun[] = [];
    const inlineRegex = /(<strong>|<b>|<em>|<i>)(.*?)(<\/strong>|<\/b>|<\/em>|<\/i>)|([^<]+)/gi;
    let inlineMatch;

    while ((inlineMatch = inlineRegex.exec(content)) !== null) {
      if (inlineMatch[4]) {
        // Plain text
        const text = inlineMatch[4].trim();
        if (text) {
          runs.push(new TextRun({
            text: inlineMatch[4],
            font: "Times New Roman",
            size: 26 // 13pt
          }));
        }
      } else {
        const openTag = inlineMatch[1].toLowerCase();
        const innerText = inlineMatch[2];
        const isBold = openTag.includes("strong") || openTag.includes("b");
        const isItalic = openTag.includes("em") || openTag.includes("i");

        runs.push(new TextRun({
          text: innerText,
          bold: isBold,
          italics: isItalic,
          font: "Times New Roman",
          size: 26 // 13pt
        }));
      }
    }

    if (runs.length === 0) {
      const rawText = content.replace(/<[^>]*>/g, "").trim();
      if (rawText) {
        runs.push(new TextRun({
          text: rawText,
          font: "Times New Roman",
          size: 26
        }));
      }
    }

    if (runs.length > 0) {
      paragraphs.push(new Paragraph({
        alignment: isCentered ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
        indent: isCentered || isHeading ? undefined : { firstLine: 720 }, // 1.27cm indent as required by Decree 30
        spacing: {
          line: 276, // 1.15 line spacing
          before: 80,
          after: 80
        },
        children: runs
      }));
    }
  }

  // Fallback if no block tags matched
  if (paragraphs.length === 0) {
    const rawLines = html.replace(/<[^>]*>/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);
    rawLines.forEach(line => {
      paragraphs.push(new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 720 },
        spacing: { line: 276, before: 60, after: 60 },
        children: [
          new TextRun({ text: line, font: "Times New Roman", size: 26 })
        ]
      }));
    });
  }

  return paragraphs;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"upload" | "editor" | "preview" | "history">("upload");
  const [standardType, setStandardType] = useState<"state" | "party">("state");
  const [rawText, setRawText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isFullScreenPreview, setIsFullScreenPreview] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [doc, setDoc] = useState<DocumentState>(DEFAULT_DOC);
  const [versions, setVersions] = useState<Version[]>([
    {
      id: "v1",
      timestamp: new Date().toLocaleTimeString("vi-VN") + " - " + new Date().toLocaleDateString("vi-VN"),
      title: "Khởi tạo mặc định",
      data: DEFAULT_DOC
    }
  ]);

  const previewRef = useRef<HTMLDivElement>(null);

  const pushVersion = (title: string, newDoc: DocumentState) => {
    const newV: Version = {
      id: "v_" + Date.now(),
      timestamp: new Date().toLocaleTimeString("vi-VN") + " - " + new Date().toLocaleDateString("vi-VN"),
      title,
      data: { ...newDoc }
    };
    setVersions(prev => [newV, ...prev]);
  };

  const handleFieldChange = (field: keyof DocumentState, value: string) => {
    const updated = { ...doc, [field]: value };
    setDoc(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg("");
    setSuccessMsg("");
    setUploadedFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse-docx", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.text) {
        setRawText(data.text);
        setSuccessMsg(`Đã đọc thành công nội dung từ "${file.name}" (${data.text.length} ký tự). Bấm nút "Chuẩn hóa bằng AI" bên dưới để hoàn thiện thể thức.`);
      } else {
        setErrorMsg(data.error || "Không thể đọc file.");
      }
    } catch (err: any) {
      setErrorMsg("Lỗi kết nối máy chủ: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const loadSampleText = () => {
    setRawText(SAMPLE_RAW_TEXT);
    setUploadedFileName("Mau_bao_cao_chua_chuan_hoa.docx");
    setSuccessMsg("Đã tải dữ liệu mẫu thô vào hệ thống. Hãy bấm nút 'Chuẩn hóa bằng AI' để kiểm tra kết quả!");
  };

  const handleAiFormat = async () => {
    if (!rawText.trim()) {
      setErrorMsg("Vui lòng tải lên file Word hoặc nhập nội dung văn bản thô.");
      return;
    }

    setIsAiLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/ai/format-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          standardType,
          customInstructions
        })
      });
      const data = await res.json();
      if (data.success && data.formatted) {
        const f = data.formatted;
        const newDocState: DocumentState = {
          orgHeader1: f.orgHeader1 || doc.orgHeader1,
          orgHeader2: f.orgHeader2 || doc.orgHeader2,
          nationalHeader1: f.nationalHeader1 || doc.nationalHeader1,
          nationalHeader2: f.nationalHeader2 || doc.nationalHeader2,
          locationAndDate: f.locationAndDate || doc.locationAndDate,
          documentType: f.documentType || doc.documentType,
          referenceNumber: f.referenceNumber || doc.referenceNumber,
          subject: f.subject || doc.subject,
          bodyHtml: f.bodyHtml || doc.bodyHtml,
          signTitle: f.signTitle || doc.signTitle,
          signName: f.signName || doc.signName,
          recipients: f.recipients || doc.recipients
        };
        setDoc(newDocState);
        const standardName = standardType === 'party' ? 'Hướng dẫn 05' : 'Nghị định 30';
        pushVersion(`Chuẩn hóa AI (${standardName})`, newDocState);
        setSuccessMsg(`Chuẩn hóa thành công văn bản theo chuẩn ${standardName}! Kiểm tra tại tab Xem trước hoặc Soạn thảo.`);
        setActiveTab("preview");
      } else {
        setErrorMsg(data.error || "Lỗi xử lý AI.");
      }
    } catch (err: any) {
      setErrorMsg("Lỗi kết nối AI: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiRefine = async (action: "proofread" | "expand" | "formalize") => {
    setIsRefining(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/ai/refine-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: doc.bodyHtml, action })
      });
      const data = await res.json();
      if (data.success && data.refined) {
        const updated = { ...doc, bodyHtml: data.refined };
        setDoc(updated);
        const actionLabel = action === 'proofread' ? 'Sửa lỗi chính tả' : action === 'expand' ? 'Bổ sung điều khoản' : 'Nâng cấp văn phong';
        pushVersion(`AI Tinh chỉnh (${actionLabel})`, updated);
        setSuccessMsg(`Đã hoàn tất tinh chỉnh văn bản: ${actionLabel}!`);
      } else {
        setErrorMsg(data.error || "Lỗi tinh chỉnh văn bản.");
      }
    } catch (err: any) {
      setErrorMsg("Lỗi kết nối: " + err.message);
    } finally {
      setIsRefining(false);
    }
  };

  const selectTemplate = (tId: string) => {
    const t = TEMPLATES.find(x => x.id === tId);
    if (!t) return;
    setStandardType(t.type as any);
    let title = t.name.toUpperCase();
    let sampleBody = `<p><strong>Căn cứ các quy định pháp luật hiện hành;</strong></p><p><strong>Xét đề nghị của cơ quan chuyên môn...</strong></p><p style="text-align: center;"><strong>QUYẾT ĐỊNH:</strong></p><p><strong>Điều 1.</strong> Nội dung chi tiết của ${t.name} theo đúng thẩm quyền được phân công.</p><p><strong>Điều 2.</strong> Thủ trưởng các đơn vị có liên quan chịu trách nhiệm thi hành Quyết định này./.</p>`;
    
    if (t.type === 'party') {
      title = "NGHỊ QUYẾT";
      sampleBody = `<p><strong>Căn cứ Điều lệ Đảng Cộng sản Việt Nam;</strong></p><p><strong>Căn cứ Chương trình công tác toàn khóa của Ban Chấp hành;</strong></p><p style="text-align: center;"><strong>BAN CHẤP HÀNH NGHỊ QUYẾT:</strong></p><p><strong>1. Mục tiêu và phương hướng:</strong> Tiếp tục đổi mới phương thức lãnh đạo, nâng cao năng lực và sức chiến đấu của tổ chức cơ sở đảng.</p><p><strong>2. Tổ chức thực hiện:</strong> Các cấp ủy trực thuộc có trách nhiệm phổ biến và triển khai thực hiện./.</p>`;
    }

    const updated: DocumentState = {
      ...doc,
      documentType: title,
      subject: `V/v ${t.name.toLowerCase()} theo quy định hiện hành`,
      bodyHtml: sampleBody
    };
    setDoc(updated);
    pushVersion("Chọn mẫu: " + t.name, updated);
    setSuccessMsg(`Đã áp dụng mẫu "${t.name}". Chuyển sang tab Xem trước hoặc Soạn thảo.`);
  };

  // Export to standard Microsoft Word (.docx) adhering to Decree 30 table headers & signature layout
  const exportToDocx = async () => {
    setIsExportingDocx(true);
    setErrorMsg("");
    try {
      const bodyParagraphs = parseHtmlToDocxParagraphs(doc.bodyHtml);

      const docxFile = new Document({
        styles: {
          default: {
            document: {
              run: {
                font: "Times New Roman",
                size: 26, // 13pt
                color: "000000"
              }
            }
          }
        },
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 1134, // 20mm (Nghị định 30: 20-25mm)
                  bottom: 1134, // 20mm (Nghị định 30: 20-25mm)
                  left: 1701, // 30mm (Nghị định 30: 30-35mm)
                  right: 850 // 15mm (Nghị định 30: 15-20mm)
                }
              }
            },
            children: [
              // 1. Header 2-column borderless table
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
                      // Left Header: Issuing Agency & Number
                      new TableCell({
                        width: { size: 45, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: doc.orgHeader1.toUpperCase(), size: 24, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: doc.orgHeader2.toUpperCase(), bold: true, size: 24, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: "----------------", size: 20, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: doc.referenceNumber, size: 24, font: "Times New Roman" })
                            ]
                          })
                        ]
                      }),
                      // Right Header: National Motto & Location/Date
                      new TableCell({
                        width: { size: 55, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: doc.nationalHeader1.toUpperCase(), bold: true, size: 24, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: doc.nationalHeader2, bold: true, size: 26, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: "----------------------", size: 20, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: doc.locationAndDate, italics: true, size: 26, font: "Times New Roman" })
                            ]
                          })
                        ]
                      })
                    ]
                  })
                ]
              }),

              // Spacer
              new Paragraph({ text: "" }),

              // 2. Document Type
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 60 },
                children: [
                  new TextRun({ text: doc.documentType.toUpperCase(), bold: true, size: 28, font: "Times New Roman" })
                ]
              }),

              // 3. Subject
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 180 },
                children: [
                  new TextRun({ text: doc.subject, bold: true, italics: true, size: 26, font: "Times New Roman" })
                ]
              }),

              // 4. Main Body Content (Structured Paragraphs)
              ...bodyParagraphs,

              // Spacer
              new Paragraph({ text: "" }),

              // 5. Signature & Recipients 2-column borderless table
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
                      // Left: Recipients
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({ text: "Nơi nhận:", bold: true, italics: true, size: 22, font: "Times New Roman" })
                            ]
                          }),
                          ...doc.recipients.split("\n").map(line => new Paragraph({
                            spacing: { line: 240 },
                            children: [
                              new TextRun({ text: line.startsWith("-") ? line : `- ${line}`, size: 20, font: "Times New Roman" })
                            ]
                          }))
                        ]
                      }),
                      // Right: Signer Title & Name
                      new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                          ...doc.signTitle.split("\n").map(line => new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: line.toUpperCase(), bold: true, size: 24, font: "Times New Roman" })
                            ]
                          })),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: "(Ký, đóng dấu)", italics: true, size: 20, font: "Times New Roman" })
                            ]
                          }),
                          new Paragraph({ text: "\n\n" }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: doc.signName, bold: true, size: 26, font: "Times New Roman" })
                            ]
                          })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }
        ]
      });

      const blob = await Packer.toBlob(docxFile);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.documentType.replace(/\s+/g, "_")}_ChuanND30.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMsg("Xuất file Microsoft Word (.docx) chuẩn Nghị định 30 thành công!");
    } catch (err: any) {
      setErrorMsg("Lỗi khi tạo file Word: " + err.message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Export to high-resolution multi-page PDF
  const exportToPdf = async () => {
    if (!previewRef.current) return;
    setIsExportingPdf(true);
    setErrorMsg("");
    setSuccessMsg("Đang kết xuất file PDF chất lượng cao theo chuẩn A4...");

    try {
      const element = previewRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2.5, 
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;
      const imgData = canvas.toDataURL("image/png");

      // First page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Handle multi-page documents
      while (heightLeft > 5) {
        position = position - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${doc.documentType.replace(/\s+/g, "_")}_ChuanND30.pdf`);
      setSuccessMsg("Xuất file PDF chuẩn A4 thành công!");
    } catch (err: any) {
      setErrorMsg("Lỗi khi xuất PDF: " + err.message);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const restoreVersion = (v: Version) => {
    setDoc(v.data);
    setSuccessMsg(`Đã khôi phục phiên bản: "${v.title}" (${v.timestamp})`);
    setActiveTab("preview");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between shadow-xs sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-600/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
              DocForm 30 <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">NĐ 30/2020 & HD 05</span>
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">Chuẩn hóa thể thức văn bản hành chính nhà nước & văn bản Đảng</p>
          </div>
        </div>

        {/* Workflow Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 my-2 sm:my-0">
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "upload" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> 1. Tải lên & AI
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "editor" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> 2. Soạn thảo
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "preview" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> 3. Xem trước
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "history" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-3.5 h-3.5" /> Lịch sử ({versions.length})
          </button>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={exportToDocx}
            disabled={isExportingDocx}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Xuất file Microsoft Word chuẩn bảng thể thức NĐ 30"
          >
            <Download className="w-3.5 h-3.5" /> {isExportingDocx ? "Đang tạo Word..." : "Xuất Word (.docx)"}
          </button>
          <button
            onClick={exportToPdf}
            disabled={isExportingPdf}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Xuất file PDF chất lượng cao A4"
          >
            <Printer className="w-3.5 h-3.5" /> {isExportingPdf ? "Đang tạo PDF..." : "Xuất PDF"}
          </button>
        </div>
      </header>

      {/* Notifications bar */}
      {(successMsg || errorMsg) && (
        <div className={`notification-bar px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
          errorMsg ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          <div className="flex items-center gap-2">
            {errorMsg ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            <span>{errorMsg || successMsg}</span>
          </div>
          <button onClick={() => { setErrorMsg(""); setSuccessMsg(""); }} className="text-xs opacity-75 hover:opacity-100 underline font-semibold">Đóng</button>
        </div>
      )}

      {/* Main Content Layout */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (Workflow Tabs) */}
        <div className="main-column lg:col-span-2 space-y-6">
          
          {/* TAB 1: UPLOAD & AI */}
          {activeTab === "upload" && (
            <div className="space-y-6">
              {/* Step Flow Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900">
                <div className="flex items-center gap-2 font-semibold">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  Quy trình 3 bước: Tải lên Word &rarr; AI Tự động định dạng &rarr; Xuất file Word/PDF chuẩn NĐ 30
                </div>
                <button
                  onClick={loadSampleText}
                  className="bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 px-3 py-1 rounded-lg font-semibold transition"
                >
                  Dùng thử dữ liệu mẫu có sẵn
                </button>
              </div>

              {/* Template selector */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-blue-600" /> Chọn mẫu biểu văn bản sẵn có
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t.id)}
                      className="text-left p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50/50 hover:border-blue-400 transition group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-900 text-xs group-hover:text-blue-600">{t.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${t.type === 'party' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t.type === 'party' ? 'Đảng' : 'Nhà nước'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Word or Paste Text */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-600" /> Tải lên file Word (.docx, .txt) hoặc dán văn bản
                  </span>
                  {uploadedFileName && (
                    <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      File: {uploadedFileName}
                    </span>
                  )}
                </h2>
                
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-5 text-center transition bg-slate-50/50 relative">
                  <input
                    type="file"
                    accept=".docx,.txt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="bg-white p-2.5 rounded-full text-blue-600 shadow-sm border border-slate-200">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700">
                      {isUploading ? "Đang đọc nội dung file..." : "Nhấn để chọn file Word (.docx) hoặc kéo thả vào đây"}
                    </p>
                    <p className="text-[11px] text-slate-400">Hỗ trợ Microsoft Word (.docx) và file văn bản (.txt)</p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700">Nội dung văn bản thô cần chuẩn hóa:</label>
                    <span className="text-[11px] text-slate-400">{rawText.length} ký tự</span>
                  </div>
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Dán nội dung văn bản thô vào đây (hoặc tải file Word ở trên) để AI tự động phân tích và lập cấu trúc theo Nghị định 30..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu chuẩn thể thức áp dụng:</label>
                    <select
                      value={standardType}
                      onChange={(e: any) => setStandardType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="state">Nghị định 30/2020/NĐ-CP (Hành chính Nhà nước)</option>
                      <option value="party">Hướng dẫn 05-HD/VPTW (Văn bản của Đảng)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Yêu cầu bổ sung cho AI (tùy chọn):</label>
                    <input
                      type="text"
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="VD: Căn cứ luật tổ chức chính quyền địa phương..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAiFormat}
                  disabled={isAiLoading || !rawText.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer text-xs"
                >
                  <Sparkles className="w-4 h-4 text-yellow-200 animate-spin" />
                  {isAiLoading ? "AI đang phân tích và chuẩn hóa thể thức văn bản..." : "Bắt đầu chuẩn hóa thể thức bằng AI"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: EDITOR */}
          {activeTab === "editor" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" /> Soạn thảo cấu trúc văn bản
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAiRefine("proofread")}
                    disabled={isRefining}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <Wand2 className="w-3 h-3" /> {isRefining ? "Đang xử lý..." : "Sửa lỗi chính tả"}
                  </button>
                  <button
                    onClick={() => handleAiRefine("formalize")}
                    disabled={isRefining}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" /> Nâng cấp văn phong
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cơ quan chủ quản cấp trên (nếu có):</label>
                  <input
                    type="text"
                    value={doc.orgHeader1}
                    onChange={(e) => handleFieldChange("orgHeader1", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cơ quan ban hành văn bản:</label>
                  <input
                    type="text"
                    value={doc.orgHeader2}
                    onChange={(e) => handleFieldChange("orgHeader2", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Quốc hiệu (Dòng 1):</label>
                  <input
                    type="text"
                    value={doc.nationalHeader1}
                    onChange={(e) => handleFieldChange("nationalHeader1", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tiêu ngữ (Dòng 2):</label>
                  <input
                    type="text"
                    value={doc.nationalHeader2}
                    onChange={(e) => handleFieldChange("nationalHeader2", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Địa danh & Ngày tháng năm:</label>
                  <input
                    type="text"
                    value={doc.locationAndDate}
                    onChange={(e) => handleFieldChange("locationAndDate", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Loại văn bản:</label>
                  <input
                    type="text"
                    value={doc.documentType}
                    onChange={(e) => handleFieldChange("documentType", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Số & Ký hiệu:</label>
                  <input
                    type="text"
                    value={doc.referenceNumber}
                    onChange={(e) => handleFieldChange("referenceNumber", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Trích yếu nội dung văn bản:</label>
                <input
                  type="text"
                  value={doc.subject}
                  onChange={(e) => handleFieldChange("subject", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nội dung chi tiết (Định dạng HTML chuẩn văn thư: Điều, Khoản, Điểm):
                </label>
                <textarea
                  rows={9}
                  value={doc.bodyHtml}
                  onChange={(e) => handleFieldChange("bodyHtml", e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-800 font-mono leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Chức vụ người ký:</label>
                  <textarea
                    rows={2}
                    value={doc.signTitle}
                    onChange={(e) => handleFieldChange("signTitle", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Họ tên người ký:</label>
                  <input
                    type="text"
                    value={doc.signName}
                    onChange={(e) => handleFieldChange("signName", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nơi nhận:</label>
                  <textarea
                    rows={2}
                    value={doc.recipients}
                    onChange={(e) => handleFieldChange("recipients", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    pushVersion("Chỉnh sửa thủ công", doc);
                    setSuccessMsg("Đã lưu lại thay đổi và ghi nhận vào lịch sử phiên bản!");
                    setActiveTab("preview");
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-sm"
                >
                  <Save className="w-4 h-4" /> Lưu thay đổi & Chuyển sang Xem trước
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: PREVIEW */}
          {activeTab === "preview" && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Xem trước văn bản theo chuẩn Nghị định 30 & Hướng dẫn 05</h3>
                  <p className="text-[11px] text-slate-500">Đã áp dụng bảng lề, phông chữ Times New Roman 13pt và khoảng cách dãn dòng chuẩn.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={handlePrint} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-semibold border border-slate-300 flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5" /> In trực tiếp
                  </button>
                  <button 
                    onClick={exportToDocx} 
                    disabled={isExportingDocx}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> {isExportingDocx ? "Đang xuất..." : "Tải Word (.docx)"}
                  </button>
                  <button 
                    onClick={exportToPdf} 
                    disabled={isExportingPdf}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" /> {isExportingPdf ? "Đang xuất..." : "Tải PDF"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HISTORY */}
          {activeTab === "history" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" /> Lịch sử phiên bản chỉnh sửa
                </h2>
                <span className="text-xs text-slate-400">{versions.length} phiên bản đã lưu</span>
              </div>
              <p className="text-xs text-slate-500">Mỗi lần tải lên, chuẩn hóa bằng AI hoặc chỉnh sửa đều được lưu lại để khôi phục bất cứ lúc nào.</p>
              
              <div className="space-y-2.5 mt-2">
                {versions.map((v, index) => (
                  <div key={v.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between hover:border-blue-400 transition">
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 text-purple-700 p-2 rounded-lg font-bold text-xs">
                        #{versions.length - index}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900">{v.title}</h4>
                        <p className="text-[11px] text-slate-500">{v.timestamp} · {v.data.documentType}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => restoreVersion(v)}
                      className="bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Khôi phục phiên bản này
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Live A4 Visual Preview */}
        <div className="preview-column lg:col-span-1">
          <div className="sticky top-20 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Trang A4 chuẩn NĐ 30</span>
              </h3>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">Times New Roman</span>
              </div>
            </div>

            {/* A4 Paper Container with true Decree 30 visual layout */}
            <div
              id="printable-document"
              ref={previewRef}
              className="bg-white text-slate-900 p-6 sm:p-7 rounded border border-slate-300 shadow-md mx-auto font-serif text-[12px] leading-relaxed selection:bg-blue-100 relative overflow-hidden"
              style={{ width: "100%", minHeight: "640px", maxWidth: "430px" }}
            >
              {/* Header block: 2 columns */}
              <div className="grid grid-cols-2 text-center mb-4 gap-2">
                <div>
                  <p className="uppercase text-[10.5px] leading-tight text-slate-800">{doc.orgHeader1}</p>
                  <p className="font-bold text-[10.5px] leading-tight mt-0.5 text-slate-900">{doc.orgHeader2}</p>
                  <div className="w-16 h-0.5 bg-slate-900 mx-auto my-1"></div>
                  <p className="text-[10px] mt-1 text-slate-800">{doc.referenceNumber}</p>
                </div>
                <div>
                  <p className="font-bold uppercase text-[10.5px] leading-tight text-slate-900">{doc.nationalHeader1}</p>
                  <p className="font-bold text-[10.5px] leading-tight mt-0.5 text-slate-900">{doc.nationalHeader2}</p>
                  <div className="w-20 h-0.5 bg-slate-900 mx-auto my-1"></div>
                  <p className="text-[9.5px] italic mt-1 text-slate-800">{doc.locationAndDate}</p>
                </div>
              </div>

              {/* Title */}
              <div className="text-center my-4">
                <h2 className="font-bold uppercase text-xs tracking-wide text-slate-900">{doc.documentType}</h2>
              </div>

              {/* Subject */}
              <div className="text-center my-2.5 px-3">
                <p className="italic text-[11px] font-semibold leading-snug text-slate-900">{doc.subject}</p>
              </div>

              {/* Body Content */}
              <div 
                className="space-y-2.5 text-justify text-[11px] my-3 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: doc.bodyHtml }}
              />

              {/* Signature Block & Recipients: 2 columns */}
              <div className="mt-8 grid grid-cols-2 gap-2 pt-2">
                {/* Recipients */}
                <div className="text-[9.5px] leading-normal text-slate-800">
                  <p className="font-bold italic">Nơi nhận:</p>
                  <div className="whitespace-pre-line text-slate-700">
                    {doc.recipients}
                  </div>
                </div>

                {/* Signer */}
                <div className="text-center">
                  <p className="font-bold uppercase text-[10.5px] whitespace-pre-line leading-tight text-slate-900">{doc.signTitle}</p>
                  <p className="text-[9px] italic my-1 text-slate-500">(Ký, ghi rõ họ tên và đóng dấu)</p>
                  <div className="h-10"></div>
                  <p className="font-bold text-[11px] text-slate-900">{doc.signName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
