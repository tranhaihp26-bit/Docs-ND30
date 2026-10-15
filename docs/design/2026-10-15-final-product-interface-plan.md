# Docs-ND30 — phương án sản phẩm và giao diện cuối cùng

**Ngày chốt đề xuất:** 15/10/2026  
**Đợt sử dụng đầu:** nhân viên nội bộ Công ty Hoa tiêu Hàng hải miền Bắc.  
**Mục tiêu:** nhân viên tạo hoặc nhập văn bản, sửa đúng chỗ, đối chiếu được với nguồn, xuất tệp Word dùng được và hiểu rõ phần nào còn cần kiểm tra. Chất lượng tệp cuối quan trọng hơn vẻ giống Word của màn hình web.  
**Phạm vi tài liệu:** quyết định thiết kế và tiêu chí nghiệm thu; chưa phải chứng nhận ứng dụng hiện tại đã đạt.

## 1. Quyết định sản phẩm

**Chọn giao diện theo tác vụ trên lõi tài liệu hiện có.** Một tài liệu có hai không gian chính:

1. **Soạn thảo & đối chiếu**: bắt đầu, chọn mẫu/tải DOCX-TXT/dán, parse trực tiếp, thiết lập profile, sửa phần đầu/nội dung/phần cuối/phụ lục, rà soát các mục bất định. Đây là một bước liền mạch; tải tệp không mở một wizard hoặc modal chặn trước editor.
2. **Xem trước & xuất**: chỉ một bản A4, bảng kiểm cuối, xuất Word; PDF là lựa chọn phụ sau khi chức năng được xác minh. Quay từ cảnh báo về đúng trường trong bước 1.

**Lịch sử, quy tắc chi tiết, trợ giúp và AI** mở theo ngữ cảnh bằng drawer/menu. Không tạo thêm tab bắt buộc. Không thay editor hiện có bằng một bộ Office tổng quát trong đợt đầu.

Những điều phải giữ: profile công ty từ tệp “Tiêu ngữ chuẩn.docx”; chế độ hành chính NĐ30 và văn bản Đảng HD05 tách biệt; không tự sinh nội dung vắng trong nguồn; chỉ nêu “đã kiểm” với quy tắc thực sự chạy; kiểm cả mã **và kết quả nhìn thấy** trên local, Word/bộ dựng tương đương và AI Studio sau khi đồng bộ.

## 2. Cơ sở quyết định và giới hạn bằng chứng

| Nguồn | Điều đã quan sát hoặc xác minh | Tác động đến phương án |
| --- | --- | --- |
| [Audit ứng dụng local](../audits/2026-10-15-ux-workflow-audit.md) và [đề xuất giao diện đầu](./2026-10-15-end-user-interface-proposal.md) | 10 mẫu đẩy upload xuống dưới; vùng review và editor xa nhau; toolbar tràn ở 620 px; A4 co quá nhỏ ở 390 px; Preview có công cụ/nút lặp. Bản local `4bb714e` và AI Studio/GitHub `main` `e58fd6e` khác nhau tại thời điểm kiểm. | Bắt đầu ngắn, editor chiếm ưu tiên, review theo việc cần làm, responsive thực dụng, không đánh giá AI Studio bằng ảnh của commit khác. |
| Mã hiện tại | `parseLocalFile()` dùng bộ tách OOXML/JSZip rồi phân vùng; Tiptap là editor; `docx` tạo Word và `docx-preview` hiển thị blob. Bản nháp/checkpoint hiện chủ yếu ở state phiên; một số lỗi xuất và giữ nguồn đã được ghi trong audit. | Cải thiện trên pipeline hiện có; sửa độ tin cậy dữ liệu và lưu nháp cùng với giao diện, không chỉ đổi CSS. |
| [Nghiên cứu dự án GitHub](./2026-10-15-github-reference-reassessment.md) | Tiptap, `docx`, `docx-preview`, Mammoth có vai trò rõ. Paperless-ngx gợi ý cách cho thấy nguồn, metadata, version; ONLYOFFICE/SuperDoc có chi phí tích hợp và giấy phép cần đánh giá riêng. | Dùng lại thư viện đang có; học pattern, thử riêng component Tiptap UI; chưa chuyển toàn bộ engine. |
| [Bộ concept Studio do người dùng cung cấp](./2026-10-15-external-studio-concept-review.md) | Bản đồ khối nguồn và giấy A4 là hình dung tốt. HTML chỉ là prototype tĩnh; ảnh còn làm gãy tên công ty/quốc hiệu; nhãn 100%, IndexedDB, xuất Word, AI chưa có chứng cứ vận hành. | Nhận ý tưởng đối chiếu nguồn; giữ A4 ở Preview; chuyển mọi cam kết tuyệt đối thành tiêu chí kiểm chứng. |

