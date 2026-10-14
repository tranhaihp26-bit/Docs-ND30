/**
 * @file compliance.middleware.ts
 * @description Compliance Middleware & Hybrid Safety Net cho Nghị định số 30/2020/NĐ-CP
 * và Hướng dẫn số 05-HD/VPTW.
 * 
 * NGUYÊN TẮC:
 * 1. "AI gợi ý ngữ nghĩa, Rule Engine chốt hạ thể thức": AI chỉ phụ trách phân tích và sinh nội dung thô.
 *    Toàn bộ cấu trúc quy chuẩn cứng (Quốc hiệu, Tiêu ngữ, Font, Size, Lề) do Rule Engine quyết định.
 * 2. "Zero Trust AI Output": Mọi output từ AI đều bị coi là không đáng tin cậy cho tới khi được ghi đè
 *    (Override) và xác thực thành công qua Zod Schema.
 */

import { DocumentFormatSchema, DocumentFormatType, LOCATION_AND_DATE_REGEX } from "../../shared/schemas/document.schema.ts";

/**
 * Tạo chuỗi địa danh và ngày, tháng, năm theo đúng mẫu NĐ 30/2020/NĐ-CP
 * Ví dụ: "Hà Nội, ngày 13 tháng 10 năm 2026"
 */
export function formatStandardDate(location: string = "Hà Nội", date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const cleanLocation = location.trim().replace(/,$/, "") || "Hà Nội";
  return `${cleanLocation}, ngày ${day} tháng ${month} năm ${year}`;
}

/**
 * Trích xuất địa danh từ chuỗi do AI sinh ra (nếu có)
 */
function extractLocation(rawDateStr?: string): string {
  if (!rawDateStr || typeof rawDateStr !== "string") return "Hà Nội";
  
  // Tách phần địa danh trước dấu phẩy hoặc từ "ngày"
  const commaIdx = rawDateStr.indexOf(",");
  if (commaIdx > 0) {
    const loc = rawDateStr.slice(0, commaIdx).trim();
    if (loc.length >= 2 && !/^(ngày|tháng|năm|số)/i.test(loc)) {
      return loc;
    }
  }

  const ngayMatch = rawDateStr.match(/^(.*?)\s+ngày/i);
  if (ngayMatch && ngayMatch[1]) {
    const loc = ngayMatch[1].trim();
    if (loc.length >= 2) return loc;
  }

  return "Hà Nội";
}

/**
 * Chuẩn hóa số ký hiệu văn bản theo NĐ 30 Điều 10
 * Đảm bảo bắt đầu bằng tiền tố "Số: "
 */
function normalizeReferenceNumber(rawNum?: string, docType: string = "CV"): string {
  if (!rawNum || typeof rawNum !== "string" || !rawNum.trim()) {
    const acronym = docType
      .split(/\s+/)
      .map(w => w[0]?.toUpperCase())
      .filter(Boolean)
      .join("") || "CV";
    return `Số: 01/${acronym}-VP`;
  }

  let clean = rawNum.trim();
  if (!clean.startsWith("Số:") && !clean.startsWith("Số ")) {
    clean = `Số: ${clean}`;
  } else if (clean.startsWith("Số ") && !clean.startsWith("Số: ")) {
    clean = clean.replace(/^Số\s+/, "Số: ");
  }

  return clean;
}

/**
 * Làm sạch và định dạng lại nội dung HTML để đảm bảo an toàn & đúng ngữ nghĩa
 */
function sanitizeBodyHtml(rawHtml?: string): string {
  if (!rawHtml || typeof rawHtml !== "string" || !rawHtml.trim()) {
    return "<p>Văn bản chưa có nội dung chi tiết.</p>";
  }

  // Loại bỏ các thẻ script, iframe, style nguy hiểm
  let cleaned = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .trim();

  // Đảm bảo văn bản được bọc trong các thẻ đoạn văn nếu chỉ là plain text
  if (!/<(p|div|h[1-6]|ul|ol|table)/i.test(cleaned)) {
    cleaned = cleaned
      .split(/\r?\n\r?\n/)
      .filter(Boolean)
      .map(par => `<p>${par.trim()}</p>`)
      .join("");
  }

  return cleaned;
}

