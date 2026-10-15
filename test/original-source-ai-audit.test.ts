import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { compareSourceToParsedBlocks, extractOriginalSourceEvidence } from "../src/server/originalSource.ts";
import { resolveImportAuditRulePack } from "../src/server/importAuditRules.ts";
import { runImportAiAudit } from "../src/server/importAiAudit.ts";
import { parseLocalFile } from "../src/utils/localFileImport.ts";
import type { AuditInput, AuditRegion } from "../src/shared/aiImportAudit.ts";

const txt = Buffer.from("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nNội dung tổng hợp thử nghiệm.", "utf8");
const evidence = await extractOriginalSourceEvidence("pilot.txt", txt);
assert.equal(evidence.extractionMethod, "utf8_txt");
assert.equal(evidence.text, txt.toString("utf8"));
assert.match(evidence.sha256, /^[a-f0-9]{64}$/);

const match = compareSourceToParsedBlocks(evidence.text, [
  { id: "1", index: 0, kind: "paragraph", text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" },
  { id: "2", index: 1, kind: "paragraph", text: "Nội dung tổng hợp thử nghiệm." },
]);
assert.equal(match.status, "matched", "source and parsed text should be reconciled independent of line spacing");
const lost = compareSourceToParsedBlocks(evidence.text, [
  { id: "1", index: 0, kind: "paragraph", text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" },
]);
assert.equal(lost.status, "mismatch", "a source-only paragraph must be surfaced");
assert.ok(lost.sourceTokenCount > lost.parsedTokenCount);

const docx = await readFile(new URL("./fixtures/step1-smoke.docx", import.meta.url));
const docxEvidence = await extractOriginalSourceEvidence("step1-smoke.docx", docx);
assert.equal(docxEvidence.extractionMethod, "mammoth_docx");
assert.match(docxEvidence.text, /BIÊN BẢN/);
assert.deepEqual(docxEvidence.detectedFeatures, [], "default empty note parts and terminal section settings are not false positives");

const pilotManifest = JSON.parse(await readFile(join(process.cwd(), "public/pilot-tests/adversarial-manifest.json"), "utf8")) as Array<{ filename: string; url: string }>;
const pilotReconciliations: string[] = [];
for (const item of pilotManifest) {
  const bytes = await readFile(join(process.cwd(), "public", item.url.replace(/^\//, "")));
  const file = new File([bytes], item.filename, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const parsed = await parseLocalFile(file);
  const original = await extractOriginalSourceEvidence(item.filename, bytes);
  const reconciliation = compareSourceToParsedBlocks(original.text, parsed.structured!.blocks || [], original.detectedFeatures.length > 0);
  assert.ok(reconciliation.sourceTokenCount > 0 && reconciliation.parsedTokenCount > 0, `${item.filename} has source and parsed content`);
  pilotReconciliations.push(`${item.filename}: ${reconciliation.status}; ${reconciliation.sourceTokenCount}/${reconciliation.parsedTokenCount} words; ${original.detectedFeatures.join(" | ") || "no unsupported OOXML feature"}`);
}

const nd30Pack = resolveImportAuditRulePack("state", "THÔNG BÁO", "2026-10-15");
assert.ok(nd30Pack.rules.length > 0, "administrative formatting rules should be attached");
assert.ok(nd30Pack.rules.every(rule => rule.id.startsWith("ND30.PL1.")));
assert.ok(nd30Pack.rules.every(rule => rule.maturity === "verified"));
assert.ok(nd30Pack.version, "the rule pack must be versioned");
const minutesPack = resolveImportAuditRulePack("state", "BIÊN BẢN", "2026-10-15");
assert.ok(!minutesPack.rules.some(rule => rule.id === "ND30.PL1.I.II.4B.ISSUE_DATE_FULL"), "minutes do not receive the generic issue-date rule");
const partyPack = resolveImportAuditRulePack("party", "THÔNG BÁO", "2026-10-15");
assert.equal(partyPack.rules.length, 0, "unverified Party rules must not be presented as a verified pack");
assert.equal(partyPack.status, "no_verified_pack");

function auditInput(): AuditInput {
  return {
    standardType: "state",
    document: {
      orgHeader1: "", orgHeader2: "CƠ QUAN BAN HÀNH", nationalHeader1: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
      nationalHeader2: "Độc lập - Tự do - Hạnh phúc", referenceNumber: "Số: 01/TB", locationAndDate: "",
      documentType: "THÔNG BÁO", subject: "Về việc thử nghiệm", bodyHtml: "<p>Nội dung tổng hợp thử nghiệm.</p>",
      signTitle: "", signName: "", recipients: "",
    },
    structuredImport: {
      source: { type: "txt", blockCount: 2 }, fields: {},
      body: { html: "<p>Nội dung tổng hợp thử nghiệm.</p>", sourceBlockIds: ["body-1"] },
      appendices: [], unclassified: [], order: ["header-1", "body-1"],
      blocks: [
        { id: "header-1", index: 0, kind: "paragraph", role: "header", text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM" },
        { id: "body-1", index: 1, kind: "paragraph", role: "body", text: "Nội dung tổng hợp thử nghiệm." },
      ],
    },
    originalSource: {
      sha256: "a".repeat(64), text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nNội dung tổng hợp thử nghiệm.",
      extractionMethod: "utf8_txt", fileType: "txt", byteLength: 100, detectedFeatures: [], notEvaluatedFeatures: [],
    },
    rulePack: nd30Pack,
    parseRevision: 4,
  };
}

const sourcePrompts: string[] = [];
const report = await runImportAiAudit(auditInput(), async prompt => {
  if (prompt.includes("ĐỐI CHIẾU FILE GỐC")) {
    sourcePrompts.push(prompt);
    return { model: "test-model", text: JSON.stringify({ summary: "Đã đối chiếu file gốc.", findings: [], visualLimitations: [] }) };
  }
  return { model: "test-model", text: JSON.stringify({ summary: "Đã rà soát vùng.", findings: [], visualLimitations: [] }) };
});
assert.equal(sourcePrompts.length, 1, "original source evidence should be sent in a dedicated comparison pass");
assert.ok(sourcePrompts[0].includes("Nội dung tổng hợp thử nghiệm."));
assert.ok(sourcePrompts[0].includes("ND30.PL1."), "the applicable verified rule pack is included");
assert.equal(report.sourceComparison, "reviewed");
assert.equal(report.sourceHash, "a".repeat(64));
assert.equal(report.parseRevision, 4);
assert.ok(report.sections.some(section => section.region === "source"));

const withFinding = await runImportAiAudit(auditInput(), async prompt => ({
  model: "test-model",
  text: JSON.stringify({ summary: "Đối chiếu xong.", findings: prompt.includes("ĐỐI CHIẾU FILE GỐC") ? [{
    category: "content", severity: "attention", blockId: "body-1", sourceQuote: "Nội dung tổng hợp thử nghiệm.",
    observation: "Cần kiểm tra nội dung đã được đưa vào body.", recommendation: "So sánh đoạn được trích với ô body.",
  }] : [], visualLimitations: [] }),
}));
const sourceFinding = withFinding.sections.find(section => section.region === "source")?.findings[0];
assert.equal(sourceFinding?.sourceQuote, "Nội dung tổng hợp thử nghiệm.", "source evidence is retained for the user");

const invalidEvidence = await runImportAiAudit(auditInput(), async prompt => ({
  model: "test-model",
  text: JSON.stringify({ summary: "Đối chiếu xong.", findings: prompt.includes("ĐỐI CHIẾU FILE GỐC") ? [{
    category: "format", severity: "attention", fieldKey: "documentType", sourceQuote: "CÂU KHÔNG CÓ TRONG FILE",
    ruleIds: ["RULE.NOT.IN.PACK"], observation: "Có vấn đề.", recommendation: "Hãy xem lại.",
  }] : [], visualLimitations: [] }),
}));
assert.equal(invalidEvidence.sections.find(section => section.region === "source")?.status, "not_evaluated",
  "unverifiable source quotes and rule IDs cannot enter the report");
assert.equal(invalidEvidence.sourceComparison, "not_evaluated");

const oversized = auditInput();
oversized.originalSource!.text = "nội dung ".repeat(40000);
const partial = await runImportAiAudit(oversized, async prompt => ({
  model: "test-model", text: JSON.stringify({ summary: "ok", findings: [], visualLimitations: [] }),
}));
assert.equal(partial.sourceComparison, "not_evaluated", "oversized source comparison must never be reported as complete");
assert.equal(partial.scope, "partial");

console.log("Original source AI audit tests passed");
console.log(pilotReconciliations.join("\n"));
