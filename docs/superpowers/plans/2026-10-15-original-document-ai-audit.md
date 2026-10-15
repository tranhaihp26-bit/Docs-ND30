# Kế hoạch triển khai đối chiếu file gốc bằng AI

> **Cách làm:** Thực hiện tuần tự trong workspace local; kiểm tra code và giao diện nhìn thấy ở mọi thay đổi ảnh hưởng tới nhập liệu, Preview hoặc xuất file. Đợt triển khai đầu đã có trong branch hiện tại. Bảng trạng thái dưới đây phân biệt phần đã chạy được với phạm vi còn lại trong kế hoạch.

**Mục tiêu:** Sau khi tải tài liệu và parse, tự đối chiếu file gốc với kết quả parse, rà soát theo rule pack đúng loại văn bản, phát hiện vấn đề nội dung/cấu trúc/trình bày và đưa bằng chứng để người dùng quyết định sửa.

**Spec:** `docs/superpowers/specs/2026-10-15-original-document-ai-audit-design.md`.

## Ràng buộc chung

- Mặc định parser và đối chiếu xác định chạy cục bộ; chỉ gửi file/nội dung lên Gemini khi người dùng đã bật và chấp thuận rõ ràng.
- Không ghi văn bản tài liệu, prompt chứa dữ liệu tài liệu, bytes/base64 hoặc API key vào log, localStorage, lịch sử hay telemetry.
- Chỉ chọn rule có nguồn, phạm vi áp dụng, phiên bản và trạng thái đã xác minh. Gợi ý outline không phải quy định pháp lý.
- Không tự sửa nội dung. Phát hiện không đủ bằng chứng là `NEEDS_REVIEW` hoặc `NOT_EVALUATED`, không biến thành PASS.
- Tài liệu pilot chỉ dùng dữ liệu tổng hợp; không đưa tài liệu nhân sự/công ty thật vào commit công khai.
- Không chuyển sang workflow tiếp theo của sản phẩm trong khi bước 1 upload/parse/đối chiếu chưa nghiệm thu.

## Trạng thái triển khai — 15/10/2026

| Giai đoạn | Đã triển khai và kiểm chứng | Còn lại |
|---|---|---|
| 0. Render nguồn | Đã rà soát runtime và tài liệu Gemini; local có Word, Cloud Run chưa có công cụ chuyển đổi DOCX→PDF được kiểm chứng. UI và báo cáo nói rõ giới hạn hình thức. | Fixture Word phức tạp chưa được so sánh render; chưa có visual audit nguồn. |
| 1. Nguồn và đối chiếu | Giữ `File` trong bộ nhớ tab; backend nhận DOCX/TXT tạm thời, trích văn bản độc lập, tính SHA-256; đối chiếu chuỗi từ có thứ tự. 9 DOCX adversarial pilot khớp 9/9. | Chưa có ánh xạ nguồn đến từng paragraph/cell/page; dò OOXML chỉ bao phủ một số thành phần. |
| 2. Rule pack | Resolver đính kèm rule định dạng/cấu trúc ND30 có nguồn và phiên bản; biên bản bỏ rule ngày ban hành chung. | Pack hẹp; chưa có pack Đảng đã xác minh, profile nội bộ hay lựa chọn theo ngày ban hành. |
| 3. AI | Multipart có giới hạn 25 MB, kiểm tra loại file, trích văn bản ở backend; Gemini nhận văn bản + dữ liệu parse, xác minh quote/rule/locator; buffer và text bị xóa sau xử lý. | Chưa gửi binary/PDF lên Gemini, chưa có render, hủy/timeout, hoặc xác minh live Gemini do thiếu `GEMINI_API_KEY`. |
| 4. Giao diện | Nút chạy thủ công, tự rà soát mặc định tắt và opt-in theo phiên, hộp thoại nêu dữ liệu sẽ gửi; báo cáo chỉ nhận xét, không tự sửa. Đã xem trực tiếp giao diện local và hộp thoại riêng tư. | Chưa xem giao diện báo cáo sau một lượt Gemini thành công; chưa kiểm tra trên AI Studio. |
| 5. Pilot | Các test import/AI/ND30/pilot, typecheck và build đều đạt. | Chưa chạy AI thật, kiểm tra xuất/render có nguồn đối chiếu, hoặc retest sau khi AI Studio pull. |