## 3. Mô hình dữ liệu làm nền cho giao diện

Một trường chỉ có **một giá trị đang soạn**. Giao diện phải phân biệt bốn loại dữ liệu:

- **Bản nguồn bất biến**: tên tệp, loại, hash/ID, thứ tự khối, văn bản/bảng/phụ lục và thông tin format trích xuất. Giữ được cả khối chưa phân loại; không ghi đè bản nguồn khi người dùng sửa.
- **Bản làm việc**: profile, các trường đầu/cuối, nội dung và phụ lục đang sửa. Mọi ô trên giao diện đọc/ghi một nguồn trạng thái này.
- **Dấu vết đối chiếu**: trường/khối nào lấy từ đâu; `cần sửa`, `cần người xác nhận`, `đã xác nhận`, `chưa tự kiểm`, `không áp dụng`. Xác nhận gắn với phiên bản giá trị; sửa lại thì trạng thái trở về cần xem.
- **Bản xuất có định danh**: một snapshot cụ thể sinh ra DOCX blob; Preview xem chính blob đó. Tệp cuối và kết quả rà soát được liên kết với cùng snapshot, tránh Preview và download lệch nhau.

“Bảo toàn dữ liệu” là phép kiểm đo được: mỗi khối nguồn có ID và vị trí, mỗi bảng có cấu trúc hàng/cột/ô, mỗi phụ lục có trạng thái nhập. UI nêu số khối chưa gán hoặc không hỗ trợ. Chỉ hiển thị “không phát hiện bỏ sót” khi phép đối chiếu đã chạy; không dùng khẩu hiệu Zero Data Loss.

## 4. Kiến trúc thông tin và menu

```text
Docs-ND30 / [Tên tài liệu]                              [Lưu thật] [Lịch sử] [⋯]
├─ 1. Soạn thảo & đối chiếu
│  ├─ Chưa có tài liệu: Tiếp tục nháp / Tải DOCX-TXT / Chọn mẫu / Dán
│  ├─ Cấu trúc: Phần đầu / Nội dung / Phần cuối / Phụ lục / Khác
│  ├─ Vùng soạn thảo: một nơi sửa cho mỗi trường
│  └─ Inspector theo ngữ cảnh: Nguồn → Bản đang soạn → Việc cần làm
└─ 2. Xem trước & xuất
   ├─ Một viewer A4 từ DOCX xuất
   ├─ Kiểm tra cuối và đường quay đúng trường
   └─ Một hành động Word chính; PDF phụ khi đạt kiểm thử

Menu ⋯: Quy tắc chi tiết · Cấu hình/profile (theo quyền) · Trợ giúp · AI tùy chọn
```

Không bày đồng thời 10 mẫu, upload, AI, catalog rule, lịch sử và các nút xuất quanh tờ giấy. Người dùng luôn thấy **tên tài liệu**, **nguồn**, **chế độ NĐ30/HD05**, **trạng thái lưu thật** và **số việc cần xử lý**. Thay nguồn hoặc đổi profile là thao tác có checkpoint và mô tả tác động lên tài liệu hiện tại.

## 5. Thiết kế từng trạng thái màn hình

### 5.1. Chưa có tài liệu

