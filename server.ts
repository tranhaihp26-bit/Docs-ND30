import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import mammoth from "mammoth";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { enforceND30Standards, formatStandardDate } from "./src/server/middleware/compliance.middleware.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

function fallbackRuleBasedParser(rawText: string, standardType: string) {
  const isParty = standardType === 'party' || rawText.includes("ĐẢNG CỘNG SẢN") || rawText.includes("ĐẢNG BỘ");
  
  // Heuristic document type detection
  let docType = "CÔNG VĂN";
  if (/QUYẾT ĐỊNH/i.test(rawText)) docType = "QUYẾT ĐỊNH";
  else if (/KẾ HOẠCH/i.test(rawText)) docType = "KẾ HOẠCH";
  else if (/TỜ TRÌNH/i.test(rawText)) docType = "TỜ TRÌNH";
  else if (/THÔNG BÁO/i.test(rawText)) docType = "THÔNG BÁO";
  else if (/NGHỊ QUYẾT/i.test(rawText)) docType = isParty ? "NGHỊ QUYẾT" : "NGHỊ ĐỊNH / NGHỊ QUYẾT";
  else if (/BÁO CÁO/i.test(rawText)) docType = "BÁO CÁO";

  // Split into clean paragraphs
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let htmlBody = "";
  
  lines.forEach(line => {
    if (/^(Điều|Khoản|Điểm)\s+\d+/i.test(line)) {
      htmlBody += `<p><strong>${line}</strong></p>`;
    } else if (/^(Căn cứ|Xét đề nghị|Theo quy định)/i.test(line)) {
      htmlBody += `<p><strong>${line}</strong></p>`;
    } else if (line.toUpperCase() === docType || /^(QUYẾT ĐỊNH:|NỘI DUNG:)/i.test(line)) {
      htmlBody += `<p style="text-align: center;"><strong>${line}</strong></p>`;
    } else {
      htmlBody += `<p>${line}</p>`;
    }
  });

  if (!htmlBody) {
    htmlBody = `<p>${rawText}</p>`;
  }

  const dateStr = formatStandardDate("Hà Nội");

  return {
    orgHeader1: isParty ? "ĐẢNG BỘ TỈNH/THÀNH PHỐ" : "UBND TỈNH/THÀNH PHỐ",
    orgHeader2: isParty ? "BAN THƯỜNG VỤ / VĂN PHÒNG" : "VĂN PHÒNG / SỞ BAN NGÀNH",
    nationalHeader1: isParty ? "ĐẢNG CỘNG SẢN VIỆT NAM" : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    nationalHeader2: isParty ? "" : "Độc lập - Tự do - Hạnh phúc",
    locationAndDate: dateStr,
    documentType: docType,
    referenceNumber: `Số: 01/${docType.slice(0, 2).toUpperCase()}`,
    subject: `V/v ${docType.toLowerCase()} thực hiện nhiệm vụ công tác theo quy định`,
    bodyHtml: htmlBody,
    signTitle: isParty ? "TM. BAN THƯỜNG VỤ\nBÍ THƯ" : "TM. ỦY BAN NHÂN DÂN\nCHỦ TỊCH",
    signName: "Nguyễn Văn A",
    recipients: isParty ? "Kính gửi: Các đảng bộ, chi bộ trực thuộc;\nLưu: VT." : "Kính gửi: Các cơ quan, đơn vị liên quan;\nNơi nhận: Như trên, Lưu: VT."
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API to parse uploaded file (.docx, .txt)
  app.post("/api/parse-docx", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Không tìm thấy file tải lên." });
      }

      const originalName = req.file.originalname.toLowerCase();
      
      // If plain text or txt file
      if (originalName.endsWith(".txt") || req.file.mimetype === "text/plain") {
        const textContent = req.file.buffer.toString("utf-8");
        return res.json({
          success: true,
          text: textContent,
          html: `<p>${textContent.replace(/\n/g, "</p><p>")}</p>`,
          fileType: "txt"
        });
      }

      // Word .docx file
      try {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        const htmlResult = await mammoth.convertToHtml({ buffer: req.file.buffer });

        return res.json({
          success: true,
          text: result.value,
          html: htmlResult.value,
          messages: result.messages,
          fileType: "docx"
        });
      } catch (docErr: any) {
        // Fallback if binary doc or corrupted zip
        const rawString = req.file.buffer.toString("utf-8", 0, Math.min(req.file.buffer.length, 50000));
        const cleanAscii = rawString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "").trim();
        if (cleanAscii.length > 50) {
          return res.json({
            success: true,
            text: cleanAscii,
            html: `<p>${cleanAscii.replace(/\n/g, "</p><p>")}</p>`,
            warning: "File không phải chuẩn .docx nhưng đã được trích xuất nội dung văn bản khả dụng."
          });
        }
        throw new Error("Không thể đọc định dạng file này. Vui lòng đảm bảo file có đuôi .docx hoặc chuyển sang file văn bản .txt");
      }
    } catch (error: any) {
      console.error("Parse docx error:", error);
      res.status(500).json({ error: error.message || "Lỗi khi đọc file Word." });
    }
  });

  // API to format and structure document using Gemini AI according to Nghị định 30 or Hướng dẫn 05
  app.post("/api/ai/format-document", async (req, res) => {
    const { rawText, standardType, customInstructions } = req.body;

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "Thiếu nội dung văn bản gốc." });
    }

    const standardDesc = standardType === 'party' 
      ? "Hướng dẫn số 05-HD/VPTW về thể thức và kỹ thuật trình bày văn bản của Đảng"
      : "Nghị định số 30/2020/NĐ-CP của Chính phủ về công tác văn thư và thể thức trình bày văn bản hành chính nhà nước";

    const safeRawText = String(rawText || '').slice(0, 30000);
    const safeInstructions = typeof customInstructions === 'string' 
      ? customInstructions.slice(0, 500).replace(/[`${}\\]/g, ' ').trim() 
      : 'Không có';

    const prompt = `
Bạn là chuyên gia hàng đầu về soạn thảo văn bản hành chính Nhà nước và văn bản Đảng Việt Nam.
Hãy phân tích nội dung văn bản gốc dưới đây và chuẩn hóa lại cấu trúc, ngôn ngữ, thể thức theo chuẩn: ${standardDesc}.

Nội dung văn bản gốc:
\`\`\`
${safeRawText}
\`\`\`

Yêu cầu bổ sung từ người dùng: ${safeInstructions || 'Không có'}

Quy định cấu trúc:
1. Cơ quan ban hành (orgHeader1, orgHeader2)
2. Quốc hiệu, tiêu ngữ (nationalHeader1, nationalHeader2)
3. Địa danh và ngày tháng năm (locationAndDate)
4. Tên loại văn bản và trích yếu (documentType, subject)
5. Số và ký hiệu văn bản (referenceNumber)
6. Nội dung chi tiết (bodyHtml): các thẻ HTML hợp lệ (p, strong, em, ul, ol, li), chia rõ căn cứ pháp lý, các Điều, Khoản, Điểm hoặc Phần I, II, III... Văn phong pháp lý chuẩn mực, không dùng từ ngữ dân dã.
7. Chức vụ, chữ ký, họ tên người ký (signTitle, signName)
8. Nơi nhận (recipients)

Hãy trả về kết quả dưới dạng JSON (chính xác định dạng JSON thuần túy, không có markdown ngoài JSON) với cấu trúc sau:
{
  "orgHeader1": "Tên cơ quan chủ quản (nếu có, VD: BỘ GIÁO DỤC VÀ ĐÀO TẠO)",
  "orgHeader2": "Tên cơ quan ban hành (VD: TRƯỜNG ĐẠI HỌC KHOA HỌC)",
  "nationalHeader1": "${standardType === 'party' ? 'ĐẢNG CỘNG SẢN VIỆT NAM' : 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'}",
  "nationalHeader2": "${standardType === 'party' ? '' : 'Độc lập - Tự do - Hạnh phúc'}",
  "locationAndDate": "Địa danh, ngày ... tháng ... năm ...",
  "documentType": "Tên loại văn bản (VD: QUYẾT ĐỊNH, CÔNG VĂN, KẾ HOẠCH, BÁO CÁO, TỜ TRÌNH, THÔNG BÁO...)",
  "referenceNumber": "Số: .../QĐ-...",
  "subject": "Trích yếu nội dung văn bản (tóm tắt ngắn gọn súc tích)",
  "bodyHtml": "Nội dung chi tiết được trình bày bằng các thẻ HTML sạch đúng chuẩn văn bản pháp lý...",
  "signTitle": "Chức vụ người ký (VD: KT. BỘ TRƯỞNG\\nTHỨ TRƯỞNG hoặc T/M BAN CHẤP HÀNH\\nBÍ THƯ)",
  "signName": "Họ và tên người ký",
  "recipients": "Kính gửi: ...\\nNơi nhận: ..."
}
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        }
      });

      const textRes = response.text || "{}";
      const firstBrace = textRes.indexOf('{');
      const lastBrace = textRes.lastIndexOf('}');
      
      let parsed;
      if (firstBrace !== -1 && lastBrace !== -1) {
        parsed = JSON.parse(textRes.slice(firstBrace, lastBrace + 1));
      } else {
        parsed = JSON.parse(textRes);
      }

      // DETERMINISTIC SAFETY NET: Cưỡng chế thể thức NĐ 30 & Zod Schema Validation
      const regime = standardType === "party" ? "party" : "administrative";
      console.log("[COMPLIANCE] Raw AI output received:", parsed);
      const compliantDoc = enforceND30Standards(parsed, regime);
      console.log("[COMPLIANCE] After enforcement & Zod validation:", compliantDoc);

      return res.json({ success: true, formatted: compliantDoc });
    } catch (error: any) {
      console.warn("AI format or Zod validation failed, using rule-based fallback:", error.message);
      // Fallback parser + Compliance Middleware enforcement so user is NEVER blocked
      const regime = standardType === "party" ? "party" : "administrative";
      const rawFallback = fallbackRuleBasedParser(rawText, standardType);
      const compliantFallback = enforceND30Standards(rawFallback, regime);

      return res.json({ 
        success: true, 
        formatted: compliantFallback, 
        notice: "Đã chuẩn hóa nội dung theo quy tắc chuẩn thể thức NĐ 30/2020/NĐ-CP (Rule Engine Fallback)." 
      });
    }
  });

  // API for AI text refinement (proofreading, legal polishing, expanding clauses)
  app.post("/api/ai/refine-text", async (req, res) => {
    const { text, action } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Thiếu nội dung cần xử lý." });
    }

    try {
      let instruction = "";
      if (action === "proofread") {
        instruction = "Kiểm tra lỗi chính tả, ngữ pháp, chuẩn hóa thuật ngữ hành chính nhà nước và văn phong pháp lý cho đoạn văn sau, giữ nguyên ý nghĩa và cấu trúc HTML:";
      } else if (action === "expand") {
        instruction = "Bổ sung thêm các điều khoản, căn cứ pháp lý hoặc nội dung chi tiết mang tính quy phạm hành chính chuẩn mực cho đoạn văn sau, giữ nguyên cấu trúc HTML:";
      } else if (action === "formalize") {
        instruction = "Nâng cấp văn phong của đoạn văn sau trở nên trang trọng, sắc sảo, đúng mực văn bản quản lý nhà nước cấp cao, giữ nguyên cấu trúc HTML:";
      } else {
        instruction = "Cải thiện văn bản sau đây theo chuẩn thể thức văn bản hành chính:";
      }

    const safeText = String(text || '').slice(0, 15000);
    const prompt = `${instruction}\n\n\`\`\`html\n${safeText}\n\`\`\`\n\nChỉ trả về đoạn HTML đã được tối ưu hóa, không giải thích thêm.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
      });

      const refined = response.text || text;
      res.json({ success: true, refined: refined.replace(/```html/g, "").replace(/```/g, "").trim() });
    } catch (error: any) {
      console.warn("AI refine error:", error.message);
      // Return original text if AI fails
      res.json({ success: true, refined: text, notice: "Không thể kết nối AI, giữ nguyên nội dung gốc." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
