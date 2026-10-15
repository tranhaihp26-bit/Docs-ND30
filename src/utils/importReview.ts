import type { SourceBlock, SourceRegion, StructuredImport } from "../shared/schemas/document.schema.ts";
import { isPlaceholderValue } from "../shared/schemas/document.schema.ts";

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const blockHtml = (block: SourceBlock) => block.html || `<p>${escapeHtml(block.text)}</p>`;

export function composeImportedBodyHtml(source: StructuredImport): string {
  // Keep an imported multi-signer table as a top-level table. Wrapping it in
  // a div makes the DOCX converter flatten its three columns into paragraphs.
  return source.body.html + (source.signatureHtml || "");
}

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

/** Reassign a source block without deleting or copying its original evidence. */
export function assignUnclassifiedBlock(
  source: StructuredImport,
  blockId: string,
  destination: "body" | "signature" | "appendix",
): StructuredImport {
  const block = source.unclassified.find(item => item.id === blockId);
  if (!block || !source.blocks) return source;
  const role: SourceRegion = destination === "signature" ? "signature" : destination;
  const blocks = source.blocks.map(item => item.id === blockId ? { ...item, role } : item);
  const unclassified = source.unclassified.filter(item => item.id !== blockId);
  const result: StructuredImport = { ...source, blocks, unclassified };
  if (destination === "body") {
    const bodyBlocks = blocks.filter(item => item.role === "body");
    result.body = { html: bodyBlocks.map(blockHtml).join(""), sourceBlockIds: bodyBlocks.map(item => item.id) };
  } else if (destination === "signature") {
    result.signatureHtml = (source.signatureHtml || "") + blockHtml(block);
  } else {
    const appendixBlock = { ...block, role: "appendix" as const };
    result.appendices = [...source.appendices, {
      id: `appendix-manual-${block.id}`,
      title: `Phụ lục từ khối ${block.index + 1}`,
      html: blockHtml(block),
      blocks: [appendixBlock],
      sourceBlockIds: [block.id],
      extractionStatus: "needs_review" as const,
      tables: block.kind === "table" && block.tableShape ? [{ rows: block.tableShape.rows, columns: block.tableShape.columns, data: block.tableData }] : [],
    }];
  }
  return result;
}

export function deriveImportStatus(source: StructuredImport, approved: boolean): "confirmed" | "needs_review" {
  if (!approved || source.unclassified.length > 0) return "needs_review";
  const minutes = /^BIÊN BẢN\b/i.test(source.fields.documentType?.value || "");
  if (Object.entries(source.fields).some(([name, field]) => {
    if (name === "orgHeader1") return false;
    if (name === "recipients" && minutes && !field.value) return false;
    if ((name === "signTitle" || name === "signName") && source.signatureHtml && !field.value) return false;
    return field.status === "missing" || field.status === "ambiguous" ||
      (Boolean(field.value) && isPlaceholderValue(field.value));
  })) {
    return "needs_review";
  }
  if (source.appendices.some((appendix) => appendix.extractionStatus === "needs_review")) {
    return "needs_review";
  }
  return "confirmed";
}
