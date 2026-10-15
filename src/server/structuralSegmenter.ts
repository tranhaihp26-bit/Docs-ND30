/**
 * @file structuralSegmenter.ts
 * @description Pure structural segmenter and field mapping engine for Docs-ND30.
 * Operates offline, adheres strictly to "One Block - One Owner" and Zero Data Loss.
 */

import type {
  SourceBlock,
  StructuredImport,
  ExtractedField,
  AppendixDocument,
  SourceRegion,
} from "../shared/schemas/document.schema.ts";
import { detectDocumentType } from "./parser.ts";
import { getSignatureBlocksFromTable } from "../utils/documentStructure.ts";

/**
 * Standard regex patterns for Vietnamese administrative & party documents
 */
const NATIONAL_HEADER_1_REGEX = /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM|ĐẢNG CỘNG SẢN VIỆT NAM/i;
const NATIONAL_HEADER_2_REGEX = /Độc lập\s*-\s*Tự do\s*-\s*Hạnh phúc/i;
const DATE_LOCATION_REGEX = /(?:^|\b)([\p{L}\s\.\-]+),\s*ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})(?:\b|$)/u;
const REF_NUMBER_REGEX = /Số:\s*([^\n\r,;]+)|Số\s*([0-9]+[^\n\r,;]*)/i;

function extractHeaderDate(text: string): Pick<ExtractedField<string>, "value" | "confidence" | "status"> | null {
  for (const sourceLine of text.split(/\r?\n/)) {
    const line = sourceLine.trim();
    const complete = line.match(DATE_LOCATION_REGEX);
    if (complete) return { value: complete[0].trim(), confidence: "high", status: "extracted" };

    // Word templates commonly leave the day and month blank while retaining
    // the place and year. Keep those known parts and flag the blanks for review.
    const partial = line.match(/^([\p{L}\s.\-]+),\s*ngày\s*(.*?)\s*tháng\s*(.*?)\s*năm\s*(.*?)\s*$/u);
    if (!partial) continue;
    const location = partial[1].trim();
    const parts = partial.slice(2).map((part, index) => {
      const value = part.trim();
      if (!value || /^[.…]+$/.test(value)) return "…";
      if (index < 2 && /^\d{1,2}$/.test(value)) return value;
      if (index === 2 && /^\d{4}$/.test(value)) return value;
      return null;
    });
    if (!location || location.length > 60 || parts.some((part) => part === null)) continue;
    return {
      value: `${location}, ngày ${parts[0]} tháng ${parts[1]} năm ${parts[2]}`,
      confidence: "medium",
      status: "ambiguous",
    };
  }
  return null;
}

const SIGN_FORMULAS = [
  "TM.", "T/M.", "KT.", "TL.", "TUQ.",
  "GIÁM ĐỐC", "TỔNG GIÁM ĐỐC", "CHỦ TỊCH", "PHÓ CHỦ TỊCH",
  "BÍ THƯ", "PHÓ BÍ THƯ", "TRƯỞNG BAN", "TRƯỞNG PHÒNG", "VIỆN TRƯỞNG", "HIỆU TRƯỞNG"
];

function isSignFormula(text: string): boolean {
  const upper = text.toUpperCase().trim();
  return SIGN_FORMULAS.some(f => upper.startsWith(f) || upper.includes(f));
}

function isAppendixHeading(text: string): boolean {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();
  // Standalone heading or starts with PHỤ LỤC
  if (!upper.startsWith("PHỤ LỤC")) return false;
  // If text is long narrative sentence, it is not a heading
  if (trimmed.length > 90) return false;
  // Must match PHỤ LỤC, PHỤ LỤC I, PHỤ LỤC 01, PHỤ LỤC:..., PHỤ LỤC SỐ...
  return /^PHỤ LỤC(?:\s+[IVXLCDM\d]+|\s*[:\-\.]|\s*$)/i.test(upper);
}

/**
 * Main Structural Segmentation function
 */
