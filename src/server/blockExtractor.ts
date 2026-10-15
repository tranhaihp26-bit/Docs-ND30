/**
 * @file blockExtractor.ts
 * @description Extracts structured SourceBlocks from DOCX (via JSZip and OOXML) and TXT buffers.
 * Preserves linear document order, table geometry, cell contents, paragraph formatting, and styles.
 */

import JSZip from "jszip";
import mammoth from "mammoth";
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
  const runRegex = /<w:t(?:[\s>][\s\S]*?)>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
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
    const tRegex = /<w:t(?:[\s>][\s\S]*?)>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
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
  const bodyStart = xml.indexOf("<w:body");
  if (bodyStart === -1) return [];
  const bodyOpenEnd = xml.indexOf(">", bodyStart) + 1;
  const bodyEnd = xml.lastIndexOf("</w:body>");
  if (bodyEnd === -1) return [];
  const content = xml.slice(bodyOpenEnd, bodyEnd);

  const results: Array<{ tag: "w:p" | "w:tbl" | "w:sectPr"; xml: string }> = [];
  let i = 0;

  while (i < content.length) {
    const pIdx = content.indexOf("<w:p", i);
    const tblIdx = content.indexOf("<w:tbl", i);
    const sectIdx = content.indexOf("<w:sectPr", i);

    const candidates = [
      { tag: "w:p" as const, idx: pIdx },
      { tag: "w:tbl" as const, idx: tblIdx },
      { tag: "w:sectPr" as const, idx: sectIdx },
    ]
      .filter((c) => c.idx !== -1)
      .sort((a, b) => a.idx - b.idx);

    if (candidates.length === 0) break;
    const next = candidates[0];

    const openTag = "<" + next.tag;
    const closeTag = "</" + next.tag + ">";

    // Fast check for self closing e.g. <w:p/> or <w:sectPr/>
    const nextCloseBracket = content.indexOf(">", next.idx);
    if (nextCloseBracket !== -1 && content[nextCloseBracket - 1] === "/") {
      results.push({ tag: next.tag, xml: content.slice(next.idx, nextCloseBracket + 1) });
      i = nextCloseBracket + 1;
      continue;
    }

    let depth = 0;
    let pos = next.idx;
    let endPos = -1;

    while (pos < content.length) {
      const nextOpen = content.indexOf(openTag, pos);
      const nextClose = content.indexOf(closeTag, pos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + openTag.length;
      } else {
        depth--;
        pos = nextClose + closeTag.length;
        if (depth === 0) {
          endPos = pos;
          break;
        }
      }
    }

    if (endPos !== -1) {
      results.push({ tag: next.tag, xml: content.slice(next.idx, endPos) });
      i = endPos;
    } else {
      i = next.idx + openTag.length;
    }
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
export async function extractBlocksFromDocx(buffer: Buffer): Promise<ExtractedBlocksResult> {
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
      blocks.push({
        id: `block-${blockIndex}`,
        index: blockIndex,
        kind: "section-break",
        text: "",
        html: "<hr class=\"section-break\"/>",
        role: "unclassified",
      });
      blockIndex++;
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

  // Also run mammoth to get complete backward-compatible text and HTML
  let mammothText = "";
  let mammothHtml = "";
  try {
    const rawResult = await mammoth.extractRawText({ buffer });
    mammothText = rawResult.value;
    const htmlResult = await mammoth.convertToHtml({ buffer });
    mammothHtml = htmlResult.value;
  } catch {
    mammothText = blocks.map((b) => b.text).join("\n");
    mammothHtml = blocks.map((b) => b.html || "").join("");
  }

  return {
    blocks,
    rawText: mammothText || blocks.map((b) => b.text).join("\n"),
    rawHtml: mammothHtml || blocks.map((b) => b.html || "").join(""),
    fileType: "docx",
  };
}

/**
 * Extracts SourceBlocks from plain text (.txt) buffer.
 */
export function extractBlocksFromTxt(textContent: string): ExtractedBlocksResult {
  const lines = textContent.split(/\r?\n/);
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
    rawText: textContent,
    rawHtml: blocks.map((b) => b.html || "").join(""),
    fileType: "txt",
  };
}
