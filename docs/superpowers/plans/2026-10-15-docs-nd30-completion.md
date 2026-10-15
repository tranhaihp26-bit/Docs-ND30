# Docs-ND30 Internal Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thành Docs-ND30 cho nhân viên Công ty Hoa tiêu Hàng hải miền Bắc: làm trọn công việc với tài liệu thật, giữ nguyên dữ liệu, xuất file dùng được và phục hồi bản nháp ổn định.

**Architecture:** Giữ React/Express và luồng AI Studio ↔ GitHub hiện có. Tách trạng thái nhập và lưu nháp thành các module nhỏ; giữ AI là tùy chọn, mọi thay đổi nội dung có cổng người dùng duyệt. Dùng bộ tài liệu tham chiếu để kiểm tra từ API nhập đến DOCX/PDF, rồi khóa chất lượng bằng CI và nghiệm thu nội bộ.

**Tech Stack:** React 19, TypeScript, Vite, Express, Tiptap, `docx`, `docx-preview`, `jszip`, GitHub Actions. Chốt một package manager/lockfile trong Task 6.

**Spec:** [Audit mức sẵn sàng sản phẩm](../../audits/2026-10-15-product-readiness.md).

## Global Constraints

- Bản phát hành đầu chỉ phục vụ nội bộ Công ty Hoa tiêu Hàng hải miền Bắc; giữ hồ sơ đầu trang công ty cho mẫu hành chính mới, giữ nguyên danh tính của văn bản nhập.
- Không tự tạo số văn bản, ngày ký, người ký hoặc nội dung không có nguồn; trường thiếu phải hiển thị để người dùng duyệt.
- `NOT_EVALUATED` không được tính thành `PASS`; kiểm tra 9 trường dữ liệu không phải chứng nhận toàn bộ NĐ 30/HD 05.
- Không đưa tài liệu nghiệp vụ thật hoặc secret vào Git/CI. Bộ fixture công khai chỉ gồm tài liệu tự tạo/đã khử thông tin; bộ thử nội bộ lưu ở vị trí có quyền truy cập phù hợp.
- Mỗi task cần test của chính nó, kiểm tra diff và commit riêng trên branch làm việc. Không push thẳng `main` từ Desktop khi đang vận hành PR; nếu AI Studio vẫn push `main`, cần thống nhất một cửa đồng bộ trước khi bật branch protection.

## Review Focus

1. File B lỗi sau file A hợp lệ: tên, nội dung và metadata không được trộn; Task 1 có test A → B.
2. Reload khi đang sửa hoặc storage đầy/hỏng: bản nháp còn hoặc hiển thị lỗi lưu rõ ràng; Task 2 có test khôi phục/lỗi.
3. Bảng/phụ lục nhiều trang và chữ Việt: DOCX/PDF không mất, lặp hoặc cắt nội dung; Task 4–5 có test và nghiệm thu trực quan.
4. Nội dung thiếu chứng cứ: không được chuyển thành “đạt chuẩn” chỉ nhờ 9 trường có giá trị; Task 3 có test UI/report.
5. AI không key/429/503/timeout hoặc bị từ chối: tài liệu gốc không bị ghi đè; Task 5 có test hành vi.

---

## Task 1: Cô lập và xác nhận giao dịch nhập file

**Files:** Modify `src/App.tsx`, `server.ts`; Create `src/utils/importState.ts`, `test/import-state.test.ts`.

**Interfaces:** `ParsedImport = { filename: string; fileType: "docx" | "txt"; text: string; html: string; structured: StructuredImport | null }`; `parseImportResponse(filename: string, data: unknown): ParsedImport` kiểm tra dữ liệu từ API trước khi cập nhật React state. `importMetadata.sourceType` lấy từ `ParsedImport.fileType`.

- [ ] Viết test: A hợp lệ → B trả 422/empty/network error; state sau lỗi vẫn chỉ thuộc A hoặc được xóa hoàn toàn, không xuất hiện tên B với nội dung A. Test `.txt` tạo metadata `txt`, `.docx` tạo `docx`.
- [ ] Chạy test mới để thấy thất bại trên code hiện tại.
- [ ] Đổi `handleFileUpload` thành một giao dịch: giữ trạng thái hiện hành khi đang parse, chỉ cập nhật đồng thời tên/text/html/structured sau khi response hợp lệ; xóa lỗi cũ và reset file input đúng lúc. Dùng `AbortController`/request id để response file A chậm không ghi đè file B mới chọn.
- [ ] Ở server, xác định đường TXT bằng extension hợp lệ; một `.docx` có MIME `text/plain` không được đọc như TXT. Trả lỗi rõ với tệp rỗng, sai định dạng, quá 25 MB.
- [ ] Chạy test nhập mới và `test/import-segments.test.ts`; thử A → B lỗi trong Preview. Commit thay đổi.

