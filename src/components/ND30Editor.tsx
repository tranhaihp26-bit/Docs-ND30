/**
 * @file ND30Editor.tsx
 * @description Tiptap Rich Text Editor chuyên dụng cho văn bản hành chính theo Nghị định số 30/2020/NĐ-CP
 * và Hướng dẫn số 05-HD/VPTW của Văn phòng Trung ương Đảng.
 * 
 * TÍNH NĂNG CHÍNH:
 * 1. Chèn Quốc hiệu / Tiêu ngữ chuẩn (căn giữa, in hoa, đậm, gạch ngang).
 * 2. Chèn Cơ quan ban hành chuẩn (in hoa, đứng, đậm).
 * 3. Chuẩn hóa Heading (H1, H2, H3) theo chuẩn trình bày văn bản pháp quy:
 *    - H1: Tên loại văn bản (căn giữa, in hoa, đậm, 14pt).
 *    - H2: Phân mục / Lời ban hành (QUYẾT ĐỊNH:, CHƯƠNG I...).
 *    - H3: Điều, Khoản (Điều 1., Khoản 1...).
 * 4. Chèn Căn cứ pháp lý, Khối chữ ký & Nơi nhận.
 * 5. Giữ vững font Times New Roman và giãn dòng 1.15 - 1.25 chuẩn NĐ 30.
 */

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { 
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, 
  AlignRight, AlignJustify, List, ListOrdered, Undo, Redo, 
  Heading1, Heading2, Heading3, FileText, Building2, Scale, 
  PenTool, PlusCircle, Bookmark
} from "lucide-react";

export interface ND30EditorProps {
  /** Nội dung HTML của văn bản */
  content: string;
  /** Callback kích hoạt khi nội dung thay đổi */
  onChange: (html: string) => void;
  /** Chế độ thể thức: Hành chính nhà nước hoặc Văn bản Đảng */
  regime?: "administrative" | "party";
  /** Chiều cao tối thiểu của khung soạn thảo */
  minHeight?: string;
}

