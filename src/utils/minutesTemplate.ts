import type { DocumentState } from "../App.tsx";

export interface TemplatePreset {
  id: string;
  name: string;
  desc: string;
  type: "state" | "party";
  badge: string;
  defaultData: DocumentState;
}

/** Nghị định 30/2020/NĐ-CP, Phụ lục III, Phần II, Mẫu 1.9 — Biên bản. */
export const MINUTES_TEMPLATE: TemplatePreset = {
  id: "bien-ban",
  name: "Biên bản họp, hội nghị, làm việc",
  desc: "Mẫu 1.9 Nghị định 30: thời gian, địa điểm, thành phần, diễn biến và chữ ký thư ký/chủ tọa",
  type: "state",
  badge: "NĐ 30 Mẫu 1.9",
  defaultData: {
    orgHeader1: "",
    orgHeader2: "",
    nationalHeader1: "",
    nationalHeader2: "",
    locationAndDate: "",
    documentType: "BIÊN BẢN",
    referenceNumber: "Số: …/BB-[CHỮ VIẾT TẮT CƠ QUAN]",
    subject: "[Tên cuộc họp, hội nghị, hội thảo hoặc buổi làm việc]",
    bodyHtml: `
      <p><strong>Thời gian bắt đầu:</strong> [Hồi … giờ … phút, ngày … tháng … năm …]</p>
      <p><strong>Địa điểm:</strong> [Địa điểm tiến hành cuộc họp/hội nghị/hội thảo]</p>
      <p><strong>Thành phần tham dự:</strong> [Ghi họ tên, chức vụ hoặc đơn vị của người tham dự; ghi rõ người vắng mặt nếu cần.]</p>
      <p><strong>Chủ trì:</strong> [Họ tên, chức vụ nếu cần]</p>
      <p><strong>Thư ký (người ghi biên bản):</strong> [Họ tên]</p>
      <p><strong>Nội dung (theo diễn biến cuộc họp/hội nghị/hội thảo):</strong></p>
      <p>[Ghi lần lượt diễn biến, ý kiến và kết luận/thoả thuận; giữ đúng nội dung đã được phát biểu hoặc thống nhất.]</p>
      <p><strong>Cuộc họp (hội nghị, hội thảo) kết thúc vào:</strong> [ … giờ … phút, ngày … tháng … năm …]</p>
    `,
    signTitle: "",
    signName: "",
    signatureBlocks: [
      { id: "minutes-secretary", role: "THƯ KÝ", instruction: "(Ký, ghi rõ họ tên)", name: "[Họ và tên]", status: "needs_review" },
      { id: "minutes-chair", role: "CHỦ TỌA", instruction: "(Ký, ghi rõ họ tên)", name: "[Họ và tên]", status: "needs_review" },
    ],
    recipients: "Lưu: VT, hồ sơ.",
  },
};
