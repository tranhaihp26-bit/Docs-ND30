import React, { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { renderAsync } from "docx-preview";
import { Packer } from "docx";
import { 
  FileText, ZoomIn, ZoomOut, Maximize2, Minimize2, 
  Printer, Download, FileCode, CheckCircle2, Layers,
  RefreshCw, Eye, Sparkles, LayoutGrid
} from "lucide-react";
import { detectEmbeddedSignature, generateND30DocxDocument } from "../utils/docxExport";
import { preparePreviewDocument, type PreviewDocumentSource } from "../utils/previewDocument.ts";
import {
  COMPANY_HEADER_PROFILE_ID, COMPANY_HEADER_GEOMETRY_MM, COMPANY_MOTTO,
  COMPANY_NATIONAL_HEADER, COMPANY_HEADER_PARENT_LINES, COMPANY_HEADER_ISSUER_LINES,
} from "../canonical/nd30/companyHeader.ts";

export type DocumentData = PreviewDocumentSource;

export interface A4DocumentPreviewProps {
  doc: DocumentData;
  standardType: "administrative" | "party" | "state";
  previewRef: React.RefObject<HTMLDivElement | null>;
  mode?: "thumbnail" | "full";
  onExportDocx?: () => void;
  onExportPdf?: () => void;
  onPrint?: () => void;
  onSwitchToFullPreview?: () => void;
  isExportingDocx?: boolean;
  isExportingPdf?: boolean;
}

// docx-preview does not currently apply the negative OOXML table indent. Restore
// that placement in its HTML view so it matches the exported Word document.
function positionCompanyTableInDocxPreview(root: HTMLElement) {
  const table = Array.from(root.querySelectorAll("table"))
    .find((candidate) => candidate.textContent?.includes(COMPANY_HEADER_ISSUER_LINES[0]));
  if (!table) return;
  table.style.marginLeft = `${COMPANY_HEADER_GEOMETRY_MM.headerIndent}mm`;
  table.style.tableLayout = "fixed";
}

export const A4DocumentPreview: React.FC<A4DocumentPreviewProps> = ({
  doc,
  standardType,
  previewRef,
  mode = "full",
  onExportDocx,
  onExportPdf,
  onPrint,
  onSwitchToFullPreview,
  isExportingDocx = false,
  isExportingPdf = false,
}) => {
  const isParty = standardType === "party";
  const isCompanyHeader = !isParty && doc.headerProfile === COMPANY_HEADER_PROFILE_ID;
  const isImported = doc.importMetadata?.sourceType === "docx" || doc.importMetadata?.sourceType === "txt";
  const [zoomLevel, setZoomLevel] = useState<number | "auto">("auto");
  const [computedScale, setComputedScale] = useState<number>(mode === "thumbnail" ? 0.48 : 0.85);
  const [renderEngine, setRenderEngine] = useState<"docx_real" | "css_canvas">("docx_real");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalZoom, setModalZoom] = useState<number>(0.9);
  const [pageCount, setPageCount] = useState<number>(1);
  const [isRenderingDocx, setIsRenderingDocx] = useState<boolean>(false);
  const [docxRenderError, setDocxRenderError] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const modalDocxContainerRef = useRef<HTMLDivElement>(null);

  // A4 sheet dimensions in CSS pixels at 96 DPI: 210mm ~ 794px, 297mm ~ 1123px
  const A4_WIDTH_PX = 794;
  const A4_HEIGHT_PX = 1123;

  // Check embedded headers / signatures in bodyHtml
  const bodyHtml = doc.bodyHtml || "";
  const topHtmlUpper = bodyHtml.slice(0, 1500).toUpperCase();
  const hasEmbeddedHeader =
    topHtmlUpper.includes("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM") ||
    topHtmlUpper.includes("ĐẢNG CỘNG SẢN VIỆT NAM");
  const hasEmbeddedSignature = detectEmbeddedSignature(bodyHtml);

  // 1. Calculate responsive scale based on container width
  useEffect(() => {
    const calculateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth - 32; // padding offset
      if (zoomLevel === "auto") {
        if (mode === "thumbnail") {
          const autoScale = Math.min(0.6, Math.max(0.35, containerWidth / A4_WIDTH_PX));
          setComputedScale(autoScale);
        } else {
          const autoScale = Math.min(1.1, Math.max(0.45, containerWidth / (A4_WIDTH_PX + 40)));
          setComputedScale(autoScale);
        }
      } else {
        setComputedScale(zoomLevel);
      }
    };

    calculateScale();
    const resizeObserver = new ResizeObserver(calculateScale);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [zoomLevel, mode]);

  // 2. Debounced DOCX Real Engine Rendering via docx-preview
  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(async () => {
      if (renderEngine !== "docx_real") return;
      const targetElement = docxContainerRef.current;
      if (!targetElement) return;

      try {
        setIsRenderingDocx(true);
        const normalizedDoc = preparePreviewDocument(doc, isParty ? "party" : "administrative");
        const docxDoc = generateND30DocxDocument(normalizedDoc);
        const blob = await Packer.toBlob(docxDoc);

        if (!isMounted || !docxContainerRef.current) return;

        docxContainerRef.current.innerHTML = "";
        await renderAsync(blob, docxContainerRef.current, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          experimental: true,
          trimXmlDeclaration: true,
          debug: false,
        });
        if (isCompanyHeader && docxContainerRef.current) {
          positionCompanyTableInDocxPreview(docxContainerRef.current);
        }

        setDocxRenderError(false);
      } catch (err) {
        console.warn("docx-preview rendering error, falling back to CSS canvas:", err);
        if (isMounted) setDocxRenderError(true);
      } finally {
        if (isMounted) setIsRenderingDocx(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [doc, standardType, isParty, isCompanyHeader, renderEngine]);

  // 3. Render Modal DOCX Real Engine when Modal is Open
  useEffect(() => {
    if (!isModalOpen || renderEngine !== "docx_real" || !modalDocxContainerRef.current) return;

    let isMounted = true;
    const renderModalDocx = async () => {
      try {
        const normalizedDoc = preparePreviewDocument(doc, isParty ? "party" : "administrative");
        const docxDoc = generateND30DocxDocument(normalizedDoc);
        const blob = await Packer.toBlob(docxDoc);
        if (!isMounted || !modalDocxContainerRef.current) return;

        modalDocxContainerRef.current.innerHTML = "";
        await renderAsync(blob, modalDocxContainerRef.current, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          experimental: true,
          trimXmlDeclaration: true,
          debug: false,
        });
        if (isCompanyHeader && modalDocxContainerRef.current) {
          positionCompanyTableInDocxPreview(modalDocxContainerRef.current);
        }
      } catch (err) {
        console.warn("Modal docx-preview render error:", err);
      }
    };

    renderModalDocx();
    return () => { isMounted = false; };
  }, [isModalOpen, doc, standardType, isParty, isCompanyHeader, renderEngine]);

  // 4. Estimate page count for CSS Canvas fallback
  useEffect(() => {
    if (renderEngine === "docx_real" && !docxRenderError) return;
    const calculatePages = () => {
      const targetElement = previewRef.current || sheetRef.current;
      if (targetElement) {
        const height = targetElement.scrollHeight;
        const estimatedPages = Math.max(1, Math.ceil(height / A4_HEIGHT_PX));
        setPageCount(estimatedPages);
      }
    };

    calculatePages();
    const timeout = setTimeout(calculatePages, 200);
    return () => clearTimeout(timeout);
  }, [doc, bodyHtml, renderEngine, docxRenderError]);

  const handleZoomIn = () => {
    if (zoomLevel === "auto") setZoomLevel(mode === "thumbnail" ? 0.65 : 1.0);
    else setZoomLevel((prev) => Math.min(1.8, (prev as number) + 0.15));
  };

  const handleZoomOut = () => {
    if (zoomLevel === "auto") setZoomLevel(mode === "thumbnail" ? 0.35 : 0.6);
    else setZoomLevel((prev) => Math.max(0.3, (prev as number) - 0.15));
  };

  // High-fidelity CSS A4 Paper Sheet Renderer
  const renderA4SheetContent = (isModal = false) => (
    <div
      id={isModal ? undefined : "printable-document"}
      ref={isModal ? undefined : previewRef}
      className="bg-white text-slate-900 rounded-sm border border-slate-300 shadow-2xl mx-auto selection:bg-blue-100 relative text-left box-border"
      style={{
        width: "210mm",
        minHeight: "297mm",
        paddingTop: "20mm",
        paddingBottom: "20mm",
        paddingLeft: "30mm",
        paddingRight: "15mm",
        fontFamily: "'Times New Roman', Times, serif",
        fontSize: isParty ? "14pt" : "13pt",
        lineHeight: "1.4",
        color: "#000000",
        boxSizing: "border-box",
      }}
    >
      {/* 1. Header Block (2 columns) */}
      {!hasEmbeddedHeader && isCompanyHeader && (
        <div
          className="grid text-center text-black mb-6"
          style={{
            width: `${COMPANY_HEADER_GEOMETRY_MM.headerWidth}mm`,
            marginLeft: `${COMPANY_HEADER_GEOMETRY_MM.headerIndent}mm`,
            gridTemplateColumns: `${COMPANY_HEADER_GEOMETRY_MM.leftColumn}mm ${COMPANY_HEADER_GEOMETRY_MM.rightColumn}mm`,
            fontFamily: "'Times New Roman', Times, serif",
            lineHeight: 1.15,
          }}
        >
          <div>
            <p style={{ fontSize: "12pt" }}>{COMPANY_HEADER_PARENT_LINES[0]}<br />{COMPANY_HEADER_PARENT_LINES[1]}</p>
            <p className="font-bold whitespace-nowrap" style={{ fontSize: "12pt" }}>{COMPANY_HEADER_ISSUER_LINES[0]}</p>
            <div className="border-b border-black mx-auto mt-1" style={{ width: "35mm" }} />
          </div>
          <div>
            <p className="font-bold whitespace-nowrap" style={{ fontSize: "12pt" }}>{COMPANY_NATIONAL_HEADER}</p>
            <p className="font-bold" style={{ fontSize: "13pt" }}>{COMPANY_MOTTO}</p>
            <div className="border-b border-black mx-auto mt-1" style={{ width: "50.5mm" }} />
          </div>
          <p className="mt-1" style={{ fontSize: "13pt" }}>{doc.referenceNumber || "Số: …/…"}</p>
          <p className="mt-1 italic text-right" style={{ fontSize: "13pt" }}>{doc.locationAndDate || "Hải Phòng, ngày … tháng … năm …"}</p>
        </div>
      )}
      {!hasEmbeddedHeader && !isCompanyHeader && (
        <div className="grid grid-cols-2 text-center mb-6 gap-2 items-start text-black">
          {/* Column 1: Organization Header & Ref Number */}
          <div>
            {doc.orgHeader1 && (
              <p className="uppercase text-[10.5pt] font-normal leading-tight">
                {doc.orgHeader1}
              </p>
            )}
            <p className="font-bold uppercase text-[11pt] leading-tight mt-0.5">
              {doc.orgHeader2 || (isParty ? "[TÊN CẤP ỦY]" : "[CƠ QUAN BAN HÀNH]")}
            </p>
            <div className="w-20 h-[1px] bg-black mx-auto my-1.5"></div>
            <p className="text-[10pt] mt-1 font-normal">
              {doc.referenceNumber || "Số: .../..."}
            </p>
          </div>

          {/* Column 2: National Header & Date */}
          <div>
            <p className="font-bold uppercase text-[11pt] leading-tight">
              {doc.nationalHeader1 ||
                (isParty ? "ĐẢNG CỘNG SẢN VIỆT NAM" : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM")}
            </p>
            {!isParty && (
              <>
                <p className="font-bold text-[11pt] leading-tight mt-0.5">
                  {doc.nationalHeader2 || "Độc lập - Tự do - Hạnh phúc"}
                </p>
                <div className="w-28 h-[1px] bg-black mx-auto my-1.5"></div>
              </>
            )}
            {isParty && <div className="w-28 h-[1px] bg-black mx-auto my-1.5"></div>}
            <p className="text-[10pt] italic mt-1 font-normal">
              {doc.locationAndDate || "[Địa danh], ngày ... tháng ... năm ..."}
            </p>
          </div>
        </div>
      )}

      {/* 2. Document Type (Tên loại văn bản) */}
      {!hasEmbeddedHeader && doc.documentType && (
        <div className="text-center my-4">
          <h2 className="font-bold uppercase text-[14pt] tracking-wide">
            {doc.documentType}
          </h2>
        </div>
      )}

      {/* 3. Subject (Trích yếu) */}
      {!hasEmbeddedHeader && doc.subject && (
        <div className="text-center mb-4 px-4">
          <p className="italic text-[11pt] font-bold leading-snug">
            {doc.subject}
          </p>
        </div>
      )}

      {/* 4. Main Body HTML */}
      <div
        className="text-justify my-4 space-y-2 [&_p]:my-1.5 [&_p]:text-justify [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-black [&_th]:p-2 [&_th]:font-bold [&_th]:bg-slate-50 [&_td]:border [&_td]:border-black [&_td]:p-2"
        style={{
          fontSize: isParty ? "14pt" : "13pt",
          fontFamily: "'Times New Roman', Times, serif",
          lineHeight: "1.4",
        }}
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(bodyHtml || (isImported ? "" : "<p>[Chưa có nội dung văn bản]</p>")),
        }}
      />

      {/* 5. Signature & Recipients Block */}
      {!hasEmbeddedSignature && (!isImported || Boolean(doc.recipients || doc.signTitle || doc.signName)) && (
        <div className="mt-8 grid grid-cols-2 gap-4 pt-2 items-start break-inside-avoid">
          {/* Left Column: Recipients */}
          <div className="text-[10pt] leading-normal">
            {(doc.recipients || !isImported) && <>
              <p className="font-bold italic">Nơi nhận:</p>
              <div className="whitespace-pre-line mt-1">
                {doc.recipients || "- Như trên;\n- Lưu: VT."}
              </div>
            </>}
          </div>

          {/* Right Column: Sign Title & Name */}
          <div className="text-center">
            {(doc.signTitle || doc.signName || !isImported) && <>
              <p className="font-bold uppercase text-[11pt] whitespace-pre-line leading-tight">
                {doc.signTitle || (isImported ? "" : isParty ? "T/M CẤP ỦY\nBÍ THƯ" : "TM. CƠ QUAN BAN HÀNH\nGIÁM ĐỐC")}
              </p>
              <p className="text-[9.5pt] italic my-2 text-slate-600">(Ký, ghi rõ họ tên và đóng dấu)</p>
              <div className="h-16"></div>
              <p className="font-bold text-[11pt]">{doc.signName || (isImported ? "" : "[Họ và tên]")}</p>
            </>}
          </div>
        </div>
      )}

      {/* 6. Independent Appendices Section */}
      {doc.appendices && Array.isArray(doc.appendices) && doc.appendices.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-300 space-y-8">
          {doc.appendices.map((app: any, idx: number) => (
            <div key={app.id || idx} className="space-y-4">
              <div className="text-center">
                <h3 className="font-bold uppercase text-[12pt]">
                  {app.title || `PHỤ LỤC ${idx + 1}`}
                </h3>
                {app.referenceText && (
                  <p className="italic text-[11pt] mt-1">{app.referenceText}</p>
                )}
              </div>
              <div
                className="text-justify space-y-2 [&_p]:my-1.5 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:border [&_th]:border-black [&_th]:p-2 [&_th]:font-bold [&_td]:border [&_td]:border-black [&_td]:p-2"
                style={{
                  fontSize: isParty ? "14pt" : "13pt",
                  fontFamily: "'Times New Roman', Times, serif",
                  lineHeight: "1.4",
                }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(app.html || ""),
                }}
              />
            </div>
          ))}
        </div>
      )}
      {Boolean(doc.unclassified?.length) && (
        <div className="mt-12 pt-8 border-t border-amber-300 space-y-3">
          <h3 className="font-bold text-amber-900">KHỐI CHƯA PHÂN LOẠI — CẦN ĐỐI CHIẾU BẢN GỐC</h3>
          {doc.unclassified?.map((block) => (
            <div key={block.id}>
              <p className="font-semibold">Khối #{block.index + 1} ({block.kind})</p>
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.html || `<p>${block.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`) }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 ${
      mode === "thumbnail" ? "p-3.5 sticky top-20" : "p-4 sm:p-5"
    }`}>
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>Xem trước trang A4 (210×297 mm)</span>
            </h3>
            <p className="text-[10px] text-slate-500 font-sans">
              Khổ A4 Portrait · Lề: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm
            </p>
          </div>
        </div>

        {/* Badges & Mode Switchers */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold border border-blue-100">
            {isParty ? "HD 05 (14pt)" : "NĐ 30 (13pt)"}
          </span>
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200 flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-500" />
            {renderEngine === "docx_real" && !docxRenderError ? "Bản xem DOCX" : `Khoảng ${pageCount} trang (ước tính)`}
          </span>

          {mode === "full" && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] ml-1">
              <button
                type="button"
                onClick={() => setRenderEngine("docx_real")}
                className={`px-2 py-0.5 rounded font-medium transition ${
                  renderEngine === "docx_real" ? "bg-white text-blue-700 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Sử dụng engine Word DOCX thực tế"
              >
                Engine Word Real
              </button>
              <button
                type="button"
                onClick={() => setRenderEngine("css_canvas")}
                className={`px-2 py-0.5 rounded font-medium transition ${
                  renderEngine === "css_canvas" ? "bg-white text-blue-700 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Sử dụng A4 Canvas CSS"
              >
                Canvas CSS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar: Zoom, Scale, Fullscreen */}
      <div className="flex flex-wrap items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            title="Thu nhỏ"
            className="p-1 hover:bg-white hover:shadow-2xs rounded text-slate-700 border border-transparent hover:border-slate-200 transition"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel("auto")}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
              zoomLevel === "auto"
                ? "bg-blue-600 text-white shadow-2xs font-semibold"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Vừa khung ({Math.round(computedScale * 100)}%)
          </button>
          <button
            onClick={handleZoomIn}
            title="Phóng to"
            className="p-1 hover:bg-white hover:shadow-2xs rounded text-slate-700 border border-transparent hover:border-slate-200 transition"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <select
            value={zoomLevel === "auto" ? "auto" : zoomLevel}
            onChange={(e) => {
              const val = e.target.value;
              setZoomLevel(val === "auto" ? "auto" : parseFloat(val));
            }}
            className="bg-white border border-slate-200 text-[11px] rounded px-1.5 py-0.5 text-slate-700 focus:outline-none"
          >
            <option value="auto">Tự động</option>
            <option value="0.4">40%</option>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1.0">100% (A4 chuẩn)</option>
            <option value="1.25">125%</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          {mode === "thumbnail" && onSwitchToFullPreview && (
            <button
              onClick={onSwitchToFullPreview}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2.5 py-1 rounded-lg text-[11px] transition flex items-center gap-1 shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5" /> Xem toàn trang
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition flex items-center gap-1 shadow-2xs"
          >
            <Maximize2 className="w-3.5 h-3.5" /> Mở rộng A4
          </button>
        </div>
      </div>

      {/* Main Preview Container with Neutral Canvas & Centered A4 Pages */}
      <div
        ref={containerRef}
        className={`bg-slate-200/90 rounded-xl border border-slate-300 overflow-x-auto flex justify-center items-start relative shadow-inner ${
          mode === "thumbnail" ? "p-3 min-h-[420px]" : "p-4 sm:p-8 min-h-[600px]"
        }`}
      >
        {/* Render Engine 1: DOCX Real Engine (Word .docx rendered via docx-preview) */}
        {renderEngine === "docx_real" && !docxRenderError ? (
          <div
            key="docx-real"
            className="w-full flex justify-center"
            style={{
              transform: `scale(${computedScale})`,
              transformOrigin: "top center",
              transition: "transform 0.15s ease-out",
              marginBottom: mode === "thumbnail" ? `-${A4_HEIGHT_PX * 0.45}px` : "20px",
            }}
          >
            {isRenderingDocx && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10 rounded">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-200 text-xs font-semibold text-slate-800">
                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                  Đang dựng văn bản Word A4...
                </div>
              </div>
            )}
            <div ref={docxContainerRef} className="docx-preview-wrapper shadow-2xl" />
          </div>
        ) : (
          /* Render Engine 2: High-Fidelity CSS A4 Canvas Sheet */
          <div
            key="css-canvas"
            style={{
              transform: `scale(${computedScale})`,
              transformOrigin: "top center",
              transition: "transform 0.15s ease-out",
              marginBottom: `${-(A4_HEIGHT_PX * (1 - computedScale))}px`,
            }}
          >
            {renderA4SheetContent(false)}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-1 grid grid-cols-3 gap-2">
        {onPrint && (
          <button
            onClick={onPrint}
            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" /> In A4
          </button>
        )}
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            disabled={isExportingPdf}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <FileCode className="w-3.5 h-3.5" /> {isExportingPdf ? "Đang xuất..." : "Xuất PDF"}
          </button>
        )}
        {onExportDocx && (
          <button
            onClick={onExportDocx}
            disabled={isExportingDocx}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> {isExportingDocx ? "Đang xuất..." : "Xuất Word"}
          </button>
        )}
      </div>

      {/* FULLSCREEN / EXPANDED A4 PREVIEW MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex flex-col items-center justify-between p-3 sm:p-6 overflow-hidden">
          {/* Modal Topbar */}
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 px-4 py-2.5 w-full max-w-6xl flex items-center justify-between z-10 mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <span>Xem trước A4 (210×297 mm) — Tỷ lệ hình học chuẩn</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                    {isParty ? "HD 05 (14pt)" : "NĐ 30 (13pt)"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Lề: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm · Khoảng {pageCount} trang
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Modal Zoom Controls */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                <button
                  onClick={() => setModalZoom((z) => Math.max(0.4, z - 0.1))}
                  className="p-1 hover:bg-white rounded text-slate-700"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-medium text-slate-700">{Math.round(modalZoom * 100)}%</span>
                <button
                  onClick={() => setModalZoom((z) => Math.min(1.5, z + 0.1))}
                  className="p-1 hover:bg-white rounded text-slate-700"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setModalZoom(1.0)}
                  className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  100%
                </button>
              </div>

              {/* Action Buttons */}
              {onPrint && (
                <button
                  onClick={onPrint}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> In
                </button>
              )}
              {onExportDocx && (
                <button
                  onClick={onExportDocx}
                  disabled={isExportingDocx}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> Xuất Word
                </button>
              )}

              <button
                onClick={() => setIsModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1.5 rounded-lg font-bold transition ml-1"
                title="Đóng xem trước"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Body Container */}
          <div 
            ref={modalContainerRef}
            className="w-full flex-1 overflow-auto bg-slate-800/80 rounded-xl p-4 sm:p-8 flex justify-center items-start shadow-inner"
          >
            {renderEngine === "docx_real" && !docxRenderError ? (
              <div
                key="modal-docx-real"
                style={{
                  transform: `scale(${modalZoom})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease-out",
                }}
              >
                <div ref={modalDocxContainerRef} className="docx-preview-modal-wrapper" />
              </div>
            ) : (
              <div
                key="modal-css-canvas"
                style={{
                  transform: `scale(${modalZoom})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease-out",
                }}
              >
                {renderA4SheetContent(true)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
