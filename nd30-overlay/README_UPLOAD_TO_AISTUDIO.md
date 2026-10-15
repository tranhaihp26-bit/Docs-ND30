# Docs-ND30 — Canonical Rule Overlay + Khối đầu Công ty Hoa tiêu

## Phạm vi và nguồn chuẩn

- Dự án nhận sửa: `tranhaihp26-bit/Docs-ND30`, baseline `afac9c7198e2c69f071e2705b2c2f926edddb0e5`.
- **DUY NHẤT** nguồn quy tắc: `quanggiaphthh/chuan-hoa-van-ban-nghi-dinh-30`, commit `078dae21f9e23975676179fa189f5c01b605f49a`.
- Release catalog: `v22-runtime/release/admin-nd30-verified-rc-v20.yaml` — **435 verified canonical rules** (nhiều domain, không chỉ thể thức văn bản). Không dùng `nghi-dinh-30/*.md` legacy để quyết định kết quả máy.
- Phương pháp: REUSE FIRST. Dùng toàn bộ 435 rule ID và constraint từ repo nguồn, **không bịa một bộ 435 rule mới**. Không kiểm tra nguồn pháp lý bên ngoài.
- Chuẩn thị giác hiện hành cho **organization profile**: tệp Word `Tieu ngu chuan.docx` do người dùng cung cấp. Bản `reference/Company_HoaTieu_Fixed_Header_A4.docx` trong gói là bản tham chiếu cũ; không dùng kích thước 75/90 mm của bản đó để ghi đè bố cục hiện hành.

## Cách đưa vào Google AI Studio

ZIP này là **gói cập nhật source (overlay)**, KHÔNG PHẢI bản ZIP đầy đủ repository gốc (môi trường tạo gói không truy cập mạng GitHub trực tiếp để clone).

1. Mở workspace AI Studio có đủ source Docs-ND30 (`server.ts`, `src/App.tsx`, `src/utils/docxExport.ts`, `package.json`).
2. Tải lên ZIP này và giải nén vào một thư mục, ví dụ `nd30-overlay` trong root workspace. **Không giải nén đè toàn bộ source một cách mù quáng**.
3. Trong terminal workspace, chạy:

```bash
python3 nd30-overlay/scripts/apply_overlay.py . --dry-run
python3 nd30-overlay/scripts/apply_overlay.py .
npm run rules:sync
npm run lint
npm run build
npm run test:canonical
npm test
```

4. `rules:sync` chỉ tải từ nguồn đã chỉ định, kiểm tra **Git HEAD đúng commit khóa**, nạp chính xác 435 ID verified, không có trùng/mất ID. Nếu AI Studio không có `git` hoặc không truy cập GitHub, chuẩn bị sẵn checkout repo quy tắc và chạy:

```bash
ND30_RULE_SOURCE_DIR=/absolute/path/chuan-hoa-van-ban-nghi-dinh-30 npm run rules:sync
```

5. Thử chọn 1 mẫu hành chính mới → xác nhận bảng đầu theo tệp Word gốc: cột **5187/5245 twips**, thụt đầu bảng **-874 twips**; tên Công ty và quốc hiệu mỗi bên một dòng; văn bản thân 155 mm với lề trong thêm 5 mm; dưới tên Công ty và tiêu ngữ có đường kẻ OOXML thực; không có viền bảng; 2 trường số/ký hiệu & ngày tháng cho phép nhập.
6. Thử tải lên một DOCX hoàn chỉnh → bảo đảm **không** áp profile đầu trang công ty lên nội dung nhập, không trùng khối đầu. Thử 1/3/10 trang bằng Word hoặc LibreOffice.
7. Ghi log, Word render, so sánh và báo cáo rõ trạng thái.

## Những thay đổi có mã nguồn thực thi

- `src/canonical/nd30/companyHeader.ts`: bảng đầu trang theo số đo của tệp Word gốc, tên Công ty một dòng, không viền, paragraph border dùng OOXML.
- `src/canonical/nd30/canonicalAudit.ts`: đánh giá theo catalog canonical 435 rule. Chưa có dữ liệu/capability => `NOT_EVALUATED`, **không tính PASS**. Đối chiếu thuộc tính section thực tế từ `word/document.xml` nếu có đầu ra DOCX.
- `scripts/sync_verified_nd30.mjs`: lấy toàn bộ verified catalog từ repo nguồn đúng commit; giữ source/provenance và file hợp đồng rule.
- `scripts/apply_overlay.py`: patch an toàn các file gốc, dừng nếu anchor thay đổi. Giữ bản sao tệp gốc trong `.nd30-overlay-backup/` ở máy chạy.
- `tests/nd30-canonical-overlay.test.ts`: xác minh nạp 435 rules, header Word thực và status rõ ràng.
- `reference/*.docx`: bản tham chiếu đã duyệt.

## Giới hạn được công khai

- Repository nguồn dùng **.NET DocumentEngine + SemanticDetector + LegalValidator**, có 435 rule thuộc nhiều lĩnh vực như tổ chức văn thư, ký số, quản lý lưu trữ. App React/Node không thể suy ra tất cả chúng chỉ từ HTML/DOCX. Adapter mới tải toàn bộ danh mục và báo chính xác `NOT_EVALUATED` cho rule thiếu dữ liệu hoặc runtime capability, không tuyên bố 435/435 PASS.
- Những rule có `PROHIBITED` hoặc `SUGGEST_ONLY` không được tự sửa. Quy tắc canonical về tính áp dụng và thời hiệu phải giữ nguyên.
- `auditCanonicalND30` hiện thực đầy đủ kết quả coverage nhưng chỉ kết luận PASS/FAIL tự động với các rule **section OOXML có bằng chứng xác thực**. Những họ rule khác muốn thực thi cần tái sử dụng pipeline .NET canonical của repo nguồn, KHÔNG tự suy đoán để đổi sang PASS.
- Các bài kiểm tra cần chạy **trong workspace AI Studio sau khi tải đầy đủ source thực**. Không báo lint/build PASS trước khi có log thực thi từ workspace đó.
- Bảng đầu theo tệp Word gốc rộng khoảng 184 mm và bắt đầu trước lề trái văn bản khoảng 15,4 mm; vẫn nằm trong khổ giấy A4. Thân văn bản 155 mm là **profile tổ chức**, được thụt vào thêm 5 mm hai bên.
- Không áp phần đầu Công ty cho văn bản Đảng hoặc tài liệu được tải lên như văn bản hoàn chỉnh.

## Trạng thái

**PATCH PREPARED — WORKSPACE BUILD/RENDER NOT VERIFIED.** Gói đã được xây dựng và kiểm tra cú pháp Python; nghiệm thu TypeScript, Word sau tích hợp và việc tải 435 rule cần thực hiện tại workspace AI Studio.
