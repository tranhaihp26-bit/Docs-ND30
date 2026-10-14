import { z } from "zod";

/**
 * @file document.schema.ts
 * @description Zod validation schema cho cấu trúc văn bản hành chính nhà nước (Nghị định 30/2020/NĐ-CP)
 * và văn bản Đảng (Hướng dẫn số 05-HD/VPTW).
 * 
 * NGUYÊN TẮC "ZERO TRUST AI OUTPUT":
 * - Các thuộc tính thể thức cứng (Quốc hiệu, Tiêu ngữ, Phông chữ, Cỡ chữ) phải tuân thủ nghiêm ngặt 100%.
 * - Các thuộc tính nội dung do AI sinh ra phải được xác thực kiểu dữ liệu và chuẩn hóa qua regex.
 */

/**
 * Regex chuẩn hóa số, ký hiệu văn bản theo Điều 8 & Phụ lục I Nghị định 30/2020/NĐ-CP
 * Ví dụ hợp lệ:
 * - Văn bản QPPL / Cá biệt: "Số: 123/QĐ-UBND", "Số: 45/2026/NĐ-CP"
 * - Công văn hành chính: "Số: 12/STP-VP"
 * - Văn bản Đảng: "Số: 01-NQ/TW", "Số: 15-HD/BTCTW"
 */
export const REFERENCE_NUMBER_REGEX = /^Số:\s*[\d\w\.\-]+(\/|-)[\d\w\.\-\/]+$/i;

/**
 * Regex chuẩn hóa địa danh và ngày, tháng, năm ban hành văn bản:
 * Phải có dạng: "[Tên địa danh], ngày [dd] tháng [mm] năm [yyyy]"
 * Ví dụ: "Hà Nội, ngày 13 tháng 10 năm 2026"
 */
export const LOCATION_AND_DATE_REGEX = /^[\p{L}\s\.\-]+,\s*ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}$/u;

/**
 * Zod Schema cho chuẩn thể thức văn bản hành chính và văn bản Đảng
 */
export const DocumentFormatSchema = z.object({
  /**
   * Chế độ văn bản:
   * - 'administrative': Văn bản hành chính nhà nước (NĐ 30/2020/NĐ-CP)
   * - 'party': Văn bản của Đảng (Hướng dẫn số 05-HD/VPTW)
   */
  regime: z.enum(["administrative", "party"]).default("administrative"),

  /**
   * Quốc hiệu (Dòng 1):
   * - Nhà nước: Bắt buộc là "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" (in hoa, cỡ 12-13, đứng, đậm)
   * - Đảng: Bắt buộc là "ĐẢNG CỘNG SẢN VIỆT NAM" (in hoa, cỡ 13-14, đứng, đậm)
   */
  nationalHeader1: z.enum([
    "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "ĐẢNG CỘNG SẢN VIỆT NAM"
  ]),

  /**
   * Tiêu ngữ (Dòng 2):
   * Bắt buộc là "Độc lập - Tự do - Hạnh phúc" (chữ in thường, cỡ 13-14, đứng, đậm)
   */
  nationalHeader2: z.literal("Độc lập - Tự do - Hạnh phúc"),

  /**
   * Phông chữ bắt buộc: Times New Roman (Nghị định 30 Điều 8 khoản 1)
   */
  fontFamily: z.literal("Times New Roman").default("Times New Roman"),

  /**
   * Cỡ chữ chuẩn nội dung văn bản: 13pt hoặc 14pt (Nghị định 30 Phụ lục I Mục II.1)
   */
  fontSize: z.union([z.literal(13), z.literal(14)]).default(13),

  /**
   * Tên cơ quan, tổ chức chủ quản cấp trên trực tiếp (nếu có)
   * Ví dụ: "BỘ GIÁO DỤC VÀ ĐÀO TẠO" hoặc "ỦY BAN NHÂN DÂN THÀNH PHỐ HÀ NỘI"
   */
  orgHeader1: z.string().default(""),

  /**
   * Tên cơ quan, tổ chức ban hành văn bản
   * Ví dụ: "VĂN PHÒNG ỦY BAN" hoặc "SỞ TƯ PHÁP"
   */
  orgHeader2: z.string().min(1, "Tên cơ quan ban hành không được để trống"),

  /**
   * Địa danh và thời gian ban hành văn bản
   * Định dạng chuẩn NĐ 30: "Địa danh, ngày ... tháng ... năm ..." (chữ nghiêng, cỡ 13-14)
   */
  locationAndDate: z.string().min(5, "Địa danh và ngày tháng không hợp lệ"),

  /**
   * Tên loại văn bản
   * Ví dụ: "QUYẾT ĐỊNH", "CÔNG VĂN", "KẾ HOẠCH", "BÁO CÁO", "TỜ TRÌNH", "NGHỊ QUYẾT"
   */
  documentType: z.string().min(1, "Loại văn bản không được để trống"),

  /**
   * Số và ký hiệu của văn bản
   * Phải bắt đầu bằng "Số: " theo chuẩn Điều 10 NĐ 30/2020/NĐ-CP
   */
  referenceNumber: z.string().min(1, "Số ký hiệu không được để trống"),

  /**
   * Trích yếu nội dung văn bản
   * Ví dụ: "V/v ban hành quy chế làm việc của cơ quan..."
   */
  subject: z.string().min(1, "Trích yếu nội dung văn bản không được để trống"),

  /**
   * Nội dung chi tiết văn bản (HTML ngữ nghĩa)
   * Phân chia thành các căn cứ, Điều, Khoản, Điểm hoặc Phần I, II, III...
   */
  bodyHtml: z.string().min(1, "Nội dung văn bản không được để trống"),

  /**
   * Chức vụ, quyền hạn người ký
   * Ví dụ: "TM. ỦY BAN NHÂN DÂN\nCHỦ TỊCH" hoặc "KT. BỘ TRƯỞNG\nTHỨ TRƯỞNG"
   */
  signTitle: z.string().min(1, "Chức vụ người ký không được để trống"),

  /**
   * Họ và tên người ký
   */
  signName: z.string().min(1, "Họ tên người ký không được để trống"),

  /**
   * Nơi nhận văn bản
   * Ví dụ: "Như Điều 3;\nLưu: VT, TH."
   */
  recipients: z.string().min(1, "Nơi nhận văn bản không được để trống"),
});

export type DocumentFormatType = z.infer<typeof DocumentFormatSchema>;
