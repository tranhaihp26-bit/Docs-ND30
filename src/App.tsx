import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, Upload, Sparkles, Download, Printer, History, RotateCcw, 
  CheckCircle2, AlertCircle, LayoutTemplate, Edit3, Eye, 
  Save, Wand2, ArrowRight, FileCheck, ShieldCheck, Check,
  X, AlertTriangle, Info, HelpCircle, FilePlus, ChevronRight,
  ExternalLink, Copy, Bookmark, Building2, MapPin, Tag
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import DOMPurify from "dompurify";
import ND30Editor from "./components/ND30Editor.tsx";
import { A4DocumentPreview } from "./components/A4DocumentPreview.tsx";
import { exportToDocx as generateAndDownloadDocx } from "./utils/docxExport.ts";
import { parseLocalFile } from "./utils/localFileImport.ts";
import { composeImportedBodyHtml, deriveImportStatus, updateImportField } from "./utils/importReview.ts";
import { 
  type DocumentFormatType, 
  validateND30Compliance, 
  type ND30ComplianceReport,
  isPlaceholderValue,
  type StructuredImport,
  type AppendixDocument,
  type SourceBlock
} from "./shared/schemas/document.schema.ts";
import { formatStandardDate, extractLocation } from "./server/middleware/compliance.middleware.ts";
import { detectDocumentType } from "./server/parser.ts";
import { COMPANY_HEADER_PROFILE_ID, COMPANY_HEADER_PARENT_LINES, applyCompanyProfile, LOCKED_COMPANY_FIELDS } from "./canonical/nd30/companyHeader.ts";

export interface DocumentState {
  headerProfile?: "generic" | typeof COMPANY_HEADER_PROFILE_ID;
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
  appendices?: AppendixDocument[];
  unclassified?: SourceBlock[];
  importMetadata?: {
    sourceType?: "template" | "docx" | "txt" | "paste";
    status?: "parsed" | "needs_review" | "confirmed";
    sourceFilename?: string;
  };
}

interface Version {
  id: string;
  timestamp: string;
  title: string;
  data: DocumentState;
  standardType: "state" | "party";
}

interface TemplatePreset {
  id: string;
  name: string;
  desc: string;
  type: "state" | "party";
  badge: string;
  defaultData: DocumentState;
}

