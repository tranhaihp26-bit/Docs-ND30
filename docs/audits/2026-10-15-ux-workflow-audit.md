# Audit giao diện và luồng làm việc Docs-ND30

**Ngày:** 15/10/2026  
**Phạm vi:** Bản local `4bb714e` trên nhánh `feat/docs-nd30-internal-release`; đối chiếu AI Studio/GitHub `main` đang ở `e58fd6e`.  
**Đích sử dụng:** Nhân viên nội bộ Công ty Hoa tiêu Hàng hải miền Bắc tạo hoặc nhập văn bản, đối chiếu, sửa, xem trước và xuất tệp dùng được.

## Cách kiểm tra và giới hạn

- Quan sát trực tiếp app local ở cửa sổ khoảng 1265 × 744 px; thử chọn mẫu, tải DOCX tổng hợp 7 khối, đối chiếu trường trích xuất, xem editor, Preview, Lịch sử, hộp kiểm tra thể thức, nút PDF và cảnh báo đổi mẫu.
- Đối chiếu hành vi với `src/App.tsx`, `src/components/A4DocumentPreview.tsx`, `src/utils/docxExport.ts`, `src/utils/importReview.ts` và bộ quy tắc nhập. Tệp thử tổng hợp không chứa dữ liệu công ty. Các ca đã thử với tài liệu thực trong lượt trước chỉ được dùng làm ngữ cảnh; chưa nghiệm thu lại DOCX/PDF bằng Word với đủ loại tài liệu trong audit này.
- AI Studio đang dùng commit khác local nên hình trên AI Studio không phải bằng chứng cho bố cục local mới. Chưa đánh giá đầy đủ màn hình hẹp/điện thoại, trình duyệt khác hoặc vận hành khi mất mạng.

## Kết luận

Luồng **tải DOCX → parse tự động → đưa nội dung vào editor trong mục 1** đã hoạt động với tệp thử. Preview đã ở mục riêng. Tuy nhiên bản local vẫn chưa phù hợp để nhân viên dùng tin cậy: nguồn và editor tách xa nhau; trạng thái xác nhận có thể lỗi thời; PDF không phản hồi ở chế độ xem mặc định; DOCX có thể thêm “Nơi nhận” không có trong tệp nhập; nháp không sống qua tải lại trang. Các điểm này cần sửa trước khi làm đẹp sâu hoặc phát hành nội bộ.

## Phát hiện đã xác minh

| Mức | Phát hiện | Bằng chứng / tác động |
| --- | --- | --- |
| P0 | **PDF im lặng ở Preview mặc định.** Bấm `Xuất PDF` khi `Engine Word Real` được chọn không đổi trạng thái hoặc hiện lỗi. | `src/App.tsx:796` thoát khi `previewRef.current` rỗng; `src/components/A4DocumentPreview.tsx:533` chỉ gắn ref đó vào nhánh CSS (`:223`), còn mặc định là DOCX (`:59`). Cần một nguồn kết xuất PDF thật, cùng trạng thái báo lỗi/tiến độ. |
| P0 | **DOCX/Preview có thể tự thêm Nơi nhận cho tệp nhập.** Tệp thử là biên bản, ô Nơi nhận trống nhưng bản xem DOCX hiện `Nơi nhận: - Như trên; ...`. | `src/utils/docxExport.ts:817` dùng fallback khi chữ ký tồn tại. Đây là thay đổi nội dung nguồn; cần giữ trống nếu nguồn không có và không tự điền khi xuất. |
| P0 | **Mất bản nháp sau refresh/đóng tab.** | `doc`, `versions` chỉ lưu trong `useState` tại `src/App.tsx:411, 414`; tìm kiếm không thấy lưu bền. Trang Lịch sử cũng ghi rõ chỉ giữ trong phiên. Một lần đóng nhầm tab có thể mất công việc. |
| P0 | **Xác nhận đối chiếu không còn đúng sau khi sửa trong editor.** | Đã thử tệp tổng hợp ở lượt kiểm tra trước: sửa trích yếu trong editor, ô review nguồn vẫn giữ giá trị cũ và checkbox vẫn chọn. `handleFieldChange` ở `src/App.tsx:463` chỉ cập nhật `doc`; thay đổi ở ô review thì có reset (`:1129–1134`). Cần tách snapshot nguồn khỏi dữ liệu hiện hành, đồng bộ nhãn trạng thái và hủy xác nhận cũ khi tài liệu đổi. |
| P1 | **Mục 1 dài và chia đôi một công việc.** | Trên màn hình 1265 × 744, 10 thẻ mẫu chiếm gần trọn trang đầu; upload ở dưới fold. Sau tải tệp, các trường đối chiếu hiện ở một khối dài; editor tiếp tục ở dưới nữa. Người dùng phải tìm nơi tiếp tục và gặp cùng một trường ở hai chỗ. |
| P1 | **Badge `Thể thức: 78%` dễ gây hiểu nhầm.** | Với tệp thử, modal ghi 7/9 trường cơ bản đạt, đồng thời 0 PASS và 393 NOT_EVALUATED trong catalog. Badge ở header vẫn là `Thể thức: 78%` (`src/App.tsx:930–935`). Nên ghi rõ `Trường dữ liệu: 7/9` và `Quy tắc chưa đánh giá: 393`, không gộp thành mức đạt chuẩn. |
| P1 | **Xuất tệp có thể đi trước đối chiếu.** | Nút Word hiện cố định ở header và cuối editor; `exportToDocx` tải tệp trước rồi mới thông báo là bản nháp (`src/App.tsx:744–790`). Người dùng có thể bỏ qua trạng thái nguồn. Cần hiển thị cảnh báo trước khi tải bản nháp và tên tệp phân biệt nháp. |
| P1 | **Nội dung phụ lục phải sửa bằng HTML thô; xóa một chạm.** | Sau `+ Thêm Phụ lục`, ô hiện `<p>Nội dung phụ lục mới...</p>` và nút `Xóa` không hỏi hoặc có Undo (`src/App.tsx:1552–1668`). Không phù hợp nhân viên văn thư không biết HTML; có nguy cơ mất phụ lục vừa sửa. |
| P1 | **Vùng upload hứa kéo thả nhưng chưa hỗ trợ.** | Nhãn ghi “kéo thả vào đây” (`src/App.tsx:1075`), không có `onDrop`/`onDragOver` trong `src`. Chỉ thao tác chọn tệp có thật. |
| P1 | **Một số quy tắc chỉ báo chưa đánh giá, nhưng giao diện chưa dẫn tới cách kiểm.** | `src/utils/importRules.ts:69–98` còn `NOT_EVALUATED` cho chiều dài đường kẻ, in đậm trích yếu, cỡ chữ và giãn dòng thân. Danh sách quy tắc trong accordion dài, mã rule kỹ thuật xuất hiện ngay ở mức đọc thường. |
| P2 | **Hành động và thuật ngữ trùng/lệch.** | Nút Word ở header, cuối editor và Preview; PDF ở header và Preview. `Lưu thay đổi & Xem trước` thực chất thêm checkpoint phiên chứ không lưu bền. `Engine Word Real`, `Canvas CSS`, `parse`, `high`, `Mã HTML` là thuật ngữ kỹ thuật không cần hiện trong luồng mặc định. |

