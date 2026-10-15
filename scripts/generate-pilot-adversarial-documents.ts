import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const outputRoot = join(process.cwd(), "public", "pilot-tests", "adversarial");
const issuer = "TRUNG TÂM KIỂM THỬ VĂN BẢN";
const parent = "CƠ QUAN PILOT HÀNG HẢI";
const officialHeader = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
const motto = "Độc lập - Tự do - Hạnh phúc";
const records: Array<{
  id: string;
  documentType: string;
  scenario: string;
  filename: string;
  url: string;
  testGroup: "complex" | "format-error" | "data-error";
  testFocus: string;
  document: Document;
}> = [];

type POptions = {
  bold?: boolean;
  italic?: boolean;
  size?: number;
  font?: string;
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  color?: string;
};

function p(text: string, options: POptions = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({
      text,
      bold: options.bold,
      italics: options.italic,
      size: options.size,
      font: options.font,
      color: options.color,
    })],
    alignment: options.alignment,
    heading: options.heading,
    spacing: { after: 100 },
  });
}

function cell(text: string, options: POptions = {}): TableCell {
  return new TableCell({
    children: text.split("\n").map(line => p(line, options)),
  });
}

function table(rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(row => new TableRow({ children: row.map(value => cell(value)) })),
  });
}

function header(reference: string, date: string, options: { bad?: boolean; minutes?: boolean } = {}): Table {
  const leftLines = options.bad
    ? [`${parent} ${issuer.toLocaleLowerCase("vi-VN")}`, reference, date]
    : [`${parent}\n${issuer}`, reference];
  const rightLines = options.bad
    ? [`${officialHeader} ${motto}`, "Độc lập / Tự do / Hạnh phúc"]
    : [officialHeader, motto, ...(options.minutes ? [] : [date])];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      cell(leftLines.join("\n"), options.bad ? { font: "Arial", size: 18 } : {}),
      cell(rightLines.join("\n"), { alignment: AlignmentType.CENTER, bold: true }),
    ] })],
  });
}

function signature(names: string[][]): Table {
  return table(names);
}

function createDocument(title: string, children: Array<Paragraph | Table>): Document {
  return new Document({
    creator: "Docs-ND30 Pilot Generator",
    title,
    description: "Dữ liệu hoàn toàn giả lập, dùng kiểm thử parse, cảnh báo, xem trước và xuất tệp.",
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 850, bottom: 1134, left: 1701 } } },
      children,
    }],
  });
}

function register(
  id: string,
  documentType: string,
  scenario: string,
  testGroup: "complex" | "format-error" | "data-error",
  testFocus: string,
  document: Document,
): void {
  const filename = `${id}.docx`;
  records.push({ id, documentType, scenario, filename, url: `/pilot-tests/adversarial/${filename}`, testGroup, testFocus, document });
}

