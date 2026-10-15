# Bộ tài liệu pilot

Bộ pilot gồm 96 tệp DOCX giả lập: 87 ca chuẩn (3 tình huống cho mỗi loại trong danh mục 29 loại văn bản hành chính) và 9 ca nâng cao cho Công văn, Biên bản và Quyết định. Tên người, số hiệu, thời gian và nội dung đều là dữ liệu kiểm thử; đây không phải biểu mẫu pháp lý đã được thẩm định hoặc hồ sơ nghiệp vụ thật.

## Nạp tài liệu trong ứng dụng

Mở bước **Khởi tạo & Mẫu**, chọn **Tài liệu pilot**, rồi chọn loại văn bản và tình huống:

- **Cơ bản**: thành phần đầu, trích yếu, các mục nội dung, phần kết, ký tên, nơi nhận và phụ lục.
- **Bảng**: thêm bảng theo dõi bên trong nội dung chính.
- **Danh sách**: thêm các ý đánh số và nội dung chi tiết trong từng mục.
- **Nâng cao · nội dung dài**: nhiều mục, bảng, chữ ký, phụ lục và dữ liệu đủ dài để kiểm tra nhiều trang.
- **Sai thể thức**: tiêu đề, quốc hiệu/tiêu ngữ, tên cơ quan, số hiệu, thời gian, căn lề và kiểu chữ có lỗi chủ đích.
- **Sai dữ liệu**: số hiệu, ngày, số lượng người, giờ họp hoặc người ký mâu thuẫn giữa các phần.

Chọn **Nạp vào trình soạn thảo** để đưa DOCX qua đúng luồng đọc tệp và phân vùng hiện dùng. Riêng Biên bản dùng thời gian họp trong phần thân, có bảng ký Thư ký/Chủ tọa hai cột và không có ngày ban hành ở đầu trang.

## Tạo lại và kiểm thử

```powershell
npm run pilot:generate
npm run pilot:generate:adversarial
npm run test:pilot
```

Generator chuẩn đọc danh mục loại văn bản trực tiếp từ `src/utils/documentStructure.ts`; generator nâng cao tạo thêm chín tài liệu có cấu trúc phức tạp, lỗi thể thức và dữ liệu mâu thuẫn. Tất cả dữ liệu đều giả lập. Bài kiểm thử nạp từng DOCX qua `parseLocalFile`, xác nhận cấu trúc nguồn được giữ, đồng thời kiểm tra các giá trị xung đột không bị âm thầm thay đổi. Các ca mâu thuẫn hiện cần người dùng đối chiếu; bộ pilot giúp đánh giá liệu giao diện có làm rõ chúng hay không.

## Kết quả pilot trực tiếp — 15/10/2026

Đã chạy các ca đại diện qua cùng danh mục trên local cô lập `127.0.0.2:3000` và `127.0.0.2:3002`, không dùng dữ liệu người dùng. Bộ test tự động xác nhận đủ 87 DOCX chuẩn và 9 DOCX nâng cao đều parse được; body, bảng, khối ký, phụ lục và các giá trị nguồn mâu thuẫn được giữ. Phiên `3002` dùng để xác minh bản sửa parser mà không khởi động lại máy chủ local người dùng đang mở.

| Ca đã nạp | Kết quả quan sát | Lỗi hoặc giới hạn |
| --- | --- | --- |
| Công văn phức tạp `adv-complex-cong-van.docx` | 9.302 ký tự, 49 khối, 1 phụ lục; xem được phần đầu, body dài, bảng và bảng phụ lục 32 dòng. Xuất PDF báo thành công. | Word Real cần thời gian dựng trang; trong lúc tải, vùng giấy tạm thời còn trống và chưa có chỉ báo tiến độ rõ. |
| Công văn sai thể thức `adv-format-cong-van.docx` | 714 ký tự, 11 khối, 1 phụ lục; giữ được nội dung, có 3 mục cần xem. Sau sửa parser, “Hải Phòng ngày 15-10-2026” được chuẩn hóa vào ô địa danh/ngày và giữ trạng thái cần rà soát. Word Real và Canvas CSS đều hiển thị đầu trang, body, khối ký và phụ lục. | Parser vẫn ghép tên cơ quan cấp trên “CƠ QUAN PILOT HÀNG HẢI” với tên cơ quan ban hành viết thường “trung tâm kiểm thử văn bản” vào một ô. Các trường quốc hiệu/tiêu ngữ cũng được chuẩn hóa theo quy tắc ứng dụng; cần xác nhận giữ dấu hiệu nguồn sai thể thức đủ rõ để người dùng nhận biết trước khi xuất. |
| Công văn sai dữ liệu `adv-data-cong-van.docx` | 812 ký tự, 10 khối, 1 phụ lục; giữ cả `18/CV-PILOT`/`81/CV-PILOT` và `31/02/2026`/`05/03/2026` trong nội dung và bảng. Xem trước Canvas CSS và Word Real đều hiển thị các giá trị. | Có 1 mục cần xem do ngày không hợp lệ; ứng dụng chưa chỉ ra cặp số hiệu và ngày đang mâu thuẫn. Cần người dùng so sánh thân, đầu trang và phụ lục. |

### Chạy lại trên Google AI Studio

Đã xác nhận AI Studio kéo commit `b4dded8e5e0a960d6825eeed6427a9faca2981a1` từ `main`, sau đó tải lại app để nhận bộ pilot 96 tài liệu. Cả chín DOCX nâng cao đều được nạp từ danh mục trong app; số ký tự/khối/phụ lục được app báo như sau:

