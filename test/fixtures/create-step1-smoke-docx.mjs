import { writeFile } from "node:fs/promises";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

const cell = (...lines) => new TableCell({ children: lines.map(text => new Paragraph({ children: [new TextRun(text)] })) });
const header = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [
  cell("TỔNG CÔNG TY BẢO ĐẢM", "AN TOÀN HÀNG HẢI VIỆT NAM", "CÔNG TY HOA TIÊU HÀNG HẢI MIỀN BẮC", "Số: 01/BB-HTMB"),
  cell("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "Độc lập - Tự do - Hạnh phúc", "Hải Phòng, ngày 15 tháng 10 năm 2026"),
] })] });
const signers = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
  new TableRow({ children: [cell("NGƯỜI GHI BIÊN BẢN"), cell("ĐẠI DIỆN BỘ PHẬN"), cell("CHỦ TRÌ")] }),
  new TableRow({ children: [cell("Nguyễn Văn Mẫu"), cell("Trần Văn Mẫu"), cell("Lê Văn Mẫu")] }),
] });
const appendix = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
  new TableRow({ children: [cell("STT"), cell("Nội dung"), cell("Kết quả")] }),
  new TableRow({ children: [cell("1"), cell("Kiểm tra bước nhập"), cell("Đạt")] }),
] });
const document = new Document({ sections: [{ children: [
  header,
  new Paragraph({ text: "BIÊN BẢN" }),
  new Paragraph({ text: "Về việc kiểm tra luồng nhập tài liệu" }),
  new Paragraph({ text: "Nội dung thử nghiệm không chứa dữ liệu nhân viên." }),
  signers,
  new Paragraph({ text: "PHỤ LỤC 01" }),
  new Paragraph({ text: "Bảng kiểm thử kèm theo biên bản" }),
  appendix,
] }] });
await writeFile(new URL("./step1-smoke.docx", import.meta.url), await Packer.toBuffer(document));
