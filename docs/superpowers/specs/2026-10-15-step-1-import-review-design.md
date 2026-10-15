# Bước 1 Khởi tạo & Mẫu — đặc tả nhập và đối chiếu

## Mục tiêu

Nhân viên nội bộ tải DOCX/TXT hoặc chọn mẫu và **biết chính xác ứng dụng đã nhận gì**, phần nào đã trích xuất, phần nào chỉ suy đoán/chưa kiểm tra, trước khi dùng tài liệu ở các bước sau. Một khối nguồn chỉ có một chủ sở hữu; không mất, nhân đôi hay tự điền nội dung còn thiếu.

## Luồng người dùng

1. Mục `1. Khởi tạo & Soạn thảo` chứa chọn mẫu, upload, parse, đối chiếu và trình soạn thảo. Chọn tệp tối đa 25 MB, chỉ DOCX/TXT. Lỗi tải hoặc tệp rỗng/hỏng giữ nguyên phiên làm việc hiện tại; hai lần tải đồng thời chỉ kết quả mới nhất được áp dụng.
2. Bước 1 trình bày bản kiểm tra theo nguồn: phần đầu, loại và trích yếu, thân, phần cuối/chữ ký/nơi nhận, từng phụ lục, khối khác/chưa phân loại. Mỗi vùng có số khối, vị trí nguồn và nội dung đầy đủ để so mắt với DOCX gốc. Bảng giữ cấu trúc hàng/cột/ô.
3. Mỗi ô đầu/cuối có giá trị, độ tin cậy, nguồn khối và rule áp dụng. Quy tắc dạng chữ có thể kiểm tra ngay thì hiện kết quả; quy tắc cần hình học/phông chữ của Word phải hiện **Chưa đánh giá**, không tính là đạt. Nhãn `Đã trích xuất` chỉ là kết quả parser, không phải chứng nhận thể thức.
4. Chọn chế độ hành chính/Đảng theo chứng cứ quốc hiệu/Đảng hiệu trong tệp. Nếu khác chế độ đang chọn, người dùng thấy chênh lệch và chọn trước khi xác nhận. Profile Công ty tự áp dụng chỉ khi cả cơ quan cấp trên và tên Công ty khớp sau chuẩn hóa khoảng trắng; tài liệu khác giữ tùy chỉnh.
5. Cho sửa giá trị trường trích xuất; mọi sửa đổi hủy xác nhận trước. Với khối chưa phân loại, người dùng phải thấy nguyên văn và có thể gán thủ công vào thân, phần cuối, phụ lục hoặc để cần rà soát; không xóa âm thầm.
6. Upload thành công tự điền ngay nội dung vào trình soạn thảo bên dưới, không cần nút nhập lần hai và không chuyển tab. Bản trước khi tải được giữ trong lịch sử phiên. Xác nhận chỉ ghi việc đã đối chiếu, không chặn soạn thảo và không biến `missing`, `ambiguous`, placeholder hoặc rule chưa đánh giá thành PASS. Trạng thái `needs_review` còn theo tài liệu.
7. Mục `2. Xem trước` là nơi duy nhất dựng trang A4. Mục 1 và Lịch sử không có preview thu nhỏ.

## Chọn rule

- Chế độ hành chính: catalog `src/canonical/nd30/rules.generated.json` tại commit `078dae21f9e23975676179fa189f5c01b605f49a` là nguồn rule đã xác minh. Phần đầu dùng các rule quốc hiệu, tiêu ngữ, cơ quan, số, ngày; phần 5a/5b tách theo công văn; phần thân/chữ ký/phụ lục dùng các role tương ứng. Bộ kiểm tra bước 1 chỉ kết luận trên bằng chứng thật có trong tệp.
- Văn bản Đảng: Hướng dẫn 05-HD/VPTW ngày 27/5/2026 là nguồn chính thức, nhưng chưa có party pack đã xác minh trong repo. Hiện có thể nhận diện regime và hiển thị checklist có nguồn; không tuyên bố PASS tự động cho hình học/format.
- Biên bản Công ty thuộc hành chính; không dùng dấu sao hoặc năm dấu gạch nối của văn bản Đảng. Các quy tắc đường kẻ có trong [bản đối chiếu](../../audits/2026-10-15-header-separator-rules.md).

## Phạm vi hoàn thành bước 1

- Có test tối thiểu cho bảng hai cột không phải header, title/subject không bị nuốt vào thân, bảng ký 3 người, phụ lục nhiều bảng, ô trống, khối chưa phân loại, DOCX/TXT lỗi, và chuyển regime.
- Bằng mắt kiểm tra bản local với tệp mẫu được người dùng chỉ định: thấy đủ hai dòng cơ quan cấp trên, tên Công ty, quốc hiệu, body, bảng ký ba người; không hiển thị dữ liệu nội bộ trong commit/ảnh công khai.
- Chỉ sau khi bước 1 đạt theo cả test và quan sát UI mới đồng bộ AI Studio.
