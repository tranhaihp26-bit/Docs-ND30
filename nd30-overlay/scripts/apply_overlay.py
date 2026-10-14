#!/usr/bin/env python3
"""Idempotent source overlay. Expects the original Docs-ND30 checkout.
Fail closed if a critical source anchor changed. Does not push or deploy.
"""
import argparse
import re
import shutil
from pathlib import Path

OVERLAY = Path(__file__).resolve().parents[1]

def replace_once(s,old,new,label):
    if new in s: return s
    if s.count(old)!=1: raise RuntimeError(f'{label}: expected 1 occurrence, got {s.count(old)}; source differs, manual review required')
    return s.replace(old,new,1)

def patch_schema(s):
    s=replace_once(s,'import { z } from "zod";',
        'import { z } from "zod";\nimport { COMPANY_HEADER_PROFILE_ID } from "../../canonical/nd30/companyHeader.ts";\nimport { auditCanonicalND30 } from "../../canonical/nd30/canonicalAudit.ts";', 'schema imports')
    s=replace_once(s,'  regime: z.enum(["administrative", "party"]).default("administrative"),',
        '  regime: z.enum(["administrative", "party"]).default("administrative"),\n  headerProfile: z.enum(["generic", COMPANY_HEADER_PROFILE_ID]).optional(),', 'schema profile field')
    s=replace_once(s,'  issues: ND30ComplianceIssue[];\n}',
        '  issues: ND30ComplianceIssue[];\n  canonical?: { total: number; passed: number; failed: number; notEvaluated: number; needsReview: number; notApplicable: number; sourceCommit: string };\n}', 'canonical report shape')
    anchor='  const passed = issues.filter(i => i.severity === "error").length === 0;\n\n  return {'
    new='''  const passed = issues.filter(i => i.severity === "error").length === 0;
  // The nine field checks ARE NOT a full legal compliance certification.
  // The verified 435-rule catalogue is always counted, including NOT_EVALUATED.
  const canonicalAudit = isParty ? undefined : auditCanonicalND30();
  const canonical = canonicalAudit ? {
    total: canonicalAudit.total,
    passed: canonicalAudit.counts.PASS,
    failed: canonicalAudit.counts.FAIL,
    notEvaluated: canonicalAudit.counts.NOT_EVALUATED,
    needsReview: canonicalAudit.counts.NEEDS_REVIEW,
    notApplicable: canonicalAudit.counts.NOT_APPLICABLE,
    sourceCommit: canonicalAudit.commit,
  } : undefined;
  // Keep the legacy 9-check issue list stable for P0 tests; show canonical coverage separately in UI.
  return {'''
    s=replace_once(s,anchor,new,'audit integration')
    s=replace_once(s,'    passedChecks,\n    issues,\n  };','    passedChecks,\n    issues,\n    canonical,\n  };','audit return')
    return s

