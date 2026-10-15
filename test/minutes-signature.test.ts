import assert from "node:assert/strict";
import { detectEmbeddedSignature, detectMinutesTwoColumnSignature } from "../src/utils/docxExport.ts";

const officialMinutesSignature = `
  <table style="width:100%;border:none">
    <tr>
      <td><p><strong>THƯ KÝ</strong></p><p>(Ký, ghi rõ họ tên)</p><p><strong>[Họ và tên]</strong></p></td>
      <td><p><strong>CHỦ TỌA</strong></p><p>(Ký, ghi rõ họ tên)</p><p><strong>[Họ và tên]</strong></p></td>
    </tr>
  </table>`;

assert.equal(
  detectEmbeddedSignature(officialMinutesSignature, "BIÊN BẢN"),
  true,
  "Mẫu biên bản có khối ký Thư ký/Chủ tọa hai cột để không sinh thêm khối ký đơn",
);
assert.equal(detectMinutesTwoColumnSignature(officialMinutesSignature, "BIÊN BẢN"), true);
assert.equal(detectMinutesTwoColumnSignature(officialMinutesSignature, "BÁO CÁO"), false);
assert.equal(
  detectEmbeddedSignature(officialMinutesSignature, "BÁO CÁO"),
  false,
  "Bảng hai cột khác trong văn bản thông thường không bị nhận nhầm là khối ký biên bản",
);
assert.equal(
  detectEmbeddedSignature(`<table><tr><td>NGƯỜI GHI BIÊN BẢN</td><td>ĐẠI DIỆN</td><td>CHỦ TRÌ</td></tr></table>`),
  true,
  "Khối ký nhiều người ba cột đang được dùng trong tài liệu nhập vẫn được nhận diện",
);
