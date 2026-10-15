# Đối chiếu file gốc bằng AI sau khi parse — thiết kế

## Mục tiêu

Sau khi tải tài liệu và parse, hệ thống tự chạy một lượt rà soát có kiểm soát để so sánh nội dung/khối trong file gốc với kết quả parse, kiểm tra cách trình bày và cấu trúc theo đúng loại văn bản, rồi hiển thị vấn đề để người dùng tự quyết định sửa. AI không tự thay đổi bản thảo và không được tuyên bố “đảm bảo không sai lệch” chỉ dựa trên một lần quét.

## Kết luận audit hiện trạng

| Hạng mục | Hiện trạng | Hệ quả |
|---|---|---|
| Giữ file nguồn | `loadFileIntoEditor` nhận `File` khi tải nhưng chỉ lưu kết quả trích xuất, snapshot và metadata; bytes DOCX không được giữ trong trạng thái để gửi vào lượt audit sau parse. | AI audit hiện tại không đọc trực tiếp file gốc. |
| Trích xuất DOCX | `src/server/blockExtractor.ts` đọc `word/document.xml`; giữ văn bản, một phần định dạng đoạn và cấu trúc bảng. Header/footer, ảnh, text box, footnote/endnote, comment, tab stop, khoảng cách, ngắt trang và nhiều thuộc tính OOXML khác chưa được biểu diễn đầy đủ. | Có thể bỏ sót nội dung hoặc ngữ cảnh trình bày trước khi AI nhìn thấy dữ liệu. |
| AI audit hiện có | `src/server/importAiAudit.ts` nhận các vùng đã parse và bản thảo hiện tại, chia đoạn, gọi mô hình tuần tự. UI xác nhận trước khi gửi dữ liệu. Không có bytes DOCX/PDF; các vùng được kiểm tra riêng và chưa có lượt kết luận nhất quán toàn tài liệu. | Có thể nêu lỗi nội dung trong phần đã parse nhưng không kiểm chứng độc lập rằng parser đã nhận đủ file gốc; mâu thuẫn giữa các vùng có thể bị bỏ qua. |
| Rule theo loại văn bản | Catalog ND30 có 435 rule đã xác minh. Chưa có resolver chọn rule áp dụng theo loại văn bản và đưa rule pack tương ứng vào từng yêu cầu AI. `documentStructure.ts` có outline cho 29 loại, được ghi rõ là gợi ý soạn thảo. | Mô hình có thể áp rule chung không phù hợp hoặc biến gợi ý thành yêu cầu bắt buộc. |
| Kiểm chứng trực quan | Preview của sản phẩm dựng bản thảo đầu ra; chưa phải bản render độc lập của tài liệu nguồn. Audit hiện cũng đã ghi rõ hạn chế này. | Không thể kết luận về xuống dòng, tràn trang, bảng, ảnh hoặc vị trí khối chỉ từ chuỗi văn bản/HTML. |
| Báo cáo và vị trí lỗi | Kết quả hiện có category, mức độ, field/block và nhận xét/đề xuất; thiếu trích dẫn rule/version, trích đoạn file nguồn, trang/hàng/cột và liên kết bằng chứng nguồn ↔ kết quả parse. | Người dùng khó kiểm tra từng nhận xét và quyết định có sửa hay không. |

## Trạng thái triển khai đợt đầu — 15/10/2026

- Sau khi người dùng chấp thuận, trình duyệt gửi file DOCX/TXT lên backend ứng dụng bằng multipart; backend đọc tệp trong bộ nhớ, trích văn bản độc lập bằng Mammoth/UTF-8, tính SHA-256 rồi xóa buffer. File nhị phân không được gửi đến Gemini và không lưu trong localStorage.
- Gemini nhận văn bản trích xuất cùng các trường/khối/bảng/body/chữ ký/phụ lục đã parse và bản đang soạn. Có nút rà soát thủ công; tùy chọn tự rà soát mặc định tắt và chỉ tồn tại trong phiên. Mọi kết quả chỉ là nhận xét, không tự sửa.
- Đối chiếu xác định hiện so chuỗi token có thứ tự từ nguồn độc lập với chuỗi khối parse. Nó phát hiện khác số lượng/giá trị/vị trí từ đầu tiên nhưng chưa ánh xạ từng token đến paragraph, hàng/cột hoặc vị trí trang. `matched` chỉ có nghĩa là chuỗi từ khớp, không bảo đảm parser giữ nguyên bố cục hay toàn bộ cấu trúc.
- Có cảnh báo một số thành phần OOXML (header/footer có nội dung, footnote/endnote, comment, text box, ảnh, page/section break, field code, tracked changes). Dò tìm này không bao phủ mọi phần mở rộng Word.
- Rule pack hiện chỉ gồm danh sách hẹp các rule định dạng/cấu trúc Nghị định 30 đã xác minh trong catalog. Biên bản không nhận rule ngày ban hành chung; chế độ văn bản Đảng hiện không có pack đã xác minh. Chưa có profile nội bộ hoặc điều kiện áp dụng theo ngày đầy đủ.
- Không render DOCX thành PDF ở runtime AI Studio/Cloud Run; không gửi tệp binary hoặc dùng Gemini Files API. Bố cục trang, ngắt dòng/trang, vị trí ảnh, OCR và nội dung header/footer ngoài thân được báo chưa đánh giá. Tệp nguồn lớn hơn giới hạn payload đối chiếu được đánh dấu chưa đánh giá.
- Máy chủ hiện không có `GEMINI_API_KEY`, nên giao diện, xác nhận riêng tư và luồng lỗi đã kiểm tra trên local nhưng chưa chạy một lượt gọi Gemini thật. Kết quả cũng chưa được kiểm tra lại sau pull trên AI Studio.