Điểm đã tốt: upload parse trực tiếp; tệp nhập lỗi được giữ nguyên trạng thái cũ; có cảnh báo trước khi đổi mẫu đang sửa; Preview riêng; thông báo Lịch sử chỉ có hiệu lực trong phiên đã trung thực hơn; chế độ tài liệu Đảng/hành chính được tách; tệp nhập có danh sách khối nguồn để đối chiếu.

## Bố cục đề xuất: một không gian làm việc cho mục 1

Giữ **hai mục chính**: `1. Soạn thảo & đối chiếu` và `2. Xem trước & xuất`. Lịch sử chuyển thành nút/drawer. Tại mục 1, không đặt gallery mẫu thường trực phía trên editor. Bắt đầu bằng thanh nguồn gọn `Chọn mẫu | Tải DOCX/TXT | Dán văn bản`; sau khi có tài liệu, thanh này thu nhỏ thành tên nguồn và nút `Thay nguồn` có cảnh báo. Profile công ty mặc định cho văn bản hành chính nội bộ.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ DocForm 30  [Soạn thảo & đối chiếu] [Xem trước & xuất]  Đã lưu  Lịch sử │
├──────────────────────────────────────────────────────────────────────────┤
│ docs.docx · NĐ 30 · 59 khối · 2 cần kiểm tra         [Thay nguồn]        │
├───────────────────┬──────────────────────────────────────┬───────────────┤
│ Cấu trúc tài liệu │ Trình soạn thảo                      │ Cần xử lý      │
│ • Phần đầu  1    │ [Thông tin đầu văn bản]              │ • Trích yếu    │
│ • Nội dung  0    │ [Nội dung chính / bảng]               │ • Phụ lục 2    │
│ • Phần cuối 0    │ [Chữ ký / nơi nhận]                   │               │
│ • Phụ lục   1    │ [Phụ lục, editor trực quan]           │ Xem khối gốc  │
│ • Khác      0    │                                      │ và sửa tại đây│
├───────────────────┴──────────────────────────────────────┴───────────────┤
│ 2 mục cần đối chiếu · Đã lưu lúc 10:24           [Tiếp tục: Xem trước]  │
└──────────────────────────────────────────────────────────────────────────┘
```

Ở khung hẹp, ba cột chuyển thành một cột: danh mục vùng ở trên, editor ở giữa, `Cần xử lý` là drawer. Bảng đối chiếu nguồn mở theo **vùng và lỗi cần xử lý**, không lặp toàn bộ 11 ô đã đúng. Mỗi lỗi có nguồn, giá trị trích xuất, giá trị đang soạn, nút `Chấp nhận`/`Sửa`/`Giữ nguyên nguồn`, và vị trí khối. Nguồn gốc giữ bất biến; editor là bản làm việc; trạng thái xác nhận gắn với phiên bản cụ thể của nội dung.

## Luồng thao tác mục tiêu

1. **Bắt đầu:** chọn mẫu, tải DOCX/TXT hoặc dán văn bản. Nếu tải tệp, tự parse và cuộn/focus thẳng tới editor cùng bảng `Cần xử lý`; gallery mẫu thu gọn. Không bắt thêm nút “đưa vào editor”.
2. **Đối chiếu:** app tóm tắt số khối, bảng, phụ lục, vùng chưa phân loại; chỉ hiển thị việc chưa xác định và quy tắc chưa kiểm được. Một trường chỉ có một chỗ sửa trong bản làm việc; snapshot nguồn hiển thị cạnh đó. Đổi trường sau khi xác nhận phải làm trạng thái liên quan thành `Cần kiểm tra lại`.
3. **Biên tập:** editor trực quan cho thân, phần cuối và phụ lục; profile công ty cố định ở các ô nhận diện, vẫn cho sửa số, ngày, nội dung. Các công cụ AI và HTML nằm trong `Tùy chọn nâng cao`, không che luồng chính.
4. **Xem trước:** chỉ tại mục 2, dùng đúng DOCX được tạo để đối chiếu trực quan. Có liên kết `Sửa phần đầu/nội dung/phần cuối/phụ lục` quay đúng vùng trong mục 1. Hiển thị `Bản nháp` khi còn placeholder, khối chưa phân loại hoặc đối chiếu chưa xong.
5. **Xuất:** một vùng xuất duy nhất. Word là đường chính. PDF chỉ bật khi kết xuất và kiểm tra trang hoạt động. Nếu còn thiếu, hỏi người dùng xuất **bản nháp** trước khi tải, tên tệp có `DRAFT`; không tuyên bố “đạt chuẩn” chỉ vì xuất thành công.
6. **Lưu và phục hồi:** lưu nháp cục bộ có chỉ báo `Đang lưu/Đã lưu/Lỗi lưu`, phục hồi sau refresh; checkpoint trước đổi nguồn, đổi mẫu và sau nhập. Lịch sử diễn đạt đúng bản nháp và checkpoint, không hứa lưu nếu chưa có.

## Phương án triển khai

| Phương án | Điểm mạnh | Hạn chế |
| --- | --- | --- |
| Vá bố cục một trang dài | Nhanh nhất | Vẫn buộc người dùng cuộn qua nguồn và editor; hai chỗ sửa dễ lệch. |
| **Workspace một màn hình, review theo ngữ cảnh** | Ít bước, trạng thái rõ, phù hợp mục 1 đã gộp; có thể triển khai từng phần | Cần tách `App.tsx` và làm rõ mô hình trạng thái nguồn/bản làm việc. **Khuyến nghị.** |
| Wizard nhiều bước trong mục 1 | Dễ chỉ dẫn người mới | Thêm bước và nút quay lại; trái mục tiêu đơn giản hóa khi văn bản cần sửa qua lại. |

## Thứ tự thực hiện và điều kiện đạt

1. **Khóa lỗi dữ liệu/xuất:** bỏ Nơi nhận tự điền trên nhập; sửa PDF không phản hồi; đồng bộ/hủy xác nhận khi editor đổi; lưu nháp bền. Thử lại bằng tệp có/không có nơi nhận, bảng, nhiều trang, phụ lục; mở DOCX bằng Word và PDF bằng viewer. Không mất hoặc thêm nội dung nguồn.
2. **Làm gọn mục 1:** thanh chọn nguồn gọn, tự focus editor, điều hướng theo vùng, review theo việc cần xử lý; loại hai chỗ nhập cùng trường. Trường thiếu và khối chưa phân loại dễ tìm, sửa xong cập nhật trạng thái ngay.
3. **Phụ lục và cổng xuất:** editor phụ lục trực quan, Undo/xác nhận xóa; preview chỉ ở mục 2; cảnh báo bản nháp trước xuất. Thử với phụ lục có bảng và tài liệu không phụ lục.
4. **Làm rõ kiểm tra:** đổi badge 9 trường; tách `Đã kiểm`, `Cần đối chiếu`, `Chưa có cách tự kiểm`; nguồn quy tắc trong panel chi tiết. Không dùng một phần trăm làm kết luận phù hợp pháp lý.
5. **Nghiệm thu bản local rồi AI Studio:** typecheck/build/test, ca thao tác thật bằng mắt và file xuất, đẩy GitHub `main` khi đạt, AI Studio pull đúng SHA rồi thử lại cùng ca. Hiện tại local `4bb714e` chưa có trên `main` `e58fd6e`.

**Chưa thay mã ứng dụng trong audit này.** Báo cáo là cơ sở triển khai, không phải chứng nhận tệp xuất hay toàn bộ 435 quy tắc đã đạt.