export const ND30Editor: React.FC<ND30EditorProps> = ({
  content,
  onChange,
  regime = "administrative",
  minHeight = "480px",
}) => {
  const isParty = regime === "party";

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
        defaultAlignment: "justify",
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none min-h-[420px] p-6 font-serif text-[13pt] leading-[1.35] text-slate-900",
        style: "font-family: 'Times New Roman', Times, serif;",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  // ACTION 1: Chèn Quốc hiệu và Tiêu ngữ chuẩn NĐ 30
  const insertNationalHeader = () => {
    const line1 = isParty ? "ĐẢNG CỘNG SẢN VIỆT NAM" : "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
    const line2 = isParty ? "" : "Độc lập - Tự do - Hạnh phúc";
    const divider = isParty ? "-------------------" : "------------------------";

    const htmlSnippet = `
      <p style="text-align: center;"><strong>${line1}</strong></p>
      ${line2 ? `<p style="text-align: center;"><strong>${line2}</strong></p>` : ""}
      <p style="text-align: center;"><small>${divider}</small></p>
      <p></p>
    `;
    editor.chain().focus().insertContent(htmlSnippet).run();
  };

  // ACTION 2: Chèn Tên cơ quan ban hành văn bản
  const insertOrgHeader = () => {
    const parentOrg = isParty ? "ĐẢNG BỘ TỈNH/THÀNH PHỐ" : "UBND TỈNH / THÀNH PHỐ...";
    const org = isParty ? "BAN THƯỜNG VỤ / VĂN PHÒNG" : "VĂN PHÒNG / SỞ BAN NGÀNH...";
    const refNum = isParty ? "Số: 01-NQ/TU" : "Số: 01/QĐ-UBND";

    const htmlSnippet = `
      <p style="text-align: center;">${parentOrg}</p>
      <p style="text-align: center;"><strong>${org}</strong></p>
      <p style="text-align: center;"><small>-------------</small></p>
      <p style="text-align: center;">${refNum}</p>
      <p></p>
    `;
    editor.chain().focus().insertContent(htmlSnippet).run();
  };

  // ACTION 3: Chèn Căn cứ pháp lý
  const insertLegalGround = () => {
    const groundText = isParty
      ? `<p><strong><em>Căn cứ Điều lệ Đảng Cộng sản Việt Nam;</em></strong></p><p><strong><em>Căn cứ Quy chế làm việc của Ban Chấp hành...;</em></strong></p>`
      : `<p><strong><em>Căn cứ Luật Tổ chức chính quyền địa phương ngày 19 tháng 6 năm 2015;</em></strong></p><p><strong><em>Căn cứ Nghị định số 30/2020/NĐ-CP ngày 05 tháng 3 năm 2020 của Chính phủ về công tác văn thư;</em></strong></p><p><strong><em>Xét đề nghị của...;</em></strong></p>`;
    editor.chain().focus().insertContent(groundText).run();
  };

  // ACTION 4: Chèn Điều khoản mới (Điều ... / Khoản ...)
  const insertArticle = () => {
    const articleHtml = `
      <p><strong>Điều 1. [Tên điều khoản]</strong></p>
      <p style="text-indent: 1.27cm;">1. Nội dung khoản 1 chi tiết...</p>
      <p style="text-indent: 1.27cm;">2. Nội dung khoản 2 chi tiết...</p>
    `;
    editor.chain().focus().insertContent(articleHtml).run();
  };

  // ACTION 5: Chèn Khối chữ ký & Nơi nhận chuẩn NĐ 30
  const insertSignatureBlock = () => {
    const signTitle = isParty ? "T/M BAN THƯỜNG VỤ<br/>BÍ THƯ" : "TM. ỦY BAN NHÂN DÂN<br/>CHỦ TỊCH";
    const recipients = isParty ? "Như Điều...;<br/>Lưu: VT, Ban Tổ chức." : "Như Điều...;<br/>Lưu: VT, TH.";

    const htmlSnippet = `
      <br/>
      <table style="width: 100%; border: none; margin-top: 20px;">
        <tbody>
          <tr>
            <td style="width: 50%; vertical-align: top; font-size: 11pt;">
              <p><strong><em>Nơi nhận:</em></strong></p>
              <p>- ${recipients}</p>
            </td>
            <td style="width: 50%; text-align: center; vertical-align: top;">
              <p><strong>${signTitle}</strong></p>
              <p><em>(Ký, ghi rõ họ tên và đóng dấu)</em></p>
              <br/><br/><br/>
              <p><strong>[Họ và tên người ký]</strong></p>
            </td>
          </tr>
        </tbody>
      </table>
      <p></p>
    `;
    editor.chain().focus().insertContent(htmlSnippet).run();
  };

  return (
    <div className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
      {/* 1. Thanh công cụ cấp cao: Thể thức NĐ 30 / HD 05 */}
      <div className="bg-slate-100 border-b border-slate-200 p-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="font-bold text-slate-700 px-2 py-1 flex items-center gap-1 border-r border-slate-300 mr-1">
          <Scale className="w-3.5 h-3.5 text-blue-600" /> Chuẩn NĐ 30:
        </span>

        {/* Nút Chèn Quốc hiệu / Tiêu ngữ */}
        <button
          type="button"
          onClick={insertNationalHeader}
          className="bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-300 px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 shadow-2xs"
          title="Chèn Quốc hiệu, Tiêu ngữ (căn giữa, in hoa, đậm)"
        >
          <FileText className="w-3.5 h-3.5 text-rose-600" /> Quốc hiệu/Tiêu ngữ
        </button>

        {/* Nút Chèn Cơ quan ban hành */}
        <button
          type="button"
          onClick={insertOrgHeader}
          className="bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-300 px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 shadow-2xs"
          title="Chèn Tên cơ quan ban hành văn bản"
        >
          <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Cơ quan ban hành
        </button>

        {/* Nút Chèn Căn cứ pháp lý */}
        <button
          type="button"
          onClick={insertLegalGround}
          className="bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-300 px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 shadow-2xs"
          title="Chèn căn cứ pháp lý (in nghiêng, đậm)"
        >
          <Bookmark className="w-3.5 h-3.5 text-amber-600" /> Căn cứ pháp lý
        </button>

        {/* Nút Chèn Điều khoản */}
        <button
          type="button"
          onClick={insertArticle}
          className="bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-300 px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 shadow-2xs"
          title="Chèn Điều, Khoản (thụt đầu dòng 1.27cm)"
        >
          <PlusCircle className="w-3.5 h-3.5 text-indigo-600" /> Thêm Điều khoản
        </button>

        {/* Nút Chèn Khối Chữ ký */}
        <button
          type="button"
          onClick={insertSignatureBlock}
          className="bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-300 px-2.5 py-1 rounded-md font-medium transition flex items-center gap-1 shadow-2xs"
          title="Chèn khối chữ ký và nơi nhận chuẩn 2 cột"
        >
          <PenTool className="w-3.5 h-3.5 text-purple-600" /> Khối chữ ký & Nơi nhận
        </button>
      </div>

      {/* 2. Thanh công cụ định dạng chuẩn: Typography & Alignment */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex flex-wrap items-center justify-between gap-1 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          {/* Headings mapped to NĐ 30 standards */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).setTextAlign("center").run()}
            className={`p-1.5 rounded transition ${
              editor.isActive("heading", { level: 1 })
                ? "bg-blue-600 text-white font-bold"
                : "text-slate-700 hover:bg-slate-200"
            }`}
            title="H1: Tên loại văn bản (căn giữa, in hoa, đậm, 14pt)"
          >
            <span className="font-bold px-1">H1 (Loại VB)</span>
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).setTextAlign("center").run()}
            className={`p-1.5 rounded transition ${
              editor.isActive("heading", { level: 2 })
                ? "bg-blue-600 text-white font-bold"
                : "text-slate-700 hover:bg-slate-200"
            }`}
            title="H2: Lệnh hành chính (VD: QUYẾT ĐỊNH:)"
          >
            <span className="font-bold px-1">H2 (Phân mục)</span>
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).setTextAlign("left").run()}
            className={`p-1.5 rounded transition ${
              editor.isActive("heading", { level: 3 })
                ? "bg-blue-600 text-white font-bold"
                : "text-slate-700 hover:bg-slate-200"
            }`}
            title="H3: Tiêu đề Điều khoản"
          >
            <span className="font-bold px-1">H3 (Điều)</span>
          </button>

          <span className="h-4 w-px bg-slate-300 mx-1" />

          {/* Bold, Italic, Underline */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded transition ${
              editor.isActive("bold") ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
            title="In đậm (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded transition ${
              editor.isActive("italic") ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
            title="In nghiêng (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded transition ${
              editor.isActive("underline") ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
            title="Gạch chân (Ctrl+U)"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-slate-300 mx-1" />

          {/* Text Alignment */}
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={`p-1.5 rounded transition ${
              editor.isActive({ textAlign: "left" }) ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
            title="Canh trái"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={`p-1.5 rounded transition ${
              editor.isActive({ textAlign: "center" }) ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
            title="Canh giữa (Quốc hiệu, Tiêu ngữ, Loại văn bản)"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={`p-1.5 rounded transition ${
              editor.isActive({ textAlign: "right" }) ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
            title="Canh phải (Địa danh, ngày tháng)"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            className={`p-1.5 rounded transition ${
              editor.isActive({ textAlign: "justify" }) ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
            title="Canh đều 2 bên (Nội dung văn bản chuẩn NĐ 30)"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-slate-300 mx-1" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded transition ${
              editor.isActive("bulletList") ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
            title="Danh sách dấu chấm (- / •)"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded transition ${
              editor.isActive("orderedList") ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-200"
            }`}
            title="Danh sách đánh số (1., 2., 3.)"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition"
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition"
            title="Làm lại (Ctrl+Y)"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Vùng soạn thảo chính (Giả lập trang in A4) */}
      <div 
        className="bg-white overflow-y-auto cursor-text selection:bg-blue-100"
        style={{ minHeight }}
        onClick={() => editor.chain().focus().run()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* 4. Thanh trạng thái phía dưới */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>Font: <strong>Times New Roman (13pt - 14pt)</strong></span>
        <span>Khoảng cách dòng: <strong>1.15 - 1.25</strong> · Canh lề chuẩn: <strong>Canh đều (Justify)</strong></span>
      </div>
    </div>
  );
};

export default ND30Editor;