Các checkbox trong các giai đoạn tiếp theo mô tả điều kiện nghiệm thu đầy đủ; chúng vẫn là backlog nếu chưa được nêu trong bảng “Đã triển khai và kiểm chứng”.

## Trọng tâm review

- DOCX có header/footer, bảng, ảnh, text box, tab, ngắt trang, footnote và các thuộc tính chưa hỗ trợ phải được phát hiện hoặc báo phần chưa đánh giá.
- Tất cả khối nguồn ánh xạ được sang đúng một đích parse, hoặc được giữ trong danh sách chưa phân loại; không mất, nhân đôi hay đổi thứ tự âm thầm.
- Chọn đúng rule pack theo chế độ và loại văn bản; không áp rule Đảng cho hành chính và không trình bày gợi ý soạn thảo như luật.
- AI xem được nguồn độc lập và bản parse; body nhiều bảng/đoạn có báo cáo đủ vị trí, trích đoạn và trang.
- Bản thảo mới làm vô hiệu kết quả audit cũ.
- Người dùng nhìn thấy tiến độ, quyền riêng tư, lỗi, hủy và trạng thái dọn file; không bị kẹt khi dịch vụ AI lỗi.

---

### Giai đoạn 0: Xác minh đường render tài liệu nguồn

**Phạm vi kiểm tra:** đường chạy local và AI Studio/Cloud Run; `src/server/*`, `package.json`, cấu hình container/build/deploy hiện có.

- [ ] Tạo fixture DOCX tổng hợp có tiếng Việt, bảng nhiều trang, header/footer, ảnh, canh lề, paragraph spacing, tab, page break và ký hiệu đặc biệt.
- [ ] Thử các đường DOCX→PDF có thể triển khai trong runtime hiện tại; đo độ trung thực với render Word và chi phí tài nguyên/kích thước.
- [ ] Xác minh model/fallback được cấu hình hiện tại nhận PDF/image theo API đang dùng; không giả định mọi model fallback đều có cùng năng lực.
- [ ] Chốt một phương án có thể chạy trong production hoặc ghi rõ điều kiện đầu vào PDF đi kèm/nhãn `NOT_EVALUATED` cho rà soát hình học.
- [ ] Lập bảng lỗi chuyển đổi và giới hạn định dạng/kích thước trước khi chọn kiến trúc.

**Cổng qua giai đoạn:** PDF render đọc được và đối chiếu được với Word cho fixture hoặc UI nêu rõ không thực hiện visual audit. Không được tuyên bố kiểm tra đầy đủ bố cục trước cổng này.

### Giai đoạn 1: Manifest nguồn và khả năng truy nguyên

**Files dự kiến:** `src/utils/localFileImport.ts`, `src/server/blockExtractor.ts`, schema import trong `src/shared/schemas/`, `src/App.tsx`, tests import hiện có.

- [ ] Mở rộng mô hình nguồn với stable block ID, thứ tự, path OOXML, loại đối tượng, table row/cell, paragraph/run formatting đã trích và cảnh báo thành phần không hỗ trợ.
- [ ] Giữ `File`/bytes chỉ trong bộ nhớ phiên đến khi parse và rà soát kết thúc; tạo `sourceHash` và `parseRevision`, không tuần tự hóa bytes vào localStorage hoặc session history.
- [ ] Kiểm tra và ghi trạng thái cho header/footer, ảnh, text box, footnote/endnote, comment, field code, section/page break và thuộc tính layout; không hỗ trợ thì đánh dấu cụ thể.
- [ ] Thêm đối chiếu xác định source→parse: khối mất/thừa/trùng, thứ tự, text, bảng và ô; mọi nguồn phải có owner duy nhất hoặc đứng trong vùng chưa phân loại.
- [ ] Thêm test tổng hợp cho DOCX hợp lệ/lỗi, nội dung lặp, bảng nhiều ô, khối không phân loại, upload liên tiếp và upload đồng thời.

**Kiểm tra:** targeted import tests, schema validation, TypeScript/build; mở giao diện local với DOCX fixture và đối chiếu nội dung hiển thị bằng mắt.