function complexLetter(): Document {
  const body: Array<Paragraph | Table> = [
    header("Số: 07/CV-PILOT", "Hải Phòng, ngày 15 tháng 10 năm 2026"),
    p("CÔNG VĂN", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    p("V/v phối hợp rà soát hồ sơ giả lập nhiều thành phần", { alignment: AlignmentType.CENTER }),
    p("Kính gửi: Các đơn vị phối hợp kiểm thử giả lập"),
    p("Tài liệu pilot phức tạp CV-07: toàn bộ đơn vị, cá nhân, con số và thời hạn trong văn bản này đều được tạo để kiểm thử; không dùng làm hồ sơ nghiệp vụ."),
  ];
  for (let section = 1; section <= 9; section++) {
    body.push(p(`${section}. Nội dung phối hợp ${section}`, { bold: true, heading: HeadingLevel.HEADING_2 }));
    body.push(p(`Đơn vị đầu mối giả lập cần rà soát nhóm hồ sơ ${section}, ghi rõ căn cứ, nguồn dữ liệu, người xử lý và kết quả. Mọi nhận xét phải gắn với mã kiểm thử CV-07-${String(section).padStart(2, "0")} để đối chiếu giữa nội dung, bảng và phụ lục.`));
    body.push(p(`${section}.1. Kiểm tra trường bắt buộc; xác nhận dữ liệu nguồn còn nguyên vẹn; đánh dấu nội dung cần người dùng kiểm tra.`));
    body.push(p(`${section}.2. Nếu có xung đột, giữ đồng thời các giá trị đã xuất hiện và ghi vị trí nguồn; không tự lựa chọn một giá trị làm kết quả đúng.`));
    if ([2, 5, 8].includes(section)) {
      body.push(table([
        ["Mã", "Đầu việc giả lập", "Hạn xử lý", "Kết quả"],
        [`CV-07-${section}A`, "Đối chiếu thành phần hồ sơ", "20/10/2026", "Chờ xác nhận"],
        [`CV-07-${section}B`, "Kiểm tra liên kết phụ lục", "22/10/2026", "Đang rà soát"],
        [`CV-07-${section}C`, "So khớp nội dung sau parse", "25/10/2026", "Chưa thực hiện"],
      ]));
    }
  }
  body.push(p("Kết luận: chuyển toàn bộ 27 đầu mục và 3 bảng theo dõi sang người phụ trách pilot để đối chiếu."));
  body.push(signature([["Nơi nhận:\n- Như trên\n- Lưu: VT, Pilot", "GIÁM ĐỐC\n(Ký, ghi rõ họ tên)\nNguyễn Văn Kiểm Thử"]]));
  body.push(p("PHỤ LỤC I", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }));
  body.push(p("Danh sách dữ liệu giả lập kèm theo Công văn số 07/CV-PILOT ngày 15/10/2026"));
  body.push(table([
    ["STT", "Mã dữ liệu", "Nội dung kiểm tra", "Trạng thái"],
    ...Array.from({ length: 32 }, (_, index) => [String(index + 1), `CV-07-${String(index + 1).padStart(2, "0")}`, `Dòng phụ lục giả lập ${index + 1}: rà soát bảng dài, thứ tự dòng và nội dung ô khi phân trang.`, index % 2 ? "Cần kiểm tra" : "Đã ghi nhận"]),
  ]));
  return createDocument("Công văn phức tạp nhiều bảng và phụ lục", body);
}

function complexMinutes(): Document {
  const body: Array<Paragraph | Table> = [
    header("Số: 03/BB-PILOT", "", { minutes: true }),
    p("BIÊN BẢN", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    p("Cuộc họp rà soát quy trình kiểm thử tài liệu", { bold: true, alignment: AlignmentType.CENTER }),
    p("Thời gian: Từ 08 giờ 15 phút đến 11 giờ 45 phút, ngày 14 tháng 10 năm 2026."),
    p("Địa điểm: Phòng họp giả lập số 2, Hải Phòng."),
    p("Chủ trì: Nguyễn Văn Điều Phối. Thư ký: Trần Thị Tổng Hợp."),
    p("Thành phần: 12 người tham dự giả lập, không đại diện cho cá nhân hay cơ quan có thật."),
    table([
      ["STT", "Họ tên giả lập", "Bộ phận", "Tình trạng"],
      ...Array.from({ length: 12 }, (_, index) => [String(index + 1), `Người tham dự ${String(index + 1).padStart(2, "0")}`, `Tổ ${index % 4 + 1}`, "Có mặt"]),
    ]),
  ];
  for (let topic = 1; topic <= 6; topic++) {
    body.push(p(`${topic}. Nội dung thảo luận ${topic}`, { bold: true, heading: HeadingLevel.HEADING_2 }));
    body.push(p(`Các thành viên xem xét hồ sơ giả lập BB-03-${topic}, đối chiếu nguyên văn, cấu trúc bảng, thời gian và trách nhiệm. Thư ký ghi nhận ý kiến khác nhau mà không hợp nhất hoặc lược bỏ dữ liệu nguồn.`));
    body.push(p(`Ý kiến ${topic}.1: cần kiểm tra lại số lượng, mốc thời gian và tên tài liệu viện dẫn trước khi lập kết luận.`));
  }
  body.push(p("Kết luận cuộc họp", { bold: true, heading: HeadingLevel.HEADING_2 }));
  body.push(table([
    ["STT", "Nội dung thống nhất", "Đầu mối", "Thời hạn"],
    ...Array.from({ length: 10 }, (_, index) => [String(index + 1), `Kết luận giả lập ${index + 1}: giữ mã nguồn và lập dấu vết đối chiếu.`, `Tổ ${index % 4 + 1}`, `${20 + index}/10/2026`]),
  ]));
  body.push(p("Cuộc họp kết thúc lúc 11 giờ 45 phút cùng ngày. Biên bản đã được đọc lại, các bên ghi nhận để kiểm thử."));
  body.push(signature([["THƯ KÝ", "CHỦ TỌA"], ["(Ký, ghi rõ họ tên)", "(Ký, ghi rõ họ tên)"], ["Trần Thị Tổng Hợp", "Nguyễn Văn Điều Phối"]]));
  body.push(p("PHỤ LỤC", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }));
  body.push(p("Bảng tổng hợp ý kiến giả lập của 12 người tham dự"));
  body.push(table([
    ["STT", "Mã ý kiến", "Nhóm nội dung", "Ghi nhận"],
    ...Array.from({ length: 18 }, (_, index) => [String(index + 1), `BB03-YK-${String(index + 1).padStart(2, "0")}`, `Nhóm ${index % 6 + 1}`, `Ý kiến giả lập ${index + 1}, bảo toàn thứ tự và câu chữ trong nguồn.`]),
  ]));
  return createDocument("Biên bản phức tạp có nhiều người và bảng", body);
}

