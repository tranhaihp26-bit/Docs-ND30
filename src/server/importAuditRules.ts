import catalog from "../canonical/nd30/rules.generated.json";
import type { ImportAuditRule, ImportAuditRulePack } from "../shared/aiImportAudit.ts";

const verifiedFormattingRuleIds = new Set([
  "ND30.PL1.I.II.1A.NATIONAL_HEADER_BOLD",
  "ND30.PL1.I.II.1A.NATIONAL_HEADER_SIZE",
  "ND30.PL1.I.II.1A.NATIONAL_HEADER_TEXT",
  "ND30.PL1.I.II.1A.NATIONAL_HEADER_UPPERCASE",
  "ND30.PL1.I.II.1A.NATIONAL_HEADER_UPRIGHT",
  "ND30.PL1.I.II.1B.MOTTO_BOLD",
  "ND30.PL1.I.II.1B.MOTTO_TEXT",
  "ND30.PL1.I.II.1B.MOTTO_UNDERLINE_LENGTH",
  "ND30.PL1.I.II.2B.ISSUER_UPPERCASE",
  "ND30.PL1.I.II.2B.PARENT_UPPERCASE",
  "ND30.PL1.I.II.4B.ISSUE_DATE_FULL",
  "ND30.PL1.I.II.5B.TYPE_UPPERCASE",
  "ND30.PL1.I.II.6E.BODY_JUSTIFIED",
  "ND30.PL1.I.II.6E.BODY_LINE_SPACING_RANGE",
  "ND30.PL1.I.II.6E.BODY_SIZE",
  "ND30.PL1.I.II.6E.BODY_UPRIGHT",
  "ND30.PL1.I.II.6E.FIRST_LINE_INDENT",
  "ND30.PL1.I.II.6E.PARAGRAPH_GAP_MIN",
  "ND30.PL1.I.III.1B.APPENDIX_TITLE_UPPERCASE",
]);

/** Select only applicable, source-backed, verified format/structure rules already in the bundled catalog. */
export function resolveImportAuditRulePack(standardType: "state" | "party", documentType: string, issueDate?: string): ImportAuditRulePack {
  const regime = standardType === "party" ? "party" : "administrative";
  const date = issueDate && /^\d{4}-\d{2}-\d{2}$/.test(issueDate) ? issueDate : null;
  const isMinutes = /^BIÊN\s+BẢN\b/i.test(documentType.trim());
  const rules = regime === "administrative"
    ? (catalog.rules as ImportAuditRule[]).filter(rule => verifiedFormattingRuleIds.has(rule.id) &&
      rule.regime === "administrative" && ["document_format", "document_structure"].includes(rule.domain) &&
      !(isMinutes && rule.id === "ND30.PL1.I.II.4B.ISSUE_DATE_FULL") &&
      rule.normativity === "mandatory" && rule.maturity === "verified" &&
      (!date || rule.temporality.effective_from <= date) &&
      (!date || rule.temporality.effective_to === null || rule.temporality.effective_to >= date))
    : [];
  return {
    version: `${catalog.releasePack}@${catalog.commit}`,
    regime,
    documentType: documentType.trim().slice(0, 120),
    issueDate: date,
    status: rules.length ? "verified_pack" : "no_verified_pack",
    rules,
  };
}
