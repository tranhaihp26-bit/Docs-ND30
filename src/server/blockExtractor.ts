/**
 * @file blockExtractor.ts
 * @description Extracts structured SourceBlocks from DOCX (via JSZip and OOXML) and TXT buffers.
 * Preserves linear document order, table geometry, cell contents, paragraph formatting, and styles.
 */

import JSZip from "jszip";
import type { SourceBlock, SourceBlockKind } from "../shared/schemas/document.schema.ts";

/**
 * Strips XML tags or extracts text cleanly.
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Extracts plain text from a paragraph XML node (<w:p>...</w:p>).
 */
function extractParagraphText(pXml: string): string {
  const parts: string[] = [];
  const runRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = runRegex.exec(pXml)) !== null) {
    if (match[0] === "<w:tab/>") {
      parts.push("\t");
    } else if (match[0].startsWith("<w:br")) {
      parts.push("\n");
    } else if (match[1] !== undefined) {
      parts.push(decodeXmlEntities(match[1]));
    }
  }
  return parts.join("");
}

/**
 * Converts a paragraph XML node to clean semantic HTML.
 */
function paragraphXmlToHtml(pXml: string): string {
  const jcMatch = pXml.match(/<w:jc\s+w:val="([^"]+)"/);
  const align = jcMatch ? jcMatch[1].toLowerCase() : "";
  let alignStyle = "";
  if (align === "center") alignStyle = ' style="text-align: center;"';
  else if (align === "right") alignStyle = ' style="text-align: right;"';

  // Extract runs
  const runBlockRegex = /<w:r\b[\s\S]*?<\/w:r>/g;
  let rMatch: RegExpExecArray | null;
  let innerHtml = "";

  while ((rMatch = runBlockRegex.exec(pXml)) !== null) {
    const rXml = rMatch[0];
    const isBold = /<w:b(?:\s|>|\/>)/.test(rXml) && !/<w:b\s+w:val="(?:0|false)"/.test(rXml);
    const isItalic = /<w:i(?:\s|>|\/>)/.test(rXml) && !/<w:i\s+w:val="(?:0|false)"/.test(rXml);
    const isUnderline = /<w:u(?:\s|>|\/>)/.test(rXml) && !/<w:u\s+w:val="(?:none|0|false)"/.test(rXml);

    const tParts: string[] = [];
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(rXml)) !== null) {
      if (tMatch[0] === "<w:tab/>") {
        tParts.push("&nbsp;&nbsp;&nbsp;&nbsp;");
      } else if (tMatch[0].startsWith("<w:br")) {
        tParts.push("<br/>");
      } else if (tMatch[1] !== undefined) {
        tParts.push(escapeHtml(decodeXmlEntities(tMatch[1])));
      }
    }

    let runText = tParts.join("");
    if (!runText) continue;

    if (isBold) runText = `<strong>${runText}</strong>`;
    if (isItalic) runText = `<em>${runText}</em>`;
    if (isUnderline) runText = `<u>${runText}</u>`;

    innerHtml += runText;
  }

  if (!innerHtml) {
    const fallbackText = extractParagraphText(pXml);
    if (!fallbackText.trim()) return "<p></p>";
    innerHtml = escapeHtml(fallbackText);
  }

  return `<p${alignStyle}>${innerHtml}</p>`;
}

/**
 * Extracts a table structure and 2D cell data from a <w:tbl>...</w:tbl> XML string.
 */
function extractTableDetails(tblXml: string): {
  rows: number;
  columns: number;
  tableData: string[][];
  html: string;
  text: string;
} {
  // Find all <w:tr> nodes
  const trMatches = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  const tableData: string[][] = [];
  const htmlRows: string[] = [];
  const textLines: string[] = [];
  let maxCols = 0;

  for (const trXml of trMatches) {
    const tcMatches = trXml.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    maxCols = Math.max(maxCols, tcMatches.length);
    const rowData: string[] = [];
    const cellHtmls: string[] = [];

    for (const tcXml of tcMatches) {
      // Cell may have multiple paragraphs
      const pMatches = tcXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
      const cellParagraphTexts: string[] = [];
      const cellParagraphHtmls: string[] = [];

      for (const pXml of pMatches) {
        const pText = extractParagraphText(pXml).trim();
        if (pText) cellParagraphTexts.push(pText);
        cellParagraphHtmls.push(paragraphXmlToHtml(pXml));
      }

      const combinedText = cellParagraphTexts.join("\n");
      rowData.push(combinedText);
      cellHtmls.push(`<td style="border: 1px solid #000; padding: 4px 8px;">${cellParagraphHtmls.join("")}</td>`);
    }

    tableData.push(rowData);
    htmlRows.push(`<tr>${cellHtmls.join("")}</tr>`);
    textLines.push(rowData.join(" | "));
  }

  const tableHtml = `<table style="width: 100%; border-collapse: collapse; border: 1px solid #000;"><tbody>${htmlRows.join("")}</tbody></table>`;
  const tableText = textLines.join("\n");

  return {
    rows: trMatches.length,
    columns: maxCols,
    tableData,
    html: tableHtml,
    text: tableText,
  };
}