function complexDecision(): Document {
  const body: Array<Paragraph | Table> = [
    header("Số: 05/QĐ-PILOT", "Hải Phòng, ngày 15 tháng 10 năm 2026"),
    p("QUYẾT ĐỊNH", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    p("Về việc tổ chức đợt kiểm thử giả lập", { bold: true, alignment: AlignmentType.CENTER }),
    p("GIÁM ĐỐC TRUNG TÂM KIỂM THỬ VĂN BẢN", { bold: true, alignment: AlignmentType.CENTER }),
    p("Căn cứ kế hoạch kiểm thử nội bộ giả lập và nhu cầu rà soát luồng xử lý tài liệu;"),
    p("QUYẾT ĐỊNH:" , { bold: true, alignment: AlignmentType.CENTER }),
  ];
  for (let article = 1; article <= 8; article++) {
    body.push(p(`Điều ${article}. Nhiệm vụ ${article}`, { bold: true, heading: HeadingLevel.HEADING_2 }));
    body.push(p(`Tổ kiểm thử ${article} thực hiện nhiệm vụ giả lập theo phạm vi, mốc thời gian và tiêu chí ghi trong phụ lục. Kết quả phải chỉ ra tài liệu nguồn, vị trí dữ liệu và sai khác hiển thị sau khi xuất.`));
    body.push(p(`${article}.1. Người phụ trách tổng hợp bằng chứng, ghi nhận trường hợp chưa xác định và báo cáo người điều phối.`));
    if (article === 3 || article === 6) body.push(table([["Vai trò", "Trách nhiệm"], ["Điều phối", "Theo dõi tiến độ giả lập"], ["Kiểm thử", "Đối chiếu nội dung và bố cục"], ["Ghi nhận", "Lưu lỗi với mã nguồn"]]));
  }
  body.push(p("Điều 9. Tổ chức thực hiện", { bold: true, heading: HeadingLevel.HEADING_2 }));
  body.push(p("Quyết định này phục vụ duy nhất đợt pilot giả lập; không phát sinh chỉ đạo nghiệp vụ thực tế."));
  body.push(signature([["Nơi nhận:\n- Các tổ pilot\n- Lưu: VT, Pilot", "GIÁM ĐỐC\n(Ký, ghi rõ họ tên)\nLê Văn Mẫu"]]));
  body.push(p("PHỤ LỤC", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }));
  body.push(p("Danh sách phân công kèm theo Quyết định số 05/QĐ-PILOT ngày 15/10/2026"));
  body.push(table([
    ["STT", "Tổ", "Hạng mục", "Người phụ trách", "Hạn"],
    ...Array.from({ length: 24 }, (_, index) => [String(index + 1), `Tổ ${index % 6 + 1}`, `Hạng mục giả lập ${index + 1}`, `Nhân sự mẫu ${index + 1}`, `${20 + index % 8}/10/2026`]),
  ]));
  return createDocument("Quyết định phức tạp nhiều điều và phụ lục", body);
}

