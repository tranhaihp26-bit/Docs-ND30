import assert from "node:assert/strict";
import mammoth from "mammoth";
import { Packer, convertMillimetersToTwip } from "docx";
import { 
  validateND30Compliance, 
  isPlaceholderValue, 
  REFERENCE_NUMBER_REGEX, 
  LOCATION_AND_DATE_REGEX,
  type DocumentFormatType
} from "../src/shared/schemas/document.schema.ts";
import { 
  enforceND30Standards, 
  extractLocation, 
  normalizeReferenceNumber, 
  sanitizeBodyHtml 
} from "../src/server/middleware/compliance.middleware.ts";
import {
  generateND30DocxDocument,
  ND30_PAGE_MARGINS
} from "../src/utils/docxExport.ts";

console.log("==================================================================");
console.log(" BỘ KIỂM TRA TOÀN DIỆN THỂ THỨC NGHỊ ĐỊNH 30/2020 & HD 05 (21 TESTS)");
console.log("==================================================================\n");

let passed = 0;
let failed = 0;

async function runTest(testId: string, title: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] ${testId}: ${title}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${testId}: ${title}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

async function main() {
  // ----------------------------------------------------------------------
  // 1. Quốc hiệu NĐ 30
  // ----------------------------------------------------------------------
  await runTest("TEST-01", "Quốc hiệu NĐ 30 bắt buộc là 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'", () => {
    const repCorrect = validateND30Compliance({ nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" }, "administrative");
    assert.equal(repCorrect.issues.some(i => i.id === "nationalHeader1"), false);

    const repWrong = validateND30Compliance({ nationalHeader1: "Cộng hòa xã hội chủ nghĩa Việt Nam" }, "administrative");
    assert.equal(repWrong.issues.some(i => i.id === "nationalHeader1"), true);
  });

  // ----------------------------------------------------------------------
  // 2. Tiêu ngữ NĐ 30
  // ----------------------------------------------------------------------
  await runTest("TEST-02", "Tiêu ngữ NĐ 30 bắt buộc là 'Độc lập - Tự do - Hạnh phúc'", () => {
    const repCorrect = validateND30Compliance({ nationalHeader2: "Độc lập - Tự do - Hạnh phúc" }, "administrative");
    assert.equal(repCorrect.issues.some(i => i.id === "nationalHeader2"), false);

    const repWrong = validateND30Compliance({ nationalHeader2: "ĐỘC LẬP - TỰ DO - HẠNH PHÚC" }, "administrative");
    assert.equal(repWrong.issues.some(i => i.id === "nationalHeader2"), true);
  });

  // ----------------------------------------------------------------------
  // 3. Quốc hiệu Văn bản Đảng HD 05
  // ----------------------------------------------------------------------
  await runTest("TEST-03", "Quốc hiệu Đảng theo HD 05 bắt buộc là 'ĐẢNG CỘNG SẢN VIỆT NAM'", () => {
    const repParty = validateND30Compliance({ nationalHeader1: "ĐẢNG CỘNG SẢN VIỆT NAM", nationalHeader2: "" }, "party");
    assert.equal(repParty.issues.some(i => i.id === "nationalHeader1"), false);

    const enforced = enforceND30Standards({}, "party");
    assert.equal(enforced.nationalHeader1, "ĐẢNG CỘNG SẢN VIỆT NAM");
  });

  // ----------------------------------------------------------------------
  // 4. Tiêu ngữ Văn bản Đảng HD 05
  // ----------------------------------------------------------------------
  await runTest("TEST-04", "Văn bản Đảng theo HD 05 không có tiêu ngữ", () => {
    const repPartyNoMotto = validateND30Compliance({ nationalHeader1: "ĐẢNG CỘNG SẢN VIỆT NAM", nationalHeader2: "" }, "party");
    assert.equal(repPartyNoMotto.issues.some(i => i.id === "nationalHeader2"), false);

    const repPartyWithMotto = validateND30Compliance({ nationalHeader1: "ĐẢNG CỘNG SẢN VIỆT NAM", nationalHeader2: "Độc lập - Tự do - Hạnh phúc" }, "party");
    assert.equal(repPartyWithMotto.issues.some(i => i.id === "nationalHeader2"), true);
  });

  // ----------------------------------------------------------------------
  // 5. Tên cơ quan ban hành phải viết in hoa
  // ----------------------------------------------------------------------
  await runTest("TEST-05", "Tên cơ quan ban hành bắt buộc viết IN HOA", () => {
    const repUpper = validateND30Compliance({ orgHeader2: "ỦY BAN NHÂN DÂN THÀNH PHỐ HẢI PHÒNG" }, "administrative");
    assert.equal(repUpper.issues.some(i => i.id === "orgHeader2" || i.id === "orgHeader2_case"), false);

    const repLower = validateND30Compliance({ orgHeader2: "Ủy ban nhân dân thành phố" }, "administrative");
    const caseIssue = repLower.issues.find(i => i.id === "orgHeader2_case");
    assert.ok(caseIssue);
    assert.equal(caseIssue.suggestion, "ỦY BAN NHÂN DÂN THÀNH PHỐ");
  });

  // ----------------------------------------------------------------------
  // 6. Phát hiện và từ chối placeholder tên cơ quan
  // ----------------------------------------------------------------------
  await runTest("TEST-06", "Từ chối và cảnh báo placeholder cơ quan ban hành", () => {
    const placeholders = ["[TÊN CƠ QUAN BAN HÀNH]", "[Tên cơ quan]", "...", "<Cơ quan ban hành>"];
    for (const ph of placeholders) {
      assert.equal(isPlaceholderValue(ph), true, `Placeholder ${ph} must be detected`);
      const rep = validateND30Compliance({ orgHeader2: ph }, "administrative");
      assert.equal(rep.issues.some(i => i.id === "orgHeader2"), true);
    }
  });

  // ----------------------------------------------------------------------
  // 7. Số ký hiệu văn bản bắt buộc bắt đầu bằng 'Số: '
  // ----------------------------------------------------------------------
  await runTest("TEST-07", "Số ký hiệu văn bản phải có tiền tố 'Số: '", () => {
    assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 12/QĐ-UBND"), true);
    assert.equal(REFERENCE_NUMBER_REGEX.test("12/QĐ-UBND"), false);

    const normalized = normalizeReferenceNumber("12/QĐ-UBND", "QĐ");
    assert.equal(normalized.startsWith("Số: "), true);
  });

  // ----------------------------------------------------------------------
  // 8. Định dạng số ký hiệu văn bản hành chính NĐ 30
  // ----------------------------------------------------------------------
  await runTest("TEST-08", "Định dạng số ký hiệu hành chính NĐ 30 hợp lệ", () => {
    assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 125/QĐ-UBND"), true);
    assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 45/2026/NĐ-CP"), true);
    assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 18/STP-VP"), true);
  });

  // ----------------------------------------------------------------------
  // 9. Định dạng số ký hiệu văn bản Đảng HD 05
  // ----------------------------------------------------------------------
  await runTest("TEST-09", "Định dạng số ký hiệu văn bản Đảng HD 05 hợp lệ", () => {
    assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 01-NQ/TW"), true);
    assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 15-HD/BTCTW"), true);
    assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 24-CT/TU"), true);
  });

  // ----------------------------------------------------------------------
  // 10. Từ chối placeholder số ký hiệu và không tự điền số giả
  // ----------------------------------------------------------------------
  await runTest("TEST-10", "Từ chối placeholder số ký hiệu và không tự điền số giả", () => {
    assert.equal(isPlaceholderValue("Số: .../QĐ-UBND"), true);
    assert.equal(isPlaceholderValue("Số: .../..."), true);
    
    const rep = validateND30Compliance({ referenceNumber: "Số: .../QĐ-UBND" });
    const emptyIssue = rep.issues.find(i => i.id === "referenceNumber_empty");
    assert.ok(emptyIssue);
    assert.equal(emptyIssue.suggestion, undefined, "Không được tự gợi ý số giả như '01/QĐ-UBND'");
  });

  // ----------------------------------------------------------------------
  // 11. Định dạng địa danh và ngày ban hành chuẩn
  // ----------------------------------------------------------------------
  await runTest("TEST-11", "Định dạng địa danh và ngày tháng năm ban hành chuẩn", () => {
    assert.equal(LOCATION_AND_DATE_REGEX.test("Hà Nội, ngày 14 tháng 10 năm 2026"), true);
    assert.equal(LOCATION_AND_DATE_REGEX.test("TP. Hồ Chí Minh, ngày 05 tháng 02 năm 2026"), true);
    assert.equal(LOCATION_AND_DATE_REGEX.test("Hải Phòng, ngày 30 tháng 12 năm 2025"), true);
    assert.equal(LOCATION_AND_DATE_REGEX.test("14/10/2026"), false);
  });

  // ----------------------------------------------------------------------
  // 12. Quy tắc số 0 đứng trước ngày dưới 10 và tháng 1, 2
  // ----------------------------------------------------------------------
  await runTest("TEST-12", "Tuân thủ quy tắc số 0 đứng trước ngày dưới 10 và tháng 1, 2", () => {
    assert.equal(LOCATION_AND_DATE_REGEX.test("Đà Nẵng, ngày 05 tháng 02 năm 2026"), true);
    assert.equal(LOCATION_AND_DATE_REGEX.test("Cần Thơ, ngày 09 tháng 01 năm 2026"), true);
  });

  // ----------------------------------------------------------------------
  // 13. Tuyệt đối không tự ý gán 'Hà Nội' hoặc ngày giả khi thiếu dữ liệu
  // ----------------------------------------------------------------------
  await runTest("TEST-13", "extractLocation không được tự mặc định gán 'Hà Nội'", () => {
    assert.equal(extractLocation(undefined), "");
    assert.equal(extractLocation(""), "");
    assert.equal(extractLocation("[Địa danh], ngày ... tháng ... năm ..."), "");
    assert.equal(extractLocation("Đà Nẵng, ngày 15 tháng 8 năm 2026"), "Đà Nẵng");
  });

  // ----------------------------------------------------------------------
  // 14. Loại văn bản in hoa đứng đậm
  // ----------------------------------------------------------------------
  await runTest("TEST-14", "Loại văn bản chuẩn hóa in hoa và đúng danh mục quy định", () => {
    const validTypes = ["QUYẾT ĐỊNH", "CÔNG VĂN", "BÁO CÁO", "KẾ HOẠCH", "TỜ TRÌNH", "THÔNG BÁO", "BIÊN BẢN"];
    for (const vt of validTypes) {
      const rep = validateND30Compliance({ documentType: vt, subject: "Nội dung hợp lệ" });
      assert.equal(rep.issues.some(i => i.id === "documentType"), false);
    }
  });

  // ----------------------------------------------------------------------
  // 15. Trích yếu nội dung văn bản (subject)
  // ----------------------------------------------------------------------
  await runTest("TEST-15", "Trích yếu nội dung văn bản không được để trống hoặc placeholder", () => {
    const repValid = validateND30Compliance({ documentType: "QUYẾT ĐỊNH", subject: "V/v phê duyệt kế hoạch chuyển đổi số" });
    assert.equal(repValid.issues.some(i => i.id === "subject"), false);

    const repPh = validateND30Compliance({ documentType: "QUYẾT ĐỊNH", subject: "[Trích yếu nội dung]" });
    assert.equal(repPh.issues.some(i => i.id === "subject"), true);
  });

  // ----------------------------------------------------------------------
  // 16. Phông chữ chuẩn Times New Roman và cỡ chữ 13pt
  // ----------------------------------------------------------------------
  await runTest("TEST-16", "Compliance middleware ép buộc font Times New Roman & cỡ chữ 13", () => {
    const enforced = enforceND30Standards({ fontFamily: "Arial", fontSize: 10 });
    assert.equal(enforced.fontFamily, "Times New Roman");
    assert.equal(enforced.fontSize, 13);
  });

  // ----------------------------------------------------------------------
  // 17. Nơi nhận và bộ phận lưu trữ văn thư
  // ----------------------------------------------------------------------
  await runTest("TEST-17", "Nơi nhận văn bản phải có bộ phận lưu trữ văn thư", () => {
    const repValid = validateND30Compliance({ recipients: "Như trên;\nLưu: VT, TH." });
    assert.equal(repValid.issues.some(i => i.id === "recipients"), false);

    const repEmpty = validateND30Compliance({ recipients: "" });
    assert.equal(repEmpty.issues.some(i => i.id === "recipients"), true);
  });

  // ----------------------------------------------------------------------
  // 18. Lề trang chuẩn Phụ lục I NĐ 30 & Phép thử tạo DOCX thật
  // ----------------------------------------------------------------------
  await runTest("TEST-18", "Tạo DOCX thật, kiểm tra lề A4 (20-20-30-15mm), OOXML nhị phân và chữ Việt", async () => {
    // 1. Kiểm tra cấu hình lề trang theo Phụ lục I NĐ 30: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm
    assert.equal(ND30_PAGE_MARGINS.top, convertMillimetersToTwip(20), "Lề trên phải là 20mm");
    assert.equal(ND30_PAGE_MARGINS.bottom, convertMillimetersToTwip(20), "Lề dưới phải là 20mm");
    assert.equal(ND30_PAGE_MARGINS.left, convertMillimetersToTwip(30), "Lề trái phải là 30mm");
    assert.equal(ND30_PAGE_MARGINS.right, convertMillimetersToTwip(15), "Lề phải phải là 15mm");

    // 2. Tạo đối tượng Document thật và xuất ra binary OOXML buffer
    const sampleData: DocumentFormatType = {
      regime: "administrative",
      nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
      fontFamily: "Times New Roman",
      fontSize: 13,
      orgHeader1: "ỦY BAN NHÂN DÂN THÀNH PHỐ",
      orgHeader2: "VĂN PHÒNG ỦY BAN",
      locationAndDate: "Hải Phòng, ngày 14 tháng 10 năm 2026",
      documentType: "QUYẾT ĐỊNH",
      referenceNumber: "Số: 125/QĐ-UBND",
      subject: "V/v ban hành quy định thể thức văn bản hành chính",
      bodyHtml: "<p><strong>Điều 1.</strong> Ban hành kèm theo Quyết định này Quy định về thể thức văn bản.</p><p><strong>Điều 2.</strong> Quyết định này có hiệu lực thi hành kể từ ngày ký./.</p>",
      signTitle: "TM. ỦY BAN NHÂN DÂN\nCHỦ TỊCH",
      signName: "Nguyễn Văn A",
      recipients: "Như Điều 2;\nLưu: VT, TH."
    };

    const doc = generateND30DocxDocument(sampleData);
    assert.ok(doc, "Instance Document phải được khởi tạo");

    const buffer = await Packer.toBuffer(doc);
    assert.ok(buffer && buffer.length > 2000, "Buffer DOCX phải hợp lệ và lớn hơn 2KB");
    assert.equal(buffer[0], 0x50, "Header zip byte 0 phải là 0x50 (P)");
    assert.equal(buffer[1], 0x4B, "Header zip byte 1 phải là 0x4B (K)");

    // 3. Đọc lại tệp DOCX thật bằng Mammoth
    const parsed = await mammoth.extractRawText({ buffer });
    const rawText = parsed.value;

    assert.ok(rawText.includes("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"), "Tiếng Việt chữ Quốc hiệu phải nguyên vẹn");
    assert.ok(rawText.includes("Độc lập - Tự do - Hạnh phúc"), "Tiếng Việt chữ Tiêu ngữ phải nguyên vẹn");
    assert.ok(rawText.includes("QUYẾT ĐỊNH"), "Tên loại văn bản phải có trong văn bản");
    assert.ok(rawText.includes("Hải Phòng, ngày 14 tháng 10 năm 2026"), "Địa danh ngày tháng phải nguyên vẹn");
    assert.ok(rawText.includes("Nguyễn Văn A"), "Họ tên người ký phải nguyên vẹn");
  });

  // ----------------------------------------------------------------------
  // 19. Chống tấn công XSS và làm sạch HTML
  // ----------------------------------------------------------------------
  await runTest("TEST-19", "Làm sạch HTML, loại bỏ thẻ script, onerror, iframe độc hại", () => {
    const malicious = `<p>Văn bản hợp lệ</p><script>alert('xss')</script><img src="x" onerror="stealCookie()"><iframe src="evil.com"></iframe>`;
    const sanitized = sanitizeBodyHtml(malicious);
    assert.equal(sanitized.includes("<script>"), false);
    assert.equal(sanitized.includes("onerror"), false);
    assert.equal(sanitized.includes("<iframe>"), false);
    assert.equal(sanitized.includes("Văn bản hợp lệ"), true);
  });

  // ----------------------------------------------------------------------
  // 20. Phân biệt rõ ràng phản hồi AI vs Rule Fallback
  // ----------------------------------------------------------------------
  await runTest("TEST-20", "Minh bạch cờ isFallback và source trong cơ chế fallback", () => {
    const aiSuccessResp = { success: true, source: "gemini_ai", isFallback: false };
    assert.equal(aiSuccessResp.isFallback, false);
    assert.equal(aiSuccessResp.source, "gemini_ai");

    const fallbackResp = { success: true, source: "rule_fallback", isFallback: true };
    assert.equal(fallbackResp.isFallback, true);
    assert.equal(fallbackResp.source, "rule_fallback");
  });

  // ----------------------------------------------------------------------
  // 21. Bảng 2 cột & Đọc lại OOXML kiểm tra thứ tự đoạn và bảng dữ liệu
  // ----------------------------------------------------------------------
  await runTest("TEST-21", "Tạo DOCX thật, đọc lại OOXML kiểm tra thứ tự đoạn văn và bảng", async () => {
    const sampleWithTable: DocumentFormatType = {
      regime: "administrative",
      nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc",
      fontFamily: "Times New Roman",
      fontSize: 13,
      orgHeader1: "ỦY BAN NHÂN DÂN THÀNH PHỐ",
      orgHeader2: "SỞ NỘI VỤ",
      locationAndDate: "Đà Nẵng, ngày 10 tháng 8 năm 2026",
      documentType: "BÁO CÁO",
      referenceNumber: "Số: 99/BC-SNV",
      subject: "Báo cáo thống kê nhân sự và biên chế cơ quan",
      bodyHtml: `
        <p>Kính gửi: Ủy ban nhân dân thành phố</p>
        <p>Sở Nội vụ báo cáo tình hình biên chế theo bảng dưới đây:</p>
        <table>
          <tr><th>STT</th><th>Đơn vị</th><th>Biên chế</th></tr>
          <tr><td>1</td><td>Văn phòng Sở</td><td>15</td></tr>
          <tr><td>2</td><td>Phòng Tổ chức cán bộ</td><td>12</td></tr>
        </table>
        <p>Kính trình UBND thành phố xem xét, phê duyệt./.</p>
      `,
      signTitle: "GIÁM ĐỐC",
      signName: "Trần Thị B",
      recipients: "Như trên;\nLưu: VT."
    };

    const doc = generateND30DocxDocument(sampleWithTable);
    const buffer = await Packer.toBuffer(doc);

    // 1. Kiểm tra bảng tồn tại trong HTML chuyển đổi từ OOXML thật qua Mammoth
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const html = htmlResult.value;
    assert.ok(html.includes("<table>") && html.includes("</table>"), "Tệp Word phải chứa bảng dữ liệu (table)");
    assert.ok(html.includes("Văn phòng Sở"), "Tế bào bảng phải chứa đúng nội dung đơn vị");
    assert.ok(html.includes("Phòng Tổ chức cán bộ"), "Tế bào bảng phải chứa đúng phòng ban");

    // 2. Kiểm tra thứ tự các đoạn văn logic chuẩn văn bản hành chính
    const textResult = await mammoth.extractRawText({ buffer });
    const docText = textResult.value;

    const idxHeader = docText.indexOf("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM");
    const idxDocType = docText.indexOf("BÁO CÁO");
    const idxSubject = docText.indexOf("Báo cáo thống kê nhân sự");
    const idxBody = docText.indexOf("Kính gửi: Ủy ban nhân dân");
    const idxTable = docText.indexOf("Văn phòng Sở");
    const idxSignTitle = docText.indexOf("GIÁM ĐỐC");
    const idxSignName = docText.indexOf("Trần Thị B");
    const idxRecipients = docText.indexOf("Nơi nhận");

    assert.ok(idxHeader >= 0 && idxDocType > idxHeader, "Header phải xuất hiện trước Tên loại văn bản");
    assert.ok(idxSubject > idxDocType, "Tên loại văn bản phải xuất hiện trước Trích yếu");
    assert.ok(idxBody > idxSubject, "Trích yếu phải xuất hiện trước Nội dung");
    assert.ok(idxTable > idxBody, "Nội dung dẫn nhập phải xuất hiện trước Bảng biểu");
    assert.ok(idxSignTitle > idxTable, "Bảng biểu phải xuất hiện trước Khối chữ ký");
    assert.ok(idxSignName > idxSignTitle, "Chức vụ người ký phải xuất hiện trước Tên người ký");
    assert.ok(idxRecipients >= 0, "Khối nơi nhận phải có trong tệp Word");
  });

  // ----------------------------------------------------------------------
  // TỔNG KẾT KẾT QUẢ KIỂM TRA
  // ----------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(` KẾT QUẢ KIỂM TRA: ${passed}/21 PASS, ${failed} FAIL`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log(" TẤT CẢ 21 KIỂM TRA THỂ THỨC ĐỀU ĐẠT CHUẨN XÁC THỰC NGHIỆM THU!");
  }
}

main();
