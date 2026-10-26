# CVAT Cuboid Toolbox v2.5 — Hướng dẫn đầy đủ

Userscript hỗ trợ gán nhãn **CVAT 3D Cuboid**: sửa kích thước, fit mặt đất theo point cloud, quản lý keyframe/track, kiểm tra ngưỡng LWH theo class, QA và snapshot.

> File script: `cvat-cuboid-quicktool.user.js` (v2.5.0)  
> Chỉ chạy trên trang `/jobs/` của CVAT 3D. Không cần reload trang sau khi cài.

---

## Mục lục

0. [Bắt đầu nhanh](#0-bắt-đầu-nhanh)
1. [Giới thiệu & cài đặt](#1-giới-thiệu--cài-đặt)
2. [Giao diện & thao tác chung](#2-giao-diện--thao-tác-chung)
3. [Khái niệm nền](#3-khái-niệm-nền)
4. [Tab Object](#4-tab-object)
5. [Tab Ground](#5-tab-ground)
6. [Tab Track](#6-tab-track)
7. [Tab QA](#7-tab-qa)
8. [Tab Limits](#8-tab-limits)
9. [Quy trình làm việc](#9-quy-trình-làm-việc)
10. [An toàn dữ liệu](#10-an-toàn-dữ-liệu)
11. [Troubleshooting](#11-troubleshooting)
12. [Giới hạn & roadmap](#12-giới-hạn--roadmap)
13. [Phụ lục: cơ chế & công thức](#13-phụ-lục-cơ-chế--công-thức)
14. [Lịch sử phiên bản](#14-lịch-sử-phiên-bản)
15. [Bảng tra nhanh](#15-bảng-tra-nhanh)

---

## 0. Bắt đầu nhanh

1. Mở job 3D → panel **CVAT Toolbox** ở mép phải (hoặc nhấn **Alt+Q**).
2. Tab **Object** → bấm **🎯 Auto** để lấy object đang chọn.
3. Đặt dải frame: nhập **Start/End**, hoặc **Tổng số frame**, hoặc bấm **🔍 Tự lấy dải frame của object**.
4. (Một lần) Tab **Limits** → kiểm tra ngưỡng LWH của class; chỉnh nếu label trong bài khác.
5. Tab **Ground** → **☁️ Z point cloud** → **📏 Kiểm tra đáy** → **⬇️ Fit mặt đất**.
6. Tab **Object** → nhập/chọn LWH → **📐 Áp dụng LWH** (hoặc **🔗 Đồng bộ toàn track**).
7. **Ctrl+S** để lưu lên server.

---

## 1. Giới thiệu & cài đặt

### 1.1. Tool làm gì

- Sửa **LWH** cho cuboid, giữ mặt đáy, áp cho dải frame / toàn track / từng frame.
- **Clamp** LWH theo ngưỡng min/max của từng class (vehicle, two_wheel, pedestrian…).
- **Fit mặt đất** rotation-aware, lấy cao độ Z từ point cloud.
- Quản lý **keyframe**: bật/gỡ, gỡ hàng loạt, decimate, resample, smooth.
- Dịch chuyển / xoay 180° / scale / copy transform.
- **QA**: quét lún-bay, size bất thường, keyframe quá dày, ngoài limits.
- **Snapshot**: undo riêng cho các thao tác hàng loạt.
- **Check/Clamp toàn bộ class** trong một lần.

### 1.2. Yêu cầu

- Tampermonkey / Violentmonkey / Userscripts (Safari).
- Job CVAT **3D** (point cloud), object là cuboid 3D.
- Trình duyệt cho phép `localStorage`.
- Nên dùng trên Chrome/Edge mới; Firefox cũng được.

### 1.3. Cài đặt / cập nhật / gỡ

**Cài lần đầu**

1. Mở dashboard userscript → **Create new script**.
2. Dán toàn bộ `cvat-cuboid-quicktool.user.js`.
3. Lưu → mở trang job → kiểm tra console có `[CVAT-Toolbox] Khởi động v2.5.0`.

**Cập nhật**

1. Thay **toàn bộ** nội dung script cũ bằng file mới.
2. `Ctrl+Shift+R` (hard reload) trang CVAT.
3. **Tắt/gỡ bản 1.x** nếu còn — hai bản dùng chung `#cvat-quicktool-wrapper` sẽ tranh nhau.

**Gỡ**

- Xoá script trong dashboard userscript.
- (Tuỳ chọn) xoá dữ liệu localStorage — xem 1.4.

### 1.4. Dữ liệu lưu ở đâu

| Key | Nội dung |
|---|---|
| `cqt_presets_v2` | Preset LWH theo label |
| `cqt_limits_v2` | Ngưỡng LWH theo class |
| `cqt_snapshots_v2` | 6 snapshot gần nhất (tối đa 2000 mục/bản) |
| `cqt_clipboard_v2` | Transform đã copy |
| `cqt_panel_top_v2` | Vị trí panel |

Tất cả nằm trong **localStorage của trình duyệt**, không đồng bộ giữa các máy.

---

## 2. Giao diện & thao tác chung

### 2.1. Panel

- **Header**: `📦 CVAT Toolbox`, nút **📌** (ghim), **✕** (thu gọn). Kéo header để di chuyển; vị trí được nhớ.
- **5 tab**: Object · Ground · Track · QA · Limits.
- **Status bar** ở đáy panel: thông báo thao tác gần nhất (xanh = thành công, vàng = cảnh báo, đỏ = lỗi).
- **Log** ở tab QA: 60 dòng thao tác gần nhất kèm giờ.

### 2.2. Phím tắt

| Phím | Tác dụng |
|---|---|
| **Alt+Q** | Mở/đóng panel; khi mở sẽ focus ô Target ID |
| **Alt+G** | Chạy **Fit mặt đất** với cấu hình đang chọn |

### 2.3. Trạng thái & log

- Status chỉ giữ thao tác gần nhất; chi tiết hơn xem **QA → Log**.
- Các thao tác hàng loạt có thể mất vài giây; status hiện tiến độ `⏳ frame x/y...`.

### 2.4. Cơ chế "nhích frame" để vẽ lại

CVAT không tự vẽ lại cuboid sau khi SDK sửa dữ liệu. Tool sẽ:

1. Ghi lại frame hiện tại.
2. Nhích sang frame kế (hoặc lùi nếu đang ở frame cuối).
3. Chờ frame load xong.
4. Quay lại **đúng frame ban đầu**.

Bạn sẽ thấy frame chớp nhẹ nhưng số frame không đổi. Nếu không tự về được, status ghi `⚠️ Chưa tự về frame cũ` — bấm ← một lần.

### 2.5. Object ID và frame hiện tại

- **Target Object ID** là ID hiển thị trong danh sách Objects (clientID hoặc serverID đều khớp).
- Dòng **Frame hiện tại** cho biết tool đang đọc frame nào. Nếu hiện `?`, tool chưa đọc được — click vào canvas rồi thử lại.
- Khi báo "không thấy cuboid", tool sẽ dò ±30 frame và gợi ý frame gần nhất có object.

---

## 3. Khái niệm nền

### 3.1. Track và shape

- **Shape**: cuboid chỉ tồn tại ở một frame.
- **Track**: cuboid tồn tại qua nhiều frame, có **keyframe** và các frame **nội suy** ở giữa.

Hầu hết thao tác hàng loạt trong tool áp dụng cho track.

### 3.2. Keyframe và frame nội suy

- **Keyframe** (★): frame có dữ liệu thật do người dùng đặt.
- **Frame nội suy**: CVAT tự tính giữa hai keyframe.
- Sửa points ở một frame **không phải keyframe** sẽ khiến CVAT **tạo keyframe** tại frame đó.
- Nếu mọi keyframe của track có cùng LWH, mọi frame nội suy cũng có đúng LWH đó.

### 3.3. Dữ liệu cuboid trong CVAT 3D

`points = [x, y, z, rx, ry, rz, L, W, H]`

- `(x, y, z)`: tâm hộp, mét.
- `(rx, ry, rz)`: góc Euler, **radian** (CVAT chỉ đổi sang độ khi hiển thị).
- `L, W, H`: kích thước đầy đủ theo trục local.
- `z` là trục đứng; `rz` là yaw (view TOP), `rx` là pitch (FRONT), `ry` là roll (SIDE).

Tool tính mặt đáy bằng điểm thấp nhất trong **8 góc** của hộp, đúng cả khi hộp nghiêng.

### 3.4. Limits (ngưỡng LWH theo class)

Mỗi class có 3 khoảng `[min, max]` cho L, W, H. Khi clamp:

- `min ≤ v ≤ max` → giữ nguyên.
- `v < min` → min.
- `v > max` → max.

Mỗi chiều kẹp **độc lập**, không scale đồng thời.

### 3.5. Đồng bộ và tách riêng

| Chế độ | Cách làm | Khi nào dùng |
|---|---|---|
| **Đồng bộ chung** | **🔗 Đồng bộ toàn track** hoặc **⚡ Clamp toàn track** | Muốn cả track cùng một LWH |
| **Tách riêng** | **✂️ Chỉ frame này** tại từng frame | Mỗi frame cần LWH khác nhau |

Có thể đồng bộ trước rồi tinh chỉnh vài frame.

### 3.6. Snapshot

- Trước mỗi thao tác hàng loạt, tool tự lưu snapshot các state bị sửa.
- Giữ **6 bản gần nhất**, tối đa 2000 mục/bản.
- Restore trong tab QA; khôi phục `points`, `keyframe`, `outside`, `occluded`.
- Snapshot là undo riêng của tool, **không thay thế** undo của CVAT.

---

## 4. Tab Object

### 4.1. Target

- **Target Object ID**: nhập tay.
- **🎯 Auto**: lấy object đang chọn, điền ID, đặt Start/End = frame hiện tại, nạp LWH và chọn preset/limits tương ứng.
- Nếu ô ID trống, một số thao tác sẽ dùng object đang chọn.

### 4.2. Dải frame

| Thành phần | Tác dụng |
|---|---|
| **Start Frame / End Frame** | Dải áp dụng cho các thao tác hàng loạt |
| **Frame hiện tại** | Frame tool đang đọc từ CVAT |
| **Tổng số frame của object** | `End = Start + count − 1`; tự cập nhật khi đổi count hoặc Start |
| **Dùng** | Áp dụng ngay số frame |
| **🔍 Tự lấy dải frame của object** | Dò toàn job, tìm frame đầu/cuối object tồn tại, điền Start/End/count |

Ví dụ: Start 40, count 120 → End 159.

> `Tự lấy dải` bỏ qua các frame `outside`; nếu track có khoảng trống, status báo cả số frame thực tế có object.

### 4.3. Kích thước LWH

- **Lấy size**: đọc LWH từ object tại frame hiện tại, đồng thời cảnh báo nếu ngoài limits.
- **📏 Kẹp**: kẹp LWH **đang nhập** theo limits của class, cập nhật lại 3 ô (chưa sửa object). Dùng để xem trước giá trị hợp lệ trước khi Áp dụng.
- **Tự kẹp limits** (mặc định bật): đồng bộ với checkbox ở tab Limits, lưu vào `localStorage`. Khi bật, rời ô L/W/H sẽ tự kẹp giá trị; khi Áp dụng / Đồng bộ / Chỉ frame này cũng tự kẹp.
- **Giữ đáy** (mặc định bật): khi đổi H, giữ nguyên cao độ mặt đáy; đúng cả khi box nghiêng.
- **Chỉ keyframe**: chỉ sửa frame đang là keyframe (dùng cho Áp dụng LWH theo dải).

### 4.4. Ba cách áp dụng LWH

| Nút | Phạm vi | Đặc điểm |
|---|---|---|
| **📐 Áp dụng LWH** | Start–End | Sửa cả frame không phải keyframe (tạo keyframe mới) |
| **🔗 Đồng bộ toàn track** | Mọi keyframe của object | Frame nội suy tự theo; không tạo keyframe mới |
| **✂️ Chỉ frame này** | Đúng frame hiện tại | Các frame khác giữ nguyên; tạo keyframe nếu cần |

Cả 3 đều tự kẹp limits nếu **Tự kẹp limits** (tab Object) hoặc **Tự clamp khi Áp dụng LWH** (tab Limits) đang bật — hai checkbox này là một thiết lập, tự đồng bộ và được nhớ cho lần sau.

**Ví dụ**

- Object `vehicle` đang `6.0 × 2.5 × 2.2`, limits L 3.2–5.5, W 1.6–2.2, H 1.5–1.9.
- Nhập `L=7, W=2.0, H=1.8` → **Áp dụng** hoặc **Đồng bộ** → kết quả `5.5 × 2.0 × 1.8`.
- Muốn frame 5 khác: đứng ở frame 5, nhập LWH → **✂️ Chỉ frame này**.

> LWH lấy từ các ô nhập. Nếu vừa kéo tay trên canvas, bấm **Lấy size** trước.

### 4.5. Preset theo label

- Nhập LWH → **💾 Lưu preset** → gắn với label của object đang chọn.
- Chọn preset → **Dùng** để điền vào ô LWH (chưa áp dụng).
- **Xoá preset** để bỏ.
- Preset lưu theo trình duyệt; không chia sẻ giữa các máy.

### 4.6. Copy size / Scale / Copy transform

- **Copy size từ ID**: nhập ID mẫu → **Copy** → điền LWH của mẫu vào ô.
- **Scale LWH (×)**: nhân L/W/H của toàn dải với hệ số, giữ đáy.
  - Dùng checkbox **Chỉ keyframe** ở mục LWH.
  - Scale không tự clamp; bấm **Clamp** sau nếu cần.
- **📋 Copy transform**: lưu toàn bộ `(x,y,z,rx,ry,rz,L,W,H)`.
- **📥 Paste**: dán vào object đích tại **frame hiện tại**.

### 4.7. Keyframe

- **⭐ Bật / Gỡ keyframe [K]**: toggle keyframe tại frame hiện tại, giống phím K.
  - Yêu cầu object đang hiện trong danh sách Objects; nếu không thấy nút, mở rộng object đó.
- **⚡ Gỡ keyframe trong dải**: bỏ keyframe trung gian, giữ keyframe đầu tiên làm anchor.
  - Có confirm và snapshot.
  - Không thể gỡ keyframe duy nhất của track.

---

## 5. Tab Ground

### 5.1. Ground Z là gì?

CVAT **không có khái niệm mặt đất**. `z = 0` chỉ là gốc toạ độ, không đảm bảo trùng mặt đường của PCD.

Nếu nhập sai Z, box sẽ lún hoặc bay đúng bằng khoảng chênh đó. Vì vậy hãy lấy Z từ dữ liệu trước khi fit.

### 5.2. Ba cách lấy Ground Z

| Nút | Cách hoạt động | Khi nào dùng |
|---|---|---|
| **☁️ Z point cloud** | Đọc point cloud đang render, lấy percentile thấp quanh footprint (bỏ điểm thân xe) | Tốt nhất, job có PCD |
| **📊 Z box khác** | Trung vị đáy của các cuboid khác ở frame hiện tại | Khi không đọc được cloud |
| **📌 Z từ box này** | Lấy đáy của object đang chọn | Khi object này đã đúng |

Sau khi bấm, Z được điền vào ô; kiểm tra lại rồi mới Fit.

### 5.3. Fit mặt đất

**Chế độ**

- **Snap đáy (giữ nghiêng)**: tịnh tiến box để điểm thấp nhất trong 8 góc chạm Z. Box nghiêng chỉ chạm bằng 1 góc.
- **Đặt phẳng đáy**: bỏ pitch/roll (`rx=ry=0`), giữ yaw, mặt đáy phẳng nằm trên Z.

**Phạm vi**

- **Chỉ keyframe trong dải**: nhẹ, giữ nội suy.
- **Mọi frame (bake)**: chính xác từng frame nhưng tạo keyframe ở mọi frame.
- **Frame hiện tại**: chỉ sửa frame đang xem.

**Hướng**

- **Cả hai**: sửa cả box lún và bay.
- **Chỉ hạ**: chỉ sửa box đang lún.
- **Chỉ nâng**: chỉ sửa box đang bay.

**Nút**

- **📏 Kiểm tra đáy**: quét dải, báo `min/max` độ lệch, số frame lún/bay >1cm, độ nghiêng tối đa.
- **⬇️ Fit mặt đất**: áp dụng.

> Muốn fit cả track: bấm **🔍 Tự lấy dải frame của object** ở tab Object trước, rồi Fit.

### 5.4. Occupancy

Đếm tỷ lệ điểm point cloud gần box nằm trong hộp:

- Quá thấp (<5%): box lệch hoặc rỗng.
- Quá cao: box ôm quá nhiều điểm (quá lớn).

Chỉ để tham khảo, không phải tiêu chí tuyệt đối.

### 5.5. Fit box theo cloud (beta)

Tự fit lại kích thước/hướng box theo cụm điểm bên trong box hiện tại (PCA trên XY):

- Giữ yaw, **reset pitch/roll về 0**.
- Cần ≥60 điểm trong vùng box.
- Kết quả phụ thuộc điểm nhìn lidar; luôn kiểm tra lại.
- Có confirm và snapshot trước khi sửa.

### 5.6. Quy trình ground chuẩn

1. Đứng ở frame đại diện.
2. **☁️ Z point cloud** (hoặc **📊 Z box khác**).
3. **📏 Kiểm tra đáy** xem lệch bao nhiêu.
4. Chọn chế độ/phạm vi/hướng.
5. **⬇️ Fit mặt đất**.
6. Kiểm tra lại; `Ctrl+S`.

---

## 6. Tab Track

Checkbox **Chỉ sửa keyframe trong dải** áp dụng cho Dịch chuyển và Xoay 180°.

### 6.1. Dịch chuyển

Nhập `dX`, `dY`, `dZ` → **↔️ Dịch chuyển** toàn dải.

### 6.2. Xoay 180°

Cộng π vào yaw (`rz`) của các frame đã chọn.

### 6.3. Smooth vị trí

- Trung bình có trọng số `0.25 / 0.5 / 0.25` cho `x,y,z` của các keyframe **ở giữa** dải.
- Giữ keyframe đầu/cuối; cần ≥3 keyframe.
- Không smooth góc.

### 6.4. Decimate keyframe

- Nhập ngưỡng sai số (m), mặc định `0.05`.
- Với mỗi keyframe giữa, so **toàn bộ 9 thành phần points** nội suy (vị trí, góc, LWH) giữa 2 keyframe lân cận với keyframe thật.
- Nếu sai số lớn nhất ≤ ngưỡng → gỡ keyframe đó.
- Giữ keyframe đầu/cuối; có confirm + snapshot.

### 6.5. Resample

Thêm keyframe mỗi `N` frame trong dải. Có confirm vì có thể tạo rất nhiều keyframe.

---

## 7. Tab QA

### 7.1. Quét QA

Quét **tất cả cuboid** trong dải frame (Start–End) và tổng hợp:

| Kiểm tra | Ngưỡng |
|---|---|
| Đáy lệch so với Ground Z | > 5 cm |
| Size lệch so với preset hoặc midpoint limits | > 25% |
| Ngoài limits LWH | Bất kỳ chiều nào ngoài min/max |
| Keyframe quá dày | > 80% số frame (track > 10 frame) |
| Track quá ngắn | < 3 frame |

Kết quả hiện trong khung; object có vấn đề xếp lên đầu. **Quét QA không sửa gì.**

### 7.2. Export CSV

Xuất các dòng QA ra `cvat_qa_<job>_<start>-<end>.csv` (UTF-8 BOM, mở được bằng Excel).

Cột: `clientID,label,frames,keyframes,gap_min,gap_max,size_dev,issues`.

### 7.3. Snapshot / Restore

- Chọn snapshot → **Restore** để khôi phục.
- **Xoá tất cả snapshot** khi không cần.
- Restore là best-effort: object đã bị xoá/đổi cấu trúc sẽ bị bỏ qua.

### 7.4. Log

Hiển thị 60 dòng thao tác gần nhất kèm giờ. Chỉ ghi các thao tác có trạng thái success/error/warn.

Nút **📋 Copy log** sao chép toàn bộ log vào clipboard để dán vào báo cáo/claim.

---

## 8. Tab Limits

### 8.1. Ngưỡng mặc định

| Class | L | W | H |
|---|---|---|---|
| `vehicle` | 3.2 – 5.5 | 1.6 – 2.2 | 1.5 – 1.9 |
| `two_wheel` | 1.5 – 2.0 | 0.6 – 0.9 | 1.5 – 1.8 |
| `pedestrian` | 0.65 – 1.0 | 0.65 – 1.0 | 1.2 – 1.9 |

Lần đầu chạy, 3 class này tự được tạo trong `localStorage` (`cqt_limits_v2`).

### 8.2. Sửa / thêm / xoá

- Chọn class → 6 ô min/max được nạp → sửa → **💾 Lưu limits**.
- **Thêm class mới**: nhập tên vào ô "Class mới" rồi Lưu (bỏ trống = lưu cho class đang chọn).
- **📌**: lấy label của object đang chọn.
- **Xoá** class đang chọn; **↺ Reset mặc định** khôi phục 3 class gốc.
- Tên class so khớp label **không phân biệt hoa thường**; label không có limits thì bỏ qua clamp.

### 8.3. Clamp

- **Tự clamp khi Áp dụng LWH** (mặc định bật): mọi lần Áp dụng / Đồng bộ / Chỉ frame này đều kẹp theo limits. Checkbox này đồng bộ với **Tự kẹp limits** ở tab Object và được lưu lại.
- **📏 Clamp object theo limits**: quét dải Start–End, tùy chọn **Clamp chỉ keyframe** (mặc định tắt), giữ mặt đáy.
- **⚡ Clamp toàn track (tự lấy dải)**: tự dò frame đầu/cuối của object rồi clamp, không cần nhập Start/End. Dùng chung checkbox **Clamp chỉ keyframe** ở trên (mặc định tắt = clamp mọi frame).

### 8.4. Check / Clamp toàn bộ class

- Chọn class ở dropdown.
- **Quét toàn job** (mặc định bật): quét mọi frame của job; bỏ chọn → chỉ quét Start–End.
- **Clamp class chỉ keyframe** (mặc định bật): tránh tạo keyframe ở mọi frame.

**🔎 Check toàn bộ class** (chỉ đọc):

```
Class "vehicle": 14 object / 812 frame.
Ngoài ngưỡng: 3/14 object, 47 frame.
#4: 12/120 frame ngoài — L max 6.20 (>5.5), W max 2.50 (>2.2)
#7: 8/95 frame ngoài — H min 1.40 (<1.5)
...
```

**📏 Clamp toàn bộ class** (sửa):

- Kẹp mọi object của class; chỉ chiều vượt ngưỡng bị đổi.
- Giữ mặt đáy từng object; object đã đúng không bị chạm.
- Bỏ checkbox keyframe → clamp mọi frame (có confirm, tạo keyframe ở tất cả frame).
- Sau khi **Check toàn bộ class**, bấm **📋 Copy kết quả check** để copy danh sách object/frame ngoài ngưỡng vào clipboard.

### 8.5. Limits và QA

- QA tính `size_dev` theo preset nếu có, nếu không thì theo midpoint limits.
- Object ngoài limits bị gắn cờ `ngoài limits LWH`.
- QA không sửa; muốn sửa dùng Clamp.

### 8.6. Ví dụ clamp

`vehicle`, limits L 3.2–5.5, W 1.6–2.2, H 1.5–1.9:

| Trước | Sau |
|---|---|
| 6.0 × 2.5 × 2.2 | 5.5 × 2.2 × 1.9 |
| 2.9 × 1.7 × 1.6 | 3.2 × 1.7 × 1.6 |
| 4.2 × 1.8 × 1.7 | 4.2 × 1.8 × 1.7 (không đổi) |

---

## 9. Quy trình làm việc

### 9.1. Object mới

1. **Object** → **🎯 Auto**.
2. **🔍 Tự lấy dải frame** (hoặc nhập count).
3. **Lấy size** hoặc chọn **preset**.
4. **📐 Áp dụng LWH** (tự clamp).
5. **Ground** → **☁️ Z point cloud** → **Fit**.
6. `Ctrl+S`.

### 9.2. Sửa LWH một object

1. Auto → nhập LWH → **📐 Áp dụng LWH**.
2. Nếu muốn cả track theo: **🔗 Đồng bộ toàn track**.
3. Nếu chỉ frame hiện tại: **✂️ Chỉ frame này**.

### 9.3. Đồng bộ cả track

1. Đứng ở frame mẫu, **Lấy size** (hoặc nhập LWH).
2. **🔗 Đồng bộ toàn track** — tool dò dải và sửa mọi keyframe.
3. Kiểm tra vài frame; `Ctrl+S`.

### 9.4. LWH khác nhau theo frame

1. Đồng bộ toàn track trước (nếu cần).
2. Tại từng frame cần khác: nhập LWH → **✂️ Chỉ frame này**.
3. Frame đó được tạo keyframe; các frame khác giữ nguyên.

### 9.5. Ground fit cả track

1. **Object** → **🔍 Tự lấy dải frame của object**.
2. **Ground** → lấy Z → **📏 Kiểm tra đáy**.
3. Chọn `Chỉ keyframe` hoặc `Mọi frame` → **Fit**.
4. Nếu vẫn lệch: kiểm tra keyframe ngoài dải hoặc đường dốc.

### 9.6. Dọn class trước khi nộp

1. **Limits** → chọn class.
2. **🔎 Check toàn bộ class** → xem object/frame ngoài ngưỡng.
3. **📏 Clamp toàn bộ class** → sửa hàng loạt.
4. **QA** → **Quét QA** → **Export CSV**.
5. `Ctrl+S`.

### 9.7. QA trước khi submit

1. Đặt Ground Z đúng (tab Ground).
2. **QA** → **Quét QA toàn dải**.
3. Xem danh sách lỗi; sửa bằng các tab tương ứng.
4. Export CSV để lưu biên bản.
5. `Ctrl+S`.

---

## 10. An toàn dữ liệu

- Tool chỉ sửa **trong bộ nhớ**; **Ctrl+S** mới ghi lên server.
- Trước batch lớn: duplicate job hoặc export annotation để backup.
- Snapshot là undo riêng; **không thay thế** undo của CVAT.
- `Fit box theo cloud (beta)` có thể cho kết quả xấu; luôn xem lại.
- Thử 1–2 object trước khi chạy toàn class.
- Clamp mọi frame sẽ tạo keyframe ở mọi frame — dùng có ý thức.

---

## 11. Troubleshooting

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Panel không hiện | Chỉ chạy ở `/jobs/`; kiểm tra console; nhấn Alt+Q. Nếu panel ngoài màn hình, xoá `localStorage.cqt_panel_top_v2`. |
| Panel hiện `?` ở Frame hiện tại | Chưa đọc được store/player. Click vào canvas, đợi job load, thử lại. |
| "Không thấy cuboid #ID ở frame X" | Object không nằm ở frame đó. Xem Frame hiện tại; tool gợi ý frame gần nhất (ví dụ "thấy ở frame 37"). Chuyển tới đó rồi thử lại. |
| "Không đọc được point cloud" | Job không phải 3D/PCD chưa load; bản CVAT đổi cấu trúc scene. Dùng **Z box khác** hoặc nhập tay. |
| Fit xong vẫn lún | `Ground Z` sai; keyframe ngoài dải kéo box xuống; đường dốc. Kiểm tra đáy/QA. |
| Không tự về frame cũ | CVAT fork đổi class nút. Xem console; báo lại để sửa selector. |
| Không thấy nút keyframe trong sidebar | Phải mở danh sách Objects và object đang ở frame hiện tại; mở rộng object. |
| "Chỉ có 1 keyframe anchor" | CVAT bắt buộc giữ 1 keyframe để duy trì track. |
| Clamp không chạy | Checkbox **Tự clamp khi Áp dụng LWH** tắt; class của label không có limits; object đang ngoài dải. |
| Object bị kéo về min/max sai | Nhầm limits class (label `pedestrian` nhưng limits `vehicle`). Sửa/xoá class trong Limits. |
| Clamp class không đổi gì | Tất cả đã trong ngưỡng; hoặc checkbox keyframe bật nhưng object không có keyframe trong phạm vi. |
| Check class quá chậm | Job dài; bỏ "Quét toàn job" và đặt dải Start–End hẹp hơn. |
| Restore chỉ khôi phục một phần | Object đã bị xoá/đổi cấu trúc, hoặc snapshot vượt 2000 mục. |
| CSV rỗng | Chưa **Quét QA** hoặc dải không có cuboid. |
| Panel che UI | Kéo header sang vị trí khác; thu gọn bằng ✕. |
| Script cũ vẫn chạy | Gỡ/tắt bản 1.x trong dashboard, chỉ để lại v2.5. |
| localStorage đầy | Xoá bớt snapshot (`Xoá tất cả snapshot`) hoặc dữ liệu `cqt_*`. |

---

## 12. Giới hạn & roadmap

Đã có trong v2.5: 38 tính năng (LWH/preset/scale/copy, limits/clamp theo class, ground fit, cloud Z, occupancy, fit box beta, shift/rotate/smooth/decimate/resample, QA/CSV, snapshot/restore, log, kéo panel, giữ frame, đồng bộ/tách riêng, check class).

Chưa có (cân nhắc bản sau):

- **Ground profile theo từng frame** (tự lấy Z khi di chuyển, nội suy cả track).
- **Fit mặt phẳng RANSAC** cho đường dốc.
- **Split / merge / trim track**.
- **Đánh dấu outside/occluded hàng loạt**.
- **Command palette (Ctrl+K)**, macro 1 nút, multi-select.
- **Import/export preset, limits** giữa các máy.
- **Ghi chú tự động vào attribute**.
- **Per-object limit override** (hiện limits theo class).

---

## 13. Phụ lục: cơ chế & công thức

### 13.1. Mặt đáy rotation-aware

Khoảng cách từ tâm xuống điểm thấp nhất:

```
hz_eff = |R20|·L/2 + |R21|·W/2 + |R22|·H/2

R20 = sin(rx)sin(rz) − cos(rx)cos(rz)sin(ry)
R21 = sin(rx)cos(rz) + cos(rx)sin(rz)sin(ry)
R22 = cos(rx)cos(ry)
```

`bottomZ = z − hz_eff`. Khi đổi H, tool giữ `bottomZ` cũ và tính lại `z`.

### 13.2. Clamp

```
clamp(v, [min, max]) = min(max(v, min), max)
```

Áp dụng riêng cho L, W, H. Không scale.

### 13.3. Đồng bộ track

- Sửa **mọi keyframe** của object thành cùng LWH.
- Frame nội suy giữa hai keyframe có cùng giá trị → LWH không đổi.
- Không tạo keyframe mới, track không phình.

### 13.4. Tạo keyframe ngoài ý muốn

Trong CVAT, `savePoints` tại frame không phải keyframe sẽ tạo keyframe tại đó. Vì vậy:

- `Áp dụng LWH` theo dải có thể tạo nhiều keyframe.
- `Chỉ frame này` tạo 1 keyframe.
- `Đồng bộ toàn track` chỉ sửa keyframe sẵn có.

### 13.5. Point cloud

- Đọc `THREE.Points` trong scene perspective của CVAT.
- Z ground: vành khuyên quanh footprint, percentile 10, median cụm thấp.
- Occupancy: điểm trong bán kính `half-diagonal + 1m`, kiểm tra trong hộp theo hệ local.

### 13.6. Snapshot

- Lưu `points`, `keyframe`, `outside`, `occluded`.
- 6 bản gần nhất; 2000 mục/bản; localStorage.
- Restore best-effort theo `clientID` + frame.

---

## 14. Lịch sử phiên bản

- **2.5.0** — Thêm **📏 Kẹp** + **Tự kẹp limits** ngay trong tab Object (đồng bộ, lưu localStorage), **📋 Copy log** (QA) và **📋 Copy kết quả check** (Limits).
- **2.4.0** — Check/Clamp toàn bộ class; quét toàn job hoặc dải; clamp class mặc định keyframe.
- **2.3.0** — **🔗 Đồng bộ toàn track** và **✂️ Chỉ frame này**.
- **2.2.0** — Tổng số frame của object; tự dò dải; Clamp toàn track.
- **2.1.0** — Ngưỡng LWH theo class; auto clamp; cảnh báo ngoài limits; QA limits.
- **2.0.1** — Sửa lỗi không tìm thấy cuboid: ưu tiên Redux store, bỏ cache khi chuyển job, frame fallback, gợi ý frame gần nhất.
- **2.0.0** — Toolbox 4 tab; preset; scale; ground fit nâng/hạ; cloud Z; occupancy; fit box beta; track tools; QA; snapshot.
- **1.5.1** — Sửa lỗi tự nhảy frame (đúng selector, chờ load, fallback nhập frame).
- **1.5.0** — Ground Z từ point cloud / box khác.
- **1.4.0** — Fit mặt đất rotation-aware, chỉ keyframe, kiểm tra đáy.
- **1.3.0** — LWH + keyframe an toàn.

---

## 15. Bảng tra nhanh

| Nút / ô | Tab | Tác dụng |
|---|---|---|
| 🎯 Auto | Object | Lấy object đang chọn + LWH + preset/limits |
| Lấy size | Object | Đọc LWH hiện tại, cảnh báo ngoài limits |
| 📏 Kẹp | Object | Kẹp LWH đang nhập theo limits của class |
| Tự kẹp limits | Object | Bật/tắt tự kẹp khi nhập hoặc áp dụng |
| 📋 Copy log | QA | Copy log thao tác |
| 📋 Copy kết quả check | Limits | Copy báo cáo check class |
| 📐 Áp dụng LWH | Object | Áp LWH cho dải Start–End |
| 🔗 Đồng bộ toàn track | Object | Áp LWH cho mọi keyframe, cả track theo |
| ✂️ Chỉ frame này | Object | Chỉ sửa frame hiện tại |
| 💾 Lưu preset / Dùng | Object | Lưu/áp preset theo label |
| Copy (size) | Object | Điền LWH từ object khác |
| Scale | Object | Nhân LWH cả dải |
| 📋 Copy / 📥 Paste transform | Object | Sao chép toàn bộ transform |
| ⭐ Toggle keyframe | Object | Bật/gỡ keyframe tại frame |
| ⚡ Gỡ keyframe trong dải | Object | Chuyển keyframe trung gian thành nội suy |
| ☁️ Z point cloud | Ground | Lấy Z mặt đường từ PCD |
| 📊 Z box khác | Ground | Trung vị đáy các box khác |
| 📌 Z từ box này | Ground | Lấy Z từ đáy object hiện tại |
| 🧊 Occupancy | Ground | % điểm cloud trong hộp |
| 📏 Kiểm tra đáy | Ground | Đo lún/bay cả dải |
| ⬇️ Fit mặt đất | Ground | Fit theo mode/scope/hướng |
| 🎯 Fit box theo cloud | Ground | Fit LWH/orientation theo PCD (beta) |
| ↔️ Dịch chuyển | Track | Dời cả dải theo dX/dY/dZ |
| 🔄 Xoay 180° | Track | Đảo yaw |
| 〰️ Smooth vị trí | Track | Làm mượt vị trí keyframe |
| ✂️ Decimate | Track | Gỡ keyframe dư theo ngưỡng |
| ➕ Resample | Track | Thêm keyframe mỗi N frame |
| 🔎 Quét QA | QA | Quét lỗi toàn dải |
| 📤 Export CSV | QA | Xuất báo cáo QA |
| Restore | QA | Khôi phục snapshot |
| 💾 Lưu limits | Limits | Lưu ngưỡng class |
| 📏 Clamp object | Limits | Kẹp object theo dải |
| ⚡ Clamp toàn track | Limits | Kẹp cả track (tự dò dải) |
| 🔎 Check class | Limits | Báo object/frame ngoài ngưỡng |
| 📏 Clamp class | Limits | Kẹp mọi object của class |