const TEMPLATES: TemplatePreset[] = [
  {
    id: "qd",
    name: "Quyết định hành chính",
    desc: "Quyết định cá biệt áp dụng quy chuẩn Nghị định 30/2020/NĐ-CP",
    type: "state",
    badge: "NĐ 30 Cá biệt",
    defaultData: {
      orgHeader1: "[CƠ QUAN CẤP TRÊN]",
      orgHeader2: "[CƠ QUAN BAN HÀNH]",
      nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "QUYẾT ĐỊNH",
      referenceNumber: "Số: .../QĐ-[TÊN CƠ QUAN]",
      subject: "V/v [Trích yếu nội dung quyết định]",
      bodyHtml: `
        <p><strong><em>Căn cứ [Tên Luật/Văn bản quy định chức năng, nhiệm vụ của cơ quan ban hành];</em></strong></p>
        <p><strong><em>Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;</em></strong></p>
        <p><strong><em>Theo đề nghị của [Thủ trưởng đơn vị tham mưu];</em></strong></p>
        <p style="text-align: center;"><strong>QUYẾT ĐỊNH:</strong></p>
        <p><strong>Điều 1.</strong> [Nội dung quyết định ban hành/phê duyệt quy định, nhiệm vụ hoặc nhân sự...].</p>
        <p><strong>Điều 2.</strong> Quyết định này có hiệu lực thi hành kể từ ngày ký. Các phòng, ban chuyên môn và các đơn vị trực thuộc chịu trách nhiệm thi hành Quyết định này.</p>
        <p><strong>Điều 3.</strong> [Chức danh người chịu trách nhiệm thi hành] và các cơ quan, đơn vị, cá nhân có liên quan chịu trách nhiệm thi hành Quyết định này./.</p>
      `,
      signTitle: "TM. [CƠ QUAN BAN HÀNH]\n[CHỨC VỤ NGƯỜI KÝ]",
      signName: "[Họ và tên người ký]",
      recipients: "Như Điều 3;\nLãnh đạo cơ quan (để b/c);\nLưu: VT, [Đơn vị soạn thảo]."
    }
  },
  {
    id: "cv",
    name: "Công văn hành chính",
    desc: "Công văn thông thường gửi cơ quan, tổ chức hoặc cá nhân",
    type: "state",
    badge: "NĐ 30 Phổ biến",
    defaultData: {
      orgHeader1: "[CƠ QUAN CẤP TRÊN]",
      orgHeader2: "[CƠ QUAN BAN HÀNH]",
      nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "CÔNG VĂN",
      referenceNumber: "Số: .../[TÊN CƠ QUAN]",
      subject: "V/v [Trích yếu nội dung công văn]",
      bodyHtml: `
        <p style="text-align: center;"><strong>Kính gửi:</strong> [Tên cơ quan, tổ chức hoặc cá nhân nhận công văn]</p>
        <p>Thực hiện [Tên văn bản/nhiệm vụ được giao], [Tên cơ quan ban hành] đề nghị quý cơ quan, đơn vị phối hợp triển khai các nội dung sau:</p>
        <p>1. Tổ chức rà soát, kiểm tra các nội dung chuyên môn thuộc phạm vi quản lý.</p>
        <p>2. Lập danh mục các công việc cần triển khai và phân công đơn vị đầu mối thực hiện.</p>
        <p>3. Báo cáo kết quả về [Tên cơ quan ban hành] trước ngày ... tháng ... năm ... để tổng hợp.</p>
        <p>Rất mong nhận được sự phối hợp chặt chẽ của quý cơ quan, đơn vị./.</p>
      `,
      signTitle: "KT. [CHỨC VỤ]\n[PHÓ CHỨC VỤ]",
      signName: "[Họ và tên người ký]",
      recipients: "Như kính gửi;\nLãnh đạo cơ quan (để b/c);\nLưu: VT, [Viết tắt đơn vị]."
    }
  },
  {
    id: "bc",
    name: "Báo cáo công tác",
    desc: "Báo cáo định kỳ tháng, quý, năm hoặc báo cáo chuyên đề",
    type: "state",
    badge: "NĐ 30 Báo cáo",
    defaultData: {
      orgHeader1: "[CƠ QUAN CẤP TRÊN]",
      orgHeader2: "[CƠ QUAN BAN HÀNH]",
      nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "BÁO CÁO",
      referenceNumber: "Số: .../BC-[TÊN CƠ QUAN]",
      subject: "Báo cáo [Nội dung tình hình thực hiện nhiệm vụ...]",
      bodyHtml: `
        <p style="text-align: center;"><strong>Kính gửi:</strong> [Tên cơ quan cấp trên/cơ quan nhận báo cáo]</p>
        <p>Thực hiện kế hoạch công tác năm [Năm], [Tên cơ quan ban hành] báo cáo kết quả triển khai như sau:</p>
        <p><strong>I. TÌNH HÌNH TRIỂN KHAI VÀ KẾT QUẢ ĐẠT ĐƯỢC</strong></p>
        <p>1. Công tác chỉ đạo, điều hành: Đã tham mưu ban hành đầy đủ các văn bản hướng dẫn và tổ chức triển khai đúng tiến độ.</p>
        <p>2. Kết quả thực hiện nhiệm vụ chuyên môn: Các hồ sơ công việc được tiếp nhận, xử lý, tỷ lệ giải quyết đúng hạn đạt [Số liệu % kết quả thực tế].</p>
        <p>3. Ứng dụng công nghệ thông tin: Thực hiện ký số văn bản và chuẩn hóa thể thức theo Nghị định 30/2020/NĐ-CP.</p>
        <p><strong>II. NHIỆM VỤ TRỌNG TÂM KỲ TIẾP THEO</strong></p>
        <p>Tiếp tục đôn đốc các bộ phận chuyên môn nâng cao chất lượng công tác chuyên môn và lưu trữ tài liệu.</p>
      `,
      signTitle: "[CHỨC VỤ NGƯỜI KÝ]",
      signName: "[Họ và tên người ký]",
      recipients: "Như kính gửi;\nLãnh đạo cơ quan (để b/c);\nLưu: VT."
    }
  },
  {
    id: "kh",
    name: "Kế hoạch công tác",
    desc: "Kế hoạch triển khai nhiệm vụ, đề án hoặc tổ chức sự kiện",
    type: "state",
    badge: "NĐ 30 Kế hoạch",
    defaultData: {
      orgHeader1: "[CƠ QUAN CẤP TRÊN]",
      orgHeader2: "[CƠ QUAN BAN HÀNH]",
      nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "KẾ HOẠCH",
      referenceNumber: "Số: .../KH-[TÊN CƠ QUAN]",
      subject: "Kế hoạch [Nội dung triển khai nhiệm vụ/đề án...]",
      bodyHtml: `
        <p><strong><em>Căn cứ [Tên văn bản/quyết định giao nhiệm vụ của cấp có thẩm quyền];</em></strong></p>
        <p>[Tên cơ quan ban hành] ban hành Kế hoạch triển khai nhiệm vụ với các nội dung trọng tâm như sau:</p>
        <p><strong>I. MỤC ĐÍCH, YÊU CẦU</strong></p>
        <p>1. Đảm bảo các nhiệm vụ được triển khai đồng bộ, đúng tiến độ và đúng quy định pháp luật.</p>
        <p>2. Phân công rõ trách nhiệm của từng bộ phận, cá nhân trong tổ chức thực hiện.</p>
        <p><strong>II. NỘI DUNG VÀ TIẾN ĐỘ THỰC HIỆN</strong></p>
        <p>1. [Nội dung công việc 1] (Thời gian hoàn thành: [Thời gian]).</p>
        <p>2. [Nội dung công việc 2] (Thời gian hoàn thành: [Thời gian]).</p>
      `,
      signTitle: "[CHỨC VỤ NGƯỜI KÝ]",
      signName: "[Họ và tên người ký]",
      recipients: "[Cơ quan cấp trên] (để b/c);\nCác đơn vị phối hợp;\nLưu: VT."
    }
  },
  {
    id: "tt",
    name: "Tờ trình phê duyệt",
    desc: "Tờ trình cấp có thẩm quyền phê duyệt chủ trương, đề án, ngân sách",
    type: "state",
    badge: "NĐ 30 Tờ trình",
    defaultData: {
      orgHeader1: "[CƠ QUAN CẤP TRÊN]",
      orgHeader2: "[CƠ QUAN BAN HÀNH]",
      nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "TỜ TRÌNH",
      referenceNumber: "Số: .../TTr-[TÊN CƠ QUAN]",
      subject: "V/v phê duyệt [Nội dung chủ trương/đề án/dự toán...]",
      bodyHtml: `
        <p style="text-align: center;"><strong>Kính gửi:</strong> [Tên cơ quan/Cấp có thẩm quyền phê duyệt]</p>
        <p><strong><em>Căn cứ [Tên căn cứ pháp lý quy định thẩm quyền phê duyệt];</em></strong></p>
        <p><strong><em>Căn cứ [Tên văn bản/quy định chuyên ngành liên quan];</em></strong></p>
        <p>[Tên cơ quan ban hành] kính trình [Tên cấp có thẩm quyền] xem xét, phê duyệt [Nội dung chủ trương/đề án] với các nội dung chi tiết kèm theo.</p>
        <p>Kính trình [Tên cấp có thẩm quyền] xem xét, quyết định./.</p>
      `,
      signTitle: "[CHỨC VỤ NGƯỜI KÝ]",
      signName: "[Họ và tên người ký]",
      recipients: "Như kính gửi;\nLãnh đạo cơ quan (để b/c);\nLưu: VT."
    }
  },
  {
    id: "tb",
    name: "Thông báo kết luận",
    desc: "Thông báo ý kiến chỉ đạo, kết luận cuộc họp của lãnh đạo",
    type: "state",
    badge: "NĐ 30 Thông báo",
    defaultData: {
      orgHeader1: "[CƠ QUAN CẤP TRÊN]",
      orgHeader2: "[CƠ QUAN BAN HÀNH]",
      nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "THÔNG BÁO",
      referenceNumber: "Số: .../TB-[TÊN CƠ QUAN]",
      subject: "Ý kiến kết luận của [Chức danh người chủ trì] tại cuộc họp [Nội dung cuộc họp]",
      bodyHtml: `
        <p>Ngày ... tháng ... năm ..., tại [Địa điểm], đồng chí [Họ tên và chức danh] đã chủ trì cuộc họp [Tên cuộc họp]. Sau khi nghe báo cáo và ý kiến thảo luận của các đại biểu, đồng chí [Chức danh] kết luận như sau:</p>
        <p>1. Đánh giá chung về kết quả triển khai công việc trong thời gian qua.</p>
        <p>2. Yêu cầu các bộ phận, đơn vị khẩn trương triển khai các nhiệm vụ trọng tâm được giao.</p>
        <p>[Tên cơ quan ban hành] thông báo để các đơn vị, cá nhân biết và thực hiện./.</p>
      `,
      signTitle: "[CHỨC VỤ NGƯỜI KÝ]",
      signName: "[Họ và tên người ký]",
      recipients: "Lãnh đạo cơ quan (để b/c);\nCác đơn vị trực thuộc;\nLưu: VT."
    }
  },
  {
    id: "nq_dang",
    name: "Nghị quyết của Đảng",
    desc: "Văn bản Đảng ban hành chuẩn theo Hướng dẫn số 05-HD/VPTW",
    type: "party",
    badge: "HD 05 Đảng",
    defaultData: {
      orgHeader1: "[CẤP ỦY CẤP TRÊN]",
      orgHeader2: "[CẤP ỦY BAN HÀNH]",
      nationalHeader1: "ĐẢNG CỘNG SẢN VIỆT NAM",
      nationalHeader2: "",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "NGHỊ QUYẾT",
      referenceNumber: "Số: ...-NQ/[TÊN CẤP ỦY]",
      subject: "Nghị quyết [Tên cuộc họp/Hội nghị] về [Nội dung trọng tâm]",
      bodyHtml: `
        <p><strong><em>Căn cứ Điều lệ Đảng Cộng sản Việt Nam;</em></strong></p>
        <p><strong><em>Căn cứ Quy chế làm việc của [Tên cấp ủy ban hành];</em></strong></p>
        <p style="text-align: center;"><strong>[TÊN CẤP ỦY] NGHỊ QUYẾT:</strong></p>
        <p><strong>1. Đánh giá tình hình:</strong> [Nội dung đánh giá tình hình thực hiện nhiệm vụ chính trị, xây dựng Đảng...].</p>
        <p><strong>2. Mục tiêu, nhiệm vụ trọng tâm:</strong> [Mục tiêu và các nhiệm vụ chủ yếu kỳ tới...].</p>
        <p><strong>3. Tổ chức thực hiện:</strong> Các cấp ủy, tổ chức đảng trực thuộc chịu trách nhiệm quán triệt và xây dựng chương trình hành động thực hiện nghiêm túc Nghị quyết này./.</p>
      `,
      signTitle: "T/M [CẤP ỦY BAN HÀNH]\n[BÍ THƯ / PHÓ BÍ THƯ]",
      signName: "[Họ và tên người ký]",
      recipients: "Các chi bộ, đảng bộ trực thuộc;\nCác ban của cấp ủy;\nLưu: Văn phòng."
    }
  },
  {
    id: "ct_dang",
    name: "Chỉ thị của Đảng",
    desc: "Chỉ thị của Ban Thường vụ / Cấp ủy Đảng theo Hướng dẫn số 05-HD/VPTW",
    type: "party",
    badge: "HD 05 Đảng",
    defaultData: {
      orgHeader1: "[CẤP ỦY CẤP TRÊN]",
      orgHeader2: "BAN THƯỜNG VỤ",
      nationalHeader1: "ĐẢNG CỘNG SẢN VIỆT NAM",
      nationalHeader2: "",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "CHỈ THỊ",
      referenceNumber: "Số: ...-CT/[TÊN CẤP ỦY]",
      subject: "Về [Nội dung chỉ đạo trọng tâm của cấp ủy]",
      bodyHtml: `
        <p>Để [Mục đích của Chỉ thị], Ban Thường vụ [Tên cấp ủy] yêu cầu các cấp ủy, tổ chức đảng triển khai các nhiệm vụ trọng tâm sau:</p>
        <p>1. Tăng cường công tác giáo dục chính trị tư tưởng, siết chặt kỷ luật, kỷ cương trong toàn hệ thống.</p>
        <p>2. Phát huy vai trò tiên phong, gương mẫu của người đứng đầu cấp ủy, cơ quan, đơn vị.</p>
        <p>3. Các ban của cấp ủy tăng cường kiểm tra, giám sát việc thực hiện Chỉ thị này./.</p>
      `,
      signTitle: "T/M BAN THƯỜNG VỤ\n[BÍ THƯ / PHÓ BÍ THƯ]",
      signName: "[Họ và tên người ký]",
      recipients: "Các cấp ủy trực thuộc;\nCác ban cán sự đảng, đảng đoàn;\nLưu: Văn phòng."
    }
  },
  {
    id: "hd_dang",
    name: "Hướng dẫn của Đảng",
    desc: "Hướng dẫn nghiệp vụ công tác Đảng theo Hướng dẫn số 05-HD/VPTW",
    type: "party",
    badge: "HD 05 Đảng",
    defaultData: {
      orgHeader1: "[CẤP ỦY CẤP TRÊN]",
      orgHeader2: "[BAN CHUYÊN MÔN CỦA ĐẢNG]",
      nationalHeader1: "ĐẢNG CỘNG SẢN VIỆT NAM",
      nationalHeader2: "",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "HƯỚNG DẪN",
      referenceNumber: "Số: ...-HD/[TÊN BAN]",
      subject: "Hướng dẫn một số nội dung về [Nội dung nghiệp vụ công tác Đảng]",
      bodyHtml: `
        <p><strong><em>Căn cứ [Tên quy định/quyết định của Trung ương hoặc cấp ủy liên quan];</em></strong></p>
        <p>[Tên ban chuyên môn] hướng dẫn cụ thể một số nội dung sau:</p>
        <p>1. Đối tượng và phạm vi áp dụng.</p>
        <p>2. Quy trình các bước thực hiện nghiệp vụ.</p>
        <p>3. Hồ sơ và chế độ báo cáo gửi về [Tên ban chuyên môn] theo quy định./.</p>
      `,
      signTitle: "TRƯỞNG BAN",
      signName: "[Họ và tên người ký]",
      recipients: "Các cấp ủy trực thuộc;\nLưu: [Tên ban chuyên môn]."
    }
  },
  {
    id: "blank",
    name: "Văn bản mới (Trang trắng)",
    desc: "Bắt đầu soạn thảo tự do với khung cấu trúc văn bản hành chính chuẩn NĐ 30",
    type: "state",
    badge: "Tùy biến",
    defaultData: {
      orgHeader1: "",
      orgHeader2: "[TÊN CƠ QUAN BAN HÀNH]",
      nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
      locationAndDate: "[Địa danh], ngày ... tháng ... năm ...",
      documentType: "VĂN BẢN HÀNH CHÍNH",
      referenceNumber: "Số: .../...",
      subject: "V/v [Trích yếu nội dung văn bản]",
      bodyHtml: `
        <p>Soạn thảo nội dung văn bản hành chính chi tiết tại đây. Bạn có thể sử dụng các nút công cụ phía trên để chèn Căn cứ pháp lý, Điều khoản, Bảng biểu và Khối chữ ký chuẩn Nghị định 30/2020/NĐ-CP.</p>
      `,
      signTitle: "TM. [CƠ QUAN BAN HÀNH]\n[CHỨC VỤ]",
      signName: "[Họ và tên người ký]",
      recipients: "Như trên;\nLưu: VT."
    }
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"upload" | "editor" | "preview" | "history">("upload");
  const [standardType, setStandardType] = useState<"state" | "party">("state");
  const [rawText, setRawText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedHtml, setUploadedHtml] = useState("");
  const [uploadedFileType, setUploadedFileType] = useState<"docx" | "txt" | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  
  // Loading flags
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [editorMode, setEditorMode] = useState<"rich" | "raw">("rich");
  
  // Notification messages
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Structured Import state
  const [structuredImport, setStructuredImport] = useState<StructuredImport | null>(null);
  const [importReviewAccepted, setImportReviewAccepted] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<TemplatePreset | null>(null);

  // Compliance Inspection Modal state
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [complianceReport, setComplianceReport] = useState<ND30ComplianceReport | null>(null);

  // AI Proposal Review Modal state (User Confirmation Gate)
  const [aiProposal, setAiProposal] = useState<DocumentState | null>(null);
  const [aiProposalMeta, setAiProposalMeta] = useState<{
    source: "gemini_ai" | "rule_fallback";
    isFallback: boolean;
    notice?: string;
  } | null>(null);

  // AI Refine Review Modal state (User Confirmation Gate for text polishing)
  const [refineProposal, setRefineProposal] = useState<{
    action: "proofread" | "formalize";
    originalHtml: string;
    refinedHtml: string;
    label: string;
    source: "gemini_ai" | "rule_fallback";
    isFallback: boolean;
    notice?: string;
  } | null>(null);

  // Primary document state (Initial default is Template QD)
  const [doc, setDoc] = useState<DocumentState>(applyCompanyProfile(TEMPLATES[0].defaultData));

  // Version History state
  const [versions, setVersions] = useState<Version[]>([
    {
      id: "v_init",
      timestamp: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
      title: "Khởi tạo mặc định (Quyết định NĐ 30)",
      data: applyCompanyProfile(TEMPLATES[0].defaultData),
      standardType: "state",
    }
  ]);

  const previewRef = useRef<HTMLDivElement>(null);

  // Run compliance check whenever doc or standardType changes
  useEffect(() => {
    const report = validateND30Compliance(
      {
        ...doc,
        regime: standardType === "party" ? "party" : "administrative",
        nationalHeader2: doc.nationalHeader2,
        fontFamily: "Times New Roman",
        fontSize: standardType === "party" ? 14 : 13
      },
      standardType === "party" ? "party" : "administrative"
    );
    setComplianceReport(report);
  }, [doc, standardType]);

  const pushVersion = (title: string, newDoc: DocumentState, versionStandardType: "state" | "party" = standardType) => {
    const newV: Version = {
      id: "v_" + crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString("vi-VN") + " " + new Date().toLocaleDateString("vi-VN"),
      title,
      data: { ...newDoc },
      standardType: versionStandardType,
    };
    setVersions(prev => [newV, ...prev]);
  };

  const handleFieldChange = (field: keyof DocumentState, value: string) => {
    // Company identity is locked only for NEW templates. Imported documents stay untouched.
    if (standardType === "state" && doc.headerProfile === COMPANY_HEADER_PROFILE_ID && LOCKED_COMPANY_FIELDS.has(field)) return;
    setDoc(prev => ({ ...prev, [field]: value }));
  };

  const handleHeaderProfileChange = (profile: "generic" | typeof COMPANY_HEADER_PROFILE_ID) => {
    if (profile === COMPANY_HEADER_PROFILE_ID && doc.headerProfile !== COMPANY_HEADER_PROFILE_ID) {
      pushVersion("Trước khi áp dụng profile công ty", doc);
    }
    const updated = profile === COMPANY_HEADER_PROFILE_ID
      ? applyCompanyProfile(doc)
      : { ...doc, headerProfile: "generic" as const };
    setDoc(updated);
    pushVersion(profile === COMPANY_HEADER_PROFILE_ID
      ? "Áp dụng profile phần đầu Công ty Hoa tiêu Hàng hải miền Bắc"
      : "Chuyển phần đầu sang tùy chỉnh", updated);
    setSuccessMsg(profile === COMPANY_HEADER_PROFILE_ID
      ? "Đã áp dụng phần đầu công ty. Nội dung, số ký hiệu và ngày ban hành được giữ nguyên."
      : "Đã chuyển sang phần đầu tùy chỉnh; bạn có thể sửa thông tin cơ quan.");
  };

  // Option A: Select template & immediately enter editor (P0-01)
  const applyTemplate = (t: TemplatePreset) => {
    if (JSON.stringify(doc) !== JSON.stringify(versions[0]?.data)) {
      pushVersion("Bản soạn trước khi đổi mẫu", doc);
    }
    setStandardType(t.type);
    const selectedDoc = t.type === "state" ? applyCompanyProfile({...t.defaultData}) : {...t.defaultData, headerProfile: "generic" as const};
    setDoc(selectedDoc);
    pushVersion(`Áp dụng mẫu: ${t.name}`, selectedDoc, t.type);
    setSuccessMsg(`Đã tải mẫu "${t.name}". Bạn có thể bắt đầu soạn thảo và chỉnh sửa ngay!`);
    setActiveTab("editor");
    setPendingTemplate(null);
  };

  const selectTemplate = (tId: string) => {
    const t = TEMPLATES.find(x => x.id === tId);
    if (!t) return;
    if (JSON.stringify(doc) !== JSON.stringify(versions[0]?.data)) {
      setPendingTemplate(t);
      return;
    }
    applyTemplate(t);
  };

  // Option B: parse the selected file locally so import works in previews without an API route.
  const uploadRequestIdRef = useRef<number>(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileInput = e.currentTarget;

    const requestId = ++uploadRequestIdRef.current;

    setIsUploading(true);
    setErrorMsg("");
    setSuccessMsg("");
    // Do NOT set uploadedFileName yet - wait for valid response

    try {
      const parsed = await parseLocalFile(file);

      // Ignore a slower parse if a newer file was selected.
      if (requestId !== uploadRequestIdRef.current) {
        return;
      }

      // ATOMIC STATE UPDATE: all import state changes happen together only after validation
      setRawText(parsed.text);
      setUploadedHtml(DOMPurify.sanitize(parsed.html));
      setStructuredImport(parsed.structured);
      setImportReviewAccepted(false);
      setUploadedFileName(parsed.filename); // Set filename only after successful parse
      setUploadedFileType(parsed.fileType); // Set fileType from validated response

      const appCount = parsed.structured?.appendices?.length || 0;
      const blockCount = parsed.blockCount;
      setSuccessMsg(`Đã đọc thành công tệp "${parsed.filename}" (${parsed.text.length} ký tự, ${blockCount} khối, ${appCount} phụ lục). Bạn có thể kiểm tra phân vùng hoặc đưa trực tiếp vào Editor.`);
    } catch (err: any) {
      // Ignore stale responses
      if (requestId !== uploadRequestIdRef.current) {
        return;
      }

      // Nothing from this failed upload has entered document state.
      const errorMessage = err.message || "Không thể đọc tệp tin đã tải lên.";
      setErrorMsg(errorMessage);
    } finally {
      if (requestId === uploadRequestIdRef.current) {
        setIsUploading(false);
        fileInput.value = "";
      }
    }
  };

  const safeTextToHtml = (text: string): string => {
    if (!text) return "<p></p>";
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    const paragraphs = escaped
      .split(/\r?\n\r?\n+/)
      .map(p => `<p>${p.replace(/\r?\n/g, "<br/>")}</p>`)
      .join("");
    return DOMPurify.sanitize(paragraphs || "<p></p>");
  };

  // Direct import to editor using structural segmentation (P0-01, P0-02, P0-B, P0-C)
  const handleDirectImportToEditor = () => {
    if (structuredImport && !importReviewAccepted) {
      setErrorMsg("Vui lòng kiểm tra và xác nhận các phần đã trích xuất trước khi soạn thảo.");
      return;
    }
    if (!uploadedHtml && !rawText && !structuredImport) {
      setErrorMsg("Chưa có nội dung tệp tin để đưa vào trình soạn thảo.");
      return;
    }

    if (structuredImport) {
      const fields = structuredImport.fields;
      const detectedType = fields.documentType?.value || "";

      const newDoc: DocumentState = {
        headerProfile: "generic",
        orgHeader1: fields.orgHeader1?.value || "",
        orgHeader2: fields.orgHeader2?.value || "",
        nationalHeader1: fields.nationalHeader1?.value || (standardType === "party" ? "ĐẢNG CỘNG SẢN VIỆT NAM" : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"),
        nationalHeader2: fields.nationalHeader2?.value ?? (standardType === "party" ? "" : "Độc lập - Tự do - Hạnh phúc"),
        locationAndDate: fields.locationAndDate?.value || "",
        documentType: detectedType,
        referenceNumber: fields.referenceNumber?.value || "",
        subject: fields.subject?.value || "",
        bodyHtml: composeImportedBodyHtml(structuredImport),
        signTitle: fields.signTitle?.value || "",
        signName: fields.signName?.value || "",
        recipients: fields.recipients?.value || "",
        appendices: structuredImport.appendices || [],
        unclassified: structuredImport.unclassified || [],
        importMetadata: {
          sourceType: uploadedFileType || "docx",
          status: deriveImportStatus(structuredImport, importReviewAccepted),
          sourceFilename: uploadedFileName,
        }
      };
      setDoc(newDoc);
      pushVersion(`Nhập phân vùng từ tệp ${uploadedFileName || "văn bản"}`, newDoc);
      setSuccessMsg(`Đã đưa tài liệu${detectedType ? ` (${detectedType})` : ""} vào trình soạn thảo. ${newDoc.importMetadata?.status === "needs_review" ? "Còn phần chưa phân loại hoặc cần đối chiếu với bản gốc trước khi xuất." : "Đã xác nhận các phần trích xuất."}`);
      setActiveTab("editor");
      return;
    }

    const cleanHtml = uploadedHtml ? DOMPurify.sanitize(uploadedHtml) : safeTextToHtml(rawText);
    const textForTypeCheck = rawText || cleanHtml.replace(/<[^>]+>/g, " ");
    const detectedType = detectDocumentType(textForTypeCheck, standardType);

    const newDoc: DocumentState = {
      orgHeader1: "",
      orgHeader2: "",
      nationalHeader1: standardType === "party" ? "ĐẢNG CỘNG SẢN VIỆT NAM" : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: standardType === "party" ? "" : "Độc lập - Tự do - Hạnh phúc",
      locationAndDate: "",
      documentType: detectedType,
      referenceNumber: "",
      subject: uploadedFileName ? `Trích xuất từ tệp ${uploadedFileName}` : "",
      bodyHtml: cleanHtml,
      signTitle: "",
      signName: "",
      recipients: "",
      appendices: [],
      unclassified: [],
    };
    setDoc(newDoc);
    pushVersion(`Nhập trực tiếp từ tệp ${uploadedFileName || "văn bản"}`, newDoc);
    setSuccessMsg(`Đã đưa nguyên văn tài liệu hoàn chỉnh (${detectedType}) vào trình soạn thảo thành công!`);
    setActiveTab("editor");
  };

  // Direct raw text import to editor without AI (P0-01)
  const handleRawTextToEditor = () => {
    if (structuredImport && uploadedFileName) {
      setErrorMsg("Tệp đã được phân vùng. Vui lòng kiểm tra các vùng trích xuất và dùng nút nhập tệp ở phía trên.");
      return;
    }
    if (!rawText.trim()) {
      setErrorMsg("Vui lòng dán hoặc nhập nội dung văn bản trước.");
      return;
    }
    const cleanHtml = safeTextToHtml(rawText);
    const detectedType = detectDocumentType(rawText, standardType);

    const newDoc: DocumentState = {
      orgHeader1: "",
      orgHeader2: "",
      nationalHeader1: standardType === "party" ? "ĐẢNG CỘNG SẢN VIỆT NAM" : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: standardType === "party" ? "" : "Độc lập - Tự do - Hạnh phúc",
      locationAndDate: "",
      documentType: detectedType,
      referenceNumber: "",
      subject: "",
      bodyHtml: cleanHtml,
      signTitle: "",
      signName: "",
      recipients: ""
    };
    setDoc(newDoc);
    pushVersion("Nhập nội dung dán thủ công", newDoc);
    setSuccessMsg("Đã đưa nội dung vào trình soạn thảo thành công!");
    setActiveTab("editor");
  };

  // Optional AI Structuring & Formatting (P0-04: AI is optional, confirms before overwrite)
  const handleAiFormat = async () => {
    if (structuredImport && uploadedFileName) {
      setErrorMsg("Hãy kiểm tra và nhập các phần của tệp vào Soạn thảo trước. Sau đó có thể dùng AI tinh chỉnh nội dung; AI sẽ không được thay cấu trúc tệp đã tải lên.");
      return;
    }
    if (!rawText.trim()) {
      setErrorMsg("Vui lòng tải lên tệp tin hoặc dán nội dung văn bản thô để AI xử lý.");
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
          rawHtml: uploadedHtml,
          standardType,
          customInstructions
        })
      });
      const data = await res.json();
      if (data.success && data.formatted) {
        const f = data.formatted;
        const candidate: DocumentState = {
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
        // Open review modal so user explicitly approves AI changes (P0-04)
        setAiProposal(candidate);
        setAiProposalMeta({
          source: data.source || (data.isFallback ? "rule_fallback" : "gemini_ai"),
          isFallback: Boolean(data.isFallback),
          notice: data.notice
        });
      } else {
        setErrorMsg(data.error || "AI tạm thời không khả dụng. Bạn có thể tự soạn thảo và áp dụng mẫu chuẩn NĐ 30.");
      }
    } catch (err: any) {
      setErrorMsg("AI tạm thời không khả dụng (" + err.message + "). Bạn vẫn có thể soạn thảo và xuất Word bình thường.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // User accepts AI proposed structure
  const acceptAiProposal = () => {
    if (!aiProposal) return;
    const sourceLabel = aiProposalMeta?.isFallback ? "Quy tắc dự phòng" : "AI Gemini";
    pushVersion(`Đồng ý áp dụng đề xuất (${sourceLabel} - ${standardType === 'party' ? 'HD 05' : 'NĐ 30'})`, aiProposal);
    setDoc(doc.headerProfile === COMPANY_HEADER_PROFILE_ID && standardType === "state"
      ? applyCompanyProfile({ ...aiProposal, headerProfile: COMPANY_HEADER_PROFILE_ID }) : aiProposal);
    setAiProposal(null);
    setAiProposalMeta(null);
    setSuccessMsg(`Đã áp dụng thành công cấu trúc thể thức (${sourceLabel}) vào tài liệu!`);
    setActiveTab("editor");
  };

  // AI Refine text (Proofreading / Formalizing) - Opens Review Modal with Before/After Diff
  const handleAiRefine = async (action: "proofread" | "formalize") => {
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
        const actionLabel = action === 'proofread' ? 'Sửa lỗi chính tả & câu từ' : 'Nâng cấp văn phong hành chính';
        setRefineProposal({
          action,
          originalHtml: doc.bodyHtml,
          refinedHtml: data.refined,
          label: actionLabel,
          source: data.source || (data.isFallback ? "rule_fallback" : "gemini_ai"),
          isFallback: Boolean(data.isFallback),
          notice: data.notice
        });
      } else {
        setErrorMsg(data.error || "Lỗi xử lý tinh chỉnh văn bản.");
      }
    } catch (err: any) {
      setErrorMsg("Không thể kết nối AI tinh chỉnh: " + err.message);
    } finally {
      setIsRefining(false);
    }
  };

  const acceptRefineProposal = () => {
    if (!refineProposal) return;
    const updated = { ...doc, bodyHtml: refineProposal.refinedHtml };
    setDoc(updated);
    pushVersion(`AI: ${refineProposal.label}`, updated);
    setSuccessMsg(`Đã phê duyệt và áp dụng: ${refineProposal.label}!`);
    setRefineProposal(null);
  };

  const rejectRefineProposal = () => {
    setRefineProposal(null);
    setSuccessMsg("Đã hủy bỏ đề xuất chỉnh sửa văn bản.");
  };

  // Export to standard Microsoft Word (.docx) adhering to Decree 30 (P0-06)
  const exportToDocx = async () => {
    setIsExportingDocx(true);
    setErrorMsg("");
    try {
      const isParty = standardType === "party";
      const exportDoc = !isParty && doc.headerProfile === COMPANY_HEADER_PROFILE_ID ? applyCompanyProfile(doc) : doc;
      const documentData: DocumentFormatType = {
        regime: isParty ? "party" : "administrative",
        headerProfile: isParty ? "generic" : (exportDoc.headerProfile || "generic"),
        nationalHeader1: isParty ? "ĐẢNG CỘNG SẢN VIỆT NAM" : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
        nationalHeader2: (isParty ? "" : "Độc lập - Tự do - Hạnh phúc") as "" | "Độc lập - Tự do - Hạnh phúc",
        fontFamily: "Times New Roman",
        fontSize: isParty ? 14 : 13,
        orgHeader1: exportDoc.orgHeader1,
        orgHeader2: exportDoc.orgHeader2,
        locationAndDate: exportDoc.locationAndDate,
        documentType: exportDoc.documentType,
        referenceNumber: exportDoc.referenceNumber,
        subject: exportDoc.subject,
        bodyHtml: exportDoc.bodyHtml,
        signTitle: exportDoc.signTitle,
        signName: exportDoc.signName,
        recipients: exportDoc.recipients,
        appendices: exportDoc.appendices || [],
        unclassified: exportDoc.unclassified || [],
      };

      const isDraft = isPlaceholderValue(doc.orgHeader2) || 
                      isPlaceholderValue(doc.referenceNumber) || 
                      isPlaceholderValue(doc.signName) || 
                      doc.locationAndDate.includes("...") ||
                      !doc.orgHeader2 ||
                      doc.importMetadata?.status === "needs_review" ||
                      Boolean(doc.unclassified?.length) ||
                      Boolean(doc.appendices?.some(appendix => appendix.extractionStatus === "needs_review"));

      await generateAndDownloadDocx(documentData);
      
      if (isDraft) {
        setSuccessMsg("Đã xuất bản nháp Word (.docx). Lưu ý: Văn bản còn các trường chưa hoàn thiện hoặc chưa được xác minh cấu trúc. Tệp xuất là bản nháp, cần kiểm tra trước khi phát hành.");
      } else {
        setSuccessMsg("Đã tạo DOCX theo cấu hình; vui lòng kiểm tra OOXML và trình bày Word trước khi phát hành.");
      }
    } catch (err: any) {
      setErrorMsg("Lỗi khi xuất tệp Word: " + err.message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Export to multi-page PDF with A4 standards
  const exportToPdf = async () => {
    if (!previewRef.current) return;
    setIsExportingPdf(true);
    setErrorMsg("");
    setSuccessMsg("Đang kết xuất tệp PDF định dạng chuẩn A4...");

    try {
      const element = previewRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2.0, 
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

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 5) {
        position = position - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const cleanDocType = (doc.documentType || "Van_Ban").replace(/\s+/g, "_");
      pdf.save(`${cleanDocType}_ChuanND30.pdf`);
      setSuccessMsg("Xuất tệp PDF chuẩn A4 thành công!");
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
    setStandardType(v.standardType);
    setSuccessMsg(`Đã khôi phục thành công phiên bản: "${v.title}" (${v.timestamp})`);
    setActiveTab("editor");
  };

  // Quick fix helper from Compliance Inspector - strictly adheres to deterministic corrections, never fabricates fake data
  const applyQuickFix = (issue: any) => {
    if (issue.field === "orgHeader2" && issue.suggestion) {
      setDoc(prev => ({ ...prev, orgHeader2: issue.suggestion }));
    } else if (issue.field === "nationalHeader1" && issue.suggestion) {
      setDoc(prev => ({ ...prev, nationalHeader1: issue.suggestion }));
    } else if (issue.field === "nationalHeader2" && typeof issue.suggestion === "string") {
      setDoc(prev => ({ ...prev, nationalHeader2: issue.suggestion }));
    } else if (issue.field === "referenceNumber" && issue.suggestion) {
      setDoc(prev => ({ ...prev, referenceNumber: issue.suggestion }));
    } else {
      setActiveTab("editor");
      setSuccessMsg(`Vui lòng chỉnh sửa trực tiếp thông tin vào trình soạn thảo cho mục: ${issue.title}`);
      return;
    }
    setSuccessMsg(`Đã áp dụng sửa nhanh cho: ${issue.title}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Application Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between shadow-2xs sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-600/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
              DocForm 30 
              <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                NĐ 30/2020 & HD 05
              </span>
            </h1>
            <p className="text-xs text-slate-500 hidden md:block">
              Chuẩn hóa thể thức văn bản hành chính Việt Nam & Xuất Microsoft Word
            </p>
          </div>
        </div>

        {/* Workflow Navigation Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 my-2 sm:my-0">
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "upload" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> 1. Khởi tạo & Mẫu
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "editor" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> 2. Soạn thảo
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "preview" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> 3. Xem trước
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "history" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <History className="w-3.5 h-3.5" /> Lịch sử ({versions.length})
          </button>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center space-x-2">
          {/* Compliance Inspector Trigger */}
          <button
            onClick={() => setShowComplianceModal(true)}
            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
            title={standardType === "party" ? "Kiểm tra thể thức theo Hướng dẫn 05-HD/VPTW" : "Kiểm tra thể thức theo Nghị định 30/2020/NĐ-CP"}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>Thể thức: </span>
            <span className="font-bold text-amber-900">
              {complianceReport ? `${complianceReport.score}%` : "Kiểm tra"}
            </span>
          </button>

          {/* Export to Word */}
          <button
            onClick={exportToDocx}
            disabled={isExportingDocx}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            title={standardType === "party" ? "Tải tệp Word theo Hướng dẫn 05-HD/VPTW" : "Tải tệp Word theo Nghị định 30/2020/NĐ-CP"}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExportingDocx ? "Đang tạo..." : "Xuất Word (.docx)"}</span>
          </button>

          {/* Export to PDF */}
          <button
            onClick={exportToPdf}
            disabled={isExportingPdf}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 hidden sm:flex"
            title="Xuất file PDF chuẩn A4"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isExportingPdf ? "Đang tạo..." : "Xuất PDF"}</span>
          </button>
        </div>
      </header>

      {/* Notifications Bar */}
      {(successMsg || errorMsg) && (
        <div className={`notification-bar px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b ${
          errorMsg ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
        }`}>
          <div className="flex items-center gap-2">
            {errorMsg ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            <span>{errorMsg || successMsg}</span>
          </div>
          <button 
            onClick={() => { setErrorMsg(""); setSuccessMsg(""); }} 
            className="text-xs opacity-75 hover:opacity-100 underline font-semibold ml-4"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Main Container Layout */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Work Area Tabs */}
        <div className={activeTab === "preview" ? "lg:col-span-3 space-y-6" : "lg:col-span-2 space-y-6"}>

          {/* ========================================================
              TAB 1: KHỞI TẠO & NHẬP LIỆU (P0-01)
              Ba lựa chọn rõ ràng: A. Chọn mẫu, B. Upload, C. Nhập/Dán
             ======================================================== */}
          {activeTab === "upload" && (
            <div className="space-y-6">
              
              {/* Guidance Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-950">
                <div className="flex items-center gap-2 font-semibold">
                  <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Quy trình chuẩn hóa: Chọn mẫu hoặc nhập tài liệu &rarr; Soạn thảo trực quan &rarr; Kiểm tra thể thức &rarr; Xuất file Word (.docx)</span>
                </div>
                <div className="text-[11px] text-blue-700 font-medium bg-blue-100/70 px-2 py-0.5 rounded">
                  Không bắt buộc cần API key
                </div>
              </div>

              {/* LỰA CHỌN A: SOẠN TỪ BIỂU MẪU QUY CHUẨN (P0-01) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4 text-blue-600" />
                    Lựa chọn A: Soạn nhanh từ 10 biểu mẫu quy chuẩn
                  </h2>
                  <span className="text-[11px] text-slate-500">Bấm vào mẫu để bắt đầu soạn ngay</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t.id)}
                      className="text-left p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50 hover:border-blue-400 transition group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-slate-900 text-xs group-hover:text-blue-700 flex items-center gap-1.5">
                            {t.id === "blank" ? <FilePlus className="w-3.5 h-3.5 text-blue-600" /> : <FileText className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-600" />}
                            {t.name}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            t.type === 'party' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {t.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{t.desc}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-blue-600 font-medium">
                        <span>Soạn thảo mẫu này</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* LỰA CHỌN B: TẢI TÀI LIỆU LÊN (P0-01, P0-02) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    Lựa chọn B: Tải tệp tài liệu (.docx, .txt)
                  </h2>
                  {uploadedFileName && (
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Đã chọn: {uploadedFileName}
                    </span>
                  )}
                </div>

                <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 text-center transition bg-slate-50/50 relative">
                  <input
                    type="file"
                    accept=".docx,.txt"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="bg-white p-2.5 rounded-full text-emerald-600 shadow-xs border border-slate-200">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800">
                      {isUploading ? "Đang trích xuất nội dung..." : "Nhấn để chọn file Word (.docx) hoặc kéo thả vào đây"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Hỗ trợ Microsoft Word (.docx) và tệp văn bản thuần (.txt)
                    </p>
                  </div>
                </div>

                {/* Khi đã tải file thành công, hiển thị 2 lựa chọn rõ ràng: Direct Editor vs AI Structuring */}
                {uploadedFileName && rawText && (
                  <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-emerald-900">
                      <span className="font-semibold">Nội dung đã sẵn sàng ({rawText.length} ký tự):</span>
                      <span className="text-[11px] text-emerald-700 italic">Kiểm tra trước khi soạn thảo</span>
                    </div>

                    {structuredImport && (
                      <div className="bg-white border border-emerald-200 rounded-lg p-3 space-y-3 text-xs">
                        <p className="font-semibold text-slate-900">Đối chiếu các vùng trích xuất với tệp gốc ({structuredImport.source.blockCount} khối)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {([
                            ["orgHeader1", "Cơ quan cấp trên"], ["orgHeader2", "Cơ quan ban hành"],
                            ["nationalHeader1", "Quốc hiệu / Đảng hiệu"], ["nationalHeader2", "Tiêu ngữ"],
                            ["locationAndDate", "Địa danh, ngày tháng"], ["documentType", "Loại văn bản"],
                            ["referenceNumber", "Số, ký hiệu"], ["subject", "Trích yếu"],
                            ["signTitle", "Chức vụ người ký"], ["signName", "Họ tên người ký"],
                            ["recipients", "Nơi nhận"],
                          ] as const).map(([key, label]) => {
                            const field = structuredImport.fields[key];
                            return (
                              <label key={key} className="block text-slate-700">
                                <span className="font-medium">{label}</span>
                                <span className={`ml-2 text-[10px] ${field?.status === "missing" || field?.status === "ambiguous" ? "text-amber-700" : "text-emerald-700"}`}>
                                  {field?.status === "missing" ? "Chưa tìm thấy" : field?.status === "ambiguous" ? "Cần kiểm tra" : field?.status === "user_confirmed" ? "Đã sửa" : `Trích xuất (${field?.confidence || "?"})`}
                                </span>
                                <textarea
                                  rows={key === "orgHeader1" || (field?.value || "").includes("\n") ? 2 : 1}
                                  value={field?.value || ""}
                                  onChange={(e) => {
                                    setStructuredImport(prev => prev ? updateImportField(prev, key, e.target.value) : prev);
                                    setImportReviewAccepted(false);
                                  }}
                                  className="mt-1 w-full min-h-9 resize-y border border-slate-300 rounded px-2 py-1.5 text-slate-900 whitespace-pre-wrap"
                                />
                              </label>
                            );
                          })}
                        </div>
                        <div className="border-t border-slate-200 pt-2 space-y-1 text-slate-700">
                          <p><strong>Nội dung chính:</strong> {structuredImport.body.sourceBlockIds.length} khối</p>
                          {structuredImport.signatureHtml && <p><strong>Bảng ký nhiều người:</strong> Đã giữ nguyên bảng từ tệp gốc để đưa vào trình soạn thảo và bản xuất.</p>}
                          <p className="max-h-24 overflow-auto whitespace-pre-wrap break-words bg-slate-50 p-2 rounded">{structuredImport.body.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800) || "(Trống)"}</p>
                          <p><strong>Phụ lục:</strong> {structuredImport.appendices.length}</p>
                          {structuredImport.appendices.map((appendix, index) => (
                            <p key={appendix.id} className="pl-2">{index + 1}. {appendix.title || "Chưa có tiêu đề"} · {appendix.blocks.length} khối · {appendix.extractionStatus === "needs_review" ? "Cần kiểm tra" : "Đã nhận diện"}</p>
                          ))}
                          <p className={structuredImport.unclassified.length ? "text-amber-800 font-semibold" : ""}>
                            Khối chưa phân loại: {structuredImport.unclassified.length}
                          </p>
                          {structuredImport.unclassified.map((block) => (
                            <p key={block.id} className="pl-2 whitespace-pre-wrap break-words">#{block.index + 1} ({block.kind}): {block.text.slice(0, 240) || "[Khối không có văn bản]"}</p>
                          ))}
                        </div>
                        <label className="flex items-start gap-2 text-slate-800 border-t border-slate-200 pt-2">
                          <input type="checkbox" checked={importReviewAccepted} onChange={(e) => setImportReviewAccepted(e.target.checked)} className="mt-0.5" />
                          <span>Tôi đã đối chiếu các trường, nội dung chính, phụ lục và khối chưa phân loại với tệp gốc. Các phần cần kiểm tra tiếp sẽ được giữ trong bản soạn thảo.</span>
                        </label>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {/* Nút 1: Đưa trực tiếp vào editor không dùng AI (P0-02) */}
                      <button
                        onClick={handleDirectImportToEditor}
                        disabled={Boolean(structuredImport) && !importReviewAccepted}
                        className="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 p-3 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
                      >
                        <Edit3 className="w-4 h-4 text-emerald-600" />
                        <span>Đưa các phần đã kiểm tra vào Soạn thảo</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* LỰA CHỌN C: DÁN HOẶC NHẬP NỘI DUNG TỰ DO (P0-01) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-purple-600" />
                    Lựa chọn C: Dán hoặc nhập văn bản tự do
                  </h2>
                  <span className="text-[11px] text-slate-400">{rawText.length} ký tự</span>
                </div>

                <textarea
                  rows={5}
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    setUploadedFileName("");
                    setUploadedHtml("");
                    setUploadedFileType(null);
                    setStructuredImport(null);
                    setImportReviewAccepted(false);
                  }}
                  placeholder="Dán nội dung văn bản cần biên tập vào đây..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Chuẩn thể thức áp dụng:</label>
                    <select
                      value={standardType}
                      onChange={(e: any) => {
                        const newType = e.target.value as "state" | "party";
                        setStandardType(newType);
                      }}
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
                      placeholder="VD: Căn cứ luật chuyên ngành, phân chia 4 điều..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={handleRawTextToEditor}
                      disabled={!rawText.trim() || Boolean(structuredImport && uploadedFileName)}
                    className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-xs disabled:opacity-50"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Đưa nội dung vào Soạn thảo ngay (Không dùng AI)</span>
                  </button>

                  <button
                    onClick={handleAiFormat}
                    disabled={isAiLoading || !rawText.trim() || Boolean(structuredImport && uploadedFileName)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-xs disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span>{isAiLoading ? "AI đang phân tích..." : "Chuẩn hóa thể thức bằng AI"}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 2: TRÌNH SOẠN THẢO TRỰC QUAN (P0-03)
             ======================================================== */}
          {activeTab === "editor" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              
              {/* Header Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">Biên tập chi tiết văn bản</h2>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    standardType === 'party' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {standardType === 'party' ? 'Hướng dẫn 05 Đảng' : 'Nghị định 30 Nhà nước'}
                  </span>
                </div>

                {/* Quick Utility Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const loc = extractLocation(doc.locationAndDate);
                      setDoc(prev => ({ ...prev, locationAndDate: formatStandardDate(loc || "[Địa danh]") }));
                      setSuccessMsg(loc ? `Đã cập nhật ngày hiện tại cho "${loc}" theo chuẩn NĐ 30!` : "Đã cập nhật ngày hiện tại theo chuẩn NĐ 30 (vui lòng thay thế [Địa danh] nếu cần)!");
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                    title="Chèn ngày hôm nay (giữ nguyên địa danh đã nhập hoặc để [Địa danh])"
                  >
                    <MapPin className="w-3 h-3 text-blue-600" /> Ngày hiện tại
                  </button>

                  <button
                    onClick={() => handleAiRefine("proofread")}
                    disabled={isRefining}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <Wand2 className="w-3 h-3 text-purple-600" /> {isRefining ? "Đang xử lý..." : "Sửa chính tả"}
                  </button>

                  <button
                    onClick={() => handleAiRefine("formalize")}
                    disabled={isRefining}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-600" /> Nâng cấp văn phong
                  </button>
                </div>
              </div>

              {standardType === "state" && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                  <label htmlFor="company-header-profile" className="block text-[11px] font-semibold text-slate-800 mb-1">
                    Profile phần đầu văn bản
                  </label>
                  <select
                    id="company-header-profile"
                    value={doc.headerProfile === COMPANY_HEADER_PROFILE_ID ? COMPANY_HEADER_PROFILE_ID : "generic"}
                    onChange={(e) => handleHeaderProfileChange(e.target.value as "generic" | typeof COMPANY_HEADER_PROFILE_ID)}
                    className="w-full bg-white border border-blue-200 rounded-lg p-2 text-xs text-slate-800"
                  >
                    <option value="generic">Phần đầu hiện tại / tùy chỉnh</option>
                    <option value={COMPANY_HEADER_PROFILE_ID}>Công ty Hoa tiêu Hàng hải miền Bắc — phần đầu cố định</option>
                  </select>
                  <p className="text-[11px] text-slate-600 mt-1.5">
                    Profile công ty dùng tên cơ quan cố định và bố cục theo tệp Tiêu ngữ chuẩn; số ký hiệu, ngày ban hành và nội dung vẫn chỉnh sửa được.
                  </p>
                </div>
              )}

              {/* Thể thức cơ quan ban hành */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Cơ quan chủ quản cấp trên (nếu có):
                  </label>
                  <textarea
                    rows={2}
                    value={standardType === "state" && doc.headerProfile === COMPANY_HEADER_PROFILE_ID ? COMPANY_HEADER_PARENT_LINES.join("\n") : doc.orgHeader1}
                    onChange={(e) => handleFieldChange("orgHeader1", e.target.value.toUpperCase())}
                    readOnly={standardType === "state" && doc.headerProfile === COMPANY_HEADER_PROFILE_ID}
                    placeholder="VD: BỘ TƯ PHÁP / UBND THÀNH PHỐ"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 resize-y"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Tên cơ quan, tổ chức ban hành (*):
                  </label>
                  <input
                    type="text"
                    value={doc.orgHeader2}
                    onChange={(e) => handleFieldChange("orgHeader2", e.target.value.toUpperCase())}
                    readOnly={standardType === "state" && doc.headerProfile === COMPANY_HEADER_PROFILE_ID}
                    placeholder="VD: VĂN PHÒNG ỦY BAN / SỞ TƯ PHÁP"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-bold"
                  />
                </div>
              </div>

              {/* Quốc hiệu và Tiêu ngữ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Quốc hiệu (Dòng 1):</label>
                  <input
                    type="text"
                    value={doc.nationalHeader1}
                    onChange={(e) => handleFieldChange("nationalHeader1", e.target.value)}
                    readOnly={standardType === "state" && doc.headerProfile === COMPANY_HEADER_PROFILE_ID}
                    className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tiêu ngữ (Dòng 2):</label>
                  <input
                    type="text"
                    value={doc.nationalHeader2}
                    onChange={(e) => handleFieldChange("nationalHeader2", e.target.value)}
                    readOnly={standardType === "state" && doc.headerProfile === COMPANY_HEADER_PROFILE_ID}
                    placeholder={standardType === "party" ? "Văn bản Đảng không có tiêu ngữ" : "Độc lập - Tự do - Hạnh phúc"}
                    className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-bold"
                  />
                </div>
              </div>

              {/* Địa danh ngày tháng & Số ký hiệu & Loại văn bản */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Số và ký hiệu văn bản:</label>
                  <input
                    type="text"
                    value={doc.referenceNumber}
                    onChange={(e) => handleFieldChange("referenceNumber", e.target.value)}
                    placeholder="VD: Số: 01/QĐ-UBND"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Địa danh và ngày ban hành:</label>
                    <button
                      type="button"
                      onClick={() => {
                        const loc = extractLocation(doc.locationAndDate);
                        handleFieldChange("locationAndDate", formatStandardDate(loc || "[Địa danh]"));
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-medium hover:underline cursor-pointer"
                      title="Chèn ngày hôm nay (giữ nguyên địa danh đã nhập hoặc để [Địa danh])"
                    >
                      Ngày hiện tại
                    </button>
                  </div>
                  <input
                    type="text"
                    value={doc.locationAndDate}
                    onChange={(e) => handleFieldChange("locationAndDate", e.target.value)}
                    placeholder="VD: [Địa danh], ngày 14 tháng 10 năm 2026"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 italic"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tên loại văn bản:</label>
                  <input
                    type="text"
                    value={doc.documentType}
                    onChange={(e) => handleFieldChange("documentType", e.target.value.toUpperCase())}
                    placeholder="VD: QUYẾT ĐỊNH, CÔNG VĂN, BÁO CÁO..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-bold text-center"
                  />
                </div>
              </div>

              {/* Trích yếu */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Trích yếu nội dung văn bản:</label>
                <input
                  type="text"
                  value={doc.subject}
                  onChange={(e) => handleFieldChange("subject", e.target.value)}
                  placeholder="V/v ..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-medium"
                />
              </div>

              {/* ND30 Tiptap Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Nội dung chi tiết (Trình soạn thảo {standardType === "party" ? "HD 05" : "NĐ 30"}):
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setEditorMode("rich")}
                      className={`px-2.5 py-0.5 rounded font-medium transition ${
                        editorMode === "rich" ? "bg-white text-blue-600 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Trực quan (Tiptap)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorMode("raw")}
                      className={`px-2.5 py-0.5 rounded font-medium transition ${
                        editorMode === "raw" ? "bg-white text-blue-600 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Mã HTML
                    </button>
                  </div>
                </div>

                {editorMode === "rich" ? (
                  <ND30Editor
                    key={standardType}
                    content={doc.bodyHtml}
                    onChange={(html) => handleFieldChange("bodyHtml", html)}
                    regime={standardType === "party" ? "party" : "administrative"}
                    minHeight="440px"
                  />
                ) : (
                  <textarea
                    rows={12}
                    value={doc.bodyHtml}
                    onChange={(e) => handleFieldChange("bodyHtml", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-800 font-mono leading-relaxed"
                  />
                )}
              </div>

              {/* Chức vụ, Họ tên người ký, Nơi nhận */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Chức vụ người ký:</label>
                  <textarea
                    rows={2}
                    value={doc.signTitle}
                    onChange={(e) => handleFieldChange("signTitle", e.target.value)}
                    placeholder="VD: TM. ỦY BAN NHÂN DÂN&#10;CHỦ TỊCH"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Họ tên người ký:</label>
                  <input
                    type="text"
                    value={doc.signName}
                    onChange={(e) => handleFieldChange("signName", e.target.value)}
                    placeholder="Ghi rõ họ và tên người ký"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nơi nhận:</label>
                  <textarea
                    rows={2}
                    value={doc.recipients}
                    onChange={(e) => handleFieldChange("recipients", e.target.value)}
                    placeholder="VD: Như Điều 3;&#10;Lưu: VT, TH."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* SECTION: PHỤ LỤC VĂN BẢN ĐỘC LẬP (P0-D / P0-B) */}
              <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 space-y-3 mt-4">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                      Phụ lục đính kèm độc lập ({doc.appendices?.length || 0})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const newApp: AppendixDocument = {
                        id: `appendix-${Date.now()}`,
                        title: `PHỤ LỤC ${(doc.appendices?.length || 0) + 1}`,
                        referenceText: `(Kèm theo ${doc.documentType || "Văn bản"} ${doc.referenceNumber || ""})`,
                        html: "<p>Nội dung phụ lục mới...</p>",
                        blocks: [],
                        sourceBlockIds: [],
                        extractionStatus: "confirmed",
                      };
                      setDoc(prev => ({
                        ...prev,
                        appendices: [...(prev.appendices || []), newApp]
                      }));
                    }}
                    className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>+ Thêm Phụ lục</span>
                  </button>
                </div>

                {(!doc.appendices || doc.appendices.length === 0) ? (
                  <p className="text-[11px] text-amber-800/80 italic py-1">
                    Tài liệu chưa có phụ lục đính kèm. Bạn có thể nhấn "+ Thêm Phụ lục" để khởi tạo phụ lục độc lập.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {doc.appendices.map((app, idx) => (
                      <div key={app.id || idx} className="border border-amber-200 rounded-lg p-3 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                            PHỤ LỤC {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDoc(prev => ({
                                ...prev,
                                appendices: prev.appendices?.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="text-[11px] text-rose-600 hover:text-rose-800 underline font-medium"
                          >
                            Xóa
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Tiêu đề:</label>
                            <input
                              type="text"
                              value={app.title || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDoc(prev => {
                                  const list = [...(prev.appendices || [])];
                                  list[idx] = { ...list[idx], title: val };
                                  return { ...prev, appendices: list };
                                });
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-semibold text-slate-800"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Dòng liên kết:</label>
                            <input
                              type="text"
                              value={app.referenceText || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDoc(prev => {
                                  const list = [...(prev.appendices || [])];
                                  list[idx] = { ...list[idx], referenceText: val };
                                  return { ...prev, appendices: list };
                                });
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs text-slate-800 italic"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">Nội dung / Bảng HTML:</label>
                          <textarea
                            rows={3}
                            value={app.html || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDoc(prev => {
                                const list = [...(prev.appendices || [])];
                                list[idx] = { ...list[idx], html: val };
                                return { ...prev, appendices: list };
                              });
                            }}
                            className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono text-slate-800"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {Boolean(doc.unclassified?.length) && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold text-amber-950">Khối chưa phân loại ({doc.unclassified?.length}) — cần đối chiếu tệp gốc</h3>
                  <p className="text-xs text-amber-900">Các khối này sẽ được giữ ở cuối bản Word dưới nhãn cần kiểm tra. Có thể chuyển khối phù hợp vào nội dung chính.</p>
                  {doc.unclassified?.map((block) => (
                    <div key={block.id} className="bg-white border border-amber-200 rounded-lg p-2 text-xs space-y-2">
                      <p className="text-slate-800 whitespace-pre-wrap break-words">#{block.index + 1} ({block.kind}): {block.text || "[Khối không có văn bản]"}</p>
                      <button type="button" className="text-blue-700 underline" onClick={() => {
                        const html = block.html || safeTextToHtml(block.text);
                        setDoc(prev => ({
                          ...prev,
                          bodyHtml: `${prev.bodyHtml || ""}${html}`,
                          unclassified: (prev.unclassified || []).filter(item => item.id !== block.id),
                          importMetadata: prev.importMetadata ? { ...prev.importMetadata, status: "needs_review" } : prev.importMetadata,
                        }));
                      }}>Chuyển vào cuối nội dung chính</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    pushVersion("Lưu chỉnh sửa biên tập", doc);
                    setSuccessMsg("Đã lưu thay đổi vào lịch sử phiên bản!");
                    setActiveTab("preview");
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-xs"
                >
                  <Eye className="w-4 h-4" />
                  <span>Lưu thay đổi & Xem trước trang A4</span>
                </button>

                <button
                  onClick={exportToDocx}
                  disabled={isExportingDocx}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-xs disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất Word (.docx)</span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 3: XEM TRƯỚC (P0-03, P1-04)
             ======================================================== */}
          {activeTab === "preview" && (
            <div className="space-y-4">
              <A4DocumentPreview
                doc={doc}
                standardType={standardType}
                previewRef={previewRef}
                mode="full"
                onExportDocx={exportToDocx}
                onExportPdf={exportToPdf}
                onPrint={handlePrint}
                isExportingDocx={isExportingDocx}
                isExportingPdf={isExportingPdf}
              />
            </div>
          )}

          {/* ========================================================
              TAB 4: LỊCH SỬ PHIÊN BẢN (P1-05)
             ======================================================== */}
          {activeTab === "history" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  Lịch sử các phiên bản tài liệu
                </h2>
                <span className="text-xs text-slate-500 font-medium">{versions.length} phiên bản đã ghi nhận</span>
              </div>
              <p className="text-xs text-slate-500">
                Các phiên bản được giữ trong phiên làm việc hiện tại. Hãy xuất Word trước khi tải lại hoặc đóng trang.
              </p>

              <div className="space-y-2.5 mt-2">
                {versions.map((v, index) => (
                  <div key={v.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between hover:border-blue-400 transition">
                    <div className="flex items-start gap-3">
                      <div className="bg-purple-100 text-purple-800 p-2 rounded-lg font-bold text-xs">
                        #{versions.length - index}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-900">{v.title}</h4>
                        <p className="text-[11px] text-slate-500">{v.timestamp} · {v.data.documentType}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => restoreVersion(v)}
                      className="bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Khôi phục phiên bản
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ========================================================
            Right Column: Live A4 Visual Preview Page (P0-03, P0-06)
           ======================================================== */}
        {activeTab !== "preview" && (
          <div className="lg:col-span-1">
            <A4DocumentPreview
              doc={doc}
              standardType={standardType}
              previewRef={previewRef}
              mode="thumbnail"
              onSwitchToFullPreview={() => setActiveTab("preview")}
              onExportDocx={exportToDocx}
              onExportPdf={exportToPdf}
              onPrint={handlePrint}
              isExportingDocx={isExportingDocx}
              isExportingPdf={isExportingPdf}
            />
          </div>
        )}

      </main>

      {/* ========================================================
          MODAL 1: KIỂM TRA THỂ THỨC NGHỊ ĐỊNH 30 (P0-05, P1-03)
         ======================================================== */}
      {showComplianceModal && complianceReport && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Báo cáo Kiểm tra Thể thức NĐ 30 / HD 05
                </h3>
              </div>
              <button 
                onClick={() => setShowComplianceModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Score header */}
              <div className={`p-4 rounded-xl flex items-center justify-between border ${
                complianceReport.passed && complianceReport.issues.length === 0 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-950" 
                  : complianceReport.passed
                  ? "bg-blue-50 border-blue-200 text-blue-950"
                  : "bg-amber-50 border-amber-200 text-amber-950"
              }`}>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm">Kiểm tra 9 trường thể thức: {complianceReport.score}/100 điểm</h4>
                  <p className="text-[11px] opacity-80">
                    Đạt {complianceReport.passedChecks}/{complianceReport.totalChecks} tiêu chí thành phần dữ liệu (NĐ 30 / HD 05).
                  </p>
                  {standardType === "state" && complianceReport.canonical && (
                    <p className="text-[11px] font-semibold text-amber-700">
                      Catalog: {complianceReport.canonical.total} quy tắc từ repository chuẩn, {complianceReport.canonical.passed} PASS / {complianceReport.canonical.failed} FAIL / {complianceReport.canonical.notEvaluated} NOT_EVALUATED. Không được coi NOT_EVALUATED là PASS.
                    </p>
                  )}
                  <p className="text-[10px] text-slate-500">
                    * Lưu ý: Đây là kết quả kiểm tra 9 trường thành phần dữ liệu. Quy chuẩn khổ giấy A4, lề chuẩn NĐ 30 (Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm), phông chữ Times New Roman và định dạng bảng biểu được cấu hình và kiểm chứng trong bộ test tạo tệp Word (.docx).
                  </p>
                </div>
                <div className={`text-xs font-bold px-3 py-2 rounded-lg text-center whitespace-nowrap ml-3 shrink-0 ${
                  complianceReport.passed && complianceReport.issues.length === 0 
                    ? "bg-emerald-600 text-white" 
                    : complianceReport.passed 
                    ? "bg-blue-600 text-white"
                    : "bg-rose-600 text-white"
                }`}>
                  {complianceReport.passed && complianceReport.issues.length === 0
                    ? "ĐẠT 9/9 TRƯỜNG DỮ LIỆU"
                    : complianceReport.passed
                    ? "CƠ BẢN (CÒN LƯU Ý)"
                    : "CẦN SỬA LỖI"}
                </div>
              </div>

              {/* Issues checklist */}
              <div className="space-y-2.5">
                <h5 className="font-bold text-slate-800 text-xs">Chi tiết các hạng mục kiểm tra:</h5>
                {complianceReport.issues.length === 0 ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>9 trường dữ liệu đã đạt; chưa đồng nghĩa toàn bộ quy tắc và DOCX đã được nghiệm thu.</span>
                  </div>
                ) : (
                  complianceReport.issues.map((issue) => (
                    <div 
                      key={issue.id}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                        issue.severity === "error" 
                          ? "bg-rose-50/70 border-rose-200 text-rose-950" 
                          : "bg-amber-50/70 border-amber-200 text-amber-950"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          {issue.severity === "error" ? (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span>{issue.title}</span>
                        </div>
                        <p className="text-[11px] opacity-90">{issue.message}</p>
                        {issue.suggestion && (
                          <p className="text-[10px] text-blue-700 italic">Gợi ý: {issue.suggestion}</p>
                        )}
                      </div>

                      {issue.suggestion && (
                        <button
                          onClick={() => applyQuickFix(issue)}
                          className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2 py-1 rounded text-[10px] font-semibold shrink-0 shadow-2xs"
                        >
                          Sửa nhanh
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowComplianceModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: XÁC NHẬN ÁP DỤNG ĐỀ XUẤT AI (P0-04: User Gate)
         ======================================================== */}
      {aiProposal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-blue-50/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Đối chiếu kết quả phân tích trước khi áp dụng
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      aiProposalMeta?.isFallback
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    }`}>
                      {aiProposalMeta?.isFallback ? "Quy tắc dự phòng (Rule Fallback)" : "Trí tuệ nhân tạo (Gemini AI)"}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setAiProposal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className={`rounded-xl p-3 text-xs border ${
                aiProposalMeta?.isFallback 
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-blue-50 border-blue-200 text-blue-900"
              }`}>
                <strong>Lưu ý:</strong> {aiProposalMeta?.notice || "Bạn có toàn quyền xem trước, đối chiếu và quyết định áp dụng hoặc hủy bỏ mà không làm mất nội dung đang soạn thảo."}
              </div>

              <div className="space-y-2 border border-slate-200 rounded-xl p-3.5 bg-slate-50">
                <h4 className="font-bold text-slate-800 text-xs">Thông tin trích xuất & cấu trúc hóa:</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="font-semibold text-slate-600">Loại văn bản:</span> {aiProposal.documentType}</div>
                  <div><span className="font-semibold text-slate-600">Số ký hiệu:</span> {aiProposal.referenceNumber}</div>
                  <div><span className="font-semibold text-slate-600">Cơ quan ban hành:</span> {aiProposal.orgHeader2}</div>
                  <div><span className="font-semibold text-slate-600">Địa danh ngày tháng:</span> {aiProposal.locationAndDate}</div>
                  <div className="col-span-2"><span className="font-semibold text-slate-600">Trích yếu:</span> {aiProposal.subject}</div>
                  <div className="col-span-2"><span className="font-semibold text-slate-600">Chức vụ người ký:</span> {aiProposal.signTitle.replace(/\n/g, " - ")}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-xs mb-1.5">Xem trước nội dung chi tiết:</h4>
                <div 
                  className="p-3 bg-white border border-slate-300 rounded-xl max-h-48 overflow-y-auto text-[11px] leading-relaxed text-justify"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(aiProposal.bodyHtml) }}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setAiProposal(null)}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                Hủy bỏ (Giữ nguyên văn bản cũ)
              </button>

              <button
                onClick={acceptAiProposal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-4 h-4" /> Đồng ý áp dụng vào văn bản
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingTemplate && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Xác nhận đổi mẫu">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900">Đổi sang mẫu {pendingTemplate.name}?</h3>
            <p className="text-sm text-slate-700">Bản đang soạn có thay đổi chưa ghi vào lịch sử. Khi tiếp tục, hệ thống sẽ lưu một phiên bản trước khi thay mẫu để bạn có thể khôi phục.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPendingTemplate(null)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">Tiếp tục soạn bản hiện tại</button>
              <button type="button" onClick={() => applyTemplate(pendingTemplate)} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">Lưu phiên bản và đổi mẫu</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: XÁC NHẬN TINH CHỈNH VĂN BẢN (P0: AI Text Review Gate)
         ======================================================== */}
      {refineProposal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Phê duyệt đề xuất: {refineProposal.label}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      refineProposal.isFallback
                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                        : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    }`}>
                      {refineProposal.isFallback ? "Quy tắc dự phòng (Fallback)" : "Gemini AI tối ưu hóa"}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={rejectRefineProposal}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3 text-indigo-950 text-xs">
                <strong>Đối chiếu trước & sau:</strong> Hãy so sánh đoạn văn bản gốc và đề xuất sau khi tinh chỉnh. Bạn có thể nhấn <em>Áp dụng vào văn bản</em> để cập nhật hoặc <em>Hủy bỏ</em> để giữ nguyên.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col">
                  <div className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    Nội dung hiện tại (Gốc):
                  </div>
                  <div 
                    className="p-3 bg-white border border-slate-200 rounded-lg flex-1 max-h-60 overflow-y-auto text-[11px] leading-relaxed text-justify text-slate-700"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(refineProposal.originalHtml) }}
                  />
                </div>

                <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/30 flex flex-col">
                  <div className="font-bold text-indigo-900 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    Đề xuất mới (Đã tinh chỉnh):
                  </div>
                  <div 
                    className="p-3 bg-white border border-indigo-200 rounded-lg flex-1 max-h-60 overflow-y-auto text-[11px] leading-relaxed text-justify text-slate-900"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(refineProposal.refinedHtml) }}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={rejectRefineProposal}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition"
              >
                Hủy bỏ (Giữ nguyên văn bản cũ)
              </button>

              <button
                onClick={acceptRefineProposal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
              >
                <Check className="w-4 h-4" /> Áp dụng nội dung này
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
