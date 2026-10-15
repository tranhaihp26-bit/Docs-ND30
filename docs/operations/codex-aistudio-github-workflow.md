# Quy trình phát triển Docs-ND30: Codex, GitHub và AI Studio

## Mục tiêu

Hoàn thiện từng chức năng để nhân viên Công ty Hoa tiêu Hàng hải miền Bắc sử dụng được toàn bộ luồng: tạo mẫu hoặc tải tài liệu → kiểm tra dữ liệu trích xuất → soạn thảo → xem trước → kiểm tra thể thức → xuất Word. Codex trực tiếp sửa mã và chịu trách nhiệm kiểm tra kết quả.

## Một vòng triển khai

1. **Quan sát bản đang chạy trong trình duyệt tích hợp.** Mở preview AI Studio, thực hiện thao tác như người dùng với dữ liệu thử không nhạy cảm, ghi lại đầu vào, kết quả mong đợi và lỗi thực tế. Kiểm tra cả trạng thái giao diện và thông báo lỗi. Không coi báo cáo của Gemini hoặc bộ test là bằng chứng thay cho thao tác này.
2. **Đối chiếu mã local.** Xác nhận nhánh, commit và chênh lệch với `origin/main`. Tìm nguyên nhân trong mã và chọn phần sửa nhỏ theo luồng người dùng. Giữ dữ liệu nguồn, nhất là bảng, phụ lục và khối chưa phân loại.
3. **Sửa và kiểm tra local.** Thêm kiểm tra hồi quy cho lỗi có thể tái hiện; chạy TypeScript, build và các test liên quan. Chạy ứng dụng local, thử lại thao tác và kiểm tra tệp DOCX đầu ra khi chức năng xuất thay đổi. Với lỗi bố cục, chụp Preview sau khi render xong, nhìn và so trực tiếp với tệp Word/ảnh chuẩn; kiểm tra cả chế độ Word Real và file xuất. Không dùng code hoặc test làm bằng chứng duy nhất.
4. **Chốt phiên bản.** Rà diff, loại bỏ tệp tạm và kiểm tra không có bí mật hay dữ liệu nội bộ trong commit. Commit phần đã đạt. Đồng bộ với `origin/main`, xử lý xung đột và kiểm tra lại. Đẩy commit lên `main` GitHub; xác nhận SHA trên remote.
5. **Đồng bộ AI Studio.** Trong phần GitHub của ứng dụng AI Studio, kéo đúng `main` mới nhất từ repository `tranhaihp26-bit/Docs-ND30`. Đối chiếu SHA hoặc nội dung thay đổi sau pull. Nếu AI Studio có sửa đổi chưa đồng bộ, kiểm tra và lưu lại trước khi pull để tránh ghi đè.
6. **Nghiệm thu trên AI Studio.** Tải lại preview, chạy đúng ca đã lỗi và ít nhất một ca bình thường; kiểm tra tương tác, dữ liệu trên giao diện và Word được tải về. Nếu còn lỗi, quay lại bước 2. Chỉ đánh dấu chức năng hoàn tất khi bản AI Studio sau pull đạt.

## Quy tắc điều phối

- Codex trực tiếp triển khai; tạm dừng giao việc cho OpenCode.
- GitHub `main` là nguồn phát hành cho AI Studio. AI Studio pull từ GitHub sau khi mã local được kiểm tra và push thành công.
- Mỗi lần push ghi rõ commit SHA, ca thử local và kết quả kiểm tra lại trên AI Studio.
- Ưu tiên chức năng người dùng cuối. Kiểm tra nền không liên quan trực tiếp đến luồng đang sửa được xếp sau.
- Không dùng tài liệu công ty thật trong ca thử công khai hoặc tải lên khi chưa xác định rõ quyền sử dụng. Dùng dữ liệu tổng hợp cho kiểm thử thông thường.