Trong viewport đầu có ba lựa chọn `Tải DOCX/TXT`, `Chọn mẫu`, `Dán văn bản`. Nếu có nháp thật, `Tiếp tục bản nháp` xuất hiện phía trên. Mẫu nằm trong thư viện lọc/tìm kiếm mở khi chọn, không đẩy upload xuống nhiều màn hình. Vùng tải chỉ hứa kéo thả sau khi thao tác kéo thả hoạt động; nêu định dạng và giới hạn kích thước thực.

Chế độ mặc định cho nội bộ công ty là **văn bản hành chính với profile Công ty Hoa tiêu Hàng hải miền Bắc**. Nếu người dùng chọn văn bản Đảng, phải chọn rõ profile HD05. Không đổi toàn bộ tài liệu đã soạn bằng một nút chuyển màu/nhãn trong header.

### 5.2. Đã tải hoặc tạo tài liệu

Tệp hợp lệ được parse và **mở thẳng editor**. Dải nguồn gọn: `01_Pham...docx · NĐ30 · 59 khối · 3 mục cần xem`. Parse lỗi giữ bản làm việc cũ và thông báo lý do. Không yêu cầu bấm thêm “Đồng ý đưa vào Studio”.

```text
┌ Tên tài liệu · Đang lưu/Đã lưu lúc… ───────── Lịch sử ────┐
│ Soạn thảo & đối chiếu              Xem trước & xuất      │
│ Nguồn: 01_Pham...docx · NĐ30 · 3 mục cần xem [Thay nguồn] │
├─────────────────┬────────────────────────────────────────┤
│ CẤU TRÚC        │ PHẦN ĐẦU / NỘI DUNG                    │
│ Phần đầu     1  │ Trường có nhãn + editor trực quan      │
│ Nội dung     0  │ Toolbar một hàng; lệnh khác trong Chèn │
│ Phần cuối    1  │                                        │
│ Phụ lục      1  │                                        │
│ Khác         0  │                                        │
└─────────────────┴────────────────────────────────────────┘
                         [3 mục cần xem] [Xem trước bản nháp]
```

- **Phần đầu**: profile công ty mặc định lấy đúng cấu trúc Word gốc. Hai dòng cơ quan cấp trên; **tên công ty và quốc hiệu mỗi bên một dòng** với hình học bảng OOXML đã được đo, không lấy hai cột CSS của concept làm chuẩn. Thông tin nhận dạng chuẩn được khóa theo profile; số/ký hiệu, địa danh/ngày, loại và trích yếu là trường sửa rõ nhãn. Áp rule theo đúng chế độ tài liệu.
- **Nội dung**: Tiptap với thanh công cụ gọn cho undo/redo, kiểu đoạn, đậm/nghiêng, căn, danh sách và bảng; nhóm `Chèn` chứa căn cứ, điều/khoản và khối hành chính. Phần thân ưu tiên độ rộng và cỡ chữ đọc được; không trộn nút chèn tiêu ngữ vào cùng vùng viết thân thường xuyên.
- **Phần cuối**: chữ ký, người ký, nơi nhận và ghi chú lưu trữ có trạng thái nguồn; không tự điền `Nơi nhận` hay người ký vào tệp nhập nếu nguồn không có.
- **Phụ lục**: danh sách phụ lục, tiêu đề, đoạn/bảng và thứ tự; chỉnh bằng editor trực quan. Xóa có hoàn tác hoặc xác nhận; HTML thô chỉ ở tùy chọn nâng cao.
- **Khác/chưa phân loại**: mục hiện rõ số khối; xem nguồn và quyết định gán hoặc giữ nguyên. Không giấu để tạo cảm giác parse “100%”.

### 5.3. Inspector đối chiếu

Mỗi mục hiển thị `Đoạn nguồn`, `Giá trị đã nhận diện`, `Bản đang soạn`, `Vì sao cần xem`, `Tới trường/Sửa/Xác nhận`. Với bảng và phụ lục, cho biết vị trí khối, hàng/cột, ô hợp nhất nếu xác định được. Các mục đã chắc chắn thu gọn; người dùng không phải rà 53 khối trong một modal trước khi được viết.