## Task 2: Lưu nháp, phục hồi và phiên bản đáng tin

**Files:** Create `src/utils/draftStore.ts`, `src/hooks/useDraft.ts`, `test/draft-store.test.ts`; Modify `src/App.tsx`, `src/components/ND30Editor.tsx` khi cần nối trạng thái; add versioned storage schema.

**Interfaces:** `DraftRecord = { schemaVersion: 1; id: string; updatedAt: string; standardType: "state" | "party"; doc: DocumentState; versions: Version[] }`; `saveDraft(record): Promise<void>`, `loadDraft(id): Promise<DraftRecord | null>`, `deleteDraft(id): Promise<void>`. Ưu tiên IndexedDB vì body/phụ lục có thể lớn; không lưu API key/tài liệu lên server.

- [ ] Viết test round trip bản nháp gồm body, bảng/phụ lục, metadata và phiên bản; reload trả đúng state; dữ liệu schema cũ/hỏng không làm app trắng; storage quota/error hiển thị “chưa lưu được”.
- [ ] Chạy test mới để xác nhận thất bại, rồi triển khai store có version, lưu debounce, trạng thái “Đang lưu/Đã lưu/Lỗi lưu”, nút tải bản sao DOCX và thao tác xóa nháp rõ ràng.
- [ ] Định nghĩa checkpoint phiên bản: khi chọn mẫu, nhập, áp dụng AI, khôi phục; bổ sung checkpoint thủ công hoặc theo chu kỳ cho sửa tay. Giới hạn số bản; hiển thị rõ lịch sử là checkpoint, không hứa lưu mọi phím gõ thành một phiên bản.
- [ ] Cập nhật câu ở tab Lịch sử đang nói “lưu an toàn” theo trạng thái lưu thực. Kiểm thử refresh, đóng/mở tab và tab khác trên trình duyệt thật; tránh ghi đè âm thầm khi hai tab cùng sửa.
- [ ] Chạy test store, test hiện có và build. Commit thay đổi.

## Task 3: Báo cáo kiểm tra đúng phạm vi chứng cứ

**Files:** Modify `src/shared/schemas/document.schema.ts`, `src/App.tsx`, `src/canonical/nd30/canonicalAudit.ts` nếu cần; Create `test/compliance-presentation.test.ts`.

**Interfaces:** Giữ `ND30ComplianceReport` tương thích; UI hiển thị `passedChecks/totalChecks`, nhóm `canonical` theo PASS/FAIL/NOT_EVALUATED/NEEDS_REVIEW và thông tin nguồn. Không tạo `overallCompliancePercent` cho 435 quy tắc.

- [ ] Viết test: report 9/9 với 387 `NOT_EVALUATED` vẫn hiển thị “9/9 trường dữ liệu” và “387 chưa đánh giá”, không có nhãn “đạt chuẩn toàn diện”. Kiểm tra quy tắc thiếu bằng chứng vẫn `NOT_EVALUATED`.
- [ ] Chạy test để thấy UI/format hiện tại chưa đạt tiêu chí.
- [ ] Đổi badge “Thể thức: 56%” thành nhãn cụ thể về 9 trường; đưa cảnh báo về phạm vi ngay cạnh hành động xuất, tách mục OOXML đã đo và mục cần người nghiệp vụ duyệt.
- [ ] Chạy `nd30-compliance`, `nd30-canonical-overlay` và test mới; xem UI với mẫu thiếu thông tin và mẫu đủ 9 trường. Commit thay đổi.

## Task 4: Chất lượng file xuất và phân trang

**Files:** Modify `src/App.tsx`, `src/utils/docxExport.ts`, `src/components/A4DocumentPreview.tsx`; Create `src/utils/pdfExport.ts`, `test/export-roundtrip.test.ts`.

**Interfaces:** `exportPdf(doc: DocumentFormatType): Promise<Blob>` phải tạo trang theo cùng cấu trúc tài liệu với DOCX/Preview hoặc dùng đường chuyển đổi có thể kiểm chứng; `exportToDocx` tiếp tục là nguồn OOXML chính. Nếu chưa bảo đảm PDF, UI phải ghi rõ “bản xem/in” thay vì “PDF chuẩn A4”.

