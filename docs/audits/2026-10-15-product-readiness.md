# Audit mức sẵn sàng sản phẩm Docs-ND30

> 15/10/2026, commit `939479a8232df01a9450b3658e80b93a6bcab9b9` trên `main`. Phạm vi phát hành đầu tiên do chủ dự án chốt: **nội bộ Công ty Hoa tiêu Hàng hải miền Bắc**. Đây là audit source, bộ kiểm tra sẵn có và Preview AI Studio; chưa phải nghiệm thu pháp lý hoặc thực địa.

## Mục tiêu và kết luận

Người dùng nội bộ phải tự tạo/nhập văn bản, sửa, xem các kiểm tra có bằng chứng, xem trước, xuất DOCX/PDF sử dụng được và tiếp tục bản nháp sau khi rời phiên. Nội dung gốc phải được bảo toàn; chỗ không chắc chắn phải được chỉ rõ và yêu cầu người dùng duyệt. Chất lượng trình bày phải được đối chiếu trong Word/LibreOffice bằng tài liệu thật, không chỉ dựa vào Preview hoặc test OOXML.

**Kết luận tại commit này: chưa đủ điều kiện gọi là sản phẩm hoàn thiện, ổn định.** App đã có giao diện và đường xử lý chính; các cổng về độ bền bản nháp, bảo toàn dữ liệu khi nhập lỗi, tài liệu thật, file xuất thực tế và vận hành phát hành chưa có bằng chứng đạt.

## Phương pháp và bằng chứng nền

- `git fetch origin` và `git ls-remote`: remote `main` vẫn ở commit trên; bản clone sạch trước khi viết tài liệu audit/kế hoạch.
- Preview AI Studio hiện mở được: thấy 10 mẫu, tải `.docx/.txt`, dán văn bản, các tab Soạn thảo/Xem trước/Lịch sử, nút Word/PDF và chỉ số “Thể thức: 56%”. Không thực hiện ca người dùng từ đầu đến cuối trong đợt này.
- Chạy trực tiếp sau khi cài dependencies vào `node_modules` (bị Git bỏ qua): `tsc --noEmit` đạt; `test/nd30-compliance.test.ts` 29/29 đạt; `test/nd30-canonical-overlay.test.ts` đạt và báo `PASS=5`, `NOT_EVALUATED=387` trên catalog 435; `test/import-segments.test.ts` thoát mã 0, log liệt kê 11 ca `SEP` đạt trên fixture tổng hợp. Build Vite đạt, nhưng cảnh báo bundle JS chính khoảng 2,367 kB trước gzip.
- Lệnh cài qua shim `pnpm` của môi trường báo `ERR_PNPM_IGNORED_BUILDS`; vì vậy các test/build trên được chạy trực tiếp bằng `node` với module đã cài, **không chứng minh quy trình cài đặt từ checkout sạch đã tái tạo được**. `pnpm-lock.yaml` và `pnpm-workspace.yaml` phát sinh khi thử đã được xóa; `node_modules`/`dist` không được track.
- Chưa có tệp DOCX thật được phép dùng để đối chiếu, vòng thử với người dùng nội bộ, kết quả mở file bằng Word/LibreOffice, hay đo vận hành của bản phát hành.

## Phát hiện theo ưu tiên