Ở desktop thông thường, inspector mở dạng drawer hoặc thay rail cấu trúc; tại ≥1440 px có thể ghim thành cột thứ ba nếu editor vẫn đủ rộng. Ở màn hình hẹp inspector chiếm toàn màn hình và quay về đúng trường sau khi xử lý.

### 5.4. Xem trước và xuất

Chỉ một bản A4 từ **DOCX blob của bản làm việc hiện tại**. Thanh xem có `Vừa trang`, `Đọc 100%`, số trang và nút trở về soạn thảo. Bên cạnh là danh sách kiểm cuối có liên kết đến trường liên quan. Không hiện `Engine Word Real`, `Canvas CSS` hoặc tỉ lệ đạt tổng khi nhiều rule chưa được đánh giá.

Một CTA theo trạng thái: `Xuất Word nháp` khi còn việc cần xem; `Xuất Word đã rà soát` khi các việc bắt buộc đã xử lý và người soạn xác nhận. Nhãn “đã rà soát” chỉ nói về quy trình nội bộ, **không chứng nhận tuân thủ pháp lý 100%**. PDF là hành động phụ sau khi có pipeline tạo tệp và kiểm được bằng mắt; lỗi xuất phải hiện rõ và không xóa bản làm việc. Bản xem `docx-preview` hỗ trợ kiểm nhanh, còn tệp Word cuối phải thử bằng Word/bộ dựng tương đương vì công cụ dựng HTML có giới hạn.

### 5.5. Lịch sử và bản nháp

Lịch sử là drawer: `Bản hiện tại`, `Trước khi đổi nguồn`, `Sau khi nhập`, `Trước khi đổi mẫu`, với thời gian và tác động khôi phục. Lưu nháp cục bộ bằng IndexedDB là bước hợp lý khi chưa có backend tài liệu, nhưng cần giao dịch lưu thành công, phục hồi sau F5/đóng tab, xử lý quota/lỗi schema và cách tải bản sao dự phòng. Không nói “an toàn tuyệt đối”; dữ liệu trình duyệt vẫn có thể bị xóa/evict. Khi chưa làm xong lưu bền, UI ghi đúng `Chưa lưu trên thiết bị`.

## 6. Màu sắc và responsive

| Vai trò UI | Đề xuất | Nguyên tắc |
| --- | --- | --- |
| Header/nhận diện | Navy `#0F2744`, dùng tiết chế | Gợi ý từ concept Studio; không chiếm quá nhiều chiều cao. |
| Hành động/điều hướng | Blue `#175CD3` | Một hành động chính nổi bật ở mỗi màn. |
| Thành công/lưu thật | Green `#067647` | Chỉ hiện khi sự kiện thành công đã xác nhận. |
| Cần người xem | Amber `#B54708` trên `#FFFAEB` | Có chữ giải thích và liên kết xử lý. |
| Lỗi | Red `#B42318` | Dùng cho lỗi và xóa; không lấy đỏ làm tông toàn app khi chọn HD05. |
| Chữ/nền | `#101828`, `#475467` trên trắng/`#F8FAFC` | Giao diện dùng Segoe UI/hệ thống, trang Word dùng Times New Roman theo profile. |

Grid 8 px, chữ nhập 16 px, nhãn 14 px, nút/tab cao ít nhất 40–44 px; trạng thái có chữ và biểu tượng bên cạnh màu. Đo tương phản trên giao diện thực và kiểm bàn phím/focus trước khi chốt.

| Rộng viewport | Bố cục |
| --- | --- |
| ≥1440 px | Cấu trúc + editor + inspector **nếu** editor còn đủ rộng; inspector có thể đóng. |
| 768–1439 px | Cấu trúc gọn + editor; inspector là drawer. Đây là mặc định desktop/AI Studio. |
| <768 px | Một cột; cấu trúc trong menu, toolbar một hàng với `Thêm`, inspector toàn màn hình. Preview có tổng quan trang và chế độ đọc 100%; không coi tờ A4 45% là văn bản đọc được. |

