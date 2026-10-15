import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { auditCanonicalND30, auditGeneratedDocx } from '../src/canonical/nd30/canonicalAudit.ts';
import {
  COMPANY_HEADER_GEOMETRY_MM, COMPANY_HEADER_PARENT, COMPANY_HEADER_ISSUER,
  COMPANY_HEADER_PROFILE_ID, applyCompanyProfile, matchesCompanyHeader,
} from '../src/canonical/nd30/companyHeader.ts';
import { generateND30DocxDocument } from '../src/utils/docxExport.ts';

const audit = auditCanonicalND30();
assert.equal(audit.total,435,'Canonical release catalogue must include exactly 435 verified rule IDs');
assert.notEqual(audit.commit,'NOT_SYNCED','Rule sync must run before tests');
assert.equal(audit.findings.length,435);
assert.equal(new Set(audit.findings.map(x=>x.ruleId)).size,435);
assert.equal(audit.counts.PASS,0,'No OOXML evidence -> no PASS');

const doc = applyCompanyProfile({
  regime: 'administrative' as const, fontFamily: 'Times New Roman' as const,
  fontSize: 13 as const,
  nationalHeader1: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM' as const,
  nationalHeader2: 'Độc lập - Tự do - Hạnh phúc' as const,
  orgHeader1:'[UNVERIFIED]',orgHeader2:'[UNVERIFIED]',
  referenceNumber:'Số: …/BB-HTMB', locationAndDate:'Hải Phòng, ngày … tháng … năm …',
  documentType:'BIÊN BẢN',subject:'Làm việc về công tác tổ chức',
  bodyHtml:'<p>Nội dung tổng hợp phục vụ phép thử.</p>',
  signTitle:'GIÁM ĐỐC',signName:'[Họ tên]',recipients:'Lưu: VT.',
});
const buffer=await Packer.toBuffer(generateND30DocxDocument(doc));
const zip=await JSZip.loadAsync(buffer);
const xml=await zip.file('word/document.xml')?.async('string');
assert.ok(xml,'Word document.xml must exist');
const sx = xml!;
assert.ok(sx.includes(COMPANY_HEADER_PARENT.split(' ')[0]));
assert.ok(sx.includes('TỔNG CÔNG TY BẢO ĐẢM'));
assert.ok(sx.includes('AN TOÀN HÀNG HẢI VIỆT NAM'));
assert.ok(sx.includes('CÔNG TY HOA TIÊU'));
assert.ok(sx.includes('HÀNG HẢI MIỀN BẮC'));
assert.ok(sx.includes(COMPANY_HEADER_ISSUER.split(' ').slice(-2).join(' ')));
assert.ok(sx.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'));
const firstCellStart = sx.indexOf('<w:tc>');
const firstCellEnd = sx.indexOf('</w:tc>', firstCellStart);
assert.ok(firstCellStart >= 0 && firstCellEnd > firstCellStart, 'Company header needs a left table cell');
const leftCellXml = sx.slice(firstCellStart, firstCellEnd);
assert.equal((leftCellXml.match(/<w:br\b/g) || []).length, 1,
  'The Word reference breaks the parent name once but keeps the company name on one line');
assert.ok(leftCellXml.includes(`>${COMPANY_HEADER_ISSUER}</w:t>`),
  'The full company name must be one uninterrupted Word run, as in Tieu ngu chuan.docx');
assert.ok(/<w:tblInd\b[^>]*w:w="-874"/.test(sx),
  'The original Word reference places the table 874 twips left of the text margin');
assert.ok(/<w:gridCol\b[^>]*w:w="5187"/.test(sx) && /<w:gridCol\b[^>]*w:w="5245"/.test(sx),
  'The original Word reference uses 5187/5245 twip columns so both bold headings fit on one line');
const headerTableXml = sx.slice(sx.indexOf('<w:tbl>'), sx.indexOf('</w:tbl>') + '</w:tbl>'.length);
const dateCellXml = headerTableXml.slice(headerTableXml.lastIndexOf('<w:tc>'));
assert.ok(/<w:jc\b[^>]*w:val="right"/.test(dateCellXml),
  'The location and date must align with the right edge of the national heading in the Word reference');
assert.ok(sx.includes('<w:tblW') && sx.includes(String(Math.round(COMPANY_HEADER_GEOMETRY_MM.headerWidth*1440/25.4)).slice(0,3)), 'Company header should be a fixed-width table');
assert.ok(sx.includes('<w:bottom') || sx.includes('<w:pBdr'), 'Real paragraph underlines required, not hyphen text');
const assessed=await auditGeneratedDocx(new Blob([new Uint8Array(buffer)]));
assert.equal(assessed.total,435);
assert.ok(assessed.counts.PASS+assessed.counts.FAIL+assessed.counts.NOT_EVALUATED+assessed.counts.NOT_APPLICABLE+assessed.counts.NEEDS_REVIEW===435);

const imported = {regime:'administrative',orgHeader1:'OTHER',orgHeader2:'OTHER',headerProfile:'generic'};
assert.equal(imported.headerProfile,'generic','Imported documents must not inherit fixed company header');
assert.equal(matchesCompanyHeader('TỔNG CÔNG TY BẢO ĐẢM\nAN TOÀN HÀNG HẢI VIỆT NAM', COMPANY_HEADER_ISSUER), true,
  'A matching imported company document must use the visual company profile');
assert.equal(matchesCompanyHeader('TỔNG CÔNG TY BẢO ĐẢM  AN TOÀN HÀNG HẢI VIỆT NAM', COMPANY_HEADER_ISSUER), true);
assert.equal(matchesCompanyHeader('OTHER', COMPANY_HEADER_ISSUER), false);
assert.equal(matchesCompanyHeader(COMPANY_HEADER_PARENT, 'OTHER'), false);
assert.equal(doc.headerProfile,COMPANY_HEADER_PROFILE_ID);

console.log(`[CANONICAL] 435 verified rules loaded; PASS=${assessed.counts.PASS}, NOT_EVALUATED=${assessed.counts.NOT_EVALUATED}.`);
console.log('[COMPANY HEADER] Word-reference table, one-line issuer, true paragraph borders, imported-doc protection: OK');