Đây là phiên bản hỗ trợ rà soát nội dung/trích xuất, không cam kết không sai lệch tuyệt đối. Muốn đánh giá hình thức Word bằng AI cần bổ sung và kiểm chứng đường render DOCX→PDF cùng cơ chế gửi/xóa PDF an toàn ở môi trường production.

## Thiết kế đích

### 1. Hai nhánh bằng chứng cùng một lượt rà soát — mục tiêu mở rộng

1. Parser cục bộ giữ danh sách khối nguồn có thứ tự, bảng và vị trí; mỗi khối có ID ổn định, trang/vị trí khi có thể, phạm vi nguồn và liên kết đến trường/khối được phân loại. Tệp gốc không bị thay thế bởi văn bản đã parse.
2. Sau khi parse thành công, bước đối chiếu cục bộ chạy trước: phát hiện khối không có đích, đích không có nguồn, trùng/lặp, sai thứ tự, sai số ô/bảng và chuỗi bị mất. Các phép kiểm đếm được xác định là `PASS`, `ISSUE` hoặc `NOT_EVALUATED` theo bằng chứng.
3. Nếu người dùng chấp thuận, backend hiện nhận file nguồn tạm thời, trích văn bản độc lập, rồi gửi văn bản cùng manifest đã parse và rule pack đã chọn tới Gemini. Bản PDF render từ DOCX để kiểm tra xuống dòng, bảng và ngắt trang vẫn là mục tiêu chưa triển khai.
4. AI đối chiếu file nguồn với manifest và chạy lượt tổng hợp toàn văn bản sau các lượt theo vùng. Nếu không tạo được PDF nguồn đáng tin cậy, hệ thống chỉ báo audit nội dung/khối; phần hình học được đánh `NOT_EVALUATED`, không giả vờ đã kiểm tra trực quan.

