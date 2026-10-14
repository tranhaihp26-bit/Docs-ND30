import React, { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { 
  FileText, ZoomIn, ZoomOut, Maximize2, Minimize2, 
  Printer, Download, FileCode, CheckCircle2, Layers
} from "lucide-react";
import { detectEmbeddedSignature } from "../utils/docxExport";

export interface DocumentData {
  orgHeader1?: string;
  orgHeader2?: string;
  referenceNumber?: string;
  nationalHeader1?: string;
  nationalHeader2?: string;
  locationAndDate?: string;
  documentType?: string;
  subject?: string;
  bodyHtml?: string;
  recipients?: string;
  signTitle?: string;
  signName?: string;
  regime?: "administrative" | "party";
}

export interface A4DocumentPreviewProps {
  doc: DocumentData;
  standardType: "administrative" | "party" | "state";
  previewRef: React.RefObject<HTMLDivElement | null>;
  onExportDocx?: () => void;
  onExportPdf?: () => void;
  onPrint?: () => void;
  isExportingDocx?: boolean;
  isExportingPdf?: boolean;
}

export const A4DocumentPreview: React.FC<A4DocumentPreviewProps> = ({
  doc,
  standardType,
  previewRef,
  onExportDocx,
  onExportPdf,
  onPrint,
  isExportingDocx = false,
  isExportingPdf = false,
}) => {
  const isParty = standardType === "party";
  const [zoomLevel, setZoomLevel] = useState<number | "auto">("auto");
  const [computedScale, setComputedScale] = useState<number>(0.52);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalZoom, setModalZoom] = useState<number>(0.85);
  const [pageCount, setPageCount] = useState<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // A4 sheet dimensions in pixels at 96 DPI: 210mm ~ 794px, 297mm ~ 1123px
  const A4_WIDTH_PX = 794;
  const A4_HEIGHT_PX = 1123;

  // Check embedded headers / signatures in bodyHtml
  const bodyHtml = doc.bodyHtml || "";
  const topHtmlUpper = bodyHtml.slice(0, 1500).toUpperCase();
  const hasEmbeddedHeader =
    topHtmlUpper.includes("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM") ||
    topHtmlUpper.includes("ĐẢNG CỘNG SẢN VIỆT NAM");
  const hasEmbeddedSignature = detectEmbeddedSignature(bodyHtml);

  // Calculate responsive scale for sidebar container
  useEffect(() => {
    const calculateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth - 24; // padding offset
      if (zoomLevel === "auto") {
        const autoScale = Math.min(1, Math.max(0.35, containerWidth / A4_WIDTH_PX));
        setComputedScale(autoScale);
      } else {
        setComputedScale(zoomLevel);
      }
    };

    calculateScale();
    const resizeObserver = new ResizeObserver(calculateScale);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [zoomLevel]);

  // Calculate page count based on content height inside A4 sheet
  useEffect(() => {
    const calculatePages = () => {
      const targetElement = previewRef.current || sheetRef.current;
      if (targetElement) {
        const height = targetElement.scrollHeight;
        const estimatedPages = Math.max(1, Math.ceil(height / A4_HEIGHT_PX));
        setPageCount(estimatedPages);
      }
    };

    calculatePages();
    const timeout = setTimeout(calculatePages, 300);
    return () => clearTimeout(timeout);
  }, [doc, bodyHtml]);

  const handleZoomIn = () => {
    if (zoomLevel === "auto") setZoomLevel(0.65);
    else setZoomLevel((prev) => Math.min(1.5, (prev as number) + 0.1));
  };

  const handleZoomOut = () => {
    if (zoomLevel === "auto") setZoomLevel(0.45);
    else setZoomLevel((prev) => Math.max(0.3, (prev as number) - 0.1));
  };

  const renderA4SheetContent = (isModal = false) => (
    <div
      id={isModal ? undefined : "printable-document"}
      ref={isModal ? undefined : previewRef}
      className="bg-white text-slate-900 rounded border border-slate-300 shadow-xl mx-auto selection:bg-blue-100 relative text-left box-border"
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
      }}
    >
      {/* 1. Header Block (2 columns) - Only if not embedded in bodyHtml */}
      {!hasEmbeddedHeader && (
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
          __html: DOMPurify.sanitize(bodyHtml || "<p>[Chưa có nội dung văn bản]</p>"),
        }}
      />

      {/* 5. Signature & Recipients Block - Only if not embedded */}
      {!hasEmbeddedSignature && (
        <div className="mt-8 grid grid-cols-2 gap-4 pt-2 items-start break-inside-avoid">
          {/* Left Column: Recipients */}
          <div className="text-[10pt] leading-normal">
            <p className="font-bold italic">Nơi nhận:</p>
            <div className="whitespace-pre-line mt-1">
              {doc.recipients || "- Như trên;\n- Lưu: VT."}
            </div>
          </div>

          {/* Right Column: Sign Title & Name */}
          <div className="text-center">
            <p className="font-bold uppercase text-[11pt] whitespace-pre-line leading-tight">
              {doc.signTitle || (isParty ? "T/M CẤP ỦY\nBÍ THƯ" : "TM. CƠ QUAN BAN HÀNH\nGIÁM ĐỐC")}
            </p>
            <p className="text-[9.5pt] italic my-2 text-slate-600">(Ký, ghi rõ họ tên và đóng dấu)</p>
            <div className="h-16"></div>
            <p className="font-bold text-[11pt]">{doc.signName || "[Họ và tên]"}</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="sticky top-20 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>Xem trước A4 (NĐ 30 / HD 05)</span>
            </h3>
            <p className="text-[10px] text-slate-500 font-sans">
              210 × 297 mm · Tỷ lệ 1:1.414 · Lề 20-15-20-30mm
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1 text-[10px]">
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-100">
            {isParty ? "HD 05 (14pt)" : "NĐ 30 (13pt)"}
          </span>
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200 flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-500" />
            {pageCount} trang
          </span>
        </div>
      </div>

      {/* Toolbar: Zoom & Expand */}
      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
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
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Tự vừa khung ({Math.round(computedScale * 100)}%)
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
            <option value="auto">Auto</option>
            <option value="0.4">40%</option>
            <option value="0.5">50%</option>
            <option value="0.6">60%</option>
            <option value="0.75">75%</option>
            <option value="1.0">100% (Chuẩn A4)</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg font-semibold text-[11px] transition flex items-center gap-1 shadow-2xs"
          >
            <Maximize2 className="w-3 h-3" /> Mở rộng A4
          </button>
        </div>
      </div>

      {/* Main Preview Container with Responsive Scaling */}
      <div
        ref={containerRef}
        className="bg-slate-200/80 p-3 sm:p-4 rounded-xl border border-slate-300 overflow-x-auto min-h-[500px] flex justify-center items-start relative shadow-inner"
      >
        <div
          style={{
            transform: `scale(${computedScale})`,
            transformOrigin: "top center",
            transition: "transform 0.15s ease-out",
            marginBottom: `${-(A4_HEIGHT_PX * (1 - computedScale))}px`,
          }}
        >
          {renderA4SheetContent(false)}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 grid grid-cols-3 gap-2">
        {onPrint && (
          <button
            onClick={onPrint}
            className="bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" /> In A4
          </button>
        )}
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            disabled={isExportingPdf}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
          >
            <FileCode className="w-3.5 h-3.5" /> {isExportingPdf ? "Đang xuất..." : "Xuất PDF"}
          </button>
        )}
        {onExportDocx && (
          <button
            onClick={onExportDocx}
            disabled={isExportingDocx}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> {isExportingDocx ? "Đang xuất..." : "Xuất Word"}
          </button>
        )}
      </div>

      {/* FULLSCREEN / EXPANDED PREVIEW MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex flex-col items-center justify-between p-4 sm:p-6 overflow-hidden">
          {/* Modal Topbar */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 px-4 py-2.5 w-full max-w-5xl flex items-center justify-between z-10 mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Xem trước trực quan A4 — Tỷ lệ hình học 1:1.414 (NĐ 30 / HD 05)
                </h3>
                <p className="text-xs text-slate-500">
                  Khổ A4 (210mm × 297mm) · Lề: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm · ~{pageCount} trang
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
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
                  onClick={() => setModalZoom((z) => Math.min(1.4, z + 0.1))}
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
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 p-1.5 rounded-lg font-bold transition ml-2"
                title="Đóng xem trước"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Body Container */}
          <div className="w-full flex-1 overflow-auto bg-slate-800/60 rounded-xl p-6 flex justify-center items-start shadow-inner">
            <div
              style={{
                transform: `scale(${modalZoom})`,
                transformOrigin: "top center",
                transition: "transform 0.15s ease-out",
              }}
            >
              {renderA4SheetContent(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