### Giai đoạn 2: Bộ chọn rule pack theo loại văn bản

**Files dự kiến:** `src/canonical/nd30/`, `src/utils/documentStructure.ts`, `src/server/importAiAudit.ts`, module resolver mới và test.

- [ ] Xây resolver đầu vào gồm regime, document type, issuer/profile và ngày áp dụng; đầu ra là rule IDs có nguồn, trạng thái, version/hash và lý do chọn.
- [ ] Trích rule tối thiểu theo từng vùng (phần đầu, body, cuối, phụ lục), bắt đầu với loại pilot được sử dụng nhiều; rule chưa xác minh phải nằm ngoài pack hoặc mang trạng thái chưa đánh giá.
- [ ] Tách luật bắt buộc, cấu hình profile công ty, quy ước nội bộ và gợi ý. Dùng outline 29 loại làm tham khảo cấu trúc, không coi là chuẩn bắt buộc nếu chưa có nguồn.
- [ ] Gắn cùng rule pack/version vào mọi chunk và lượt tổng hợp cuối; không chỉ dựa vào kiến thức nền của mô hình.
- [ ] Test regime/type routing, rule hết hiệu lực/xung đột, thiếu nguồn, không có pack và không phát PASS khi thiếu chứng cứ.

**Kiểm tra:** rule resolver tests + canonical audit tests; review nguồn pháp lý với catalog trước khi cho pack xuất hiện trong giao diện.

### Giai đoạn 3: Dịch vụ đối chiếu đa phương thức

**Files dự kiến:** `src/server/importAiAudit.ts`, route `/api/ai/review-import` trong `server.ts`, schema request/response, client Gemini hiện tại.

- [ ] Mở rộng request thành multipart cho file nguồn tạm thời, manifest parse và metadata audit; xác thực MIME/magic bytes, kích thước, timeout, rate limit và quyền gọi.
- [ ] Gọi kiểm tra riêng theo vùng (đặc biệt body) với bằng chứng nguồn cùng parse; chia chunk có overlap/anchor ổn định và lượt cuối soát mâu thuẫn giữa phần đầu, body, chữ ký, ngày/số, nơi nhận và phụ lục.
- [ ] Với PDF nguồn, gửi tài liệu dạng PDF/vision; với DOCX, dùng kết quả render đã qua Cổng 0 hoặc không kết luận về hình thức. Không gửi riêng HTML preview làm bằng chứng bố cục Word.
- [ ] Bắt buộc output JSON schema có `findingId`, `issueType`, `severity`, `confidence`, `sourceBlockId`, `sourceQuote`, `parsedTarget`, `page/row/cell`, `ruleIds`, `evidence`, `recommendation`, `status`.
- [ ] Kiểm tra mọi locator/quote/rule ID thuộc manifest hoặc rule pack được gửi; loại bỏ nhận xét không có bằng chứng và coi nội dung file là dữ liệu không tin cậy.
- [ ] Hủy request được, dọn buffer server, xóa file Gemini ngay sau khi xử lý nếu hỗ trợ, ghi nhận lỗi dọn file nhưng không log nội dung. Gắn kết quả với hash/revision/rule/model.
- [ ] Khi API lỗi hoặc mô hình trả thiếu vùng, trả báo cáo `partial` và vùng `NOT_EVALUATED`; không chặn soạn thảo.

**Kiểm tra:** unit tests với Gemini mock cho timeout, JSON lỗi, thiếu locator, quote sai, upload lỗi, cancel, xóa file lỗi, chunk dài và partial. Không dùng câu chữ cụ thể của model làm snapshot ổn định.

### Giai đoạn 4: Tự động hóa có opt-in và giao diện kết quả

**Files dự kiến:** `src/App.tsx`, component mới `src/components/ImportAiAuditPanel.tsx`, API client và styles liên quan.

