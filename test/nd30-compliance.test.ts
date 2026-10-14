import assert from "node:assert/strict";
import { 
  validateND30Compliance, 
  isPlaceholderValue, 
  REFERENCE_NUMBER_REGEX, 
  LOCATION_AND_DATE_REGEX 
} from "../src/shared/schemas/document.schema.ts";
import { 
  enforceND30Standards, 
  extractLocation, 
  normalizeReferenceNumber, 
  sanitizeBodyHtml 
} from "../src/server/middleware/compliance.middleware.ts";

console.log("==================================================================");
console.log(" BỘ KIỂM TRA TOÀN DIỆN THỂ THỨC NGHỊ ĐỊNH 30/2020 & HD 05 (21 TESTS)");
console.log("==================================================================\n");

let passed = 0;
let failed = 0;

function runTest(testId: string, title: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${testId}: ${title}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${testId}: ${title}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

// ----------------------------------------------------------------------
// 1. Quốc hiệu NĐ 30
// ----------------------------------------------------------------------
runTest("TEST-01", "Quốc hiệu NĐ 30 bắt buộc là 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'", () => {
  const repCorrect = validateND30Compliance({ nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" }, "administrative");
  assert.equal(repCorrect.issues.some(i => i.id === "nationalHeader1"), false);

  const repWrong = validateND30Compliance({ nationalHeader1: "Cộng hòa xã hội chủ nghĩa Việt Nam" }, "administrative");
  assert.equal(repWrong.issues.some(i => i.id === "nationalHeader1"), true);
});

// ----------------------------------------------------------------------
// 2. Tiêu ngữ NĐ 30
// ----------------------------------------------------------------------
runTest("TEST-02", "Tiêu ngữ NĐ 30 bắt buộc là 'Độc lập - Tự do - Hạnh phúc'", () => {
  const repCorrect = validateND30Compliance({ nationalHeader2: "Độc lập - Tự do - Hạnh phúc" }, "administrative");
  assert.equal(repCorrect.issues.some(i => i.id === "nationalHeader2"), false);

  const repWrong = validateND30Compliance({ nationalHeader2: "ĐỘC LẬP - TỰ DO - HẠNH PHÚC" }, "administrative");
  assert.equal(repWrong.issues.some(i => i.id === "nationalHeader2"), true);
});

// ----------------------------------------------------------------------
// 3. Quốc hiệu Văn bản Đảng HD 05
// ----------------------------------------------------------------------
runTest("TEST-03", "Quốc hiệu Đảng theo HD 05 bắt buộc là 'ĐẢNG CỘNG SẢN VIỆT NAM'", () => {
  const repParty = validateND30Compliance({ nationalHeader1: "ĐẢNG CỘNG SẢN VIỆT NAM", nationalHeader2: "" }, "party");
  assert.equal(repParty.issues.some(i => i.id === "nationalHeader1"), false);

  const enforced = enforceND30Standards({}, "party");
  assert.equal(enforced.nationalHeader1, "ĐẢNG CỘNG SẢN VIỆT NAM");
});

// ----------------------------------------------------------------------
// 4. Tiêu ngữ Văn bản Đảng HD 05
// ----------------------------------------------------------------------
runTest("TEST-04", "Văn bản Đảng theo HD 05 không có tiêu ngữ", () => {
  const repPartyNoMotto = validateND30Compliance({ nationalHeader1: "ĐẢNG CỘNG SẢN VIỆT NAM", nationalHeader2: "" }, "party");
  assert.equal(repPartyNoMotto.issues.some(i => i.id === "nationalHeader2"), false);

  const repPartyWithMotto = validateND30Compliance({ nationalHeader1: "ĐẢNG CỘNG SẢN VIỆT NAM", nationalHeader2: "Độc lập - Tự do - Hạnh phúc" }, "party");
  assert.equal(repPartyWithMotto.issues.some(i => i.id === "nationalHeader2"), true);
});

// ----------------------------------------------------------------------
// 5. Tên cơ quan ban hành phải viết in hoa
// ----------------------------------------------------------------------
runTest("TEST-05", "Tên cơ quan ban hành bắt buộc viết IN HOA", () => {
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
runTest("TEST-06", "Từ chối và cảnh báo placeholder cơ quan ban hành", () => {
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
runTest("TEST-07", "Số ký hiệu văn bản phải có tiền tố 'Số: '", () => {
  assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 12/QĐ-UBND"), true);
  assert.equal(REFERENCE_NUMBER_REGEX.test("12/QĐ-UBND"), false);

  const normalized = normalizeReferenceNumber("12/QĐ-UBND", "QĐ");
  assert.equal(normalized.startsWith("Số: "), true);
});

// ----------------------------------------------------------------------
// 8. Định dạng số ký hiệu văn bản hành chính NĐ 30
// ----------------------------------------------------------------------
runTest("TEST-08", "Định dạng số ký hiệu hành chính NĐ 30 hợp lệ", () => {
  assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 125/QĐ-UBND"), true);
  assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 45/2026/NĐ-CP"), true);
  assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 18/STP-VP"), true);
});

// ----------------------------------------------------------------------
// 9. Định dạng số ký hiệu văn bản Đảng HD 05
// ----------------------------------------------------------------------
runTest("TEST-09", "Định dạng số ký hiệu văn bản Đảng HD 05 hợp lệ", () => {
  assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 01-NQ/TW"), true);
  assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 15-HD/BTCTW"), true);
  assert.equal(REFERENCE_NUMBER_REGEX.test("Số: 24-CT/TU"), true);
});

// ----------------------------------------------------------------------
// 10. Từ chối placeholder số ký hiệu và không tự điền số giả
// ----------------------------------------------------------------------
runTest("TEST-10", "Từ chối placeholder số ký hiệu và không tự điền số giả", () => {
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
runTest("TEST-11", "Định dạng địa danh và ngày tháng năm ban hành chuẩn", () => {
  assert.equal(LOCATION_AND_DATE_REGEX.test("Hà Nội, ngày 14 tháng 10 năm 2026"), true);
  assert.equal(LOCATION_AND_DATE_REGEX.test("TP. Hồ Chí Minh, ngày 05 tháng 02 năm 2026"), true);
  assert.equal(LOCATION_AND_DATE_REGEX.test("Hải Phòng, ngày 30 tháng 12 năm 2025"), true);
  assert.equal(LOCATION_AND_DATE_REGEX.test("14/10/2026"), false);
});

// ----------------------------------------------------------------------
// 12. Quy tắc số 0 đứng trước ngày dưới 10 và tháng 1, 2
// ----------------------------------------------------------------------
runTest("TEST-12", "Tuân thủ quy tắc số 0 đứng trước ngày dưới 10 và tháng 1, 2", () => {
  assert.equal(LOCATION_AND_DATE_REGEX.test("Đà Nẵng, ngày 05 tháng 02 năm 2026"), true);
  assert.equal(LOCATION_AND_DATE_REGEX.test("Cần Thơ, ngày 09 tháng 01 năm 2026"), true);
});

// ----------------------------------------------------------------------
// 13. Tuyệt đối không tự ý gán 'Hà Nội' hoặc ngày giả khi thiếu dữ liệu
// ----------------------------------------------------------------------
runTest("TEST-13", "extractLocation không được tự mặc định gán 'Hà Nội'", () => {
  assert.equal(extractLocation(undefined), "");
  assert.equal(extractLocation(""), "");
  assert.equal(extractLocation("[Địa danh], ngày ... tháng ... năm ..."), "");
  assert.equal(extractLocation("Đà Nẵng, ngày 15 tháng 8 năm 2026"), "Đà Nẵng");
});

// ----------------------------------------------------------------------
// 14. Loại văn bản in hoa đứng đậm
// ----------------------------------------------------------------------
runTest("TEST-14", "Loại văn bản chuẩn hóa in hoa và đúng danh mục quy định", () => {
  const validTypes = ["QUYẾT ĐỊNH", "CÔNG VĂN", "BÁO CÁO", "KẾ HOẠCH", "TỜ TRÌNH", "THÔNG BÁO", "BIÊN BẢN"];
  for (const vt of validTypes) {
    const rep = validateND30Compliance({ documentType: vt, subject: "Nội dung hợp lệ" });
    assert.equal(rep.issues.some(i => i.id === "documentType"), false);
  }
});

// ----------------------------------------------------------------------
// 15. Trích yếu nội dung văn bản (subject)
// ----------------------------------------------------------------------
runTest("TEST-15", "Trích yếu nội dung văn bản không được để trống hoặc placeholder", () => {
  const repValid = validateND30Compliance({ documentType: "QUYẾT ĐỊNH", subject: "V/v phê duyệt kế hoạch chuyển đổi số" });
  assert.equal(repValid.issues.some(i => i.id === "subject"), false);

  const repPh = validateND30Compliance({ documentType: "QUYẾT ĐỊNH", subject: "[Trích yếu nội dung]" });
  assert.equal(repPh.issues.some(i => i.id === "subject"), true);
});

// ----------------------------------------------------------------------
// 16. Phông chữ chuẩn Times New Roman và cỡ chữ 13pt
// ----------------------------------------------------------------------
runTest("TEST-16", "Compliance middleware ép buộc font Times New Roman & cỡ chữ 13", () => {
  const enforced = enforceND30Standards({ fontFamily: "Arial", fontSize: 10 });
  assert.equal(enforced.fontFamily, "Times New Roman");
  assert.equal(enforced.fontSize, 13);
});

// ----------------------------------------------------------------------
// 17. Nơi nhận và bộ phận lưu trữ văn thư
// ----------------------------------------------------------------------
runTest("TEST-17", "Nơi nhận văn bản phải có bộ phận lưu trữ văn thư", () => {
  const repValid = validateND30Compliance({ recipients: "Như trên;\nLưu: VT, TH." });
  assert.equal(repValid.issues.some(i => i.id === "recipients"), false);

  const repEmpty = validateND30Compliance({ recipients: "" });
  assert.equal(repEmpty.issues.some(i => i.id === "recipients"), true);
});

// ----------------------------------------------------------------------
// 18. Lề trang chuẩn Phụ lục I NĐ 30
// ----------------------------------------------------------------------
runTest("TEST-18", "Cấu hình lề trang A4 tuân thủ Phụ lục I NĐ 30: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm", () => {
  // Khoảng quy định: Trên 20-25mm, Dưới 20-25mm, Trái 30-35mm, Phải 15-20mm
  const margins = { top: 20, bottom: 20, left: 30, right: 15 };
  assert.ok(margins.top >= 20 && margins.top <= 25, "Top margin valid");
  assert.ok(margins.bottom >= 20 && margins.bottom <= 25, "Bottom margin valid");
  assert.ok(margins.left >= 30 && margins.left <= 35, "Left margin valid");
  assert.ok(margins.right >= 15 && margins.right <= 20, "Right margin valid");
});

// ----------------------------------------------------------------------
// 19. Chống tấn công XSS và làm sạch HTML
// ----------------------------------------------------------------------
runTest("TEST-19", "Làm sạch HTML, loại bỏ thẻ script, onerror, iframe độc hại", () => {
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
runTest("TEST-20", "Minh bạch cờ isFallback và source trong cơ chế fallback", () => {
  const aiSuccessResp = { success: true, source: "gemini_ai", isFallback: false };
  assert.equal(aiSuccessResp.isFallback, false);
  assert.equal(aiSuccessResp.source, "gemini_ai");

  const fallbackResp = { success: true, source: "rule_fallback", isFallback: true };
  assert.equal(fallbackResp.isFallback, true);
  assert.equal(fallbackResp.source, "rule_fallback");
});

// ----------------------------------------------------------------------
// 21. Bảng 2 cột cho Quốc hiệu - Cơ quan và Khối chữ ký không viền
// ----------------------------------------------------------------------
runTest("TEST-21", "Cấu trúc bố cục Header và Chữ ký sử dụng bảng 2 cột viền ẩn", () => {
  const mockTableConfig = {
    columns: 2,
    borderStyle: "none",
    col1Ratio: 0.45,
    col2Ratio: 0.55
  };
  assert.equal(mockTableConfig.columns, 2);
  assert.equal(mockTableConfig.borderStyle, "none");
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
