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
    locationAndDate: "[Địa danh], ngày … tháng … năm …",
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
      <table style="width:100%;border:none;border-collapse:collapse;margin-top:20px">
        <tbody><tr>
          <td style="width:50%;border:none;text-align:center;vertical-align:top">
            <p style="text-align:center"><strong>THƯ KÝ</strong></p>
            <p style="text-align:center"><em>(Ký, ghi rõ họ tên)</em></p>
            <p style="text-align:center"><br/><br/><br/><strong>[Họ và tên]</strong></p>
          </td>
          <td style="width:50%;border:none;text-align:center;vertical-align:top">
            <p style="text-align:center"><strong>CHỦ TỌA</strong></p>
            <p style="text-align:center"><em>(Ký, ghi rõ họ tên)</em></p>
            <p style="text-align:center"><br/><br/><br/><strong>[Họ và tên]</strong></p>
          </td>
        </tr></tbody>
      </table>
    `,
    signTitle: "[Chữ ký thư ký và chủ tọa nằm trong bảng ở trên]",
    signName: "[Điền họ tên tại bảng chữ ký]",
    recipients: "Lưu: VT, hồ sơ.",
  },
};