def patch_app(s):
    s=replace_once(s,'import { detectDocumentType } from "./server/parser.ts";',
                   'import { detectDocumentType } from "./server/parser.ts";\nimport { COMPANY_HEADER_PROFILE_ID, applyCompanyProfile, LOCKED_COMPANY_FIELDS } from "./canonical/nd30/companyHeader.ts";', 'app imports')
    s=replace_once(s,'export interface DocumentState {\n',
                   'export interface DocumentState {\n  headerProfile?: "generic" | typeof COMPANY_HEADER_PROFILE_ID;\n','app DocumentState')
    s=replace_once(s,'const [doc, setDoc] = useState<DocumentState>(TEMPLATES[0].defaultData);',
                   'const [doc, setDoc] = useState<DocumentState>(applyCompanyProfile(TEMPLATES[0].defaultData));', 'app initial doc')
    s=replace_once(s,'      data: TEMPLATES[0].defaultData\n',
                   '      data: applyCompanyProfile(TEMPLATES[0].defaultData)\n','app initial version')
    s=replace_once(s,'    setDoc(prev => ({ ...prev, [field]: value }));',
                   '''    // Company identity is locked only for NEW templates. Imported documents stay untouched.
    if (standardType === "state" && doc.headerProfile === COMPANY_HEADER_PROFILE_ID && LOCKED_COMPANY_FIELDS.has(field)) return;
    setDoc(prev => ({ ...prev, [field]: value }));''','app guard')
    anchor='''    setStandardType(t.type);
    setDoc(t.defaultData);
    pushVersion(`Áp dụng mẫu: ${t.name}`, t.defaultData);'''
    repl='''    setStandardType(t.type);
    const selectedDoc = t.type === "state" ? applyCompanyProfile({...t.defaultData}) : {...t.defaultData, headerProfile: "generic" as const};
    setDoc(selectedDoc);
    pushVersion(`Áp dụng mẫu: ${t.name}`, selectedDoc);'''
    s=replace_once(s,anchor,repl,'app template selector')
    s=replace_once(s,'    setDoc(aiProposal);\n',
                   '''    setDoc(doc.headerProfile === COMPANY_HEADER_PROFILE_ID && standardType === "state"
      ? applyCompanyProfile({ ...aiProposal, headerProfile: COMPANY_HEADER_PROFILE_ID }) : aiProposal);
''','app AI approval')
    s=replace_once(s,'  const exportToDocx = async () => {\n',
                   '  const exportToDocx = async () => {\n', 'app export exists')
    s=replace_once(s,'      const isParty = standardType === "party";\n      const documentData: DocumentFormatType = {',
                   '''      const isParty = standardType === "party";
      const exportDoc = !isParty && doc.headerProfile === COMPANY_HEADER_PROFILE_ID ? applyCompanyProfile(doc) : doc;
      const documentData: DocumentFormatType = {''','app export profile')
    # Scope fields to the documentData object to avoid changing other screen/state code.
    p=s.find('      const documentData: DocumentFormatType = {')
    q=s.find('      };',p)
    if p<0 or q<0:raise RuntimeError('export object delimiter absent')
    fragment=s[p:q]
    fragment=replace_once(fragment,'        regime: isParty ? "party" : "administrative",',
      '        regime: isParty ? "party" : "administrative",\n        headerProfile: isParty ? "generic" : (exportDoc.headerProfile || "generic"),','app exported headerProfile')
    for name in ('orgHeader1','orgHeader2','locationAndDate','documentType','referenceNumber','subject','bodyHtml','signTitle','signName','recipients'):
      fragment=fragment.replace(f'{name}: doc.{name}',f'{name}: exportDoc.{name}')
    s=s[:p]+fragment+s[q:]
    s=replace_once(s,'        fontSize: 13\n', '        fontSize: standardType === "party" ? 14 : 13\n','app score actual body size')
    s=replace_once(s,'        nationalHeader2: (standardType === "party" ? "" : "Độc lập - Tự do - Hạnh phúc") as any,',
                   '        nationalHeader2: doc.nationalHeader2,','app do not mask motto')
    s=s.replace('"ĐẠT CHUẨN (9/9)"','"ĐẠT 9/9 TRƯỜNG DỮ LIỆU"')
    s=s.replace('Chúc mừng! Toàn bộ 9 thành phần thể thức đều tuân thủ đúng quy định.',
                '9 trường dữ liệu đã đạt; chưa đồng nghĩa toàn bộ quy tắc và DOCX đã được nghiệm thu.')
    s=s.replace('Đã tạo và tải xuống tệp tin Microsoft Word (.docx) chuẩn Nghị định 30 thành công!',
                'Đã tạo DOCX theo cấu hình; vui lòng kiểm tra OOXML và trình bày Word trước khi phát hành.')
    # Show canonical scope explicitly in the existing compliance modal.
    sentence='''                  <p className="text-[11px] opacity-80">
                    Đạt {complianceReport.passedChecks}/{complianceReport.totalChecks} tiêu chí thành phần dữ liệu (NĐ 30 / HD 05).
                  </p>'''
    additional=sentence+'''
                  {standardType === "state" && complianceReport.canonical && (
                    <p className="text-[11px] font-semibold text-amber-700">
                      Catalog: {complianceReport.canonical.total} quy tắc từ repository chuẩn, {complianceReport.canonical.passed} PASS / {complianceReport.canonical.failed} FAIL / {complianceReport.canonical.notEvaluated} NOT_EVALUATED. Không được coi NOT_EVALUATED là PASS.
                    </p>
                  )}'''
    s=replace_once(s,sentence,additional,'app modal canonical status')
    return s