function malformedLetter(): Document {
  const body: Array<Paragraph | Table> = [
    header("Số: 08/CV-PILOT", "Hải Phòng ngày 15-10-2026", { bad: true }),
    p("Công văn", { bold: false, alignment: AlignmentType.LEFT, size: 36, font: "Arial", color: "1D4ED8" }),
    p("V/v đề nghị phối hợp kiểm tra thể thức (dòng trích yếu bị đặt sai vị trí)", { italic: true, size: 20 }),
    p("Kính gửi: Đơn vị thử nghiệm"),
    p("Ca sai thể thức FMT-CV-01. Tên cơ quan bị viết thường, quốc hiệu thiếu dấu câu chuẩn, tiêu ngữ dùng dấu gạch chéo và ngày ban hành thiếu dấu phẩy."),
    p("1. Nội dung vẫn cần được parse và giữ lại nguyên văn."),
    p("2. Phần kết, chữ ký và phụ lục có bố cục không thống nhất."),
    signature([["Nơi nhận: Đơn vị thử nghiệm", "GIÁM ĐỐC\n(Ký, ghi rõ họ tên)\nNguyễn Văn Mẫu"]]),
    p("PHỤ LỤC", { alignment: AlignmentType.LEFT, size: 30, font: "Calibri" }),
    p("Dữ liệu kèm theo công văn số 08/CV-PILOT"),
    table([["A", "B"], ["Giá trị giả lập", "Cần rà soát"]]),
  ];
  return createDocument("Công văn sai thể thức có chủ đích", body);
}

function malformedMinutes(): Document {
  const body: Array<Paragraph | Table> = [
    header("Biên bản số 09", "Ngày họp đặt nhầm ở đầu trang", { bad: true, minutes: true }),
    p("BIÊN BẢN CUỘC HỌP", { bold: true, alignment: AlignmentType.RIGHT, font: "Arial", size: 32 }),
    p("Thời gian: 08:30 ngày 15/10/2026 đến 10:00 cùng ngày."),
    p("Địa điểm: Phòng họp giả lập."),
    p("Thành phần: Chủ trì Nguyễn Văn Mẫu; thư ký Trần Thị Mẫu."),
    p("1. Nội dung cuộc họp", { bold: false, font: "Courier New", size: 20 }),
    p("Các ý kiến giả lập được ghi liền trong một đoạn dài, không tách người phát biểu, không đánh dấu nội dung kết luận và có cách viết hoa không nhất quán."),
    table([["THƯ KÝ / CHỦ TỌA", "Ký tên"], ["Trần Thị Mẫu - Nguyễn Văn Mẫu", "................"]]),
    p("Nơi nhận: (đặt nhầm trong biên bản)"),
    p("PHỤ LỤC 1", { alignment: AlignmentType.LEFT, italic: true }),
    table([["Cột 1", "Cột 2", "Cột 3"], ["Dữ liệu", "Trộn ô và nội dung dài không thống nhất", "Sai"]]),
  ];
  return createDocument("Biên bản sai thể thức có chủ đích", body);
}

function malformedDecision(): Document {
  const body: Array<Paragraph | Table> = [
    header("Số 10 / qđ - pilot", "Hải Phòng, ngày 15 tháng 10 năm 2026", { bad: true }),
    p("quyết định", { italic: true, alignment: AlignmentType.LEFT, font: "Comic Sans MS", size: 34 }),
    p("Về việc thành lập nhóm kiểm thử giả lập", { bold: false, alignment: AlignmentType.RIGHT }),
    p("Căn cứ nội dung thử nghiệm không chính thức;"),
    p("Điều 1. Thành lập nhóm giả lập.", { font: "Arial", size: 22 }),
    p("Điều 2. Nhóm thực hiện nội dung trong tệp thử nghiệm.", { font: "Times New Roman", size: 30 }),
    p("Điều 3. Quyết định có hiệu lực kể từ ngày ký.", { font: "Calibri", size: 18 }),
    signature([["Nơi nhận: lưu hồ sơ", "GIÁM ĐỐC (thiếu khoảng trống ký)\nLê Văn Mẫu"]]),
    p("PHỤ LỤC 1 - bảng đặt ngang và trộn định dạng", { italic: true, alignment: AlignmentType.LEFT }),
    table([["STT", "Nội dung", "Ghi chú"], ["1", "Mục giả lập", "Không theo kiểu trình bày thống nhất"]]),
  ];
  return createDocument("Quyết định sai thể thức có chủ đích", body);
}

