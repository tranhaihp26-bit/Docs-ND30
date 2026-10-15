# Đối chiếu đường kẻ và dấu phân cách ở đầu văn bản

Ngày rà soát: 15/10/2026. Ca hiện tại: biên bản làm việc của Công ty Hoa tiêu Hàng hải miền Bắc, nhập từ DOCX, chế độ **administrative**.

## Nguồn và phạm vi

- [Nghị định 30/2020/NĐ-CP trên Công báo Chính phủ](https://congbao.chinhphu.vn/van-ban/nghi-dinh-so-30-2020-nd-cp-30858/30246.htm): áp dụng cho profile hành chính. Catalog `src/canonical/nd30/rules.generated.json` đồng bộ từ rule repo tại commit `078dae21f9e23975676179fa189f5c01b605f49a` và hiện chỉ chứa 435 rule đã xác minh thuộc chế độ administrative.
- [Hướng dẫn 05-HD/VPTW ngày 27/5/2026 trên Cổng thông tin Đảng](https://dangcongsan.vn/upload/2006988/20260529/HD_05_VPTW_e1550.pdf): áp dụng cho văn bản của Đảng. Mục phạm vi của Hướng dẫn loại trừ cơ quan hoạt động theo Luật Doanh nghiệp; không áp nó cho biên bản hành chính của Công ty.

## Kết quả đối chiếu

| Vị trí | Hành chính NĐ 30 | Văn bản Đảng HD 05 | Trạng thái Docs-ND30 |
| --- | --- | --- | --- |
| Dưới cơ quan ban hành | Đường liền, dài 1/3–1/2 dòng tên cơ quan (`ISSUER_UNDERLINE_RANGE`) | Dấu `*` (HD 05, II.I.2.2.1) | Profile Công ty dùng viền đoạn thực; generic DOCX vẫn dùng 16 dấu `-`; nhánh Đảng chưa dựng dấu `*` |
| Dưới tiêu ngữ/tiêu đề phải | Đường liền dài bằng tiêu ngữ (`MOTTO_UNDERLINE_LENGTH`) | Đường liền dài bằng tiêu đề Đảng (HD 05, II.I.1.2) | Profile Công ty dùng viền đoạn; generic dùng 22 dấu `-`; Đảng chưa có đường liền OOXML tương ứng |
| Dưới trích yếu 5a | Đường liền dài 1/3–1/2 dòng trích yếu (`NAMED_SUBJECT_UNDERLINE_RANGE`); trích yếu đậm, 13–14 pt | Đúng năm dấu `-----` (HD 05, II.I.5.2.1), trích yếu đứng, đậm, 14–15 pt | Nhánh xuất chung đang cho trích yếu nghiêng và chưa dựng dấu/đường phân cách; Preview CSS cũng vậy |
| Công văn 5b | Trích yếu có bố trí riêng, không áp đường kẻ 5a | Trích yếu dưới số/ký hiệu, không áp năm dấu của 5a | Cần phân nhánh theo loại văn bản trước khi sửa |

Hai dấu `-` trong `Độc lập - Tự do - Hạnh phúc` là chữ của tiêu ngữ; không phải đường kẻ. Quy tắc số/ký hiệu văn bản cũng độc lập với dấu phân cách bố cục.

## Kết quả đối với ca biên bản hiện tại

- Mã đã sửa luồng nhập: nếu nhận đúng **cả** tên cơ quan cấp trên và Công ty, tự áp profile Công ty. Preview Word Real local sau khi nhập lại cho thấy tên Công ty và quốc hiệu một dòng, tên cơ quan cấp trên hai dòng.
- Bản Word Real vẫn hiển thị trích yếu nghiêng. Đây là sai lệch tiếp theo cần xử lý và đo lại trực quan, cùng đường kẻ dưới trích yếu. Không lấy tỷ lệ thể thức hiện tại làm chứng nhận toàn bộ rule đã đạt.
- Bản Đảng cần ca thử riêng với dữ liệu tổng hợp. Không dùng biên bản Công ty để xác nhận kiểu đầu trang Đảng.