| Loại văn bản | Ca nâng cao | Ca sai thể thức | Ca sai dữ liệu |
| --- | --- | --- | --- |
| Công văn | 9.302 / 49 / 1 | 714 / 11 / 1 | 812 / 10 / 1 |
| Biên bản | 5.556 / 33 / 1 | 716 / 11 / 1 | 975 / 13 / 1 |
| Quyết định | 4.866 / 38 / 1 | 617 / 10 / 1 | 810 / 10 / 1 |

Mỗi ô là số ký tự / số khối / số phụ lục. Các giá trị nguồn sai được giữ lại sau parse, không tự đổi ngày hoặc số liệu mâu thuẫn. Đã quan sát trực tiếp Preview Canvas CSS cho Công văn sai thể thức, Công văn sai dữ liệu, Biên bản phức tạp và Quyết định sai dữ liệu. Trang Quyết định hiển thị ngày `31/02/2026`, ngày hiệu lực `01/02/2026`, số hiệu và bảng phụ lục đối chiếu như tài liệu nguồn. Ở mức thu phóng 50%, toàn trang A4 vừa khung AI Studio và có thể đọc cấu trúc; ở 80–100%, khung preview hẹp làm tràn ngang/cắt mép trang. Biên bản phức tạp báo khoảng 5 trang và có danh sách người dự, nội dung nhiều mục, chữ ký cùng phụ lục.

| Ca AI Studio | Quan sát | Lỗi hoặc giới hạn |
| --- | --- | --- |
| Biên bản sai thể thức | Parse 716 ký tự, 11 khối, 1 phụ lục; ứng dụng phát hiện bảng ký cũ còn trong body và đưa ra thao tác tách thành các ô người ký. | Ngày họp ở đầu trang bị gán vào tên cơ quan; tên cơ quan cấp trên và đơn vị ban hành bị ghép; số hiệu/tiêu đề sai cấu trúc; “Nơi nhận” đặt nhầm trong nội dung. |
| Biên bản sai dữ liệu | Parse 975 ký tự, 13 khối, 1 phụ lục; giữ được chênh lệch giờ họp 15:00/14:30, số người 8/9 và số hiệu 11/17 trong nội dung/bảng. | Chỉ có một mục cần rà soát; chưa chỉ ra các cặp dữ liệu mâu thuẫn giữa phần thân và bảng. |
| Quyết định sai thể thức | Parse 617 ký tự, 10 khối, 1 phụ lục; giữ phần căn cứ, điều khoản, nơi nhận và phụ lục. | Ô cơ quan cấp trên trống, ô đơn vị ban hành gộp hai tên; số hiệu bị sai khoảng trắng/kiểu chữ; ô chức vụ người ký chứa ghi chú lỗi định dạng. |
| Quyết định sai dữ liệu | Parse 810 ký tự, 10 khối, 1 phụ lục; Preview giữ nguyên ngày không tồn tại, ngày hiệu lực sớm hơn ngày ban hành, khác biệt người ký và số hiệu tham chiếu trong phụ lục. | Một mục cần rà soát không mô tả các mâu thuẫn liên trường; Preview vẫn dựng văn bản với ngày không hợp lệ. |

Trong cả chín ca, biểu mẫu thông báo tài liệu đã được đưa vào vùng soạn thảo và đánh dấu cần rà soát. Báo cáo này chỉ ghi nhận parse/Preview trực quan; không khẳng định ứng dụng đã tự phát hiện hết lỗi dữ liệu trong các ca đối kháng.

### Xuất và in

- Đã sửa luồng PDF cho cả Word Real và Canvas CSS. Word Real trước đây thiếu `#printable-document`; Canvas CSS gặp màu `oklch()` mà html2canvas không đọc được. Sau sửa, hai engine đều hiện thông báo xuất PDF thành công; DOCX cũng xuất và hiện cảnh báo rõ đây là bản nháp cần kiểm tra. Phiên trình duyệt thử nghiệm không trả về được đường dẫn tải PDF, nên mới xác nhận được thông báo thành công trên giao diện, chưa xác minh nội dung tệp PDF đã lưu.
- Trên AI Studio, nút PDF hiện thông báo thành công; Word hiện thông báo đã xuất bản nháp cho các loại đã thử. Tuy nhiên, không thấy tệp mới trong thư mục Downloads sau thao tác nên chưa xác minh được byte/tệp thực tế, số trang PDF, bố cục mở lại trong Word hoặc khả năng tải xuống tới người dùng cuối.
- CSS in có vùng `#printable-document` và quy tắc cho trang DOCX. Nút **In A4** được thử trong Preview AI Studio nhưng không mở hộp thoại in có thể quan sát; vùng trang trở về xám/giữ nguyên khung xem trước. Không xác nhận thao tác in giấy và chưa thể xác minh bản in qua driver máy in.
- Đã kiểm tra trực quan trang xem trước bằng trình duyệt ở cả Word Real và Canvas CSS. Bộ render DOCX ngoài ứng dụng không chạy được vì máy thiếu LibreOffice; vì vậy chưa có đối chiếu độc lập bằng ảnh render từ LibreOffice.

### Kiểm tra mã

Các bài `pilot-document-types`, `minutes-pilot-signature`, `pilot-test-documents`, `pilot-adversarial-documents`, `pdf-color-normalization`, `import-segments` và `import-ai-audit` đều qua; TypeScript không báo lỗi và Vite build thành công. Build vẫn cảnh báo bundle chính lớn hơn 500 kB.