| Mức | Phát hiện và bằng chứng | Ảnh hưởng đến người dùng | Điều kiện đóng |
|---|---|---|---|
| P0 | **Không có lưu nháp bền vững.** `doc` và `versions` chỉ nằm trong `useState` tại [`src/App.tsx`](../../src/App.tsx), dòng 391–403; không tìm thấy `localStorage`, `IndexedDB` hay API lưu. UI tại dòng 1563 lại nói mọi thao tác “được lưu lại an toàn trên máy khách”. | Refresh/đóng tab có nguy cơ mất bản đang soạn và lịch sử; lời hứa trên UI chưa có cơ sở. Đây là suy luận từ source, cần kiểm thử reload thực tế. | Lưu tự động, phục hồi, xuất bản sao; test reload, đóng/mở tab, storage đầy/hỏng và bản nháp cũ. Sửa lời hứa UI khớp hành vi. |
| P0 | **Trạng thái file nhập có thể bị trộn.** [`handleFileUpload`](../../src/App.tsx) dòng 449–489 đặt tên file mới trước khi parse; khi parse lỗi không xóa/khôi phục `rawText`, `uploadedHtml`, `structuredImport`. | Người dùng có thể thấy tên file B nhưng đưa nội dung file A vào editor. | Test chuỗi A hợp lệ → B lỗi/empty → thử nhập; không được gắn nội dung A với tên B. Chỉ thay bộ trạng thái nhập một cách nguyên tử khi B parse thành công, hoặc giữ A với tên A và thông báo rõ. |
| P0 | **Chưa kiểm chứng tính toàn vẹn trên tài liệu thật.** [`test/import-segments.test.ts`](../../test/import-segments.test.ts) tạo fixture 53 khối; báo cáo AI Studio cũng ghi “Real Document E2E: NOT TESTED”. | Parser có thể bỏ/lặp/đảo đoạn, bảng/phụ lục hoặc nhận nhầm trường trong DOCX thực. | Bộ tài liệu được phép kiểm thử, có manifest nội dung/bảng/trường; so đầu vào → phân vùng → editor → DOCX/PDF; mọi sai khác phải được xử lý hoặc giới hạn hỗ trợ công khai. |
| P0 | **Xuất PDF bằng ảnh chụp một canvas rồi cắt theo chiều cao.** [`src/App.tsx`](../../src/App.tsx) dòng 759–798 dùng `html2canvas`, đưa cùng ảnh lên nhiều trang với vị trí âm. | Có nguy cơ cắt giữa dòng/bảng, sai bố cục so với Word; PDF dạng ảnh khó tìm kiếm/chọn chữ. Chưa xác nhận lỗi trên file thực, nhưng cơ chế này cần nghiệm thu đặc biệt. | Test tài liệu 1/2/5+ trang, bảng dài, phụ lục và dấu tiếng Việt; so từng trang với DOCX/Preview. Nếu không đạt, dùng đường kết xuất phân trang đúng thay cho chụp một canvas. |
| P0 | **Chỉ số thể thức có thể bị hiểu quá mức.** `score` là tỷ lệ 9 trường tại [`document.schema.ts`](../../src/shared/schemas/document.schema.ts) dòng 471; catalog 435 mục có 387 `NOT_EVALUATED` ở lần test. Modal giải thích giới hạn, nhưng badge nổi bật vẫn ghi “Thể thức: 56%”. | Người dùng dễ coi phần trăm là chứng nhận đúng NĐ 30/HD 05 cho cả file. | Đổi nhãn badge thành “9 trường dữ liệu: x/9”, tách kiểm tra OOXML và mục chưa đánh giá; không dùng một tỷ lệ tổng để khẳng định đạt chuẩn. |
| P1 | **Loại nguồn bị ghi sai khi nhập TXT.** [`src/App.tsx`](../../src/App.tsx) dòng 528 cố định `importMetadata.sourceType: "docx"`, trong khi API trả `fileType: "txt" | "docx"` tại [`server.ts`](../../server.ts) dòng 146–204. | Lịch sử nguồn và truy vết sai. | Test DOCX/TXT; metadata phản ánh đúng loại thực và tên file tương ứng. |
| P1 | **Lịch sử phiên bản không bao phủ mọi sửa tay.** `handleFieldChange` ở [`src/App.tsx`](../../src/App.tsx) dòng 418–423 chỉ gọi `setDoc`; `pushVersion` được gọi khi chọn mẫu/nhập và một số thao tác khác. | Tab “Lịch sử” không phải bản sao đầy đủ của từng trạng thái đã sửa. | Định nghĩa rõ phiên bản là checkpoint hay mọi lần sửa; thêm checkpoint tự động có giới hạn, hoặc đổi tên/thông điệp cho đúng. Test khôi phục sau sửa tay. |
| P1 | **Thiếu cổng CI và cách cài tái tạo.** Không có `.github/workflows`; repo dùng `bun.lock` nhưng `package.json` không nêu package manager; môi trường kiểm tra bằng pnpm shim bị chặn lifecycle scripts. | Một commit mới có thể phá build/test mà không có cảnh báo trên PR; checkout sạch chưa có quy trình nhất quán. | Chốt Bun/Node version, lockfile, lệnh cài từ checkout sạch; CI chạy typecheck, ba bộ test và build trên PR/main; lưu kết quả theo SHA. |
| P1 | **AI và lỗi mạng cần thử bằng hành vi người dùng.** Backend có fallback và test 503; UI hiển thị đề xuất cần phê duyệt. Chưa thử đường không API key, timeout, 429, dữ liệu nhạy cảm thật và từ chối đề xuất trong Preview lần này. | Có nguy cơ người dùng tưởng AI là bắt buộc hoặc chấp nhận nội dung sai. | E2E không key/503/429/timeout; nội dung gốc không bị thay khi từ chối/lỗi; thông báo khi dữ liệu chuẩn bị gửi tới AI. |
| P2 | **Bundle chính lớn.** Vite cảnh báo JS khoảng 2,367 kB trước gzip. | Có thể tăng thời gian tải trên máy/mạng yếu; chưa đo tác động thực. | Đo trên máy/mạng mục tiêu; tách tải thư viện xuất/preview theo nhu cầu nếu đo cho thấy chậm. |

## Cổng nghiệm thu bản nội bộ

1. Nhân viên mục tiêu hoàn thành độc lập ba đường: chọn mẫu, nhập DOCX/TXT, dán văn bản; sửa, xem kiểm tra, xem trước, xuất và mở tệp.
2. Mỗi tài liệu trong bộ thử có đối chiếu nội dung nguồn, thứ tự, bảng, phụ lục, người ký và trường thiếu. Không mất/lặp/tự điền thông tin không có nguồn.
3. Bản nháp/phiên bản phục hồi sau refresh và đóng/mở trình duyệt; lỗi upload hoặc AI không làm hỏng công việc đang có.
4. DOCX mở được trong Word/LibreOffice; PDF mở được và không cắt nội dung. Những sai khác so với Preview được liệt kê và quyết định chấp nhận hay sửa.
5. Màn hình kiểm tra phân biệt 9 trường dữ liệu, bằng chứng OOXML và quy tắc chưa đánh giá. Không tuyên bố toàn bộ 435 quy tắc đã đạt.
6. CI đạt trên commit phát hành; cài/build/test được từ checkout sạch bằng hướng dẫn trong README.
7. Có ít nhất một vòng thử với người dùng nội bộ và tài liệu được phép dùng; không còn lỗi P0/P1 chặn công việc chính. Phát hành gắn với một commit/tag cụ thể và có đường quay lại.

Kế hoạch thực hiện chi tiết: [2026-10-15-docs-nd30-completion.md](../superpowers/plans/2026-10-15-docs-nd30-completion.md).