function incorrectLetterData(): Document {
  const body: Array<Paragraph | Table> = [
    header("Số: 18/CV-PILOT", "Hải Phòng, ngày 31 tháng 2 năm 2026"),
    p("CÔNG VĂN", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    p("V/v kiểm thử xung đột số hiệu và ngày"),
    p("Kính gửi: Đơn vị thử nghiệm giả lập"),
    p("DỮ LIỆU MÂU THUẪN: phần đầu ghi số 18/CV-PILOT, nhưng đoạn này viện dẫn Công văn số 81/CV-PILOT. Ngày phát hành trong phần đầu là 31/02/2026; dòng đăng ký nội bộ lại ghi 05/03/2026."),
    p("Yêu cầu kiểm tra: giữ nguyên cả hai số hiệu và hai mốc ngày để người dùng xác minh nguồn; không tự chọn hoặc sửa giá trị."),
    signature([["Nơi nhận: Đơn vị thử nghiệm", "GIÁM ĐỐC\n(Ký, ghi rõ họ tên)\nNguyễn Văn Mẫu"]]),
    p("PHỤ LỤC", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    p("Bảng đối chiếu kèm theo Công văn số 81/CV-PILOT ngày 05/03/2026"),
    table([["Trường", "Giá trị phần đầu", "Giá trị phần thân"], ["Số hiệu", "18/CV-PILOT", "81/CV-PILOT"], ["Ngày", "31/02/2026", "05/03/2026"]]),
  ];
  return createDocument("Công văn có dữ liệu mâu thuẫn", body);
}

function incorrectMinutesData(): Document {
  const body: Array<Paragraph | Table> = [
    header("Số: 11/BB-PILOT", "", { minutes: true }),
    p("BIÊN BẢN", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    p("Biên bản cuộc họp giả lập số 11, phần đầu ghi số 11 nhưng phần kết ghi biên bản số 17."),
    p("Thời gian: Bắt đầu 15 giờ 00 phút, kết thúc 14 giờ 30 phút, ngày 15/10/2026."),
    p("Thành phần: Có 8 người tham dự theo phần mô tả."),
    table([["STT", "Người tham dự"], ...Array.from({ length: 9 }, (_, index) => [String(index + 1), `Người mẫu ${index + 1}`])]),
    p("Diễn biến: Các ý kiến và kết luận trong biên bản chỉ phục vụ đối chiếu khả năng phát hiện số lượng và mốc thời gian không nhất quán."),
    p("Cuộc họp kết thúc lúc 14 giờ 30 phút cùng ngày."),
    p("Biên bản số 17 được lập ngày 16/10/2026."),
    signature([["THƯ KÝ", "CHỦ TỌA"], ["(Ký)", "(Ký)"], ["Trần Thị Mẫu", "Nguyễn Văn Mẫu"]]),
    p("PHỤ LỤC", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    p("Bảng danh sách ghi 9 người trong khi phần thân khai có 8 người."),
    table([["Dữ liệu", "Mốc 1", "Mốc 2"], ["Số biên bản", "11/BB-PILOT", "17/BB-PILOT"], ["Số người", "8", "9"], ["Thời gian", "15:00", "14:30"]]),
  ];
  return createDocument("Biên bản có dữ liệu mâu thuẫn", body);
}

function incorrectDecisionData(): Document {
  const body: Array<Paragraph | Table> = [
    header("Số: 04/QĐ-PILOT", "Hải Phòng, ngày 31 tháng 2 năm 2026"),
    p("QUYẾT ĐỊNH", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    p("Về việc kiểm thử dữ liệu ngày và số hiệu"),
    p("Điều 1. Phần đầu ghi Quyết định số 04/QĐ-PILOT, nội dung viện dẫn Quyết định số 40/QĐ-PILOT."),
    p("Điều 2. Văn bản ghi ngày ban hành 31/02/2026 nhưng ngày có hiệu lực là 01/02/2026, sớm hơn ngày ban hành."),
    p("Điều 3. Người ký giả lập được ghi khác nhau ở phần thân và bảng ký."),
    signature([["Nơi nhận: Lưu hồ sơ pilot", "GIÁM ĐỐC\n(Ký, ghi rõ họ tên)\nLê Văn A"]]),
    p("PHỤ LỤC", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    p("Bảng đối chiếu dữ liệu kèm theo Quyết định số 40/QĐ-PILOT ngày 01/02/2026"),
    table([["Trường", "Phần đầu", "Điều khoản", "Phụ lục"], ["Số hiệu", "04/QĐ-PILOT", "40/QĐ-PILOT", "40/QĐ-PILOT"], ["Ngày", "31/02/2026", "01/02/2026", "01/02/2026"], ["Người ký", "Lê Văn A", "Lê Văn B", "Lê Văn A"]]),
  ];
  return createDocument("Quyết định có dữ liệu mâu thuẫn", body);
}

register("adv-complex-cong-van", "Công văn", "Nâng cao · nội dung dài, nhiều bảng và phụ lục", "complex", "Kiểm tra nhiều trang, thứ tự khối, bảng nội dung, phần ký và bảng phụ lục dài.", complexLetter());
register("adv-complex-bien-ban", "Biên bản", "Nâng cao · danh sách thành phần và kết luận nhiều bảng", "complex", "Kiểm tra thời gian họp trong thân, danh sách người dự, nhiều chủ đề, hai chữ ký và phụ lục.", complexMinutes());
register("adv-complex-quyet-dinh", "Quyết định", "Nâng cao · nhiều điều khoản và phụ lục dài", "complex", "Kiểm tra điều khoản lặp, bảng nhiều dòng, ngắt trang, phần ký và phụ lục.", complexDecision());
register("adv-format-cong-van", "Công văn", "Sai thể thức · đầu trang và kiểu chữ không nhất quán", "format-error", "Xác nhận hệ thống giữ nguồn và cảnh báo quốc hiệu, tiêu ngữ, tên cơ quan, căn lề và kiểu chữ sai.", malformedLetter());
register("adv-format-bien-ban", "Biên bản", "Sai thể thức · thời gian, bảng ký và phụ lục đặt sai", "format-error", "Xác nhận parser giữ nguyên thời gian họp trong thân và không gộp mất bảng ký/phụ lục bất thường.", malformedMinutes());
register("adv-format-quyet-dinh", "Quyết định", "Sai thể thức · tiêu đề, số hiệu và định dạng trộn", "format-error", "Kiểm tra nhận diện loại văn bản khi tiêu đề viết thường, sai vị trí, số hiệu và kiểu chữ không đồng nhất.", malformedDecision());
register("adv-data-cong-van", "Công văn", "Sai dữ liệu · trùng số hiệu và ngày không tồn tại", "data-error", "Đối chiếu 18/81, ngày 31/02/2026 và ngày 05/03/2026; xem parse có giữ các giá trị xung đột để người dùng rà soát.", incorrectLetterData());
register("adv-data-bien-ban", "Biên bản", "Sai dữ liệu · giờ kết thúc, số người và số biên bản mâu thuẫn", "data-error", "Đối chiếu 15:00/14:30, 8/9 người và số biên bản 11/17 giữa phần thân/phụ lục.", incorrectMinutesData());
register("adv-data-quyet-dinh", "Quyết định", "Sai dữ liệu · số hiệu, ngày hiệu lực và người ký mâu thuẫn", "data-error", "Đối chiếu 04/40, ngày 31/02 và 01/02, tên người ký giữa các phần.", incorrectDecisionData());

await mkdir(outputRoot, { recursive: true });
for (const record of records) {
  await writeFile(join(outputRoot, record.filename), await Packer.toBuffer(record.document));
}
const manifest = records.map(({ document: _document, ...metadata }) => metadata);
await writeFile(join(process.cwd(), "public", "pilot-tests", "adversarial-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${records.length} synthetic adversarial DOCX pilot files.`);