def patch_export(s):
    s=replace_once(s,'import { type DocumentFormatType, isPlaceholderValue } from "../shared/schemas/document.schema.ts";',
                   'import { type DocumentFormatType, isPlaceholderValue } from "../shared/schemas/document.schema.ts";\nimport { COMPANY_HEADER_PROFILE_ID, createCompanyHeaderTable, COMPANY_HEADER_GEOMETRY_MM } from "../canonical/nd30/companyHeader.ts";', 'docx import company')
    s=replace_once(s,'  regime: "administrative" | "party" = "administrative"\n): (Paragraph | Table)[] {',
                   '  regime: "administrative" | "party" = "administrative",\n  bodyInsetMm = 0\n): (Paragraph | Table)[] {','docx body inset param')
    s=replace_once(s,'  const defaultHalfPoints = profile.bodyFontSize * 2;\n',
                   '  const defaultHalfPoints = profile.bodyFontSize * 2;\n  const bodyInsetTwips = convertMillimetersToTwip(bodyInsetMm);\n','docx inset units')
    # Patch only converter function (until parseInlineNodes declaration).
    p=s.index('export function convertHtmlToDocxElements(')
    q=s.index('function parseInlineNodes(',p)
    part=s[p:q]
    part=part.replace('width: { size: 100, type: WidthType.PERCENTAGE },',
                      'width: bodyInsetMm ? {size: convertMillimetersToTwip(COMPANY_HEADER_GEOMETRY_MM.bodyWidth), type: WidthType.DXA} : {size: 100, type: WidthType.PERCENTAGE},')
    part=part.replace('indent: isCentered || isRight ? undefined : { firstLine: 720 },',
                      'indent: bodyInsetMm ? {left: bodyInsetTwips, right: bodyInsetTwips, ...(!isCentered && !isRight ? {firstLine: 720} : {})} : (isCentered || isRight ? undefined : {firstLine: 720}),')
    part=part.replace('indent: { firstLine: 720 }, // 1.27cm',
                      'indent: bodyInsetMm ? {left: bodyInsetTwips, right: bodyInsetTwips, firstLine: 720} : { firstLine: 720 }, // 1.27cm')
    part=part.replace('indent: { firstLine: 720 },\n',
                      'indent: bodyInsetMm ? {left: bodyInsetTwips, right: bodyInsetTwips, firstLine: 720} : { firstLine: 720 },\n')
    s=s[:p]+part+s[q:]
    old='''  const isParty = data.regime === "party";
  const profile = getStyleProfile(data.regime);
  const bodyParagraphs = convertHtmlToDocxElements(data.bodyHtml, data.regime);'''
    new='''  const isParty = data.regime === "party";
  const useCompanyHeader = !isParty && data.headerProfile === COMPANY_HEADER_PROFILE_ID;
  const profile = getStyleProfile(data.regime);
  const bodyParagraphs = convertHtmlToDocxElements(data.bodyHtml, data.regime, useCompanyHeader ? COMPANY_HEADER_GEOMETRY_MM.bodyInset : 0);'''
    s=replace_once(s,old,new,'docx profile')
    s=replace_once(s,'  const shouldRenderHeader = !hasEmbeddedHeader && !isHeaderPlaceholder && (Boolean(data.orgHeader2) || Boolean(data.referenceNumber));',
                   '  const shouldRenderHeader = useCompanyHeader ? !hasEmbeddedHeader : (!hasEmbeddedHeader && !isHeaderPlaceholder && (Boolean(data.orgHeader2) || Boolean(data.referenceNumber)));','docx header decision')
    anchor='''          ...(shouldRenderHeader ? [
            new Table({'''
    newer='''          ...(shouldRenderHeader && useCompanyHeader ? [
            createCompanyHeaderTable(data.referenceNumber, data.locationAndDate),
            new Paragraph({ text: "", spacing: { after: 120 } }),
          ] : []),
          ...(shouldRenderHeader && !useCompanyHeader ? [
            new Table({'''
    s=replace_once(s,anchor,newer,'docx fixed header placement')
    return s

def patch_package(s):
    s=replace_once(s,'"test:ai:live": "tsx test/gemini-live-smoke.test.ts"',
                   '"test:ai:live": "tsx test/gemini-live-smoke.test.ts",\n    "rules:sync": "node scripts/sync_verified_nd30.mjs",\n    "test:canonical": "tsx test/nd30-canonical-overlay.test.ts"','package scripts')
    return s

TARGETS={'src/App.tsx':patch_app,'src/utils/docxExport.ts':patch_export,
         'src/shared/schemas/document.schema.ts':patch_schema,'package.json':patch_package}

def main():
    a=argparse.ArgumentParser();a.add_argument('checkout',type=Path);a.add_argument('--dry-run',action='store_true');v=a.parse_args()
    base=v.checkout.resolve()
    if not (base/'server.ts').exists() or not (base/'src/App.tsx').exists():raise SystemExit('Sai thư mục Docs-ND30 (cần server.ts và src/App.tsx)')
    modifications={}
    for rel,fn in TARGETS.items():
        p=base/rel;old=p.read_text(encoding='utf-8');new=fn(old)
        modifications[rel]=(old,new)
    if v.dry_run:
        for k,(old,new) in modifications.items():print(f'[DRY-RUN] {k}: {len(old)} -> {len(new)} chars')
        return
    for rel,(old,new) in modifications.items():
        p=base/rel
        if p.read_text(encoding='utf-8')!=old:raise RuntimeError('Source changed during patch: '+rel)
    for rel,(old,new) in modifications.items():
        if old==new:continue
        p=base/rel
        backup=base/'.nd30-overlay-backup'/rel;backup.parent.mkdir(parents=True,exist_ok=True)
        if not backup.exists():backup.write_text(old,encoding='utf-8')
        p.write_text(new,encoding='utf-8')
        print('[UPDATED]',rel)
    files=[('src/canonical/nd30/companyHeader.ts','src/canonical/nd30/companyHeader.ts'),
           ('src/canonical/nd30/canonicalAudit.ts','src/canonical/nd30/canonicalAudit.ts'),
           ('src/canonical/nd30/rules.generated.json','src/canonical/nd30/rules.generated.json'),
           ('scripts/sync_verified_nd30.mjs','scripts/sync_verified_nd30.mjs'),
           ('tests/nd30-canonical-overlay.test.ts','test/nd30-canonical-overlay.test.ts')]
    for src,dst in files:
        target=base/dst;target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists() and src.endswith('rules.generated.json') and '"commit": "078dae21' in target.read_text():continue
        shutil.copyfile(OVERLAY/src,target)
        print('[INSTALLED]',dst)
    print('SUCCESS: source overlay applied. NEXT: npm run rules:sync && npm run lint && npm run build && npm run test:canonical && npm test')

if __name__=='__main__':main()
