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
import { ADMINISTRATIVE_DOCUMENT_TYPES } from "../src/utils/documentStructure.ts";

const outputRoot = join(process.cwd(), "public", "pilot-tests");
const fictionalParent = "CƠ QUAN PILOT HÀNG HẢI";
const fictionalIssuer = "TRUNG TÂM KIỂM THỬ VĂN BẢN";
const scenarios = [
  { id: "01-co-ban", label: "Cơ bản — đoạn văn và thành phần chuẩn" },
  { id: "02-bang-noi-dung", label: "Bảng — nội dung kết hợp bảng" },
  { id: "03-danh-sach", label: "Danh sách — nhiều ý và phụ lục" },
] as const;
const addresseeTypes = new Set(["Công văn", "Báo cáo", "Tờ trình", "Thông báo", "Giấy mời"]);

function slugify(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("vi-VN")
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function paragraph(text: string, options: { bold?: boolean; italic?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel] } = {}) {
  return new Paragraph({
    children: [new TextRun({ text, bold: options.bold, italics: options.italic })],
    alignment: options.alignment,
    heading: options.heading,
    spacing: { after: 100 },
  });
}

function cell(...lines: string[]): TableCell {
  return new TableCell({
    children: lines.map((line, index) => new Paragraph({
      children: [new TextRun({ text: line, bold: index === 0 && /^(?:CỘNG HÒA|Độc lập|THƯ KÝ|CHỦ TỌA|GIÁM ĐỐC)/i.test(line) })],
      spacing: { after: 60 },
    })),
  });
}

function table(rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(row => new TableRow({ children: row.map(text => cell(...text.split("\n"))) })),
  });
}

