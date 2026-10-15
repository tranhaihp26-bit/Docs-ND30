# Bộ tài liệu pilot

Bộ pilot gồm 87 tệp DOCX giả lập: 3 tình huống cho mỗi loại trong danh mục 29 loại văn bản hành chính của dự án. Tên người, số hiệu, thời gian và nội dung đều là dữ liệu kiểm thử; đây không phải biểu mẫu pháp lý đã được thẩm định hoặc hồ sơ nghiệp vụ thật.

## Nạp tài liệu trong ứng dụng

Mở bước **Khởi tạo & Mẫu**, chọn **Tài liệu pilot**, rồi chọn loại văn bản và tình huống:

- **Cơ bản**: thành phần đầu, trích yếu, các mục nội dung, phần kết, ký tên, nơi nhận và phụ lục.
- **Bảng**: thêm bảng theo dõi bên trong nội dung chính.
- **Danh sách**: thêm các ý đánh số và nội dung chi tiết trong từng mục.

Chọn **Nạp vào trình soạn thảo** để đưa DOCX qua đúng luồng đọc tệp và phân vùng hiện dùng. Riêng Biên bản dùng thời gian họp trong phần thân, có bảng ký Thư ký/Chủ tọa hai cột và không có ngày ban hành ở đầu trang.

## Tạo lại và kiểm thử

```powershell
npm run pilot:generate
npm run test:pilot
```

Generator đọc danh mục loại văn bản trực tiếp từ `src/utils/documentStructure.ts` và ghi DOCX cùng `public/pilot-tests/manifest.json`. Bài kiểm thử nạp từng tệp qua `parseLocalFile`, xác nhận nhận diện loại văn bản, chế độ Nghị định 30, phần đầu, thân, chữ ký/nơi nhận và phụ lục.
