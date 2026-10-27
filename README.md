# CVAT Cuboid Toolbox (3D)

Userscript Tampermonkey bổ sung toolbox hỗ trợ thao tác cuboid 3D trên CVAT.

## Yêu cầu

- Google Chrome.
- Extension [Tampermonkey](https://www.tampermonkey.net/).
- Một trang CVAT có địa chỉ khớp với một trong các địa chỉ được cấu hình trong script:
  - `...`
  - `http://localhost:8080/`
  - `http://127.0.0.1:8080/`

## Cài đặt trên Chrome

1. Cài Tampermonkey từ [Chrome Web Store](https://chromewebstore.google.com/search/Tampermonkey), sau đó bật extension.
2. Mở Tampermonkey bằng biểu tượng extension trên Chrome và chọn **Dashboard**.
3. Mở tab **Utilities**, tìm mục **Import from file**, rồi chọn **Choose file**.
4. Chọn file [cvat-cuboid-quicktool.user.js](./cvat-cuboid-quicktool.user.js).
5. Khi trang cài đặt userscript hiện ra, chọn **Install**.
6. Mở hoặc tải lại trang CVAT có địa chỉ nằm trong danh sách ở trên. Toolbox sẽ xuất hiện ở cạnh phải màn hình.

## Dùng CVAT trên địa chỉ khác

Mặc định script chỉ chạy trên các địa chỉ được khai báo bằng `@match` ở đầu file. Nếu CVAT của bạn dùng domain hoặc cổng khác, hãy thêm một dòng `@match` phù hợp trong [cvat-cuboid-quicktool.user.js](./cvat-cuboid-quicktool.user.js), lưu script trong Tampermonkey, rồi tải lại trang CVAT.