function buildDocument(type: typeof ADMINISTRATIVE_DOCUMENT_TYPES[number], caseNumber: number) {
  const scenario = scenarios[caseNumber - 1];
  const isMinutes = type.name === "Biên bản";
  const slug = slugify(type.name) || "van-ban";
  const filename = `pilot-${slug}-${scenario.id}.docx`;
  const id = `${slug}-${scenario.id}`;
  const reference = `Số: ${String(caseNumber).padStart(2, "0")}/${type.abbreviation || "VB"}-PILOT`;
  const dateLine = "Hải Phòng, ngày 15 tháng 10 năm 2026";

  const headerRight = [
    "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
    "Độc lập - Tự do - Hạnh phúc",
    ...(!isMinutes ? [dateLine] : []),
  ];
  const children: Array<Paragraph | Table> = [
    table([[
      `${fictionalParent}\n${fictionalIssuer}\n${reference}`,
      headerRight.join("\n"),
    ]]),
    paragraph(type.name.toLocaleUpperCase("vi-VN"), { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    paragraph(`V/v kiểm thử luồng định dạng ${type.name.toLocaleLowerCase("vi-VN")}`, { alignment: AlignmentType.CENTER }),
  ];

  if (addresseeTypes.has(type.name)) {
    children.push(paragraph("Kính gửi: Các đơn vị phối hợp giả lập"));
  }

  if (isMinutes) {
    children.push(
      paragraph("Thời gian: 08 giờ 30 phút, ngày 15 tháng 10 năm 2026."),
      paragraph("Địa điểm: Phòng họp Pilot, Hải Phòng."),
      paragraph("Thành phần: Nguyễn Văn Mẫu (chủ trì), Trần Thị Mẫu (thư ký), đại diện các bộ phận."),
    );
  }

  children.push(paragraph(`Tài liệu giả lập số ${String(caseNumber).padStart(2, "0")}; toàn bộ tên người, số liệu và tình huống dưới đây chỉ phục vụ kiểm thử, không phải hồ sơ thật.`));

  for (const [outlineIndex, outline] of type.bodyOutline.entries()) {
    children.push(paragraph(outline, { bold: true, heading: HeadingLevel.HEADING_2 }));
    children.push(paragraph(`Nội dung giả lập cho mục “${outline}”: ${type.name} được xử lý theo tình huống pilot ${caseNumber}. Đơn vị phụ trách ghi nhận căn cứ, thời hạn, kết quả và đầu mối chịu trách nhiệm để kiểm tra cách giữ đoạn, tiêu đề và dấu câu.`));
    if (outlineIndex === 1 && caseNumber === 2) {
      children.push(table([
        ["Đầu việc kiểm thử", "Thời hạn giả lập", "Trạng thái"],
        ["Rà soát nội dung và bố cục", "20/10/2026", "Đang thực hiện"],
        ["Đối chiếu kết quả parse", "22/10/2026", "Chưa thực hiện"],
      ]));
    }
    if (caseNumber === 3) {
      children.push(
        paragraph(`${outlineIndex + 1}. Thực hiện bước thứ nhất theo nội dung đã giao; lưu lại kết quả và nguồn đối chiếu.`),
        paragraph(`${outlineIndex + 1}.1. Ghi nhận trường hợp ngoại lệ, người xử lý giả lập và thời gian hoàn thành.`),
      );
    }
  }

  children.push(paragraph("Kết luận: Hoàn thành các nội dung pilot và chuyển hồ sơ giả lập sang bước kiểm tra tiếp theo."));

  if (isMinutes) {
    children.push(paragraph("Cuộc họp kết thúc lúc 10 giờ 15 phút cùng ngày; biên bản được đọc lại và thống nhất thông qua."));
    children.push(table([
      ["THƯ KÝ", "CHỦ TỌA"],
      ["(Ký, ghi rõ họ tên)", "(Ký, ghi rõ họ tên)"],
      ["Trần Thị Mẫu", "Nguyễn Văn Mẫu"],
    ]));
  } else {
    children.push(table([
      [`Nơi nhận:\n- Các đơn vị liên quan\n- Lưu: VT, Pilot`, `GIÁM ĐỐC\n(Ký, ghi rõ họ tên)\nNguyễn Văn Mẫu ${String(caseNumber).padStart(2, "0")}`],
    ]));
  }

  children.push(
    paragraph("PHỤ LỤC I", { bold: true, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
    paragraph(`Kèm theo ${type.name.toLocaleLowerCase("vi-VN")} số ${String(caseNumber).padStart(2, "0")}/PILOT ngày 15/10/2026`),
    paragraph("Bảng dữ liệu giả lập phục vụ đối chiếu phụ lục."),
    table([
      ["STT", "Nội dung giả lập", "Kết quả"],
      ["1", "Kiểm tra phần đầu và thông tin văn bản", "Đã ghi nhận"],
      ["2", "Kiểm tra nội dung, phần ký và nơi nhận", "Đã ghi nhận"],
    ]),
  );

  return {
    id,
    documentType: type.name,
    scenario: scenario.label,
    filename,
    url: `/pilot-tests/${slug}/${filename}`,
    document: new Document({
      creator: "Docs-ND30 Pilot Generator",
      title: `${type.name} — ${scenario.label}`,
      description: "Tài liệu hoàn toàn giả lập để kiểm thử luồng tải, parse và phân vùng Docs-ND30.",
      sections: [{ children }],
    }),
  };
}

const manifest = [];
for (const type of ADMINISTRATIVE_DOCUMENT_TYPES) {
  const folder = join(outputRoot, slugify(type.name) || "van-ban");
  await mkdir(folder, { recursive: true });
  for (const caseNumber of [1, 2, 3]) {
    const item = buildDocument(type, caseNumber);
    await writeFile(join(folder, item.filename), await Packer.toBuffer(item.document));
    manifest.push({
      id: item.id,
      documentType: item.documentType,
      scenario: item.scenario,
      filename: item.filename,
      url: item.url,
    });
  }
}

await writeFile(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${manifest.length} synthetic DOCX files across ${ADMINISTRATIVE_DOCUMENT_TYPES.length} document types.`);