/**
 * Scans top-level children of <w:body> inside word/document.xml.
 */
function extractBodyXmlChildren(xml: string): Array<{ tag: "w:p" | "w:tbl" | "w:sectPr"; xml: string }> {
  const bodyMatch = /<w:body(?=[\s>])/.exec(xml);
  if (!bodyMatch) return [];
  const results: Array<{ tag: "w:p" | "w:tbl" | "w:sectPr"; xml: string }> = [];
  const supported = new Set(["w:p", "w:tbl", "w:sectPr"]);
  const stack: string[] = [];
  let childStart = -1;
  let childTag = "";
  let pos = xml.indexOf(">", bodyMatch.index) + 1;

  while (pos < xml.length) {
    const start = xml.indexOf("<", pos);
    if (start < 0) break;
    if (xml.startsWith("<!--", start)) {
      const end = xml.indexOf("-->", start + 4);
      if (end < 0) break;
      pos = end + 3;
      continue;
    }
    if (xml.startsWith("<?", start)) {
      const end = xml.indexOf("?>", start + 2);
      if (end < 0) break;
      pos = end + 2;
      continue;
    }

    let end = start + 1;
    let quote: string | null = null;
    for (; end < xml.length; end++) {
      const char = xml[end];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        break;
      }
    }
    if (end >= xml.length) break;
    const rawTag = xml.slice(start + 1, end);
    const match = /^\s*(\/?)\s*([\w:.-]+)/.exec(rawTag);
    pos = end + 1;
    if (!match) continue;
    const [, closing, name] = match;
    const selfClosing = !closing && /\/\s*$/.test(rawTag);

    if (closing) {
      if (stack.length === 0) {
        if (name === "w:body") break;
        continue;
      }
      if (stack.pop() !== name) throw new Error(`Invalid OOXML nesting near ${name}`);
      if (stack.length === 0 && supported.has(childTag)) {
        results.push({ tag: childTag as "w:p" | "w:tbl" | "w:sectPr", xml: xml.slice(childStart, pos) });
      }
    } else if (stack.length === 0) {
      if (selfClosing) {
        if (supported.has(name)) {
          results.push({ tag: name as "w:p" | "w:tbl" | "w:sectPr", xml: xml.slice(start, pos) });
        }
      } else {
        childStart = start;
        childTag = name;
      }
    }
    if (!closing && !selfClosing) stack.push(name);
  }
  return results;
}

export interface ExtractedBlocksResult {
  blocks: SourceBlock[];
  rawText: string;
  rawHtml: string;
  fileType: "docx" | "txt";
}

/**
 * Extracts SourceBlocks from DOCX buffer.
 */
export async function extractBlocksFromDocx(buffer: Uint8Array | ArrayBuffer): Promise<ExtractedBlocksResult> {
  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw new Error("Invalid DOCX archive: missing word/document.xml");
  }

  const docXml = await docXmlFile.async("string");
  const rawChildren = extractBodyXmlChildren(docXml);

  const blocks: SourceBlock[] = [];
  let blockIndex = 0;

  for (const child of rawChildren) {
    if (child.tag === "w:sectPr") {
      // The body-level sectPr is page/section metadata, not a visible break.
      // A real section break belongs to its paragraph's pPr, if present.
      continue;
    }

    if (child.tag === "w:p") {
      const text = extractParagraphText(child.xml);
      const html = paragraphXmlToHtml(child.xml);
      blocks.push({
        id: `block-${blockIndex}`,
        index: blockIndex,
        kind: "paragraph",
        text,
        html,
        role: "unclassified",
      });
      blockIndex++;
      continue;
    }

    if (child.tag === "w:tbl") {
      const details = extractTableDetails(child.xml);
      blocks.push({
        id: `block-${blockIndex}`,
        index: blockIndex,
        kind: "table",
        text: details.text,
        html: details.html,
        tableShape: {
          rows: details.rows,
          columns: details.columns,
        },
        tableData: details.tableData,
        role: "unclassified",
      });
      blockIndex++;
      continue;
    }
  }

  return {
    blocks,
    rawText: blocks.map((b) => b.text).join("\n"),
    rawHtml: blocks.map((b) => b.html || "").join(""),
    fileType: "docx",
  };
}

/**
 * Extracts SourceBlocks from plain text (.txt) buffer.
 */
export function extractBlocksFromTxt(textContent: string): ExtractedBlocksResult {
  const normalizedText = textContent.replace(/^\uFEFF/, "");
  const lines = normalizedText.split(/\r?\n/);
  const blocks: SourceBlock[] = [];
  let idx = 0;

  lines.forEach((lineText) => {
    const cleanText = lineText.trim();
    if (!cleanText) return;
    const html = `<p>${escapeHtml(cleanText)}</p>`;
    blocks.push({
      id: `block-${idx}`,
      index: idx,
      kind: "paragraph",
      text: cleanText,
      html,
      role: "unclassified",
    });
    idx++;
  });

  return {
    blocks,
    rawText: normalizedText,
    rawHtml: blocks.map((b) => b.html || "").join(""),
    fileType: "txt",
  };
}