Google Gemini hỗ trợ đọc PDF bằng vision; riêng binary DOCX hiện không được gửi đi. Nếu bổ sung Files API, cần thiết kế retention/xóa theo tài liệu nhà cung cấp trước khi bật. [Tài liệu Document understanding](https://ai.google.dev/gemini-api/docs/document-processing), [Files API](https://ai.google.dev/gemini-api/docs/files).

### 2. Rule pack có phiên bản và phạm vi rõ ràng

- Resolver nhận diện chế độ, loại văn bản, ngày/phiên bản áp dụng và hồ sơ cơ quan; chọn đúng các rule đã xác minh từ catalog thay vì gửi cả catalog hoặc dựa vào trí nhớ của mô hình.
- Mỗi lượt AI nhận danh sách rule ID, mô tả, trạng thái pháp lý, nguồn/điều khoản, phiên bản catalog và chính sách xử lý xung đột. Nội dung tài liệu tải lên được coi là dữ liệu không tin cậy, không phải chỉ thị cho mô hình.
- Tách rõ: yêu cầu pháp lý bắt buộc; quy tắc profile nội bộ đã được người dùng cấu hình; gợi ý trình bày; và kiểm tra chưa thể đánh giá. Outline của 29 loại văn bản chỉ được coi là gợi ý đến khi có nguồn xác nhận cho từng rule.
- Bắt đầu bằng rule pack ND30 cho các loại pilot; không áp rule Đảng/Hướng dẫn 05 lên văn bản hành chính. Chưa có pack đã xác minh thì nêu rõ giới hạn.

### 3. Kết quả có thể truy nguyên, không tự sửa

Mỗi phát hiện có: mã phát hiện; loại lỗi (mất/trùng/sai thứ tự/không khớp, chính tả, cấu trúc body, trình bày, mâu thuẫn nội dung); mức độ; độ tin cậy; ID và đoạn trích nguồn; đích parse (field/block/table row/cell); trang nếu có; rule ID và nguồn áp dụng; nhận xét; đề xuất sửa; trạng thái `ISSUE`, `NEEDS_REVIEW` hoặc `NOT_EVALUATED`.

AI chỉ đưa ra nhận xét và đề xuất. Người dùng sửa trực tiếp trong editor; sau khi nội dung thay đổi, kết quả cũ chuyển thành stale và phải chạy lại. Bằng chứng không đủ, OCR khó đọc, rule thiếu hoặc các nhánh không đồng thuận thì hạ xuống `NEEDS_REVIEW`.

### 4. Quyền riêng tư và vận hành

- Giải thích rõ dữ liệu thực sự được gửi: hiện tại backend nhận file tạm để trích văn bản, còn Gemini nhận văn bản trích xuất và các vùng parse; không gửi binary DOCX. Chỉ gửi sau khi người dùng chấp thuận; tự động rà soát mặc định tắt và chỉ bật theo phiên.
- Không ghi nội dung tài liệu, base64, prompt có văn bản người dùng, API key hoặc URL file Gemini vào log. Không lưu bytes vào localStorage, lịch sử phiên hoặc telemetry.
- Upload có giới hạn định dạng/kích thước và kiểm tra phần mở rộng/magic bytes cho DOCX, mã UTF-8 cho TXT; timeout, hủy và giới hạn song song vẫn cần bổ sung. Kết quả gắn `sourceHash`, `parseRevision`, `rulePackVersion` và model để tránh dùng kết quả cũ.
- Hiện không dùng Gemini Files API; buffer file và văn bản nguồn trong bộ nhớ server được xóa khi request kết thúc. Nếu bổ sung gửi file render lên Gemini, cần thêm trạng thái dọn file phía nhà cung cấp và không ghi nhận hoàn tất khi dọn file lỗi.

## Quyết định kỹ thuật còn cần kiểm chứng

Trước khi mở rộng UI, cần chứng minh môi trường chạy local và AI Studio/Cloud Run có thể render DOCX thành PDF đủ trung thực, giữ bảng, font/Unicode tiếng Việt, lề, ngắt trang và ảnh. So sánh PDF render với Word trên bộ tài liệu tổng hợp. Nếu không đạt, giai đoạn đầu phải ghi rõ kiểm tra hình thức chưa được đánh giá hoặc yêu cầu người dùng cung cấp bản PDF song hành; không dựa vào preview HTML để khẳng định giống Word.

## Điều kiện nghiệm thu sản phẩm

- Với mỗi tài liệu pilot, có thể lần từ mọi phát hiện về bằng chứng trong nguồn và vị trí tương ứng trong kết quả parse; các khối thiếu/thừa được phát hiện bởi đối chiếu xác định hoặc đánh dấu rõ là chưa đánh giá.
- Body nhiều đoạn, bảng lồng/đa trang, danh sách, xuống dòng, chữ ký, phần cuối và phụ lục được kiểm tra theo loại văn bản; không có nội dung tự sửa khi chạy AI.
- Mọi kết luận quy phạm có rule ID/nguồn/version. Rule thiếu hoặc không áp dụng không thể tạo trạng thái PASS.
- Khi tài liệu thay đổi, kết quả cũ không còn được trình bày như kết quả mới nhất.
- Chỉ bật gửi tự động sau khi người dùng đồng ý; trạng thái gửi, xử lý, hủy, lỗi và dọn dẹp file được thể hiện trong giao diện.
- Hoàn tất kiểm thử chức năng, kiểm tra tệp xuất, và quan sát trực tiếp giao diện local; sau khi đồng bộ AI Studio, chạy lại các ca tương ứng ở đó.

## Ngoài phạm vi giai đoạn đầu

- Cam kết tuyệt đối rằng mọi lỗi parse/định dạng sẽ được phát hiện.
- AI tự sửa bản thảo hoặc tự xác nhận văn bản hợp pháp.
- OCR/nhận dạng viết tay hoặc xử lý tài liệu scan khi chưa có pipeline và bộ kiểm thử riêng.
- Tự mở rộng rule pháp lý cho mọi loại văn bản khi chưa xác minh nguồn chính thức.