- [ ] Viết fixture tự tạo có 1, 2, 5+ trang, bảng dài, phụ lục, tiếng Việt, trường trống; test DOCX round trip OOXML: thứ tự đoạn/bảng, số ô, chữ ký, ngắt trang và không nhân đôi header.
- [ ] Chạy test mới để thấy các khoảng trống hiện tại, rồi xử lý lỗi DOCX được phát hiện. Xuất PDF theo từng trang thật; không lặp cùng một ảnh canvas dịch vị trí rồi cắt giữa dòng/bảng.
- [ ] Mở DOCX bằng Word và LibreOffice trên bộ fixture; mở PDF, kiểm từng trang với Preview, ghi ảnh/biên bản sai khác. Kiểm tra PDF có thể tìm/chọn chữ nếu đó là yêu cầu bản phát hành; nếu không, nêu giới hạn rõ trong UI.
- [ ] Chạy test xuất và build; chỉ đóng task khi không còn mất/lặp/cắt nội dung ở bộ fixture. Commit thay đổi.

## Task 5: Nghiệm thu tài liệu thật và hành vi khi AI lỗi

**Files:** Create `docs/acceptance/manifest.md`, `docs/acceptance/results-template.md`, `test/ai-failure.test.ts`; Modify `server.ts`, `src/App.tsx` theo lỗi tái hiện. Tài liệu thật để ngoài repository.

**Interfaces:** Manifest cho mỗi ca: loại văn bản, nguồn được phép dùng, số đoạn/bảng/ô/phụ lục, các trường bắt buộc, kết quả kỳ vọng và sai khác chấp nhận được. `importMetadata` lưu loại nguồn và trạng thái cần duyệt, không gán “confirmed” tự động cho trường còn ambiguous.

- [ ] Chuẩn bị tối thiểu quyết định, công văn, kế hoạch, biên bản, văn bản Đảng, DOCX có bảng/phụ lục nhiều trang và TXT; mỗi ca có manifest đã kiểm tra thủ công.
- [ ] Chạy nhập → duyệt phân vùng → soạn → kiểm tra → xuất; so khối đầu vào với `body`, `appendices`, `unclassified`, DOCX/PDF. Ghi mọi mất/lặp/đảo dữ liệu và tạo test hồi quy cho từng lỗi.
- [ ] Test không API key, 429, 503, timeout, phản hồi AI sai và thao tác từ chối; khi lỗi/từ chối, `doc` và bản nháp không bị thay. Trước khi gửi tài liệu lên AI, UI nêu rõ nội dung nào được gửi.
- [ ] Thử luồng với ít nhất một nhân viên nội bộ không tham gia phát triển; ghi thao tác họ không tự hoàn thành và sửa các lỗi P0/P1. Commit code/test/tài liệu khử thông tin, không commit dữ liệu nội bộ.

## Task 6: Cài đặt tái tạo, CI và phát hành có thể quay lại

**Files:** Create `README.md`, `.github/workflows/ci.yml`; Modify `package.json`, lockfile được chọn, `test/import-segments.test.ts` nếu nhãn số ca không khớp.

**Interfaces:** Một lệnh cài bằng package manager đã chốt; CI chạy `lint`, `test`, `test:canonical`, `test:import:segments`, `build`. Live AI test không nằm trong PR thường vì cần secret và gọi dịch vụ thật.

- [ ] Chọn Bun hoặc npm/pnpm dựa trên nơi chạy thực tế AI Studio và GitHub Actions; thống nhất `packageManager`, lockfile và version runtime, loại bỏ lockfile dư. Từ checkout sạch, cài deps đúng lệnh rồi chạy tất cả script.
- [ ] Sửa log `SEP-01..16` hoặc bổ sung ca tương ứng để số ca báo cáo khớp số ca thực chạy; CI phải thất bại nếu một ca thất bại.
- [ ] Tạo workflow chạy trên PR và `main`, cache deps, lưu SHA/kết quả; thêm README về cách chạy, env, giới hạn AI, bộ kiểm tra và phạm vi hỗ trợ.
- [ ] Mở PR thử để xác nhận CI chạy trên GitHub. Sau khi luồng AI Studio push được điều chỉnh phù hợp, đặt required checks/PR trên `main`; không bật quy tắc chặn trước khi có đường đồng bộ AI Studio khả dụng.
- [ ] Gắn tag/release cho commit đã nghiệm thu, ghi cách quay lại commit trước. Commit task.

## Thứ tự và điều kiện dừng

Thực hiện Task 1 → 2 → 3 → 4 → 5 → 6. Có thể đưa phần tạo CI của Task 6 lên sớm sau khi chốt package manager để kiểm tra mọi PR. Không mở rộng đa cơ quan, thêm mẫu mới hoặc quảng bá “435 quy tắc đạt” trong bản nội bộ đầu tiên.

Chỉ gọi **ready for internal use** sau khi toàn bộ cổng trong audit có bằng chứng đính với SHA phát hành. Nếu còn giới hạn PDF hoặc loại tài liệu chưa hỗ trợ, UI và tài liệu phát hành phải nói rõ để người dùng không dùng nhầm.