## 7. Tái sử dụng kỹ thuật đã chốt

- Giữ **Tiptap** cho editor; thử từng thành phần toolbar/menu Tiptap UI trên React 19 trước khi nhận. Không đưa toàn bộ UI mẫu vào khi chưa kiểm tương thích.
- Giữ **JSZip + bộ tách/segmenter OOXML hiện có** cho luồng nhập local; dùng Mammoth như nguồn hỗ trợ cho HTML/ngữ nghĩa khi phù hợp. Bản nguồn và dấu vết phân vùng là dữ liệu cốt lõi của Docs-ND30.
- Giữ **`docx`** cho xuất Word, **`docx-preview`** cho xem blob đã xuất; thử đối chiếu với Word trên bộ ca gốc. `docx-templates` chỉ là thử nghiệm cho biểu mẫu rất cố định nếu cần.
- Học pattern nguồn/version từ **Paperless-ngx**; chưa mang hệ thống lưu trữ vào ứng dụng. **ONLYOFFICE/SuperDoc** chỉ benchmark riêng nếu lỗi trung thực DOCX có tính hệ thống sau khi sửa pipeline hiện tại; kiểm giấy phép và vận hành trước quyết định.

## 8. Thứ tự triển khai để không rời bước 1 quá sớm

### Pha 1 — Hoàn thành Soạn thảo & đối chiếu

1. Chốt mô hình `SourceSnapshot` / `WorkingDocument` / `ReviewFinding` / `DraftRevision`. Sau khi upload, mở editor ngay; giữ nguồn và khối chưa phân loại.
2. Một nơi sửa cho mỗi trường; sửa xong hủy xác nhận đã cũ. Profile công ty và HD05 áp riêng. Hoàn thiện phần đầu, body, phần cuối, phụ lục bằng editor trực quan.
3. Lưu nháp thật và khôi phục; thay nguồn/mẫu có checkpoint. Làm màn bắt đầu, toolbar, menu, inspector và responsive của mục 1.
4. Nghiệm thu bằng mắt **và mã** trên các tài liệu đại diện: mẫu công ty, DOCX cơ quan hai dòng, DOCX thiếu `Nơi nhận`, bảng/phụ lục, TXT và nội dung dán. Chỉ chuyển pha khi người dùng thực hiện trọn bước 1 và không mất/thêm dữ liệu ngoài ý muốn.

### Pha 2 — Xem trước & xuất đáng tin

1. Preview duy nhất từ blob xuất; khắc phục lỗi PDF im lặng và nội dung tự điền. Nhãn bản nháp/đã rà soát có điều kiện đúng.
2. Đối chiếu file Word xuất với “Tiêu ngữ chuẩn.docx” và các ca thật bằng Word/bộ dựng tương đương: tên công ty/quốc hiệu không gãy, đường kẻ, lề, bảng, ngắt trang, chữ ký, phụ lục. Kiểm PDF riêng.
3. Khi local đạt, đồng bộ GitHub `main`, kéo đúng SHA vào AI Studio và thao tác lại cùng ca trong giao diện Preview.

### Pha 3 — Mở rộng theo dữ liệu sử dụng

Thử với nhân viên nội bộ, đo thời gian/điểm vướng thực tế; ưu tiên thêm shortcut, mẫu hay dùng, AI theo đoạn có diff và xác nhận. Chỉ nghiên cứu soạn trực tiếp trên mặt A4 nếu editor thật, con trỏ, bảng, mobile và tệp Word cuối đều qua bộ ca kiểm. Không dùng ước lượng “tiết kiệm 80%” trước khi đo.

## 9. Tiêu chí nghiệm thu sản phẩm