- [ ] Tạo cài đặt bật/tắt “Tự động rà soát file nguồn bằng AI sau khi parse”; lần bật đầu hiển thị rõ dữ liệu gửi đến Gemini và xác nhận của người dùng. Duy trì nút chạy thủ công.
- [ ] Sau parse, chạy đối chiếu cục bộ ngay; khi opt-in và có GEMINI_API_KEY, chạy AI tự động. Thể hiện trạng thái đang chuẩn bị nguồn, đang gửi, đang rà soát, hoàn tất một phần, hủy và lỗi.
- [ ] Hiển thị phát hiện theo khu vực với nguồn ↔ đích parse, trích đoạn, bảng/ô/trang, rule ID/nguồn, mức tin cậy, lý do và đề xuất. Có lọc theo lỗi parse, chính tả, body, thể thức, mâu thuẫn và phần chưa đánh giá.
- [ ] Cho mở đến khối/ô editor; không tự áp dụng đề xuất. Khi sửa/tải file mới/đổi rule profile, đánh dấu báo cáo cũ stale.
- [ ] Hiển thị rõ nhánh kiểm tra nào không chạy được; không dùng huy hiệu phần trăm tuân thủ như chứng nhận pháp lý nếu chưa có evidence.
- [ ] Kiểm tra responsive, nội dung dài/bảng, keyboard, loading/error/cancel, và đối chiếu bằng mắt với DOCX/PDF fixture.

**Kiểm tra:** component/API tests; thao tác upload thật trong trình duyệt local; xem trực quan trạng thái hoàn tất và lỗi API. Không chuyển sang bước 2 để né lỗi ở bước 1.

### Giai đoạn 5: Pilot đối kháng và nghiệm thu vận hành

**Files dự kiến:** `test/`, `docs/testing/pilot-documents.md`, checklist thao tác local/AI Studio.

- [ ] Mở rộng pilot tổng hợp cho từng loại văn bản được hỗ trợ: bản sạch, lỗi thể thức, dữ liệu mâu thuẫn/sai, body phức tạp nhiều bảng/ngắt trang, phụ lục, header/footer, file hỏng/không hỗ trợ.
- [ ] Định nghĩa expected findings bằng ID nguồn/rule/đích và nhóm lỗi; đo bỏ sót, cảnh báo sai, vị trí sai, partial/timeout. Không dùng AI tự đánh giá AI làm chuẩn duy nhất.
- [ ] Kiểm tra quyền riêng tư bằng network/log inspection: không gửi khi chưa opt-in; sau opt-in chỉ gửi request dự kiến; không để nội dung rò vào log; quan sát trạng thái xóa file.
- [ ] So sánh PDF nguồn và bản xuất đầu ra ở mức người dùng nhìn thấy: xuống dòng, bảng, nội dung trang, clipping, trang trắng, font tiếng Việt. Kiểm tra DOCX/PDF bằng Word hoặc renderer tương đương và bằng mắt.
- [ ] Chạy test, typecheck, build, pilot local; sửa hết lỗi blocker/high trước khi push. Chụp lại bằng chứng tổng hợp không chứa dữ liệu thật.
- [ ] Sau khi được đồng bộ GitHub/AI Studio theo workflow dự án, kéo commit và lặp lại pilot đại diện trên AI Studio; ghi nhận khác biệt runtime/deploy/model.

**Cổng phát hành:** không còn khối mất âm thầm; findings truy nguyên được; lỗi parser/AI và giới hạn PDF được biểu thị đúng; privacy opt-in hoạt động; UI và file xuất được kiểm tra trực tiếp ở local và AI Studio.

## Rủi ro cần giữ trong backlog

- Render DOCX khác nhau giữa Microsoft Word, LibreOffice, trình duyệt và Cloud Run; quyết định visual audit phụ thuộc kết quả Cổng 0.
- Header/footer, text box, SmartArt, ảnh scan, field code và bố cục phức tạp có thể cần parser/OCR riêng; giai đoạn đầu phải đánh dấu không hỗ trợ.
- AI có thể bỏ sót hoặc phát cảnh báo sai; kết quả là hỗ trợ rà soát, không phải chứng nhận tuân thủ hay bảo đảm tuyệt đối.
- File có dữ liệu cá nhân/nội bộ; cần opt-in minh bạch, giới hạn retention và không để lộ nội dung trong log.
- Rule pháp luật thay đổi; mỗi rule pack cần nguồn/version, ngày áp dụng và quy trình cập nhật có review.
