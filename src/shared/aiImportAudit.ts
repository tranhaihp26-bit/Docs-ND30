import type { StructuredImport } from "./schemas/document.schema.ts";

export const AUDIT_REGIONS = ["header", "metadata", "body", "footer", "appendix", "other"] as const;
export type AuditRegion = typeof AUDIT_REGIONS[number];
export type AuditCategory = "content" | "format" | "layout" | "structure";

export interface AiAuditFinding {
  region: AuditRegion;
  category: AuditCategory;
  severity: "attention" | "suggestion";
  fieldKey?: string;
  blockId?: string;
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
}

export interface AuditWorkingDocument {
  orgHeader1: string; orgHeader2: string; nationalHeader1: string; nationalHeader2: string;
  referenceNumber: string; locationAndDate: string; documentType: string; subject: string;
  bodyHtml: string; signTitle: string; signName: string; recipients: string;
  appendices?: Array<{ id: string; title: string; referenceText?: string; html: string }>;
}

export interface AuditInput {
  document: AuditWorkingDocument;
  structuredImport: Omit<StructuredImport, "source"> & {
    source: Omit<StructuredImport["source"], "filename">;
  };
  standardType: "state" | "party";
}