1. Ở 1265, 900, 620 và 390 px, ba cách bắt đầu tìm được ngay; header, toolbar và nội dung không gây cuộn ngang toàn trang. Nhân viên nhận ra việc tiếp theo mà không phải đọc thuật ngữ kỹ thuật.
2. Tải DOCX/TXT hợp lệ mở editor ngay; tệp lỗi không xóa bản đang soạn. Mọi khối/bảng/phụ lục có dấu vết hoặc được nêu rõ là chưa gán/không hỗ trợ; không có hai ô sửa cho cùng một giá trị.
3. Phần đầu của profile công ty đối chiếu tệp Word chuẩn bằng mắt: tên công ty và quốc hiệu một dòng, cơ quan cấp trên hai dòng, số/ngày và đường kẻ cân đối. Chế độ Đảng áp đúng profile riêng.
4. Sửa sau xác nhận làm lại trạng thái cần đối chiếu; kiểm định không coi `NOT_EVALUATED` là PASS. Nút xuất nháp nói đúng mức rà soát; nguồn thiếu không bị tự thêm nội dung.
5. F5/đóng-mở tab khôi phục bản nháp đã báo lưu; lỗi lưu được chỉ rõ và có cách tải bản sao. History khôi phục đúng phiên bản.
6. Preview xem đúng blob sẽ tải; DOCX/PDF mở được và khớp nội dung. Các ca tiêu ngữ, bảng, phần cuối và phụ lục được kiểm trực quan bằng Word/bộ dựng tương đương. AI Studio được kiểm lại sau khi pull đúng commit.
7. Quan sát ít nhất 5 nhân viên nội bộ thực hiện ba ca: chọn mẫu, nhập DOCX có vùng thiếu/bảng, dán văn bản. Ghi số lần phải tìm đường, lỗi hiểu nhầm trạng thái, thời gian hoàn thành; sửa dựa vào kết quả đo.

## 10. Quyết định còn phụ thuộc kết quả kiểm chứng

- Mức ưu tiên thị giác giữa `Tải tài liệu` và `Chọn mẫu`: đo tần suất công việc thực; hiện giữ ba lựa chọn dễ thấy.
- Lưu nháp nội bộ dài hạn ở trình duyệt hay backend công ty: IndexedDB đáp ứng bước đầu, bản sao dự phòng là bắt buộc; quyết định backend theo yêu cầu truy cập nhiều máy, phân quyền và lưu hồ sơ.
- Cần editor OOXML nguyên dạng hay không: chỉ quyết sau bộ ca xuất Word, không dựa trên concept tĩnh hoặc số sao GitHub.

**Phương án này thay thế các lựa chọn chưa chốt trong tài liệu trước.** Bản phác thảo HTML cũ chỉ minh họa điều hướng, chưa dùng làm chuẩn giao diện hay chuẩn tệp Word: kiểm tra trực tiếp ngày 15/10 cho thấy tên công ty và quốc hiệu vẫn bị xuống dòng. Khi dựng bản mới, phải đối chiếu trên màn hình và trên DOCX thực với tệp “Tiêu ngữ chuẩn.docx”, rồi mới duyệt bố cục A4.

## Nguồn ngoài đã đối chiếu

- GitHub: [Tiptap](https://github.com/ueberdosis/tiptap), [Tiptap UI Components](https://github.com/ueberdosis/tiptap-ui-components), [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx), [Mammoth](https://github.com/mwilliamson/mammoth.js), [docx-preview](https://github.com/VolodymyrBaydalka/docxjs), [docx](https://github.com/dolanmiu/docx), [docx-templates](https://github.com/guigrpa/docx-templates), [ONLYOFFICE](https://github.com/ONLYOFFICE/DocumentServer), [SuperDoc](https://github.com/superdoc/docx-editor). Giới hạn và quyết định cho từng dự án nằm trong [bảng đánh giá](./2026-10-15-github-reference-reassessment.md#2-dự-án-tham-chiếu-và-khả-năng-reuse).
- Nguyên tắc giao diện: [GOV.UK Buttons](https://design-system.service.gov.uk/components/button/), [Error summary](https://design-system.service.gov.uk/components/error-summary/), [Check answers](https://design-system.service.gov.uk/patterns/check-answers/), [W3C WCAG 2.2 Contrast](https://www.w3.org/TR/WCAG22/#contrast-minimum).
- Lưu nháp trong trình duyệt: [MDN Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) và [Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).
