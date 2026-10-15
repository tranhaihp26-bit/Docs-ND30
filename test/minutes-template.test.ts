import assert from "node:assert/strict";
import JSZip from "jszip";
import { Packer } from "docx";
import { applyCompanyProfile, COMPANY_HEADER_ISSUER } from "../src/canonical/nd30/companyHeader.ts";
import { generateND30DocxDocument } from "../src/utils/docxExport.ts";
import { MINUTES_TEMPLATE } from "../src/utils/minutesTemplate.ts";

assert.equal(MINUTES_TEMPLATE.type, "state");
assert.equal(MINUTES_TEMPLATE.defaultData.documentType, "BIÊN BẢN");
assert.match(MINUTES_TEMPLATE.badge, /Mẫu 1\.9/);
for (const label of ["Thời gian bắt đầu", "Địa điểm", "Thành phần tham dự", "Chủ trì", "Thư ký", "Nội dung", "kết thúc vào", "THƯ KÝ", "CHỦ TỌA"]) {
  assert.ok(MINUTES_TEMPLATE.defaultData.bodyHtml.includes(label), `template should include ${label}`);
}
assert.equal(MINUTES_TEMPLATE.defaultData.recipients, "Lưu: VT, hồ sơ.");

const data = applyCompanyProfile(MINUTES_TEMPLATE.defaultData);
const docx = generateND30DocxDocument({
  regime: "administrative",
  headerProfile: data.headerProfile,
  nationalHeader1: data.nationalHeader1 as "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
  nationalHeader2: data.nationalHeader2 as "Độc lập - Tự do - Hạnh phúc",
  fontFamily: "Times New Roman",
  fontSize: 13,
  orgHeader1: data.orgHeader1,
  orgHeader2: data.orgHeader2,
  locationAndDate: data.locationAndDate,
  documentType: data.documentType,
  referenceNumber: data.referenceNumber,
  subject: data.subject,
  bodyHtml: data.bodyHtml,
  signTitle: data.signTitle,
  signName: data.signName,
  recipients: data.recipients,
});
const zip = await JSZip.loadAsync(await Packer.toBuffer(docx));
const xml = await zip.file("word/document.xml")!.async("string");
assert.ok(xml.includes(COMPANY_HEADER_ISSUER), "the company profile must be the header source");
assert.ok(xml.includes("THƯ KÝ") && xml.includes("CHỦ TỌA"), "both minutes signers must be exported");
assert.ok(xml.includes("Nơi nhận:") && xml.includes("Lưu: VT, hồ sơ."), "the editable archive recipient must be exported");
assert.equal((xml.match(/<w:tbl>/g) || []).length, 2, "only the company header and the minutes sign table should be tables");
assert.ok(!xml.includes("[CHỨC VỤ]"), "the generic single-signer block must not be added");