export function segmentSourceBlocks(
  rawBlocks: SourceBlock[],
  options: {
    filename?: string;
    fileType?: "docx" | "txt";
    standardType?: string;
  } = {}
): StructuredImport {
  // Deep clone blocks so caller data remains untouched
  const blocks: SourceBlock[] = rawBlocks.map(b => ({
    ...b,
    tableShape: b.tableShape ? { ...b.tableShape } : undefined,
    tableData: b.tableData ? b.tableData.map(r => [...r]) : undefined,
    role: "unclassified" as SourceRegion,
  }));

  const fields: Record<string, ExtractedField<string>> = {
    orgHeader1: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    orgHeader2: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    nationalHeader1: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    nationalHeader2: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    referenceNumber: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    locationAndDate: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    documentType: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    subject: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    addressee: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    signTitle: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    signName: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
    recipients: { value: null, confidence: "low", status: "missing", sourceBlockIds: [] },
  };

  const total = blocks.length;
  if (total === 0) {
    return {
      source: {
        filename: options.filename || "untitled",
        type: options.fileType || "docx",
        blockCount: 0,
        detectedRegime: "unknown",
      },
      blocks: [],
      fields,
      body: { html: "", sourceBlockIds: [] },
      signatureBlocks: [],
      appendices: [],
      unclassified: [],
      order: [],
    };
  }

  // =========================================================================
  // STEP 1: HEADER EXTRACTION (Block 0 table or top paragraphs)
  // =========================================================================
  let headerBlockIds: string[] = [];
  let nextStartIndex = 0;

  if (blocks[0]?.kind === "table" && blocks[0].tableShape && blocks[0].tableShape.columns >= 2) {
    const tableData = blocks[0].tableData || [];
    const firstRow = tableData[0] || [];
    const leftText = (firstRow[0] || "").trim();
    const rightText = (firstRow[1] || "").trim();

    // Check if table looks like administrative header
    const hasNational = NATIONAL_HEADER_1_REGEX.test(rightText);

    if (hasNational) {
      blocks[0].role = "header";
      headerBlockIds.push(blocks[0].id);
      nextStartIndex = 1;

      // Parse National Header & Motto from right cell
      if (/ĐẢNG CỘNG SẢN VIỆT NAM/i.test(rightText)) {
        fields.nationalHeader1 = { value: "ĐẢNG CỘNG SẢN VIỆT NAM", confidence: "high", status: "extracted", sourceBlockIds: [blocks[0].id] };
        fields.nationalHeader2 = { value: "", confidence: "high", status: "extracted", sourceBlockIds: [blocks[0].id] };
      } else if (NATIONAL_HEADER_1_REGEX.test(rightText)) {
        fields.nationalHeader1 = { value: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", confidence: "high", status: "extracted", sourceBlockIds: [blocks[0].id] };
        fields.nationalHeader2 = { value: "Độc lập - Tự do - Hạnh phúc", confidence: "high", status: "extracted", sourceBlockIds: [blocks[0].id] };
      }

      // Parse Location and Date if present in right cell
      const dateMatch = extractHeaderDate(rightText);
      if (dateMatch) {
        fields.locationAndDate = {
          ...dateMatch,
          sourceBlockIds: [blocks[0].id],
        };
      }

      // Parse Org headers and Reference number from left cell
      const leftLines = leftText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const filteredLines: string[] = [];
      for (const line of leftLines) {
        const refMatch = line.match(REF_NUMBER_REGEX);
        if (refMatch) {
          fields.referenceNumber = {
            value: line.startsWith("Số:") ? line : `Số: ${line.replace(/^Số\s*/i, "").trim()}`,
            confidence: "high",
            status: "extracted",
            sourceBlockIds: [blocks[0].id],
          };
        } else if (!line.includes("---") && !line.includes("___")) {
          filteredLines.push(line);
        }
      }

      if (filteredLines.length >= 2) {
        // Some source DOCX files separate two parent-organization lines with
        // alignment spaces inside a single Word paragraph instead of w:br.
        const parentLines = filteredLines.slice(0, -1)
          .flatMap(line => line.split(/(?: {3,}|\t+)/).map(part => part.trim()).filter(Boolean));
        fields.orgHeader1 = { value: parentLines.join("\n"), confidence: "high", status: "extracted", sourceBlockIds: [blocks[0].id] };
        fields.orgHeader2 = { value: filteredLines[filteredLines.length - 1], confidence: "high", status: "extracted", sourceBlockIds: [blocks[0].id] };
      } else if (filteredLines.length === 1) {
        fields.orgHeader2 = { value: filteredLines[0], confidence: "high", status: "extracted", sourceBlockIds: [blocks[0].id] };
      }
    }
  } else {
    // Header in top paragraphs
    let pIdx = 0;
    const nationalIndex = blocks.findIndex((block, index) => index < 6 && block.kind === "paragraph" && NATIONAL_HEADER_1_REGEX.test(block.text));
    if (nationalIndex > 0 && nationalIndex <= 3) {
      const issuerLines = blocks.slice(0, nationalIndex);
      const credibleIssuer = issuerLines.every(block => block.kind === "paragraph" &&
        block.text.trim().length > 2 && block.text.trim().length < 180 &&
        block.text.trim() === block.text.trim().toLocaleUpperCase("vi-VN") &&
        !REF_NUMBER_REGEX.test(block.text) && !DATE_LOCATION_REGEX.test(block.text));
      if (credibleIssuer) {
        const issuer = issuerLines[issuerLines.length - 1];
        fields.orgHeader2 = { value: issuer.text.trim(), confidence: "medium", status: "extracted", sourceBlockIds: [issuer.id] };
        if (issuerLines.length > 1) {
          fields.orgHeader1 = { value: issuerLines.slice(0, -1).map(block => block.text.trim()).join("\n"), confidence: "medium", status: "extracted", sourceBlockIds: issuerLines.slice(0, -1).map(block => block.id) };
        }
        issuerLines.forEach(block => { block.role = "header"; headerBlockIds.push(block.id); });
        pIdx = nationalIndex;
        nextStartIndex = nationalIndex;
      }
    }
    while (pIdx < Math.min(total, 6)) {
      const b = blocks[pIdx];
      if (b.kind !== "paragraph") break;
      const text = b.text.trim();
      if (!text) {
        b.role = "separator";
        pIdx++;
        continue;
      }

      let isHeaderPart = false;
      if (NATIONAL_HEADER_1_REGEX.test(text)) {
        fields.nationalHeader1 = {
          value: /ĐẢNG/i.test(text) ? "ĐẢNG CỘNG SẢN VIỆT NAM" : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM",
          confidence: "high", status: "extracted", sourceBlockIds: [b.id]
        };
        isHeaderPart = true;
      }
      if (NATIONAL_HEADER_2_REGEX.test(text)) {
        fields.nationalHeader2 = { value: "Độc lập - Tự do - Hạnh phúc", confidence: "high", status: "extracted", sourceBlockIds: [b.id] };
        isHeaderPart = true;
      }
      const refMatch = text.match(REF_NUMBER_REGEX);
      if (refMatch && !fields.referenceNumber.value) {
        fields.referenceNumber = {
          value: text.startsWith("Số:") ? text : `Số: ${text.replace(/^Số\s*/i, "").trim()}`,
          confidence: "high", status: "extracted", sourceBlockIds: [b.id]
        };
        isHeaderPart = true;
      }
      const dateMatch = extractHeaderDate(text);
      if (dateMatch && !fields.locationAndDate.value) {
        fields.locationAndDate = { ...dateMatch, sourceBlockIds: [b.id] };
        isHeaderPart = true;
      }

      if (isHeaderPart) {
        b.role = "header";
        headerBlockIds.push(b.id);
        nextStartIndex = pIdx + 1;
      } else {
        break;
      }
      pIdx++;
    }
  }

  // Plain text documents often put the title before the reference/date. Keep
  // these early metadata lines even when the header scanner stopped at title.
  if (options.fileType === "txt" && !fields.referenceNumber.value) {
    for (const block of blocks.slice(0, Math.min(6, total))) {
      if (block.kind !== "paragraph" || !/^Số\s*:/i.test(block.text.trim())) continue;
      fields.referenceNumber = { value: block.text.trim(), confidence: "high", status: "extracted", sourceBlockIds: [block.id] };
      block.role = "metadata";
      break;
    }
  }

  // =========================================================================
  // STEP 2: DATE & LOCATION (if not in header)
  // =========================================================================
  if (!fields.locationAndDate.value && nextStartIndex < total) {
    for (let i = nextStartIndex; i < Math.min(nextStartIndex + 3, total); i++) {
      const b = blocks[i];
      if (b.kind === "paragraph" && b.text.trim()) {
        const dateMatch = extractHeaderDate(b.text);
        if (dateMatch) {
          b.role = "metadata";
          fields.locationAndDate = {
            ...dateMatch,
            sourceBlockIds: [b.id],
          };
          nextStartIndex = Math.max(nextStartIndex, i + 1);
          break;
        }
      }
    }
  }

  // =========================================================================
  // STEP 3: DOCUMENT TYPE & SUBJECT
  // =========================================================================
  const docTypeKeywords = [
    "QUYẾT ĐỊNH", "KẾ HOẠCH", "TỜ TRÌNH", "THÔNG BÁO", "NGHỊ QUYẾT",
    "BÁO CÁO", "NGHỊ ĐỊNH", "CHỈ THỊ", "HƯỚNG DẪN", "CÔNG VĂN", "BIÊN BẢN"
  ];

  let docTypeIndex = -1;
  const docTypeSearchStart = options.fileType === "txt" ? 0 : nextStartIndex;
  for (let i = docTypeSearchStart; i < Math.min(docTypeSearchStart + 8, total); i++) {
    const b = blocks[i];
    if (b.kind !== "paragraph") continue;
    const text = b.text.trim().toUpperCase();
    if (!text) continue;

    for (const kw of docTypeKeywords) {
      if (text === kw || text.startsWith(kw + " ") || text.startsWith(kw + ":")) {
        docTypeIndex = i;
        b.role = "metadata";
        fields.documentType = {
          value: text,
          confidence: "high",
          status: "extracted",
          sourceBlockIds: [b.id],
        };
        break;
      }
    }
    if (docTypeIndex !== -1) break;
  }

  if (docTypeIndex === -1) {
    // Infer only when the source actually mentions a document type.
    const fullText = blocks.slice(0, 10).map(b => b.text).join("\n");
    if (docTypeKeywords.some(keyword => fullText.toUpperCase().includes(keyword))) {
      const detected = detectDocumentType(fullText, options.standardType);
      fields.documentType = {
        value: detected,
        confidence: "medium",
        status: "extracted",
        sourceBlockIds: [],
      };
    }
  } else {
    nextStartIndex = Math.max(nextStartIndex, docTypeIndex + 1);
  }

  // Subject extraction (block following documentType)
  if (nextStartIndex < total) {
    const b = blocks[nextStartIndex];
    if (b.kind === "paragraph" && b.text.trim()) {
      const text = b.text.trim();
      const isIntro = /^(V\/v|Về việc|Kế hoạch|Quyết định|Về)\s+/i.test(text) ||
                      b.html?.includes("<strong>") ||
                      b.html?.includes("<em>") ||
                      (!text.toUpperCase().startsWith("CĂN CỨ") && !text.toUpperCase().startsWith("ĐIỀU "));
      if (isIntro) {
        b.role = "metadata";
        fields.subject = {
          value: text,
          confidence: "high",
          status: "extracted",
          sourceBlockIds: [b.id],
        };
        nextStartIndex++;
      }
    }
  }

  // Addressee is a separate document component for correspondence, reports,
  // submissions and similar forms; do not include it in bodyHtml.
  if (nextStartIndex < total) {
    let addresseeIndex = nextStartIndex;
    while (addresseeIndex < total && blocks[addresseeIndex].kind === "paragraph" && !blocks[addresseeIndex].text.trim()) {
      addresseeIndex++;
    }
    const first = blocks[addresseeIndex];
    const match = first?.kind === "paragraph" ? first.text.trim().match(/^Kính gửi\s*:\s*(.*)$/i) : null;
    if (match) {
      for (let index = nextStartIndex; index < addresseeIndex; index++) blocks[index].role = "separator";
      const sourceBlockIds = [first.id];
      let value = match[1].trim();
      first.role = "metadata";
      let continuationIndex = addresseeIndex + 1;
      while (continuationIndex < total && blocks[continuationIndex].kind === "paragraph" && !blocks[continuationIndex].text.trim()) {
        blocks[continuationIndex].role = "separator";
        continuationIndex++;
      }
      if (!value && continuationIndex < total && blocks[continuationIndex].kind === "paragraph") {
        const continuation = blocks[continuationIndex];
        value = continuation.text.trim();
        continuation.role = "metadata";
        sourceBlockIds.push(continuation.id);
        addresseeIndex = continuationIndex;
      }
      fields.addressee = {
        value: value || null,
        confidence: value ? "high" : "low",
        status: value ? "extracted" : "missing",
        sourceBlockIds,
      };
      nextStartIndex = addresseeIndex + 1;
    }
  }

  // =========================================================================
  // STEP 4: APPENDICES DETECTION (Looking from end forward or finding headings)
  // =========================================================================
  const appendices: AppendixDocument[] = [];
  const appendixStartIndices: number[] = [];

  // Find all appendix header block indices (must be after subject/docType)
  for (let i = nextStartIndex; i < total; i++) {
    const b = blocks[i];
    if (b.kind === "paragraph" && isAppendixHeading(b.text)) {
      // Must not be a brief mention inside an article
      appendixStartIndices.push(i);
    }
  }

  let bodyEndExclusive = total;

  if (appendixStartIndices.length > 0) {
    bodyEndExclusive = appendixStartIndices[0];

    for (let aIdx = 0; aIdx < appendixStartIndices.length; aIdx++) {
      const startIdx = appendixStartIndices[aIdx];
      const endIdx = aIdx + 1 < appendixStartIndices.length ? appendixStartIndices[aIdx + 1] : total;
      const appBlocks = blocks.slice(startIdx, endIdx);

      // Mark roles as appendix
      appBlocks.forEach(b => {
        b.role = "appendix";
      });

      // Extract title and reference text
      const headingBlock = appBlocks[0];
      let title = headingBlock.text.trim();
      let refText = "";
      let contentStart = 1;

      if (appBlocks.length > 1 && appBlocks[1].kind === "paragraph") {
        const nextText = appBlocks[1].text.trim();
        if (/^(Kèm theo|Ban hành kèm theo|\(Kèm theo)/i.test(nextText)) {
          refText = nextText;
          contentStart = 2;
        } else if (!title.includes(":") && title.length < 30) {
          title = `${title}: ${nextText}`;
          contentStart = 2;
        }
      }

      // Collect tables in this appendix
      const appTables = appBlocks
        .filter(b => b.kind === "table" && b.tableShape)
        .map(b => ({
          rows: b.tableShape!.rows,
          columns: b.tableShape!.columns,
          rowCount: b.tableShape!.rows,
          colCount: b.tableShape!.columns,
          data: b.tableData,
        }));

      appendices.push({
        id: `appendix-${aIdx + 1}`,
        title: title || `Phụ lục ${aIdx + 1}`,
        referenceText: refText,
        html: appBlocks.slice(contentStart).map(b => b.html || `<p>${b.text}</p>`).join(""),
        blocks: appBlocks,
        sourceBlockIds: appBlocks.map(b => b.id),
        extractionStatus: "confirmed",
        tables: appTables,
      });
    }
  }

  // =========================================================================
  // STEP 5: SIGNATURE & RECIPIENTS DETECTION (Before appendix or end of doc)
  // =========================================================================
  // Search from bodyEndExclusive - 1 backwards
  let sigFoundIndex = -1;
  let signatureHtml: string | undefined;
  let signatureBlocks: ReturnType<typeof getSignatureBlocksFromTable> = [];
  for (let i = bodyEndExclusive - 1; i >= nextStartIndex; i--) {
    const b = blocks[i];
    if (b.kind === "table" && b.tableShape && b.tableShape.columns >= 2) {
      const data = b.tableData || [];
      const flatText = data.flat().join(" ");
      const hasRecipients = /Nơi nhận\s*:/i.test(flatText);
      const hasSign = isSignFormula(flatText) || flatText.toUpperCase().includes("GIÁM ĐỐC");

      // Check if it's meeting minutes 3-sign table (SEP-06)
      const isMinutesSignTable = b.tableShape.columns === 3 && (
        flatText.toUpperCase().includes("THƯ KÝ") ||
        flatText.toUpperCase().includes("CHỦ TỌA") ||
        flatText.toUpperCase().includes("ĐẠI DIỆN")
      );

      if ((hasRecipients && hasSign) || isMinutesSignTable || (b.tableShape.rows <= 3 && hasSign)) {
        sigFoundIndex = i;
        b.role = "signature";
        if (isMinutesSignTable) signatureHtml = b.html || undefined;
        signatureBlocks = getSignatureBlocksFromTable(data).map(block => ({
          ...block,
          sourceBlockIds: [b.id],
        }));

        // Extract recipients and signature fields
        const leftCol = data.map(r => r[0] || "").join("\n");
        const rightCol = data.map(r => r[r.length - 1] || "").join("\n");

        if (/Nơi nhận\s*:/i.test(leftCol)) {
          fields.recipients = {
            value: leftCol.trim(),
            confidence: "high",
            status: "extracted",
            sourceBlockIds: [b.id],
          };
        }

        const rightLines = rightCol.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (isMinutesSignTable) {
          // The whole table is the signature; a second single-signer block would duplicate it.
        } else if (rightLines.length >= 3) {
          fields.signTitle = { value: rightLines.slice(0, -1).join("\n"), confidence: "high", status: "extracted", sourceBlockIds: [b.id] };
          fields.signName = { value: rightLines[rightLines.length - 1], confidence: "high", status: "extracted", sourceBlockIds: [b.id] };
        } else if (rightLines.length === 2) {
          fields.signTitle = { value: rightLines[0], confidence: "high", status: "extracted", sourceBlockIds: [b.id] };
          fields.signName = { value: rightLines[1], confidence: "high", status: "extracted", sourceBlockIds: [b.id] };
        } else if (rightLines.length === 1) {
          fields.signTitle = { value: rightLines[0], confidence: "medium", status: "extracted", sourceBlockIds: [b.id] };
        }
        break;
      }
    } else if (b.kind === "paragraph") {
      const text = b.text.trim();
      if (/Nơi nhận\s*:/i.test(text) && !fields.recipients.value) {
        b.role = "recipients";
        fields.recipients = { value: text, confidence: "high", status: "extracted", sourceBlockIds: [b.id] };
        sigFoundIndex = i;
      }
      if (isSignFormula(text) && !fields.signTitle.value) {
        b.role = "signature";
        fields.signTitle = { value: text, confidence: "high", status: "extracted", sourceBlockIds: [b.id] };
        // Check next paragraph for signName
        if (i + 1 < bodyEndExclusive && blocks[i + 1].kind === "paragraph") {
          const nextP = blocks[i + 1];
          if (nextP.text.trim() && !isAppendixHeading(nextP.text)) {
            nextP.role = "signature";
            fields.signName = { value: nextP.text.trim(), confidence: "high", status: "extracted", sourceBlockIds: [nextP.id] };
          }
        }
        sigFoundIndex = i;
      }
    }
  }

  // If a signature block was identified, body ends before signature block!
  if (sigFoundIndex !== -1) {
    bodyEndExclusive = sigFoundIndex;
  }

  // =========================================================================
  // STEP 6: BODY EXTRACTION (Between nextStartIndex and bodyEndExclusive)
  // =========================================================================
  const bodyBlockIds: string[] = [];
  const bodyHtmlParts: string[] = [];

  for (let i = nextStartIndex; i < bodyEndExclusive; i++) {
    const b = blocks[i];
    if (b.role !== "unclassified") continue;

    // Check if empty separator paragraph
    if (b.kind === "paragraph" && !b.text.trim()) {
      b.role = "separator";
      continue;
    }

    b.role = "body";
    bodyBlockIds.push(b.id);
    bodyHtmlParts.push(b.html || `<p>${b.text}</p>`);
  }

  // Empty source paragraphs may also occur before the title, outside the
  // body range. They are spacing separators rather than uncertain content.
  for (const b of blocks) {
    if (b.role === "unclassified" && b.kind === "paragraph" && !b.text.trim()) {
      b.role = "separator";
    }
  }

  // =========================================================================
  // STEP 7: OWNERSHIP INVARIANTS & UNCLASSIFIED AUDIT (Gate B)
  // =========================================================================
  const unclassifiedBlocks: SourceBlock[] = [];

  blocks.forEach(b => {
    if (b.role === "unclassified") {
      unclassifiedBlocks.push(b);
    }
  });

  const order = blocks.map(b => b.id);
  const sourceHeading = blocks.slice(0, Math.min(total, 6)).map(b => b.text).join("\n");
  const hasPartyHeading = /ĐẢNG CỘNG SẢN VIỆT NAM/i.test(sourceHeading);
  const hasAdministrativeHeading = /CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM/i.test(sourceHeading);
  const detectedRegime = hasPartyHeading === hasAdministrativeHeading
    ? "unknown" as const : hasPartyHeading ? "party" as const : "administrative" as const;

  return {
    source: {
      filename: options.filename || "untitled",
      type: options.fileType || "docx",
      blockCount: total,
      detectedRegime,
    },
    blocks,
    fields,
    body: {
      html: bodyHtmlParts.join(""),
      sourceBlockIds: bodyBlockIds,
    },
    signatureHtml,
    signatureBlocks,
    appendices,
    unclassified: unclassifiedBlocks,
    order,
  };
}
