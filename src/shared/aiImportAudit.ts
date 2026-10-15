import type { StructuredImport } from "./schemas/document.schema.ts";

export interface ImportAuditRule {
  id: string;
  regime: "administrative" | "party";
  domain: string;
  source: { source_id: string; locator: string };
  normativity: string;
  maturity: string;
  temporality: { effective_from: string; effective_to: string | null };
  target: { object_type: string; role?: string; property: string };
  constraint: { type: string; value?: unknown; min?: number; max?: number };
}

export interface ImportAuditRulePack {
  version: string;
  regime: "administrative" | "party";
  documentType: string;
  issueDate: string | null;
  status: "verified_pack" | "no_verified_pack";
  rules: ImportAuditRule[];
}

export const AUDIT_REGIONS = ["header", "metadata", "body", "footer", "appendix", "other", "source"] as const;
export type AuditRegion = typeof AUDIT_REGIONS[number];
export type AuditCategory = "content" | "format" | "layout" | "structure";

export interface AiAuditFinding {
  region: AuditRegion;
  category: AuditCategory;
  severity: "attention" | "suggestion";
  fieldKey?: string;
  blockId?: string;
  sourceQuote?: string;
  ruleIds?: string[];
  observation: string;
  recommendation: string;
}

export interface AiAuditSection {
  region: AuditRegion;
  status: "needs_review" | "no_finding" | "not_evaluated" | "partially_evaluated" | "not_applicable";
  reviewedChunks: number;
  totalChunks: number;
  summary: string;
  findings: AiAuditFinding[];
}

export interface AiImportAudit {
  source: "gemini_ai";
  model: string;
  scope: "complete" | "partial";
  reviewedChunks: number;
  totalChunks: number;
  skippedChunks: number;
  sections: AiAuditSection[];
  visualLimitations: string[];
  sourceComparison: "not_requested" | "reviewed" | "not_evaluated";
  sourceHash?: string;
  sourceExtractionMethod?: "mammoth_docx" | "utf8_txt";
  parseRevision?: number;
  rulePackVersion?: string;
  rulePackStatus?: "verified_pack" | "no_verified_pack";
  sourceIntegrity?: {
    status: "matched" | "mismatch" | "not_evaluated";
    coverage: "text_only" | "partial";
    sourceTokenCount: number;
    parsedTokenCount: number;
    firstMismatchAt?: number;
  };
}

export interface AuditWorkingDocument {
  orgHeader1: string; orgHeader2: string; nationalHeader1: string; nationalHeader2: string;
  referenceNumber: string; locationAndDate: string; documentType: string; subject: string; addressee?: string;
  bodyHtml: string; signTitle: string; signName: string; recipients: string;
  signatureBlocks?: Array<{ id: string; role: string; instruction: string; name: string; sourceBlockIds?: string[]; status?: string }>;
  appendices?: Array<{ id: string; title: string; referenceText?: string; html: string }>;
}

export interface AuditInput {
  document: AuditWorkingDocument;
  structuredImport: Omit<StructuredImport, "source"> & {
    source: Omit<StructuredImport["source"], "filename">;
  };
  standardType: "state" | "party";
  originalSource?: {
    sha256: string;
    text: string;
    extractionMethod: "mammoth_docx" | "utf8_txt";
    fileType: "docx" | "txt";
    byteLength: number;
    detectedFeatures: string[];
    notEvaluatedFeatures: string[];
  };
  rulePack?: ImportAuditRulePack;
  parseRevision?: number;
}
