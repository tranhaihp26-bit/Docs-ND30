import assert from "node:assert/strict";
import JSZip from "jszip";
import { Packer } from "docx";
import { applyCompanyProfile, COMPANY_HEADER_ISSUER } from "../src/canonical/nd30/companyHeader.ts";
import { validateND30Compliance } from "../src/shared/schemas/document.schema.ts";
import { generateND30DocxDocument } from "../src/utils/docxExport.ts";
import { MINUTES_TEMPLATE } from "../src/utils/minutesTemplate.ts";

assert.equal(MINUTES_TEMPLATE.type, "state");
assert.equal(MINUTES_TEMPLATE.defaultData.documentType, "BIÊN BẢN");
assert.match(MINUTES_TEMPLATE.badge, /Mẫu 1\.9/);
assert.equal(MINUTES_TEMPLATE.defaultData.locationAndDate, "", "Mẫu 1.9 puts meeting time in the body instead of an issue-date line in the header");
for (const label of ["Thời gian bắt đầu", "Địa điểm", "Thành phần tham dự", "Chủ trì", "Thư ký", "Nội dung", "kết thúc vào"]) {
  assert.ok(MINUTES_TEMPLATE.defaultData.bodyHtml.includes(label), `template should include ${label}`);
}
assert.deepEqual(MINUTES_TEMPLATE.defaultData.signatureBlocks?.map(block => block.role), ["THƯ KÝ", "CHỦ TỌA"]);
assert.ok(!MINUTES_TEMPLATE.defaultData.bodyHtml.includes("<table"), "signature table is not part of the body editor");
assert.equal(MINUTES_TEMPLATE.defaultData.recipients, "Lưu: VT, hồ sơ.");

const data = applyCompanyProfile(MINUTES_TEMPLATE.defaultData);
assert.equal(data.locationAndDate, "", "company profile application must not insert the generic header date into minutes");
const compliance = validateND30Compliance(data, "administrative");
assert.equal(compliance.totalChecks, 8, "the general issue-date header check does not apply to Mẫu 1.9 minutes");
assert.ok(!compliance.issues.some(issue => issue.field === "locationAndDate"), "minutes must not be flagged for omitting a separate header issue date");
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
  signatureBlocks: data.signatureBlocks,
  recipients: data.recipients,
});
const zip = await JSZip.loadAsync(await Packer.toBuffer(docx));
const xml = await zip.file("word/document.xml")!.async("string");
assert.ok(xml.includes(COMPANY_HEADER_ISSUER), "the company profile must be the header source");
assert.ok(!xml.includes("Hải Phòng, ngày"), "the Mẫu 1.9 header must not contain a generic location/date line");
assert.ok(xml.includes("THƯ KÝ") && xml.includes("CHỦ TỌA"), "both minutes signers must be exported");
assert.ok(xml.includes("[Họ và tên]"), "signer names remain editable independent fields");
assert.ok(xml.includes("Nơi nhận:") && xml.includes("Lưu: VT, hồ sơ."), "the editable archive recipient must be exported");
assert.equal((xml.match(/<w:tbl>/g) || []).length, 2, "only the company header and the minutes sign table should be tables");
assert.ok(!xml.includes("[CHỨC VỤ]"), "the generic single-signer block must not be added");

const minutesWithoutSigners = generateND30DocxDocument({
  regime: "administrative",
  headerProfile: data.headerProfile,
  nationalHeader1: data.nationalHeader1 as "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
  nationalHeader2: data.nationalHeader2 as "Độc lập - Tự do - Hạnh phúc",
  fontFamily: "Times New Roman",
  fontSize: 13,
  orgHeader1: data.orgHeader1,
  orgHeader2: data.orgHeader2,
  locationAndDate: "",
  documentType: "BIÊN BẢN",
  referenceNumber: data.referenceNumber,
  subject: data.subject,
  bodyHtml: data.bodyHtml,
  signTitle: "",
  signName: "",
  signatureBlocks: [],
  recipients: data.recipients,
});
const recipientOnlyZip = await JSZip.loadAsync(await Packer.toBuffer(minutesWithoutSigners));
const recipientOnlyXml = await recipientOnlyZip.file("word/document.xml")!.async("string");
assert.ok(recipientOnlyXml.includes("Nơi nhận:") && recipientOnlyXml.includes("Lưu: VT, hồ sơ."), "minutes recipients remain independent even when no signer block was extracted");