/**
 * Compliance Middleware: Cưỡng chế thực thi 100% tiêu chuẩn Nghị định 30/2020/NĐ-CP & Hướng dẫn 05-HD/VPTW.
 * 
 * Lớp này sẽ:
 * 1. Ghi đè (Override) toàn bộ các trường thể thức bắt buộc (Quốc hiệu, Tiêu ngữ, Font, Size).
 * 2. Tự động khắc phục các lỗi ảo giác (Hallucination) của AI ở trường ngày tháng, số ký hiệu.
 * 3. Chạy qua Zod Schema Validation để bảo đảm tính đúng đắn và an toàn kiểu dữ liệu.
 * 
 * @param rawAiJson Dữ liệu JSON thô nhận được từ Gemini API hoặc client
 * @param regime Chế độ thể thức: 'administrative' (NĐ 30) hoặc 'party' (HD 05)
 * @returns Object tuân thủ chuẩn DocumentFormatType đã được validate
 */
export function enforceND30Standards(
  rawAiJson: any,
  regime: "administrative" | "party" = "administrative"
): DocumentFormatType {
  const isParty = regime === "party";
  const source = typeof rawAiJson === "object" && rawAiJson !== null ? rawAiJson : {};

  // 1. RULE OVERRIDE: Quốc hiệu (Dòng 1)
  const nationalHeader1 = isParty
    ? "ĐẢNG CỘNG SẢN VIỆT NAM"
    : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";

  // 2. RULE OVERRIDE: Tiêu ngữ (Dòng 2)
  const nationalHeader2 = "Độc lập - Tự do - Hạnh phúc" as const;

  // 3. RULE OVERRIDE: Phông chữ & Cỡ chữ bắt buộc (NĐ 30 Điều 8)
  const fontFamily = "Times New Roman" as const;
  const fontSize = 13 as const;

  // 4. RULE OVERRIDE: Loại văn bản chuẩn hóa
  const documentType = (source.documentType || "CÔNG VĂN").toString().trim().toUpperCase();

  // 5. RULE REPAIR: Số và ký hiệu văn bản
  const referenceNumber = normalizeReferenceNumber(source.referenceNumber, documentType);

  // 6. RULE REPAIR: Địa danh và Ngày tháng năm
  let locationAndDate = (source.locationAndDate || "").toString().trim();
  if (!LOCATION_AND_DATE_REGEX.test(locationAndDate) || locationAndDate.length < 10) {
    // Nếu AI bịa ngày tháng không đúng định dạng chuẩn NĐ 30, trích xuất địa danh và áp dụng ngày thực tế
    const loc = extractLocation(locationAndDate);
    locationAndDate = formatStandardDate(loc);
  }

  // 7. Cơ quan ban hành
  const orgHeader1 = (source.orgHeader1 || "").toString().trim().toUpperCase();
  const orgHeader2 = (source.orgHeader2 || (isParty ? "BAN THƯỜNG VỤ / VĂN PHÒNG" : "ỦY BAN NHÂN DÂN")).toString().trim().toUpperCase();

  // 8. Trích yếu nội dung
  const subject = (source.subject || `V/v thực hiện nhiệm vụ công tác theo quy định`).toString().trim();

  // 9. Nội dung chi tiết được làm sạch HTML
  const bodyHtml = sanitizeBodyHtml(source.bodyHtml);

  // 10. Chức vụ & Người ký
  const defaultSignTitle = isParty ? "TM. BAN THƯỜNG VỤ\nBÍ THƯ" : "TM. ỦY BAN NHÂN DÂN\nCHỦ TỊCH";
  const signTitle = (source.signTitle || defaultSignTitle).toString().trim();
  const signName = (source.signName || "Nguyễn Văn A").toString().trim();

  // 11. Nơi nhận
  const defaultRecipients = isParty
    ? "Như trên;\nLưu: VT, Ban Tổ chức."
    : "Như trên;\nLưu: VT, TH.";
  const recipients = (source.recipients || defaultRecipients).toString().trim();

  // Tạo đối tượng đã chuẩn hóa toàn diện
  const normalizedCandidate = {
    regime,
    nationalHeader1,
    nationalHeader2,
    fontFamily,
    fontSize,
    orgHeader1,
    orgHeader2,
    locationAndDate,
    documentType,
    referenceNumber,
    subject,
    bodyHtml,
    signTitle,
    signName,
    recipients,
  };

  // 12. ZERO TRUST: Chạy qua Zod Schema Validation
  const validated = DocumentFormatSchema.parse(normalizedCandidate);
  return validated;
}
