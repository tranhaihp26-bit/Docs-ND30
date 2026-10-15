import type { StructuredImport } from "../shared/schemas/document.schema.ts";

export function updateImportField(source: StructuredImport, field: string, value: string): StructuredImport {
  const previous = source.fields[field];
  if (!previous) return source;
  return {
    ...source,
    fields: {
      ...source.fields,
      [field]: { ...previous, value, status: "user_confirmed" },
    },
  };
}

export function deriveImportStatus(source: StructuredImport, approved: boolean): "confirmed" | "needs_review" {
  if (!approved || source.unclassified.length > 0) return "needs_review";
  if (Object.values(source.fields).some((field) => field.status === "missing" || field.status === "ambiguous")) {
    return "needs_review";
  }
  if (source.appendices.some((appendix) => appendix.extractionStatus === "needs_review")) {
    return "needs_review";
  }
  return "confirmed";
}
