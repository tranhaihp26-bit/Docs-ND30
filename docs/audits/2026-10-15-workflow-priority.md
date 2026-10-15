# Ưu tiên hoàn thiện workflow Docs-ND30

> Cập nhật 15/10/2026 theo tài liệu kiểm toán người dùng cung cấp. Tài liệu đó là đầu vào để đối chiếu, không phải bằng chứng rằng hai ảnh hoặc tài liệu Word gốc đã được kiểm tra trong phiên này. Bản đầu phục vụ nội bộ Công ty Hoa tiêu Hàng hải miền Bắc.

## Những điểm đã đối chiếu với source tại `939479a`

1. `extractBodyXmlChildren()` trong `src/server/blockExtractor.ts` tìm tiền tố `<w:p`, `<w:tbl`, `<w:sectPr`. Cách tìm này có thể nhận cả `<w:pPr>`/`<w:tblPr>`; cần test từ DOCX thật hoặc OOXML tối giản đi qua `extractBlocksFromDocx()`, rồi sửa bộ đọc thành nhận đúng phần tử con trực tiếp của `w:body`.
2. `server.ts` có nhánh khi AI trả thiếu bảng thì gán `parsed.bodyHtml = req.body.rawHtml`. Với file đã phân vùng, HTML gốc chứa đầu trang/chữ ký/phụ lục, nên nhánh này có thể tái đưa chúng vào body.
3. `handleAiFormat()` trong `src/App.tsx` gửi `rawText`/`uploadedHtml`, không gửi `structuredImport`; proposal mới chỉ dựng các trường chính và `bodyHtml`, bỏ `appendices`/`unclassified`. Đây là đường có thể phá kết quả phân vùng dù parser chạy đúng.
4. Nhập trực tiếp chuyển `structuredImport` vào `DocumentState` và ghi `status: "confirmed"` ngay. Chưa có cổng người dùng duyệt từng vùng/khối ambiguous trước khi áp dụng.
5. `A4DocumentPreview.tsx` đếm `section.docx`; con số đó chưa được chứng minh trùng số trang Word sau dàn trang. `docxExport.ts` xuất tiêu đề/dòng liên kết phụ lục riêng rồi tiếp tục xuất `app.html`; cần test trùng lặp. `unclassified[]` được giữ trong state nhưng chưa thấy đường xuất trực tiếp.

Những biểu hiện trong hai ảnh mà tài liệu người dùng mô tả — đầu văn bản lặp trong Tiptap, báo một trang, viền bảng đầu trang và điểm 89% — **cần tái hiện bằng dữ liệu/ảnh gốc**. Source hiện tại chỉ chứng minh các đường có nguy cơ gây ra chúng, chưa chứng minh mọi tài liệu đều bị lỗi.

## Workflow ưu tiên để triển khai và nghiệm thu

| Bước | Kết quả người dùng phải thấy | Cổng kiểm tra sát chức năng |
|---|---|---|
| 1. Tải DOCX/TXT | Tệp lỗi không làm mất/trộn công việc cũ; tệp hợp lệ nhận đúng tên, loại và nội dung | A hợp lệ → B lỗi; A chậm/B nhanh; lỗi rỗng/quá 25 MB; TXT/DOCX |
| 2. Trích xuất nguồn | Đúng số khối và thứ tự; bảng giữ đủ hàng, cột, ô | DOCX tối giản chứa `w:tblPr`/`w:pPr` và bộ fixture DOCX thực do dự án tự tạo |
| 3. Phân vùng & duyệt | Header, metadata, body, chữ ký, nơi nhận, phụ lục, khối chưa phân loại hiện riêng; người dùng sửa/xác nhận trước khi áp dụng | Không khối nào mất/lặp; `bodyHtml` không chứa lại header/phụ lục; vùng thiếu chứng cứ giữ `needs_review` |
| 4. AI tùy chọn | AI chỉ đề xuất sửa trên dữ liệu đã tách; từ chối/lỗi giữ nguyên tài liệu; phụ lục và khối chưa phân loại không biến mất | Không key/503/429; AI bỏ bảng; chấp nhận/từ chối; đối chiếu số khối và ô |
| 5. Preview & file xuất | DOCX/PDF dùng được, không lặp đầu trang/phụ lục, không cắt bảng; số trang chỉ hiện khi có phép đo đáng tin | Mở DOCX/PDF và so với nguồn trên 1/2/5+ trang, bảng/phụ lục, tiếng Việt |
| 6. Tiếp tục công việc | Bản nháp khôi phục sau refresh/đóng tab; lỗi nhập/AI không làm mất sửa tay | Reload, hai tab, storage đầy/hỏng |

Sau khi từng bước trên có bằng chứng đạt, mới ưu tiên CI đầy đủ, tối ưu bundle, dashboard vận hành và các kiểm tra nền khác. TypeScript/build và test trực tiếp liên quan tới phần đang sửa vẫn là cổng tối thiểu để tránh đưa lỗi mới vào workflow.

Kế hoạch gốc: [2026-10-15-docs-nd30-completion.md](../superpowers/plans/2026-10-15-docs-nd30-completion.md). Thứ tự workflow trong tài liệu này thay thế thứ tự Task 2–6 của kế hoạch gốc; mỗi phần triển khai vẫn phải giữ các ràng buộc dữ liệu và nghiệm thu trong kế hoạch đó.
