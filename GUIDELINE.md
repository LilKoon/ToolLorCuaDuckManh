# CVAT Cuboid Toolbox v3.1.0 — Hướng dẫn đầy đủ

Userscript hỗ trợ gán nhãn **CVAT 3D Cuboid**: Smart Snap theo point cloud, sửa LWH/preset, fit mặt đất phẳng & dốc, quản lý hướng/track, chọn nhiều box, thao tác kiểu Blender, QA + auto-fix có xem trước, snapshot.

> File script: `cvat-cuboid-quicktool.user.js` (v3.1.0)  
> Tài liệu cập nhật: 27/10/2026 — khớp với code v3.1.0.  
> Chỉ chạy trên trang `/jobs/<id>` của CVAT. Không cần reload sau khi cài.
>
> **Đang dùng bản 2.x?** Đọc mục [1.5](#15-khác-biệt-so-với-bản-2x-đọc-trước-khi-nâng-cấp) trước — bản 3.x bỏ và đổi khá nhiều thứ.

### Có gì mới ở 3.1.0

- **🧲 Smart Snap** (Alt+S) + *Fit size*: hút box theo cụm LiDAR, tự xoay yaw, đáy chạm đất, lặp 4 lượt.
- **🎥 Camera preset** + **thao tác Blender**: **G/R/S**, khoá trục **X/Y/Z**, nhập số, **Ctrl** bắt bước, xoay cả nhóm quanh tâm.
- **🎯 Chọn nhiều box** (Shift+Click) và thao tác nhóm: Snap · Chạm đất · Outside · Dịch.
- **📐 Mặt phẳng dốc** `Z = aX + bY + c` từ point cloud, mode *Nghiêng theo dốc*; giữ cả chế độ Z phẳng.
- **🧭 Công cụ hướng**: đo góc đầu vs hướng đi, nắn theo hướng đi/cloud, đồng bộ yaw toàn track, sửa frame lộn đầu, cắt phần track quá xa.
- **🔎 QA thế hệ mới**: scale lệch, đổi hướng đột ngột, chồng lấn BEV, quá xa, ngoài limits; lọc kết quả; **auto-fix có xem trước**; CSV 9 cột.
- **🙈 Outside thay xoá**, **chỉ thêm keyframe** (bỏ decimate/resample), **snapshot trong bộ nhớ** (10 bản), Limits gộp vào tab **Cài đặt**.

---

## Mục lục

0. [Bắt đầu nhanh](#0-bắt-đầu-nhanh)
1. [Giới thiệu & cài đặt](#1-giới-thiệu--cài-đặt)
2. [Giao diện & điều khiển](#2-giao-diện--điều-khiển)
3. [Khái niệm nền](#3-khái-niệm-nền)
4. [Tab Object](#4-tab-object)
5. [Tab Ground](#5-tab-ground)
6. [Tab Track](#6-tab-track)
7. [Tab QA](#7-tab-qa)
8. [Tab Cài đặt](#8-tab-cài-đặt)
9. [Quy trình làm việc](#9-quy-trình-làm-việc)
10. [An toàn dữ liệu & quy định](#10-an-toàn-dữ-liệu--quy-định)
11. [Troubleshooting](#11-troubleshooting)
12. [Giới hạn & roadmap](#12-giới-hạn--roadmap)
13. [Phụ lục: cơ chế & công thức](#13-phụ-lục-cơ-chế--công-thức)
14. [Lịch sử phiên bản](#14-lịch-sử-phiên-bản)
15. [Bảng tra nhanh](#15-bảng-tra-nhanh)

---

## 0. Bắt đầu nhanh

1. Mở job 3D → rê chuột vào mép phải hoặc nhấn **Alt+Q** để mở panel **CVAT Toolbox**; ghim bằng **📌** nếu muốn giữ mở.
2. Tab **Object** → bấm **🎯 Auto** để lấy object đang chọn (điền ID, LWH, dải frame hiện tại, đo hướng).
3. Kéo một box áng chừng quanh xe → **🧲 Smart Snap (Alt+S)**; bật **Fit size** nếu muốn tool tính lại cả L/W/H.
4. Tab **Ground** → nếu đường dốc: **📐 Plane từ cloud** → chọn *Nghiêng theo dốc*; nếu đường phẳng: nhập Z hoặc **📊 Z box khác**.
5. Nếu cần sửa cả track: **🔍 Tự lấy dải frame** rồi chọn phạm vi phù hợp.
6. Tab **Track** → xem **🧭 Góc đầu** / **🚗 Hướng đi**; nếu lệch, dùng **🎯 Nắn theo hướng đi** hoặc **☁️ Nắn theo Cloud**.
7. Lần đầu dùng: tab **Cài đặt** → kiểm tra ngưỡng LWH của class (đặc biệt `vehicle`).
8. **Ctrl+S** để lưu lên server.

---

## 1. Giới thiệu & cài đặt

### 1.1. Tool làm gì

- Sửa **LWH** cho cuboid, giữ mặt đáy, áp cho dải frame / toàn track / từng frame.
- **Smart Snap**: hút box theo cụm điểm LiDAR (vị trí + yaw + tùy chọn cả LWH + đáy chạm đất).
- **Chọn nhiều box** (Shift+Click) và thao tác nhóm: snap, hạ chạm đất, dịch, đặt outside.
- **Thao tác kiểu Blender** trên canvas: **G / R / S**, khoá trục **X / Y / Z**, nhập số chính xác, Ctrl bắt bước.
- **Camera preset** kiểu Blender: Focus / Top / Front / Side bằng phím hoặc nút.
- **Mặt đất**: mặt phẳng ngang theo Z, hoặc **mặt phẳng dốc** `Z = aX + bY + c` fit từ point cloud; fit đáy, đặt phẳng, hoặc nghiêng thân theo dốc.
- **Hướng**: đo góc đầu vs hướng di chuyển, nắn theo hướng đi / theo cloud, đồng bộ yaw toàn track, sửa frame lệch góc.
- **Track**: dịch, xoay tự do hoặc 180/±90°, smooth vị trí, cắt phần track quá xa bằng outside.
- **QA**: 5 bộ kiểm tra (scale lệch, đổi hướng đột ngột, chồng lấn BEV, quá xa gốc, ngoài limits), lọc kết quả, nhảy tới lỗi bằng 1 click.
- **Auto-fix có xem trước**: đề xuất sửa theo từng track, tick chọn mục muốn áp dụng; mục không tự sửa được liệt kê riêng để xử lý tay.
- **Clamp limits** theo class, check/clamp toàn bộ class.
- **Snapshot** undo riêng cho thao tác hàng loạt.

### 1.2. Yêu cầu

- Tampermonkey / Violentmonkey / Userscripts (Safari).
- Job CVAT **3D** (point cloud), object là cuboid 3D. Job 2D sẽ không có cuboid/point cloud để tool đọc.
- Trình duyệt cho phép `localStorage`.
- Chrome/Edge mới là tốt nhất; Firefox cũng chạy được (kiểm tra lại phím tắt/Numpad theo layout).

### 1.3. Cài đặt / cập nhật / gỡ

**Cài lần đầu**

1. Mở dashboard userscript → **Create new script**.
2. Dán toàn bộ `cvat-cuboid-quicktool.user.js`.
3. Lưu → mở trang job. Console phải có dòng `[CVAT-Toolbox] Khởi động v3.1.0`.
4. Panel chỉ xuất hiện ở URL dạng `/jobs/<số>`; ở trang project/task sẽ không có panel dù script vẫn được nạp.

Script khai báo sẵn `@match` cho `app.cvat.ai`, `localhost:8080`, `127.0.0.1:8080`, `localhost:*`, `127.0.0.1:*`, cộng `@include *://*/jobs/*` và `@include *://*cvat*/*`. Nếu CVAT của bạn ở domain khác, thêm một dòng `@match` phù hợp (xem README).

**Cập nhật**

1. Thay **toàn bộ** nội dung script cũ bằng file mới.
2. `Ctrl+Shift+R` (hard reload) trang CVAT.
3. **Tắt/gỡ bản cũ** nếu còn — hai bản dùng chung `#cvat-quicktool-wrapper` sẽ tranh nhau.

**Gỡ**

- Xoá script trong dashboard userscript.
- (Tuỳ chọn) xoá dữ liệu localStorage — xem 1.4.

### 1.4. Dữ liệu lưu ở đâu

| Key | Nội dung |
|---|---|
| `cqt_presets_v2` | Preset LWH theo label |
| `cqt_limits_v3` | Ngưỡng LWH theo class (tự seed mặc định lần đầu) |
| `cqt_qa_options_v3` | Checkbox + ngưỡng QA |
| `cqt_settings_v1` | `blenderKeys`, `bounceRefresh` |
| `cqt_clipboard_v2` | Transform đã copy |
| `cqt_panel_top_v2` | Vị trí dọc của panel |

**Snapshot không nằm trong localStorage** — chỉ giữ trong bộ nhớ trang, tối đa **10 bản**, mất khi reload.

Tất cả dữ liệu trên đều thuộc **trình duyệt**, không đồng bộ giữa các máy.

### 1.5. Khác biệt so với bản 2.x (đọc trước khi nâng cấp)

| Hạng mục | Bản 2.x | Bản 3.1.0 |
|---|---|---|
| Tab | Object · Ground · Track · QA · **Limits** | Object · Ground · Track · QA · **Cài đặt** (Limits gộp vào đây) |
| Xoá object | **🗑️ Xoá chọn** | **🙈 Outside** — quy định dự án không xoá object |
| Keyframe | Bật/gỡ, gỡ hàng loạt, decimate, resample | **Chỉ thêm** (`⭐ Đặt keyframe`); không có gỡ/decimate/resample |
| Scale LWH | Nút **Scale (×)** | **S** trên canvas (Blender) |
| Copy size từ ID | Có | Không còn — dùng preset hoặc Copy/Paste transform |
| Occupancy, Fit box beta | Có | Đã bỏ — thay bằng **Smart Snap** và **Nắn theo Cloud** |
| Mặt đất | Chỉ Z phẳng | Thêm **mặt phẳng dốc** + nghiêng thân theo dốc |
| QA | 6–7 loại, auto-fix chạy ngay | 5 bộ kiểm tra mới + **xem trước** trước khi sửa |
| Snapshot | 6 bản trong localStorage, 2000 mục | **10 bản trong bộ nhớ**, mất khi reload |
| Làm mới canvas | Chuyển frame (nháy frame) | Mặc định refresh qua Redux store (không nháy); bounce là tuỳ chọn dự phòng |
| LWH dải | "Chỉ keyframe" mặc định tắt | Mặc định **bật** |
| Limits key | `cqt_limits_v2` | `cqt_limits_v3` → **limits cũ bị bỏ qua, về mặc định** |

> Khi nâng cấp: nhập lại limits nếu bài của bạn khác mặc định; preset / clipboard / vị trí panel vẫn giữ nguyên. Dữ liệu `cqt_snapshots_v2` cũ không còn dùng, có thể xoá.

---

## 2. Giao diện & điều khiển

### 2.1. Panel

- Panel nằm ở **mép phải**, dạng flyout: rê chuột vào để mở, rời ra tự đóng sau ~0,35 s.
- **Handle `◀ TOOLBOX`**: bấm để ghim / bỏ ghim. **📌** cũng là ghim; **✕** để thu gọn.
- **Header** hiển thị `📦 CVAT Toolbox` + badge phiên bản. Kéo header để di chuyển **theo chiều dọc**; vị trí được nhớ trong `cqt_panel_top_v2`.
- **Thanh Camera** ngay dưới header: 🎯 Focus · 🔝 Top · 🚗 Front · ↔️ Side.
- **5 tab**: Object · Ground · Track · QA · Cài đặt.
- **Status bar** ở đáy panel: thông báo thao tác gần nhất (xanh = thành công, vàng = cảnh báo, đỏ = lỗi).
- **Log** ở tab QA: 60 dòng thao tác gần nhất kèm giờ.
- Panel cao tối đa 88% màn hình; phần body tự cuộn.

### 2.2. Camera

| Nút | Tác dụng |
|---|---|
| **🎯 Focus** | Bay tới object đang target, giữ hướng nhìn hiện tại. Cần object ở frame hiện tại. |
| **🔝 Top** | Nhìn từ trên xuống theo trục đứng của box. |
| **🚗 Front** | Nhìn từ phía mũi box (theo trục dọc thân). |
| **↔️ Side** | Nhìn từ sườn trái box. |

- Khoảng cách camera = `max(2,5 × max(L,W,H), 6 m)`.
- Khi bấm nút, không có phím "phía đối diện"; nhưng **Ctrl + Numpad 1/3/7** cho phía đối diện.
- Nếu chưa chọn object: Top/Front/Side vẫn quay quanh tâm nhìn hiện tại; Focus báo lỗi.

### 2.3. Phím tắt

**Toàn cục**

| Phím | Tác dụng | Ghi chú |
|---|---|---|
| **Alt+Q** | Ghim / bỏ ghim panel | Vẫn hoạt động khi đang gõ trong ô nhập |
| **Alt+S** | Smart Snap cho **danh sách chọn** (nếu có), ngược lại cho target | Các phím Alt khác bị bỏ qua khi đang gõ |
| **Alt+G** | Hạ chạm đất (ground snap) cho danh sách chọn / target tại frame hiện tại | Dùng chế độ *Cách đặt* đang chọn ở tab Ground |
| **Alt+F** | Focus camera | |
| **Alt+7 / Alt+1 / Alt+3** | Top / Front / Side | Một số layout bàn phím có thể nuốt Alt+số |

**Trên canvas 3D** (chỉ khi bật *Phím kiểu Blender*, con trỏ đang nằm trên canvas)

| Phím | Tác dụng |
|---|---|
| **G / R / S** | Di chuyển / Xoay / Co giãn box (hoặc cả nhóm đang chọn) theo chuột |
| **X / Y / Z** | Khoá trục. Với **X/Y** (G/R): bấm lần 2 = trục local, lần 3 = bỏ khoá. Với **Z**: bấm lần 2 = bỏ khoá. Với **S**: X/Y/Z tương ứng L/W/H và bấm lại để bỏ |
| **0–9 , . - Backspace** | Nhập giá trị chính xác (m, độ, hệ số); dấu `-` đổi dấu |
| **Ctrl** (trong lúc kéo) | Bắt bước: 0,1 m · 5° · 0,05 |
| **Enter / chuột trái** | Xác nhận |
| **Esc / chuột phải** | Huỷ |
| **Numpad 7 / 1 / 3** | Top / Front / Side |
| **Ctrl + Numpad 7 / 1 / 3** | Phía đối diện |
| **Numpad .** | Focus |

> Phím Blender chỉ bắt khi `blenderKeys` bật (mặc định bật) và **không** đang gõ trong ô nhập. Riêng Alt+Q luôn bắt.

### 2.4. Chọn nhiều box

- Giữ **Shift + Click** vào box trên canvas **hoặc** dòng object ở sidebar bên phải để thêm/bớt.
- Mỗi box được chọn hiện thành **chip `#ID ✕`** trong thẻ *🎯 Chọn nhiều box*; bấm chip để bỏ.
- **Tất cả trong frame**: thêm mọi cuboid (trừ outside) ở frame hiện tại vào danh sách; **không xoá** lựa chọn cũ.
- **Bỏ chọn**: xoá toàn bộ danh sách.
- Danh sách chọn **không** được lưu qua reload.
- Click trong panel hoặc modal không tính là chọn box.
- Cơ chế đọc object active trễ ~150 ms sau click, nên đừng click quá nhanh liên tiếp.

Khi có danh sách chọn:

- **Alt+S / Alt+G / nút trong thẻ chọn nhiều** áp cho cả danh sách.
- **G/R/S** áp cho cả nhóm **nếu object đang active nằm trong danh sách**; nếu active nằm ngoài danh sách, chỉ active bị tác động.
- Nút **🧲 Smart Snap** ở đầu tab Object **không** dùng danh sách — nó luôn chỉ áp cho object target/active. Muốn snap cả nhóm, dùng nút **🧲 Snap** trong thẻ chọn nhiều hoặc **Alt+S**.

### 2.5. Thao tác Blender G / R / S

Đây là cách sửa nhanh nhất mà không cần nhập số:

1. Chọn 1 hoặc nhiều box (Shift+Click).
2. Rê chuột lên canvas 3D.
3. Bấm **G** (di chuyển), **R** (xoay), **S** (co giãn).
4. Di chuột để xem trước; box trên canvas cập nhật trực tiếp, kèm HUD ở giữa trên canvas.
5. **Enter** hoặc chuột trái để xác nhận; **Esc** hoặc chuột phải để huỷ.

Chi tiết:

- **G**: mặc định di chuyển trên mặt ngang (chiếu theo mặt phẳng qua tâm nhóm). Khoá **Z** để di chuyển theo phương đứng. Khoá **X/Y** để chỉ đi theo trục; bấm lần 2 để dùng trục local của box (theo hướng thân xe). Gõ số khi chưa khoá trục → dịch theo **trục dọc thân (local X)** đúng số mét đã gõ.
- **R**: khoá **Z** xoay quanh trục đứng (yaw) quanh tâm nhóm; **X/Y** xoay roll/pitch (góc tính theo độ dời chuột ngang, 0,5°/px). Gõ số → xoay đúng số độ. Với nhóm nhiều box, yaw quay cả vị trí các box quanh tâm nhóm.
- **S**: co giãn kích thước tại chỗ, **giữ mặt đáy**, không đổi tâm XY. Khoá **X/Y/Z** để chỉ đổi L/W/H tương ứng. Hệ số tối thiểu 0,05.
- **Ctrl** khi kéo (không gõ số) bắt bước như bảng phím tắt.
- Tâm nhóm (pivot) = trung bình tâm các box tham gia; mọi phép chiếu chuột dùng tâm này.
- Box **outside** hoặc **đang khoá (lock)** bị bỏ qua; nếu tất cả bị bỏ qua, status báo lỗi/cảnh báo.
- Nếu box không có mesh hiển thị, tool vẫn áp dụng khi xác nhận nhưng không xem trước được (HUD ghi chú).
- Thao tác chỉ áp cho **frame hiện tại**; có snapshot sau khi xác nhận.

### 2.6. Trạng thái, log & làm mới canvas

- Status chỉ giữ thao tác gần nhất; chi tiết hơn xem **QA → Log**.
- Thao tác hàng loạt hiện tiến độ `⏳ ... frame x/y...`; một số thao tác nghỉ `sleep(0)` để UI kịp vẽ.
- Sau khi sửa, tool làm mới canvas bằng cách dispatch lại action `FETCH_ANNOTATIONS_SUCCESS` (giống undo/redo của CVAT) — **không nháy frame**.
- Nếu cách đó thất bại, hoặc bạn bật *Làm mới canvas bằng chuyển frame* trong Cài đặt, tool sẽ nhích sang frame bên rồi quay lại (chậm, frame chớp nhẹ). Status có thể ghi `⚠️ Canvas chưa làm mới, hãy chuyển frame.`

### 2.7. Object ID và frame hiện tại

- **Target Object ID** nhận **clientID hoặc serverID**; để trống thì dùng object đang chọn trên canvas.
- Dòng **Frame hiện tại** cập nhật mỗi giây từ store; nếu hiện `?`, tool chưa đọc được — click vào canvas rồi thử lại.
- Đa số thao tác yêu cầu object **có mặt tại frame hiện tại**; nếu không, status báo `Không thấy cuboid #ID ở frame X.` — hãy chuyển tới frame có object (dùng QA hoặc 🔍 Tự lấy dải frame).

---

## 3. Khái niệm nền

### 3.1. Track và shape

- **Shape**: cuboid chỉ tồn tại ở một frame.
- **Track**: cuboid tồn tại qua nhiều frame, có **keyframe** và các frame **nội suy** ở giữa.

Phần lớn thao tác hàng loạt áp dụng cho track; shape chỉ bị tác động bởi các thao tác theo frame hiện tại.

### 3.2. Keyframe và frame nội suy

- **Keyframe** (★): frame có dữ liệu thật do người dùng đặt.
- **Frame nội suy**: CVAT tự tính giữa hai keyframe.
- Sửa points ở frame **không phải keyframe** sẽ khiến CVAT **tạo keyframe** tại frame đó.
- Nếu mọi keyframe của track có cùng LWH, mọi frame nội suy cũng có đúng LWH đó.

### 3.3. Dữ liệu cuboid trong CVAT 3D

```
points = [x, y, z, rx, ry, rz, L, W, H]
```

- `(x, y, z)`: tâm hộp, mét.
- `(rx, ry, rz)`: góc Euler **XYZ**, **radian** (CVAT chỉ đổi sang độ khi hiển thị).
- `L, W, H`: kích thước đầy đủ theo trục local X, Y, Z.
- `z` là trục đứng; `rz` là yaw (view TOP), `rx` là pitch (FRONT), `ry` là roll (SIDE).

Tool tính mặt đáy bằng **điểm thấp nhất trong 8 góc** của hộp, đúng cả khi hộp nghiêng.

### 3.4. Mặt đất trong tool

Tool chỉ giữ **một mặt phẳng đất** tại một thời điểm:

```
Z = a·X + b·Y + c
```

- Mặt phẳng ngang: `a = b = 0`, `c = Z`.
- Mặt phẳng dốc: `a`, `b` khác 0, fit từ point cloud quanh object.

Mặt phẳng này dùng cho **kiểm tra đáy** và **Fit mặt đất**. Smart Snap và Alt+G tự tính mặt đất cục bộ quanh từng object, không phụ thuộc mặt phẳng đang lưu.

### 3.5. Limits (ngưỡng LWH theo class)

Mỗi class có 3 khoảng `[min, max]` cho L, W, H. Khi clamp, mỗi chiều kẹp **độc lập**:

- `min ≤ v ≤ max` → giữ nguyên.
- `v < min` → min.
- `v > max` → max.

Không scale đồng thời. Tên class được chuẩn hoá khi so khớp (xem 8.6).

### 3.6. Đồng bộ và tách riêng

| Chế độ | Cách làm | Khi nào dùng |
|---|---|---|
| **Đồng bộ chung** | **🔗 Toàn track** hoặc **⚡ Clamp class** | Muốn cả track cùng một LWH |
| **Tách riêng** | **✂️ Chỉ frame này** tại từng frame | Mỗi frame cần LWH khác nhau |

Có thể đồng bộ trước rồi tinh chỉnh vài frame.

### 3.7. Quy định dự án: chỉ thêm keyframe, không xoá object

Đây là ràng buộc của bài gán nhãn, được tool thực thi:

- **Không xoá cuboid** trong tool. Object rác hoặc đi ra khỏi khung → dùng **🙈 Outside**.
- **Không gỡ keyframe** trong tool; `⭐ Đặt keyframe` chỉ đặt thêm. Vì vậy không còn decimate/resample.
- Khi restore snapshot, tool khôi phục giá trị cũ nhưng **không** bỏ cờ keyframe (frame vốn nội suy sẽ thành keyframe nhưng về đúng dữ liệu cũ).
- Nếu thật sự cần gỡ keyframe/xoá object, dùng trực tiếp CVAT và hiểu rõ hậu quả.

### 3.8. Snapshot

- Trước mỗi thao tác hàng loạt, tool tự lưu snapshot các state bị sửa.
- Giữ **10 bản gần nhất** (toàn bộ các job trong phiên trang), lọc theo job hiện tại khi hiển thị.
- Snapshot **chỉ trong bộ nhớ**: reload trang là mất.
- Restore khôi phục `points`, `outside`, `occluded`; **không** khôi phục cờ keyframe.
- Snapshot là undo riêng của tool, **không thay thế** undo của CVAT. Mỗi lần lưu cũng sinh một bước trong lịch sử CVAT (Ctrl+Z), nhưng thao tác hàng loạt có thể cần rất nhiều lần Ctrl+Z — snapshot tiện hơn.

### 3.9. Đơn vị

- Độ dài: mét (m).
- Góc trong dữ liệu: radian; trong UI: độ (°).
- HUD của G/R/S hiển thị mét, độ, hệ số tương ứng.

---

## 4. Tab Object

### 4.1. Target

- **Target Object ID**: nhập tay clientID/serverID, hoặc để trống để dùng object đang chọn.
- **🎯 Auto**:
  - Điền ID object đang chọn.
  - Đặt Start = End = frame hiện tại, Số frame = 1.
  - Nạp LWH vào ô nhập và đo hướng (góc đầu, hướng đi, độ lệch).
  - Chọn preset & class limits tương ứng label nếu có.
  - Nếu chưa chọn object / chưa đọc được frame → báo lỗi.

### 4.2. Smart Snap

**Nút `🧲 Smart Snap (Alt+S)`** + checkbox **Fit size**.

Cách dùng:

1. Vẽ/kéo một box áng chừng quanh xe (box không cần khít).
2. Bấm nút (áp cho target) hoặc **Alt+S** (áp cho danh sách chọn nếu có).
3. Xem kết quả; nếu chưa ưng, undo/snapshot và thử lại với box to hơn.

Cơ chế:

- Quét point cloud trong hộp mở rộng **+0,3 m** quanh box.
- Loại điểm mặt đường (cao hơn mặt phẳng đất cục bộ **0,15 m**); nếu không fit được mặt phẳng, dùng phân vị 2% + 0,15 m.
- Cần **≥ 10 điểm** sau lọc, nếu không báo `Chỉ có N điểm trong vùng box (cần ≥ 10).`
- Chạy **PCA 2D** tìm trục dài; yaw được chọn trong 4 hướng `yaw + k·90°` gần góc hiện tại nhất (giữ đầu xe; box chỉ cần lệch < 45°).
- Bao khít theo **phân vị 2% – 98%** trên trục dọc/ngang; chiều cao theo phân vị 99%.
- **Fit size bật**: tính lại L, W, H (min 0,2 m cho L/W, 0,3 m cho H), đáy chạm mặt đất.
- **Fit size tắt**: giữ nguyên LWH; box được đẩy để **mặt gần cảm biến** khớp với cụm điểm (nếu cụm rộng hơn box thì lấy tâm cụm).
- Luôn đặt **rx = ry = 0**, yaw theo PCA, đáy chạm mặt phẳng đất cục bộ.
- Lặp tối đa **4 lượt**, dừng khi yaw đổi < 0,2° và tâm dịch < 1 cm.
- Chỉ áp cho **frame hiện tại**, bỏ qua box outside; có snapshot.
- Nếu nhiều box, mỗi box xử lý riêng; box lỗi được liệt kê trong status, các box còn lại vẫn snap.

> Smart Snap cần point cloud. Job không có PCD hoặc PCD chưa render sẽ báo `Không đọc được point cloud.`

### 4.3. Thẻ chọn nhiều box & thao tác nhóm

Thẻ **🎯 Chọn nhiều box (N)** gồm:

| Thành phần | Tác dụng |
|---|---|
| **Tất cả trong frame** | Thêm mọi cuboid không outside ở frame hiện tại |
| **🧲 Snap** | Smart Snap cho từng box đã chọn |
| **⬇️ Chạm đất** | Hạ đáy từng box chạm mặt đất cục bộ (theo *Cách đặt* ở tab Ground) |
| **🙈 Outside** | Đặt outside cho các track đã chọn **từ frame hiện tại** |
| **dX / dY / dZ + ↔️ Dịch** | Dịch các box đã chọn tại frame hiện tại |

Ghi chú:

- **Outside** chỉ áp cho track; shape không có thuộc tính outside nên bị bỏ qua (status báo số shape bị bỏ qua). Có confirm + snapshot.
- **Dịch** bỏ qua box outside và box đang khoá.
- **Chạm đất** dùng mặt phẳng cục bộ quanh từng box; nếu không đủ điểm cloud thì dùng mặt phẳng đang lưu ở tab Ground; nếu cả hai đều không có → báo lỗi.
- Muốn thao tác nhóm bằng chuột, dùng **G/R/S** (xem 2.5) — chúng áp cho cả nhóm khi object active nằm trong danh sách.

### 4.4. Dải frame

| Thành phần | Tác dụng |
|---|---|
| **Start Frame / End Frame** | Dải áp dụng cho các thao tác hàng loạt |
| **Số frame** | `End = Start + count − 1`; tự cắt tại frame cuối job nếu vượt |
| **Frame hiện tại** | Frame tool đang đọc từ CVAT |
| **🔍 Tự lấy dải frame** | Dò toàn job, tìm frame đầu/cuối object tồn tại, điền Start/End/count |

Chi tiết:

- Đổi **Số frame** → tính lại End ngay.
- Đổi **Start** → nếu ô Số frame hợp lệ (≥1) thì cũng tính lại End, **ghi đè** End bạn vừa nhập tay.
- `Tự lấy dải` bỏ qua các frame `outside`; `count` = `End − Start + 1` (có thể lớn hơn số frame thực tế có object nếu track có khoảng trống). Status báo số frame thật có object.
- Đa số thao tác theo dải **bỏ qua frame outside** và frame không có object.
- `Tự lấy dải` không tự chạy khi bấm Auto — Auto chỉ đặt dải 1 frame tại frame hiện tại.

### 4.5. Kích thước LWH

- **Lấy size**: đọc LWH từ object tại frame hiện tại, đo lại hướng, cảnh báo nếu ngoài limits.
- **Giữ đáy** (mặc định bật): khi đổi H, giữ nguyên cao độ mặt đáy; đúng cả khi box nghiêng.
- **Chỉ keyframe** (mặc định bật): nút **Áp dụng LWH cho dải** chỉ sửa keyframe; frame nội suy tự theo.

### 4.6. Ba cách áp dụng LWH

| Nút | Phạm vi | Đặc điểm |
|---|---|---|
| **📐 Áp dụng LWH cho dải Start–End** | Start–End | Sửa theo checkbox *Chỉ keyframe* (mặc định chỉ keyframe; tắt = sửa mọi frame, tạo keyframe mới) |
| **🔗 Toàn track** | Mọi keyframe của object (tự dò dải) | Không tạo keyframe mới; frame nội suy tự theo |
| **✂️ Chỉ frame này** | Đúng frame hiện tại | Tạo keyframe nếu cần; không đụng frame khác |

- Cả 3 đều tự kẹp limits nếu **Tự kẹp khi Áp dụng LWH** (tab Cài đặt) đang bật và label của object có limits.
- Tool bỏ qua frame không có object, frame outside, và frame đã đúng LWH (không tạo thao tác thừa).
- Nếu object không có mặt ở frame hiện tại khi bấm Áp dụng, tool **không lấy được label** → có thể không kẹp limits dù checkbox bật.

**Ví dụ**

- Object `vehicle` đang `4,2 × 1,8 × 1,7`, limits mặc định L 3,2–5,5, W 1,6–2,2, H 1,5–1,9.
- Nhập `L=6, W=2.0, H=1.8` → **Áp dụng** hoặc **Toàn track** → kết quả `5,5 × 2,0 × 1,8` (L bị kẹp).
- Muốn frame 5 khác: đứng ở frame 5, nhập LWH → **✂️ Chỉ frame này**.

> LWH lấy từ các ô nhập. Nếu vừa kéo tay trên canvas, bấm **Lấy size** trước.

### 4.7. Preset theo label

- Nhập LWH → **💾 Lưu preset** → gắn với label của object **tại frame hiện tại**.
- Chọn preset → **Dùng** để điền vào ô LWH (chưa áp dụng).
- **Xoá preset** để bỏ.
- Preset so khớp label **phân biệt hoa thường** (theo đúng chuỗi label); lưu theo trình duyệt, không chia sẻ giữa máy.
- **🎯 Auto** tự chọn preset nếu label đã có.

### 4.8. Copy / Paste transform

- **📋 Copy transform**: lưu toàn bộ `(x,y,z,rx,ry,rz,L,W,H)` + label vào `cqt_clipboard_v2`.
- **📥 Paste**: dán vào object target tại **frame hiện tại** (kể cả LWH và góc); có snapshot.
- Clipboard tồn tại qua reload (localStorage).

### 4.9. Keyframe

- **⭐ Đặt keyframe**: đặt keyframe tại frame hiện tại nếu chưa có.
  - Chỉ áp cho track; shape báo lỗi.
  - Đã là keyframe → status thông báo, không đổi gì.
- Không có nút gỡ keyframe, không decimate/resample (quy định dự án — xem 3.7).

---

## 5. Tab Ground

### 5.1. Ground Z / mặt phẳng đất là gì?

CVAT **không có khái niệm mặt đất**. `z = 0` chỉ là gốc toạ độ, không đảm bảo trùng mặt đường của PCD.

Nếu nhập sai Z, box sẽ lún hoặc bay đúng bằng khoảng chênh đó. Vì vậy hãy lấy Z/mặt phẳng từ dữ liệu trước khi fit.

### 5.2. Bốn cách xác định mặt đất

| Nút | Cách hoạt động | Khi nào dùng |
|---|---|---|
| **📐 Plane từ cloud** | Fit mặt phẳng dốc `Z = aX + bY + c` từ vành khuyên quanh footprint của object đang chọn | Tốt nhất khi có PCD, đặc biệt đường dốc |
| **📊 Z box khác** | Trung vị đáy của **≥ 2** cuboid khác ở frame hiện tại | Khi không đọc được cloud |
| **📌 Z từ box này** | Lấy đáy của object đang chọn (mặt phẳng ngang) | Khi object này đã đúng |
| **Nhập Z mặt đất** | Gõ tay, tạo mặt phẳng ngang khi rời ô | Khi đã biết cao độ chính xác |

Thẻ hiển thị phía trên cho biết mặt phẳng hiện tại:

- Mặt ngang: `Mặt phẳng ngang Z = -1.700m — nguồn`.
- Mặt dốc: `Plane dốc 2.3°: Z = +0.0042·X -0.0011·Y -1.702 (Z tại box ≈ -1.698m, 812 điểm) — nguồn`.

**Plane từ cloud** lấy mẫu:

- Vành khuyên quanh footprint: từ `footprint + 0,3 m` tới bán kính `0,5·√(L²+W²) + 4,5 m`, xoay theo yaw của box.
- Cần ≥ 15 điểm trong vành khuyên.
- Lấy các điểm thấp hơn `phân vị 35% + 0,15 m`.
- Fit bình phương tối thiểu, lặp 3 lần loại outlier `|dz| > 0,12 m`, cần ≥ 10 điểm còn lại.
- Báo số điểm và độ dốc; **không** tự áp — bạn phải bấm **Fit mặt đất**.

Nếu chưa có mặt phẳng mà bấm **Kiểm tra đáy** / **Fit mặt đất**, tool tự chạy Plane từ cloud cho target; nếu không được sẽ báo lỗi.

### 5.3. Cách đặt (mode)

| Mode | Tác dụng |
|---|---|
| **Snap đáy (giữ nghiêng)** | Tịnh tiến box để điểm thấp nhất trong 8 góc chạm mặt phẳng; giữ nguyên rx/ry/rz |
| **Đặt phẳng (rx=ry=0)** | Bỏ pitch/roll, giữ yaw; mặt đáy phẳng nằm trên mặt phẳng |
| **Nghiêng theo dốc** | Tính rx, ry để trục Z của box vuông góc mặt phẳng; thân xe nghiêng theo dốc, yaw giữ nguyên |

### 5.4. Phạm vi & hướng

**Phạm vi** (`Fit mặt đất`)

- **Keyframe trong dải** (mặc định): nhẹ, giữ nội suy.
- **Mọi frame (bake)**: chính xác từng frame nhưng tạo keyframe ở mọi frame.
- **Frame hiện tại**: chỉ sửa frame đang xem.

**Hướng** (chỉ xét độ dời Z)

- **Cả hai**: sửa cả box lún và bay.
- **Chỉ hạ**: chỉ sửa box đang lún (`dz < 0`).
- **Chỉ nâng**: chỉ sửa box đang bay (`dz > 0`).

> Nếu mode *Nghiêng theo dốc* chỉ đổi góc mà `dz ≈ 0`, hướng không chặn thao tác (vì không có dời Z).

### 5.5. Kiểm tra & Fit

- **📏 Kiểm tra đáy**: quét các frame có object trong phạm vi (trừ khi chọn *Frame hiện tại* — khi đó chỉ đo frame này; **không** lọc keyframe), báo:
  - `min/max` độ lệch đáy so với mặt phẳng (m),
  - số frame lún (< −1 cm) và lơ lửng (> +1 cm).
- **⬇️ Fit mặt đất**: áp dụng cho phạm vi/hướng/mode đang chọn; báo số frame đã sửa, khoảng `dz`, số frame bị bỏ qua do hướng.
  - Không có keyframe trong dải và đang chọn *Keyframe* → status gợi ý chọn *Mọi frame*.
  - Không frame nào cần đổi → status thông báo, không tạo snapshot rỗng.

> Fit chỉ tác động frame có object và **không outside**. Frame ngoài dải hoặc outside có thể vẫn lệch — kiểm tra lại.

### 5.6. Alt+G — hạ chạm đất nhanh

- Áp cho danh sách chọn (nếu có), ngược lại target, tại **frame hiện tại**.
- Với **từng object**, tool tự tính mặt phẳng đất cục bộ từ cloud quanh box đó; nếu không được thì dùng mặt phẳng đang lưu.
- Dùng **Cách đặt** đang chọn ở tab Ground (snap / phẳng / nghiêng theo dốc).
- Chỉ sửa frame hiện tại; có snapshot; báo số object đã hạ.
- Nếu **không object nào** hạ được (không đủ điểm cloud, không có mặt phẳng lưu) → báo `Không đủ điểm cloud để tìm mặt đất.`; nếu chỉ một phần lỗi, status chỉ báo số object đã hạ.

### 5.7. Quy trình ground chuẩn

1. Đứng ở frame đại diện (xe nằm rõ trên mặt đường).
2. **📐 Plane từ cloud** (hoặc **📊 Z box khác** / nhập Z).
3. **📏 Kiểm tra đáy** xem lệch bao nhiêu.
4. Chọn mode / phạm vi / hướng.
5. **⬇️ Fit mặt đất**.
6. Kiểm tra lại vài frame; `Ctrl+S`.

**Lưu ý đường dốc/cong**

- Mặt phẳng được fit từ cloud của **một frame**; áp cho đoạn dài trên đường cong sẽ lệch dần.
- Với đường dốc đều: dùng *Nghiêng theo dốc* + *Keyframe trong dải*.
- Với đường cong/đổi dốc: chia đoạn, fit lại từng đoạn, hoặc dùng **Alt+G / Chạm đất** tại từng frame (mỗi object tự lấy mặt đất cục bộ).
- Sau khi fit, **📏 Kiểm tra đáy** lại để phát hiện đoạn còn lệch.

### 5.8. Đã bỏ

- **Occupancy** (% điểm cloud trong hộp) và **Fit box theo cloud (beta)** không còn trong 3.1. Chức năng tương đương: **Smart Snap** (Object, có *Fit size*) và **Nắn theo Cloud** (Track).

---

## 6. Tab Track

Checkbox **Chỉ sửa keyframe trong dải** (mặc định bật) áp dụng cho **Dịch chuyển**, **Xoay**, **Căn hướng theo hướng đi**.

### 6.1. Dịch chuyển

Nhập `dX`, `dY`, `dZ` → **↔️ Dịch chuyển** trên dải Start–End (theo checkbox keyframe).

### 6.2. Góc đầu & hướng đi

Thẻ **Hướng (yaw)** hiển thị:

- **🧭 Góc đầu**: yaw hiện tại, cả độ và radian.
- **🚗 Hướng đi**: hướng chuyển động ước lượng từ frame trước/kế tiếp; nếu tốc độ < 0,05 m/frame → `Đứng yên`.
- **Độ lệch**:
  - `✅ Khớp hướng đi (lệch …°)` khi ≤ 5°.
  - `⚠️ NGƯỢC ĐẦU! …` khi ≥ 135°.
  - `⚠️ Lệch …°` với các trường hợp còn lại.
- Nếu đứng yên: gợi ý dùng **☁️ Nắn theo Cloud**.

Thẻ được cập nhật khi **🎯 Auto**, **Lấy size**, **Nắn theo hướng đi**, hoặc **Nắn theo Cloud**.

### 6.3. Nắn hướng

| Nút | Phạm vi | Cơ chế |
|---|---|---|
| **🎯 Nắn theo hướng đi** | Frame hiện tại | Xoay yaw = hướng di chuyển (dùng frame ±1). Đứng yên → cảnh báo, không sửa |
| **☁️ Nắn theo Cloud** | Frame hiện tại | PCA trục chính của điểm trong box (+0,15 m); cần ≥ 15 điểm; lật trong mod π để giữ đầu xe |
| **🔗 Đồng bộ góc toàn track** | Toàn track (tự dò dải) | Lấy yaw frame hiện tại, áp cho **mọi keyframe**; frame nội suy tự theo |
| **⚡ Sửa frame lệch góc** | Toàn job, chỉ object target | Quét lỗi đổi hướng, mở **xem trước auto-fix** để lật 180° các frame ngược đầu |

- Các lệnh nắn hướng đều có snapshot.
- **Nắn theo Cloud** yêu cầu point cloud và box hiện tại có object.
- **Sửa frame lệch góc** dùng ngưỡng **Đổi hướng đột ngột** ở tab QA; các mục tự sửa được mặc định tick sẵn trong modal.

### 6.4. Xoay

- Nhập **Góc xoay (°)** (mặc định 180) → **🔄 Xoay**.
- Nút nhanh: **180°**, **+90°**, **−90°**.
- Cộng góc vào `rz`, chuẩn hoá về `[−π, π]`; áp theo checkbox keyframe.

### 6.5. Căn hướng theo hướng đi (cả dải)

- Tính hướng chuyển động tại từng frame từ frame trước/kế tiếp (kể cả ±1 frame ngoài dải để có hướng).
- Bỏ qua frame đứng yên (< 0,05 m/frame); status báo số frame bị bỏ qua.
- Áp theo checkbox keyframe; có snapshot.

### 6.6. Cắt phần track quá xa

- Dùng ngưỡng **Quá xa** ở tab QA (mặc định 100 m từ gốc toạ độ).
- Quét **toàn job** cho object target, mở **xem trước**:
  - Các đoạn frame xa hơn ngưỡng → đặt **outside** (không xoá).
  - Trước khi đặt outside, tool tự chốt keyframe ở frame ngay sau đoạn xa để phần track còn lại không bị ẩn theo.
  - Shape bị đánh dấu "cần xử lý tay" (không có outside).
- Mục tự sửa mặc định **được tick** trong modal của nút này.

### 6.7. Smooth vị trí

- Trung bình có trọng số `0,25 / 0,5 / 0,25` cho `x, y, z` của các keyframe **ở giữa** dải.
- Giữ keyframe đầu/cuối; cần ≥ 3 keyframe trong dải.
- Không smooth góc, không smooth LWH.
- Có snapshot; bỏ qua nếu thay đổi < 1 µm.

### 6.8. Đã bỏ

- **⚡ Gỡ keyframe trong dải**, **✂️ Decimate**, **➕ Resample** không còn (quy định chỉ thêm keyframe).

---

## 7. Tab QA

### 7.1. Bộ kiểm tra

| Kiểm tra | Ngưỡng mặc định | Mặc định | Ghi chú |
|---|---|---|---|
| **Scale không đồng bộ** | Lệch L/W/H > **0,005 m** so với trung vị của track | BẬT | So từng frame với median của chính track; rất nhạy, có thể tăng ngưỡng |
| **Đổi hướng đột ngột** | Nhảy yaw > **75°** giữa 2 frame liên tiếp | BẬT | Chỉ xét 2 frame sát nhau (frame sau = frame trước + 1) |
| **Chồng lấn (BEV)** | Ped–ped: IoU ≤ **0,5**; cặp khác: không cho phép giao | BẬT | Chỉ xét hình chiếu bằng (bỏ qua chiều cao) |
| **Quá xa** | Khoảng cách 3D tới gốc > **100 m** | BẬT | |
| **Ngoài limits LWH** | Bất kỳ chiều nào ngoài min/max class | BẬT | Dùng limits ở tab Cài đặt |
| **Quét toàn job** | — | BẬT | Bỏ chọn → chỉ quét Start–End |

Tất cả ngưỡng/checkbox được lưu vào `cqt_qa_options_v3` khi thay đổi.

> QA **không** kiểm tra độ lệch đáy, mật độ keyframe, track quá ngắn, hay size so với preset — những mục này đã bị bỏ khỏi QA 3.1. Muốn kiểm tra đáy, dùng **Ground → 📏 Kiểm tra đáy**.

### 7.2. Quét & đọc kết quả

- **🔎 Quét QA**: đọc toàn bộ frame trong dải (hoặc toàn job), bỏ qua object outside, gom track theo clientID.
- Kết quả:

  ```
  🔎 QA 0–499: 42 object, 137 lỗi ở 18 object.
  ```

- Danh sách lỗi:
  - **Lọc theo loại** bằng dropdown (kèm số lượng).
  - Tối đa **400 dòng** hiển thị cho mỗi bộ lọc; phần dư ghi `... +N dòng (xem đầy đủ trong CSV)`.
  - Mỗi dòng: `f<frame> · #<track> <class> · <loại>` + mô tả chi tiết.
  - **Bấm dòng** → nhảy tới frame và activate object.
- Thứ tự: scale → yaw → overlap → quá xa → limits; trong cùng loại: track rồi frame.
- **Item ID** trong CSV lấy từ tên file frame (bỏ đường dẫn và phần mở rộng).

### 7.3. Xem trước auto-fix

Nút **⚡ Xem trước auto-fix**:

- Nếu chưa quét, tool quét QA trước.
- Mở modal gồm 2 nhóm:
  - **Tự sửa được (có checkbox)**: chọn từng mục, có **Chọn tất cả / Bỏ chọn**, nút `⚡ Áp dụng N sửa đã chọn`.
  - **Cần sửa tay (bấm để nhảy tới)**: các trường hợp tool không tự sửa an toàn.

Các đề xuất tự sửa:

1. **Size** (từ lỗi scale và ngoài limits):
   - Lấy **trung vị LWH** của toàn track (mọi frame, không chỉ keyframe).
   - Nếu limits đang bật và class có limits → kẹp median theo limits.
   - Chỉ sửa **keyframe** đang lệch quá 0,1 mm; giữ đáy.
   - Nếu mọi keyframe đã đúng chuẩn → chuyển thành mục **sửa tay**.
2. **Yaw** (từ lỗi đổi hướng):
   - Tính "parity" lật 180° dọc track; xác định hướng đúng bằng **bỏ phiếu theo hướng di chuyển** (nếu đủ mẫu) hoặc **theo đa số frame** (xe đứng yên).
   - Lật 180° các **keyframe** sai.
   - Frame nội suy sai chỉ bị sửa trực tiếp khi **cả hai keyframe kề bên đều đúng** (vì lật keyframe không chữa được nó).
   - Bước nhảy 75–135° (không phải lật đầu) → mục **sửa tay**.
3. **Quá xa**:
   - Đặt **outside** cho các đoạn frame vượt ngưỡng; chốt keyframe ngay sau đoạn để giữ phần track còn lại.
   - **Mặc định không tick** trong modal toàn cục — nên xem lại trước khi áp.
4. **Chồng lấn**: chỉ hiện **mục sửa tay** (kèm IoU max và các frame), vì sửa tự động dễ phá dữ liệu.

Khi áp dụng:

- Thứ tự: **size → yaw → outside** (outside làm cuối vì nó ẩn frame).
- Có snapshot; status báo số đề xuất và số lần sửa.
- Tool **quét lại QA** sau khi sửa và cập nhật danh sách.
- Bạn vẫn cần **Ctrl+S** để lưu lên server.

> Modal này không sửa overlap, không sửa ground, không sửa object không nằm trong danh sách lỗi.

### 7.4. Export CSV

- Nút **📤 CSV** xuất `cvat_qa_job<jobId>_<start>-<end>.csv` (UTF-8 BOM, mở được bằng Excel).
- 9 cột:

  ```
  Frame, Item ID, Track ID, Class, Loại kiểm tra, Mô tả, Giá trị, Ngưỡng / Chuẩn, Track liên quan
  ```

- Xuất **toàn bộ** lỗi (không giới hạn 400 dòng).
- Cần quét QA trước; nếu chưa có dữ liệu sẽ báo lỗi.

### 7.5. Snapshot / Restore

- Dropdown liệt kê snapshot của **job hiện tại**: giờ · nhãn · số mục.
- **Restore** → confirm → khôi phục ngược thứ tự đã sửa.
- Khôi phục: `points`, `outside` (track), `occluded`.
- **Không** bỏ cờ keyframe (theo quy định dự án).
- Best-effort: object đã bị xoá/đổi cấu trúc sẽ bị bỏ qua; status báo số mục khôi phục và số lỗi.
- Snapshot mất khi reload trang.

### 7.6. Log

Hiển thị 60 dòng thao tác gần nhất kèm giờ. Chỉ ghi các thao tác có trạng thái success/error/warn.

---

## 8. Tab Cài đặt

### 8.1. Phím tắt & canvas

| Tuỳ chọn | Mặc định | Tác dụng |
|---|---|---|
| **Phím kiểu Blender trên canvas 3D** | BẬT | Bật G/R/S, X/Y/Z, nhập số, Numpad camera khi con trỏ trên canvas |
| **Làm mới canvas bằng chuyển frame (chậm, dự phòng)** | TẮT | Dùng khi refresh qua store không ăn; sẽ nháy frame |

### 8.2. Ngưỡng mặc định

| Class | L | W | H |
|---|---|---|---|
| `vehicle` | 3,2 – 5,5 | 1,6 – 2,2 | 1,5 – 1,9 |
| `two_wheel` | 1,5 – 2,0 | 0,6 – 0,9 | 1,5 – 1,8 |
| `pedestrian` | 0,65 – 1,0 | 0,65 – 1,0 | 1,2 – 1,9 |

Lần đầu chạy, 3 class này tự được seed vào `cqt_limits_v3`.

> **Lưu ý về `vehicle`:** bản 3.1.0 **vẫn có** limits mặc định cho `vehicle` (5,5 × 2,2 × 1,9 m). Nếu bài của bạn có xe bán tải, xe cứu thương, van 5,76 m, xe tải, xe buýt 10–12 m… hãy **tăng max L** (hoặc xoá class `vehicle`) trong tab này. Nếu không, **Clamp** và **auto-fix size** sẽ kéo các xe dài về 5,5 m. Đây là điểm khác so với ghi chú "đã gỡ limits vehicle" trong tài liệu 2.x — code 3.1.0 chưa gỡ.

### 8.3. Sửa / thêm / xoá limits

1. Chọn class ở dropdown → 6 ô min/max được nạp.
2. Sửa → **💾 Lưu limits**.
3. **Thêm class mới**: nhập tên vào ô *Class mới* rồi Lưu (bỏ trống = lưu cho class đang chọn).
4. **📌**: lấy label của object đang chọn; nếu class đã có limits thì nạp luôn.
5. **Xoá**: xoá class đang chọn (có confirm).
6. **↺ Tiêu chuẩn**: reset cả 3 class về mặc định (có confirm).

Ràng buộc khi lưu: đủ 6 ngưỡng dương, `min ≤ max` từng chiều; nếu sai báo lỗi.

### 8.4. Clamp

- **Tự kẹp khi Áp dụng LWH** (mặc định BẬT): mọi lần Áp dụng / Toàn track / Chỉ frame này đều kẹp theo limits **nếu label có limits và object có mặt tại frame hiện tại**.
- **📏 Clamp class** (mục *Cả class*): kẹp mọi object của class trong phạm vi, giữ mặt đáy.
- **Checkbox Chỉ keyframe** (mặc định BẬT) tránh tạo keyframe ở mọi frame. Bỏ chọn → clamp mọi frame, **có confirm** vì sẽ bake keyframe ở tất cả frame.
- Chỉ chiều vượt ngưỡng bị đổi; object đã đúng không bị chạm.
- Có snapshot cho mỗi lần clamp.

### 8.5. Check / Clamp toàn bộ class

- Chọn class ở dropdown.
- **Quét toàn job** (mặc định BẬT): quét mọi frame của job; bỏ chọn → chỉ Start–End.
- **🔎 Check class** (chỉ đọc), ví dụ:

  ```
  Class "vehicle" (L 3.2–5.5, W 1.6–2.2, H 1.5–1.9): 3/14 object ngoài ngưỡng.
  #4: 12/120 frame — L 6.20 > 5.5
  #7: 8/95 frame — H 1.40 < 1.5
  ```

- **📏 Clamp class** (sửa):
  - Kẹp mọi object của class; giữ mặt đáy từng object.
  - Mặc định chỉ keyframe; bỏ chọn → clamp mọi frame (confirm).
  - Status báo số object + số frame đã sửa.
- Check/Clamp class **bỏ qua object outside** và label không khớp class.

### 8.6. Chuẩn hoá tên class

Tool so khớp label với tên class **không phân biệt hoa thường**, gộp khoảng trắng/gạch thành `_`, và bỏ hậu tố số nhiều:

- `vehicles` → `vehicle`
- `two_wheeler`, `two-wheelers` → `two_wheel`
- `Pedestrians` → `pedestrian`
- `TWO WHEEL` → `two_wheel`

Nhờ vậy label `Pedestrians` vẫn dùng limits `pedestrian`, và `Clamp class` chọn `vehicle` sẽ bao cả label `vehicles`.

### 8.7. Limits và QA / auto-fix

- QA gắn cờ `Ngoài limits` theo class của label.
- Auto-fix size lấy **median track** rồi **kẹp limits** (nếu bật check limits).
- QA/auto-fix **không sửa limits**; muốn sửa dùng Clamp.

### 8.8. Ví dụ clamp (limits mặc định của `vehicle`)

| Trước | Sau |
|---|---|
| 6,0 × 2,5 × 2,2 | 5,5 × 2,2 × 1,9 |
| 2,9 × 1,7 × 1,6 | 3,2 × 1,7 × 1,6 |
| 4,2 × 1,8 × 1,7 | 4,2 × 1,8 × 1,7 (không đổi) |

---

## 9. Quy trình làm việc

### 9.1. Object mới (nhanh nhất)

1. Chọn box trên canvas (hoặc vẽ box áng chừng).
2. **Object** → **🎯 Auto**.
3. **🧲 Smart Snap** (bật **Fit size** nếu muốn tool tính cả LWH).
4. **Track** → kiểm tra **Góc đầu / Hướng đi**; nắn nếu cần.
5. **Ground** → **📏 Kiểm tra đáy**; nếu lệch → **⬇️ Fit mặt đất**.
6. **Ctrl+S**.

### 9.2. Chỉ sửa LWH một object

1. Auto → nhập LWH hoặc chọn preset → **📐 Áp dụng LWH** (theo dải, mặc định chỉ keyframe).
2. Muốn cả track theo: **🔗 Toàn track**.
3. Chỉ frame hiện tại: **✂️ Chỉ frame này**.

### 9.3. Đồng bộ cả track

1. Đứng ở frame mẫu, **Lấy size** (hoặc nhập LWH).
2. **🔗 Toàn track** — tool tự dò dải và sửa mọi keyframe.
3. Kiểm tra vài frame; `Ctrl+S`.

### 9.4. LWH khác nhau theo frame

1. Đồng bộ toàn track trước (nếu cần).
2. Tại từng frame cần khác: nhập LWH → **✂️ Chỉ frame này**.
3. Frame đó được tạo keyframe; các frame khác giữ nguyên.

### 9.5. Nhiều box trong một frame

1. **Shift+Click** chọn các box, hoặc **Tất cả trong frame**.
2. **🧲 Snap** (snap cả nhóm) → **⬇️ Chạm đất** nếu cần.
3. Rê chuột lên canvas, **G/R/S** để chỉnh nhóm; **Enter** xác nhận.
4. Box rác/ra khỏi khung → **🙈 Outside** (không xoá).
5. `Ctrl+S`.

### 9.6. Ground fit cả track (đường dốc)

1. **Object** → **🔍 Tự lấy dải frame**.
2. **Ground** → **📐 Plane từ cloud**.
3. Chọn **Nghiêng theo dốc** + **Keyframe trong dải** (hoặc *Mọi frame* nếu cần chính xác từng frame).
4. **📏 Kiểm tra đáy** → **⬇️ Fit mặt đất**.
5. Nếu vẫn lệch: kiểm tra keyframe ngoài dải, đường cong, hoặc dùng **Alt+G** tại từng đoạn.

### 9.7. Sửa hướng

1. **Object** → **🎯 Auto** (đo hướng).
2. Nếu xe đang chạy và lệch: **Track** → **🎯 Nắn theo hướng đi** (frame hiện tại).
3. Nếu xe đứng yên/khó xác định hướng đi: **☁️ Nắn theo Cloud**.
4. Muốn cả track cùng hướng: **🔗 Đồng bộ góc toàn track**.
5. Nhiều frame bị lộn đầu: **⚡ Sửa frame lệch góc** → xem trước → áp dụng.

### 9.8. Dọn class trước khi nộp

1. **Cài đặt** → chọn class → kiểm tra/sửa limits.
2. **🔎 Check class** → xem object/frame ngoài ngưỡng.
3. **📏 Clamp class** → sửa hàng loạt (mặc định chỉ keyframe).
4. **QA** → **Quét QA** → **⚡ Xem trước auto-fix** → chọn mục → áp dụng.
5. **📤 CSV** để lưu biên bản.
6. `Ctrl+S`.

### 9.9. QA trước khi submit

1. Đặt mặt đất đúng (tab Ground).
2. **QA** → **Quét QA**.
3. Xem danh sách, lọc theo loại; bấm dòng để nhảy tới lỗi.
4. Sửa bằng **auto-fix có xem trước** hoặc bằng tay ở các tab tương ứng.
5. Quét lại QA; Export CSV; `Ctrl+S`.

---

## 10. An toàn dữ liệu & quy định

- Tool chỉ sửa **trong bộ nhớ**; **Ctrl+S** mới ghi lên server.
- Trước batch lớn: duplicate job hoặc export annotation để backup.
- Snapshot là undo riêng, **mất khi reload**, **không thay thế** undo của CVAT.
- **Không xoá object, không gỡ keyframe** trong tool — dùng **Outside** và chỉ thêm keyframe (quy định dự án).
- **Auto-fix luôn có bước xem trước**; mục *đặt outside đoạn quá xa* mặc định không tick trong modal toàn cục.
- Clamp/Áp dụng mọi frame sẽ tạo keyframe ở mọi frame — dùng có ý thức.
- Smart Snap/Nắn theo Cloud phụ thuộc mật độ point cloud; luôn kiểm tra lại box sau khi snap.
- Mặt phẳng dốc fit từ một frame có thể không đúng cho cả đoạn đường cong.
- Thử 1–2 object trước khi chạy toàn class.
- Giới hạn `vehicle` mặc định 5,5 m có thể kẹp sai xe dài — kiểm tra trước khi Clamp.

---

## 11. Troubleshooting

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Panel không hiện | Chỉ chạy ở `/jobs/<số>`; kiểm tra console có `Khởi động v3.1.0`; nhấn Alt+Q. Nếu panel bị lệch vị trí dọc, xoá `localStorage.cqt_panel_top_v2`. |
| Panel tự đóng | Đang không ghim; rê chuột ra ngoài quá 0,35 s. Bấm 📌 để ghim. |
| Panel hiện `?` ở Frame hiện tại | Chưa đọc được store/player. Click vào canvas, đợi job load, thử lại. |
| "Không thấy cuboid #ID ở frame X" | Object không nằm ở frame đó. Xem Frame hiện tại; chuyển tới frame có object (dùng QA hoặc tự lấy dải). |
| "Không đọc được point cloud" | Job không phải 3D/PCD chưa load; bản CVAT đổi cấu trúc scene. Dùng **Z box khác** hoặc nhập tay; Smart Snap/Nắn Cloud không dùng được. |
| "Không đủ điểm quanh object để fit mặt đất" | Vành khuyên quá ít điểm (xe sát tường, PCD thưa). Dùng **Z box khác**, nhập Z, hoặc Alt+G. |
| "Cần ít nhất 2 cuboid khác" | Frame có < 2 box khác để lấy trung vị. Nhập Z hoặc Plane từ cloud. |
| Fit xong vẫn lún | Ground Z/plane sai; keyframe ngoài dải; đường dốc/cong. Kiểm tra đáy, fit lại từng đoạn. |
| "Chỉ hạ" không sửa box bay | Đúng thiết kế — hướng chỉ hạ. Đổi sang *Cả hai* hoặc *Chỉ nâng*. |
| "Không có keyframe nào trong dải" | Phạm vi Ground đang *Keyframe*. Chọn *Mọi frame*. |
| Canvas không cập nhật | Bật *Làm mới canvas bằng chuyển frame* trong Cài đặt, hoặc chuyển frame tay. |
| Không snap được box | Cần ≥ 10 điểm trong hộp +0,3 m; box quá nhỏ/xa cụm. Kéo box to hơn hoặc dùng Fit size. Yaw chỉ chỉnh trong ±45° quanh góc hiện tại — nếu box lệch nhiều, xoay sơ bộ trước. |
| Smart Snap làm box nhỏ đi bất thường | Cụm điểm bị che khuất; tắt **Fit size** (giữ LWH) hoặc kiểm tra lại PCD. |
| G/R/S không chạy | Chưa bật *Phím kiểu Blender*; con trỏ không trên canvas; chưa chọn object; đang gõ trong ô nhập; object bị khoá. |
| G/R/S chỉ tác động 1 box dù đã chọn nhiều | Object active không nằm trong danh sách chọn. Click lại box active trong nhóm hoặc dùng thao tác nhóm ở tab Object. |
| Shift+Click không thêm vào nhóm | Click trong panel/modal bị loại trừ; cần đợi ~150 ms sau click; click phải vào box/dòng object. |
| "Đứng yên, không có hướng đi" | Tool không suy ra được hướng từ chuyển động. Dùng **☁️ Nắn theo Cloud** hoặc xoay tay. |
| Nắn theo Cloud báo không đủ điểm | Cần ≥ 15 điểm trong box (+0,15 m). Kéo box ôm sát xe hơn hoặc dùng Smart Snap trước. |
| Auto-fix không có mục tự sửa | Các lỗi còn lại là loại cần sửa tay (overlap, nhảy 75–135°, shape quá xa). Bấm dòng để nhảy tới. |
| Auto-fix sửa size sai | Median track bị lệch do track có nhiều frame sai; sửa tay vài keyframe chuẩn trước rồi chạy lại. |
| QA báo chồng lấn nhưng xe không chạm | QA chỉ xét BEV, bỏ qua chiều cao. Với ped–ped, tăng `pedPedIoU`; cặp khác phải tắt check *Chồng lấn* nếu muốn bỏ qua. |
| QA quá chậm | Job dài/whole job. Tắt *Quét toàn job* và đặt dải hẹp hơn. |
| QA scale báo rất nhiều | Ngưỡng mặc định 0,005 m rất nhạy; tăng lên 0,02–0,05 m tuỳ dữ liệu. |
| CSV rỗng | Chưa **Quét QA** hoặc dải không có cuboid. |
| Clamp không chạy | *Tự kẹp* đang tắt; label không có limits; object không có mặt tại frame hiện tại; object ngoài dải. |
| Clamp class không đổi gì | Mọi frame đã trong ngưỡng; hoặc *Chỉ keyframe* bật nhưng object không có keyframe trong phạm vi. |
| Object bị kéo về min/max sai | Nhầm limits class (label `pedestrian` nhưng limits `vehicle`). Kiểm tra **Chuẩn hoá class** (8.6). |
| Restore chỉ khôi phục một phần | Object đã bị xoá/đổi cấu trúc; snapshot vượt 10 bản; đã reload trang. |
| Không thấy snapshot | Snapshot chỉ trong bộ nhớ và theo job hiện tại; reload là mất. |
| Limits bị reset sau khi cập nhật | Bản 3 dùng `cqt_limits_v3`; limits 2.x không được migrate. Nhập lại. |
| Script cũ vẫn chạy | Gỡ/tắt bản cũ trong dashboard, chỉ để lại v3.1.0. |
| Panel che UI | Kéo header lên/xuống; thu gọn bằng ✕ hoặc bỏ ghim. |
| Alt+S/G/F bị bỏ qua | Đang focus ô nhập/textarea/select. Click ra canvas rồi thử lại (Alt+Q vẫn chạy). |
| Numpad không đổi view | *Phím kiểu Blender* tắt, hoặc con trỏ không trên canvas, hoặc laptop không có Numpad — dùng nút camera/Alt+7/1/3. |

---

## 12. Giới hạn & roadmap

### 12.1. Đã có trong 3.1.0

LWH/preset/copy-paste transform, Smart Snap (+Fit size), chọn nhiều box + thao tác nhóm, Blender G/R/S + khoá trục + nhập số, camera preset, mặt phẳng đất phẳng & dốc, fit đáy 3 mode/3 phạm vi/3 hướng, đo hướng & nắn hướng, đồng bộ yaw, sửa frame lệch góc, cắt track quá xa bằng outside, dịch/xoay/smooth, QA 5 bộ kiểm tra + lọc + auto-fix xem trước + CSV, limits/clamp/check class, snapshot/restore, log, outside, phím tắt, cài đặt canvas.

### 12.2. Chưa có (cân nhắc bản sau)

- **Ground profile theo từng frame** cho cả track trong một lần chạy (hiện phải fit theo đoạn hoặc Alt+G từng frame).
- **Fit mặt phẳng RANSAC** (hiện là LSQ + lọc outlier).
- **Split / merge / trim track**.
- **Đánh dấu occluded hàng loạt** (hiện chỉ outside).
- **Command palette (Ctrl+K)**, macro 1 nút.
- **Import/export preset, limits** giữa các máy.
- **Ghi chú tự động vào attribute**.
- **Per-object limit override** (hiện limits theo class).
- **Snapshot bền vững** qua reload / nhiều tab.
- **QA kiểm tra độ lệch đáy** ngay trong tab QA (hiện tách ở Ground).
- **Sửa overlap tự động** (hiện chỉ báo).
- **Undo theo lô trong tool** (hiện dựa vào snapshot + Ctrl+Z của CVAT).

### 12.3. Hạn chế đã biết

- QA overlap chỉ xét BEV, không xét chiều cao.
- QA/auto-fix bỏ qua object outside; nếu track có đoạn outside, kiểm tra "2 frame liên tiếp" có thể bị ngắt.
- Smart Snap/Nắn Cloud phụ thuộc PCD và box ban đầu; yaw chỉ chỉnh trong ±45°.
- Mặt phẳng dốc là một mặt phẳng cho cả dải.
- Transform G/R/S chỉ áp cho frame hiện tại.
- Restore không bỏ keyframe; không hoàn tác được việc tạo keyframe.
- Panel không chạy ở trang project/task.

---

## 13. Phụ lục: cơ chế & công thức

### 13.1. Ma trận xoay & mặt đáy rotation-aware

Với Euler XYZ (three.js), `ca = cos(rx)`, `sa = sin(rx)`, `cb = cos(ry)`, `sb = sin(ry)`, `cc = cos(rz)`, `sc = sin(rz)`:

```
R = [ cb·cc                    -cb·sc                    sb        ]
    [ ca·sc + sa·sb·cc          ca·cc - sa·sb·sc         -sa·cb    ]
    [ sa·sc - ca·sb·cc          sa·cc + ca·sb·sc          ca·cb    ]
```

Khoảng cách từ tâm xuống điểm thấp nhất:

```
hz_eff = |R20|·L/2 + |R21|·W/2 + |R22|·H/2

R20 = sin(rx)sin(rz) − cos(rx)cos(rz)sin(ry)
R21 = sin(rx)cos(rz) + cos(rx)sin(rz)sin(ry)
R22 = cos(rx)cos(ry)
```

`bottomZ = z − hz_eff`. Khi đổi H và bật *Giữ đáy*, tool giữ `bottomZ` cũ và tính lại `z`.

### 13.2. Mặt phẳng đất

```
Z = a·X + b·Y + c
slopeDeg = atan(√(a² + b²)) · 180/π
```

Góc để trục Z local vuông góc mặt phẳng:

```
n  = √(a² + b² + 1)
nx = −a/n,  ny = −b/n,  nz = 1/n
rx = atan2(−ny, nz)
ry = asin(clamp(nx, −1, 1))
```

Độ lệch đáy so với mặt phẳng: lấy **min** trên 8 góc của `z_corner − planeZ(x, y)` (dương = bay, âm = lún).

Fit bình phương tối thiểu:

```
Sxx = Σ(x−mx)², Syy = Σ(y−my)², Sxy = Σ(x−mx)(y−my)
Sxz = Σ(x−mx)(z−mz), Syz = Σ(y−my)(z−mz)
det = Sxx·Syy − Sxy²
a = (Sxz·Syy − Syz·Sxy)/det
b = (Syz·Sxx − Sxz·Sxy)/det
c = mz − a·mx − b·my
```

`det ≈ 0` (điểm gần thẳng hàng) → không fit.

### 13.3. Clamp

```
clamp(v, [min, max]) = min(max(v, min), max)
```

Áp dụng riêng cho L, W, H. Không scale.

### 13.4. Đồng bộ track

- Sửa **mọi keyframe** của object thành cùng LWH (hoặc cùng yaw).
- Frame nội suy giữa hai keyframe có cùng giá trị → không đổi.
- Không tạo keyframe mới, track không phình.

### 13.5. Tạo keyframe ngoài ý muốn

Trong CVAT, `save()` tại frame không phải keyframe sẽ tạo keyframe tại đó. Vì vậy:

- `Áp dụng LWH` với *Chỉ keyframe* tắt → tạo keyframe ở mọi frame có object.
- `Chỉ frame này` → tạo 1 keyframe.
- `Toàn track`, `Đồng bộ yaw`, Clamp class với *Chỉ keyframe* bật → chỉ sửa keyframe sẵn có.
- Restore snapshot → **không** bỏ keyframe đã tạo.

### 13.6. Point cloud

- Đọc `THREE.Points` trong các view của canvas 3D (ưu tiên perspective, rồi top/side/front).
- **Ước lượng mặt đất cục bộ**: vành khuyên quanh footprint (trong +0,3 m, ngoài `0,5·√(L²+W²) + 4,5 m`, xoay theo yaw); cần ≥ 15 điểm; lấy `phân vị 35% + 0,15 m`; fit LSQ; 3 vòng loại `|dz| > 0,12 m`; cần ≥ 10 điểm.
- **Điểm trong hộp**: lọc nhanh theo bán kính ngoại tiếp, rồi kiểm tra trong hệ local theo nửa kích thước + margin.

### 13.7. Smart Snap

- Lặp `smartSnapOnce` tối đa 4 lần, dừng khi Δyaw < 0,2° và Δtâm < 1 cm.
- Mỗi lượt: lấy điểm trong hộp +0,3 m; bỏ điểm thấp hơn mặt đất cục bộ 0,15 m; cần ≥ 10 điểm.
- Yaw = PCA 2D, chọn trong `yaw + k·90°` gần yaw tham chiếu nhất.
- Bao khít: phân vị 2% và 98% theo trục dọc/ngang; đỉnh theo phân vị 99%.
- Fit size: `L = uMax − uMin`, `W = vMax − vMin` (min 0,2), `H = z99 − bottom` (min 0,3).
- Không fit size: giữ L/W/H, đẩy box để mặt gần cảm biến khớp cụm điểm (nếu cụm rộng hơn box thì lấy tâm).
- Luôn `rx = ry = 0`, đáy chạm mặt phẳng đất cục bộ.

### 13.8. QA

- **Scale**: với track > 1 frame, tính median L/W/H của track; mỗi frame lệch `max(|ΔL|,|ΔW|,|ΔH|) > scaleTol` bị gắn cờ.
- **Yaw**: với 2 frame liên tiếp (`f = prev + 1`), `|wrap(Δyaw)| > yawThresh` bị gắn cờ.
- **Quá xa**: `√(x² + y² + z²) > distThresh`.
- **Limits**: `limitViolations` từng chiều.
- **Chồng lấn**: đa giác BEV (4 góc, xoay yaw); lọc nhanh theo tổng bán kính; giao bằng **Sutherland–Hodgman**; `IoU = inter/(A1+A2−inter)`; `IoA = inter/A`.
  - Ped–ped: chỉ báo khi `IoU > pedPedIoU`.
  - Cặp khác: báo khi `inter > 1e-4 m²`.
  - Mỗi cặp sinh 2 dòng (một cho mỗi box).

### 13.9. Auto-fix yaw

- Duyệt các frame có object theo thứ tự; `parity` lật mỗi khi `|Δyaw| > 135°`.
- Bỏ phiếu hướng đúng: với frame có tốc độ ≥ 0,1 m/frame, so `cos(yaw − hướng đi)` với parity; nếu tổng phiếu ≥ 3 và hai bên khác nhau → chọn theo hướng di chuyển; ngược lại chọn parity đa số.
- Lật keyframe sai; lật frame nội suy sai chỉ khi cả 2 keyframe kề bên đều đúng.
- Bước nhảy 75–135° giữa 2 frame liên tiếp → mục sửa tay.

### 13.10. Snapshot

- Lưu `clientID`, `frame`, `objectType`, `points`, `keyframe`, `outside`, `occluded`.
- Tối đa 10 bản (toàn phiên trang), lọc theo job khi hiển thị.
- Restore ngược thứ tự; bỏ qua object không còn; không đổi cờ keyframe.

---

## 14. Lịch sử phiên bản

- **3.1.0** — Bản viết lại lớn (repo không có bản script 2.5.0; script nhảy từ 2.4.0 lên 3.1.0, còn tài liệu cũ ghi 2.5):
  - Canvas kiểu Blender: **G/R/S**, khoá trục X/Y/Z, nhập số, Ctrl bắt bước, HUD, xoay nhóm quanh tâm.
  - Camera preset: Focus/Top/Front/Side, Numpad 7/1/3/., Ctrl đối diện, Alt+F/7/1/3.
  - **Smart Snap** + Fit size; **Nắn theo Cloud**; **Nắn theo hướng đi**; **Đồng bộ góc toàn track**; **Sửa frame lệch góc**; **Cắt phần track quá xa**.
  - **Chọn nhiều box** + thao tác nhóm; **Outside** thay xoá; chỉ thêm keyframe.
  - Ground: mặt phẳng dốc `Z = aX + bY + c` với lọc outlier; mode *Nghiêng theo dốc*; bỏ occupancy/fit box beta.
  - QA: 5 bộ kiểm tra mới (scale median, yaw jump, BEV overlap, distance, limits), lọc kết quả, CSV 9 cột, **auto-fix có xem trước**.
  - Snapshot trong bộ nhớ (10 bản); refresh qua Redux store; Limits gộp vào tab **Cài đặt**; class name chuẩn hoá số nhiều.
- **2.4.0** — Check/Clamp toàn bộ class; quét toàn job hoặc dải; clamp class mặc định keyframe.
- **2.3.0** — **🔗 Đồng bộ toàn track** và **✂️ Chỉ frame này**.
- **2.2.0** — Tổng số frame của object; tự dò dải; Clamp toàn track.
- **2.1.0** — Ngưỡng LWH theo class; auto clamp; cảnh báo ngoài limits; QA limits.
- **2.0.1** — Sửa lỗi không tìm thấy cuboid: ưu tiên Redux store, bỏ cache khi chuyển job, frame fallback.
- **2.0.0** — Toolbox 4 tab; preset; scale; ground fit nâng/hạ; cloud Z; occupancy; fit box beta; track tools; QA; snapshot.
- **1.5.1** — Sửa lỗi tự nhảy frame.
- **1.5.0** — Ground Z từ point cloud / box khác.
- **1.4.0** — Fit mặt đất rotation-aware, chỉ keyframe, kiểm tra đáy.
- **1.3.0** — LWH + keyframe an toàn.

---

## 15. Bảng tra nhanh

| Nút / ô / phím | Vị trí | Tác dụng |
|---|---|---|
| 🎯 Auto | Object | Lấy object đang chọn + LWH + dải 1 frame + đo hướng |
| 🧲 Smart Snap / Alt+S | Object | Snap box theo cụm điểm (target; Alt+S dùng nhóm chọn) |
| Fit size | Object | Smart Snap tính lại cả L/W/H |
| Tất cả trong frame | Object | Chọn mọi box ở frame hiện tại |
| 🧲 Snap | Object | Smart Snap cả nhóm đã chọn |
| ⬇️ Chạm đất | Object | Hạ đáy cả nhóm chạm mặt đất |
| 🙈 Outside | Object | Đặt outside từ frame hiện tại |
| ↔️ Dịch | Object | Dịch nhóm theo dX/dY/dZ |
| Start / End / Số frame | Object | Dải áp dụng |
| 🔍 Tự lấy dải frame | Object | Dò frame đầu/cuối của object |
| Lấy size | Object | Đọc LWH + đo hướng + cảnh báo limits |
| 📐 Áp dụng LWH | Object | Áp LWH cho dải (mặc định chỉ keyframe) |
| 🔗 Toàn track | Object | Áp LWH cho mọi keyframe |
| ✂️ Chỉ frame này | Object | Chỉ sửa frame hiện tại |
| 💾 / Dùng / Xoá preset | Object | Quản lý preset theo label |
| 📋 Copy / 📥 Paste | Object | Sao chép/dán toàn bộ transform |
| ⭐ Đặt keyframe | Object | Thêm keyframe tại frame hiện tại |
| 📐 Plane từ cloud | Ground | Fit mặt phẳng dốc từ PCD quanh object |
| 📊 Z box khác | Ground | Z ngang = trung vị đáy ≥ 2 box khác |
| 📌 Z từ box này | Ground | Z ngang = đáy object hiện tại |
| Cách đặt | Ground | Snap đáy / Đặt phẳng / Nghiêng theo dốc |
| Phạm vi | Ground | Keyframe / Mọi frame / Frame hiện tại |
| Hướng | Ground | Cả hai / Chỉ hạ / Chỉ nâng |
| 📏 Kiểm tra đáy | Ground | Đo lún/bay cả dải |
| ⬇️ Fit mặt đất / Alt+G | Ground | Fit theo mode/scope/hướng (Alt+G: cục bộ từng box, frame hiện tại) |
| ↔️ Dịch chuyển | Track | Dời cả dải |
| 🎯 Nắn theo hướng đi | Track | Xoay yaw theo hướng di chuyển (frame hiện tại) |
| ☁️ Nắn theo Cloud | Track | Xoay yaw theo PCA cụm điểm |
| 🔗 Đồng bộ góc toàn track | Track | Áp yaw hiện tại cho mọi keyframe |
| ⚡ Sửa frame lệch góc | Track | Xem trước & lật 180° frame ngược đầu |
| 🔄 Xoay / 180° / ±90° | Track | Xoay yaw theo góc |
| 🧭 Căn hướng theo hướng đi | Track | Căn yaw cả dải theo chuyển động |
| ✂️ Cắt phần track quá xa | Track | Đặt outside phần xa > ngưỡng |
| 〰️ Smooth vị trí | Track | Làm mượt vị trí keyframe |
| 🔎 Quét QA | QA | Quét lỗi theo bộ kiểm tra |
| ⚡ Xem trước auto-fix | QA | Đề xuất sửa, chọn rồi áp dụng |
| 📤 CSV | QA | Xuất báo cáo QA |
| Restore | QA | Khôi phục snapshot |
| Phím Blender | Cài đặt | Bật/tắt G/R/S, Numpad camera |
| Làm mới bằng chuyển frame | Cài đặt | Refresh chậm dự phòng |
| 💾 Lưu limits | Cài đặt | Lưu ngưỡng class |
| 📌 | Cài đặt | Lấy label object cho class |
| ↺ Tiêu chuẩn | Cài đặt | Reset limits mặc định |
| Tự kẹp khi Áp dụng LWH | Cài đặt | Clamp tự động khi áp LWH |
| 🔎 Check class | Cài đặt | Báo object/frame ngoài ngưỡng |
| 📏 Clamp class | Cài đặt | Kẹp mọi object của class |
| 🎯 Focus / 🔝 Top / 🚗 Front / ↔️ Side | Header | Camera preset |
| Alt+Q | Toàn cục | Ghim/bỏ ghim panel |
| Alt+S / Alt+G / Alt+F / Alt+7,1,3 | Toàn cục | Smart Snap / chạm đất / focus / camera |
| G / R / S | Canvas | Di chuyển / xoay / co giãn |
| X / Y / Z | Canvas | Khoá trục (bấm 2 lần = local) |
| Numpad 7 / 1 / 3 / . | Canvas | Top / Front / Side / Focus |
| Ctrl + Numpad 7 / 1 / 3 | Canvas | Phía đối diện |
