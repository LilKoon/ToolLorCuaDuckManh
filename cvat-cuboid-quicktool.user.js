// ==UserScript==
// @name         CVAT Cuboid Toolbox (3D)
// @namespace    https://github.com/vantixapps/cvat-tools
// @version      3.1.0
// @description  Toolbox 3D cuboid cho CVAT: thao tác kiểu Blender, LWH/preset, mặt đất theo point cloud, track tools, QA + auto-fix có xem trước.
// @author       Antigravity
// @match        https://app.cvat.ai/*
// @match        http://localhost:8080/*
// @match        http://127.0.0.1:8080/*
// @match        http://localhost:*/*
// @match        http://127.0.0.1:*/*
// @include      *://*/jobs/*
// @include      *://*cvat*/*
// @grant        none
// @inject-into  page
// @run-at       document-idle
// ==/UserScript==

// GENERATED from src/*.js by build.ps1 - do not edit directly.
(function () {
  'use strict';

  // =========================================================================
  // Cấu hình + localStorage
  // =========================================================================
  const VERSION = '3.1.0';
  const LOG = '[CVAT-Toolbox]';

  const LS = {
    presets: 'cqt_presets_v2',
    clipboard: 'cqt_clipboard_v2',
    top: 'cqt_panel_top_v2',
    limits: 'cqt_limits_v3',
    qa: 'cqt_qa_options_v3',
    settings: 'cqt_settings_v1',
  };

  // Ngưỡng LWH tiêu chuẩn theo class (m)
  const DEFAULT_LIMITS = {
    vehicle: { l: [3.2, 5.5], w: [1.6, 2.2], h: [1.5, 1.9] },
    two_wheel: { l: [1.5, 2.0], w: [0.6, 0.9], h: [1.5, 1.8] },
    pedestrian: { l: [0.65, 1.0], w: [0.65, 1.0], h: [1.2, 1.9] },
  };

  // Tuỳ chọn QA (theo file kiểm tra cvat1.xlsx)
  const DEFAULT_QA = {
    scale: true,
    scaleTol: 0.005, // m: chênh lệch so với size chuẩn (median) của track
    yaw: true,
    yawThresh: 75, // độ, giữa 2 frame liên tiếp
    overlap: true,
    pedPedIoU: 0.5, // pedestrian-pedestrian cho phép IoU tối đa; cặp khác không cho phép chồng lấn
    dist: true,
    distThresh: 100, // m, tính từ gốc toạ độ
    limits: true,
    wholeJob: true,
  };

  const DEFAULT_SETTINGS = {
    blenderKeys: true, // G/R/S, Numpad 7/1/3/. trên canvas 3D
    bounceRefresh: false, // làm mới canvas bằng cách chuyển frame (chậm, dự phòng)
  };

  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(LOG, 'localStorage lỗi:', e);
    }
  }

  function loadOpts(key, defaults) {
    const saved = lsGet(key, null);
    return { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
  }

  function getSettings() {
    return loadOpts(LS.settings, DEFAULT_SETTINGS);
  }

  function getQAOptions() {
    return loadOpts(LS.qa, DEFAULT_QA);
  }

  // =========================================================================
  // Toán học hộp xoay
  // CVAT: points = [x, y, z, rx, ry, rz, L, W, H], góc radian, Euler 'XYZ' của three.js
  // =========================================================================
  const DEG = 180 / Math.PI;
  const RAD = Math.PI / 180;

  function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
  }

  function wrapPi(a) {
    let r = (a + Math.PI) % (2 * Math.PI);
    if (r < 0) r += 2 * Math.PI;
    return r - Math.PI;
  }

  // |a - b| trên vòng tròn, trong [0, π]
  function angleDiff(a, b) {
    return Math.abs(wrapPi(a - b));
  }

  function rotationMatrix(rx, ry, rz) {
    const ca = Math.cos(rx), sa = Math.sin(rx);
    const cb = Math.cos(ry), sb = Math.sin(ry);
    const cc = Math.cos(rz), sc = Math.sin(rz);
    return [
      [cb * cc, -cb * sc, sb],
      [ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb],
      [sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb],
    ];
  }

  function lowestOffset(p) {
    const R = rotationMatrix(p[3], p[4], p[5]);
    return Math.abs(R[2][0]) * Math.abs(p[6]) / 2 +
      Math.abs(R[2][1]) * Math.abs(p[7]) / 2 +
      Math.abs(R[2][2]) * Math.abs(p[8]) / 2;
  }

  function bottomZ(p) {
    return p[2] - lowestOffset(p);
  }

  function boxCorners(p) {
    const R = rotationMatrix(p[3], p[4], p[5]);
    const hx = Math.abs(p[6]) / 2, hy = Math.abs(p[7]) / 2, hz = Math.abs(p[8]) / 2;
    const out = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const lx = sx * hx, ly = sy * hy, lz = sz * hz;
          out.push([
            p[0] + R[0][0] * lx + R[0][1] * ly + R[0][2] * lz,
            p[1] + R[1][0] * lx + R[1][1] * ly + R[1][2] * lz,
            p[2] + R[2][0] * lx + R[2][1] * ly + R[2][2] * lz,
          ]);
        }
      }
    }
    return out;
  }

  // Đổi LWH, tuỳ chọn giữ nguyên cao độ đáy
  function withLWH(points, l, w, h, keepGround) {
    const p = [...points];
    const oldBottom = bottomZ(p);
    p[6] = l;
    p[7] = w;
    p[8] = h;
    if (keepGround) p[2] = oldBottom + lowestOffset(p);
    return p;
  }

  function sameLWH(p, l, w, h, eps = 1e-6) {
    return Math.abs(p[6] - l) < eps && Math.abs(p[7] - w) < eps && Math.abs(p[8] - h) < eps;
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function percentile(values, q) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[clamp(Math.floor(sorted.length * q), 0, sorted.length - 1)];
  }

  function fmtSigned(n, digits = 2) {
    return (n >= 0 ? '+' : '') + n.toFixed(digits);
  }

  function fmtLWH(l, w, h) {
    return `${l.toFixed(2)} x ${w.toFixed(2)} x ${h.toFixed(2)}`;
  }

  // =========================================================================
  // Mặt phẳng đất z = a·x + b·y + c (mặt phẳng ngang: a = b = 0)
  // =========================================================================
  function flatPlane(z) {
    return { a: 0, b: 0, c: z, slopeDeg: 0 };
  }

  function planeZ(plane, x, y) {
    return plane.a * x + plane.b * y + plane.c;
  }

  // Góc rx, ry để trục Z của hộp vuông góc mặt phẳng.
  // Với Euler XYZ, trục Z local = cột 2 của R = [sin ry, -sin rx·cos ry, cos rx·cos ry], không phụ thuộc rz.
  function anglesForPlane(plane) {
    const n = Math.hypot(plane.a, plane.b, 1);
    const nx = -plane.a / n, ny = -plane.b / n, nz = 1 / n;
    return { rx: Math.atan2(-ny, nz), ry: Math.asin(clamp(nx, -1, 1)) };
  }

  // Khoảng cách từ góc thấp nhất của hộp tới mặt phẳng (dương = lơ lửng, âm = lún)
  function groundGap(p, plane) {
    let gap = Infinity;
    for (const c of boxCorners(p)) gap = Math.min(gap, c[2] - planeZ(plane, c[0], c[1]));
    return gap;
  }

  // mode: 'snap' giữ nghiêng | 'flat' rx=ry=0 | 'tilt' nghiêng theo dốc
  function fitToGround(points, plane, mode) {
    const p = [...points];
    if (mode === 'flat') {
      p[3] = 0;
      p[4] = 0;
    } else if (mode === 'tilt') {
      const { rx, ry } = anglesForPlane(plane);
      p[3] = rx;
      p[4] = ry;
    }
    p[2] -= groundGap(p, plane);
    return p;
  }

  function fitPlaneLSQ(pts) {
    const n = pts.length;
    if (n < 3) return null;
    let mx = 0, my = 0, mz = 0;
    for (const q of pts) { mx += q[0]; my += q[1]; mz += q[2]; }
    mx /= n; my /= n; mz /= n;
    let sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
    for (const q of pts) {
      const dx = q[0] - mx, dy = q[1] - my, dz = q[2] - mz;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy; sxz += dx * dz; syz += dy * dz;
    }
    const det = sxx * syy - sxy * sxy;
    if (Math.abs(det) < 1e-9) return null;
    const a = (sxz * syy - syz * sxy) / det;
    const b = (syz * sxx - sxz * sxy) / det;
    return { a, b, c: mz - a * mx - b * my };
  }

  // Ước lượng mặt đất cục bộ quanh hộp từ point cloud (vành khuyên quanh footprint, lọc dần outlier)
  function estimateGroundPlane(points, positions) {
    const cx = points[0], cy = points[1];
    const l = Math.abs(points[6]), w = Math.abs(points[7]);
    const rOut = 0.5 * Math.hypot(l, w) + 4.5;
    const cos = Math.cos(-points[5]), sin = Math.sin(-points[5]);
    const inX = l / 2 + 0.3, inY = w / 2 + 0.3;

    const ring = [];
    for (let i = 0; i + 2 < positions.length; i += 3) {
      const z = positions[i + 2];
      if (!Number.isFinite(z)) continue;
      const dx = positions[i] - cx, dy = positions[i + 1] - cy;
      if (dx * dx + dy * dy > rOut * rOut) continue;
      const lx = dx * cos - dy * sin, ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= inX && Math.abs(ly) <= inY) continue;
      ring.push([positions[i], positions[i + 1], z]);
    }
    if (ring.length < 15) return null;

    ring.sort((a, b) => a[2] - b[2]);
    const cut = ring[Math.floor(ring.length * 0.35)][2] + 0.15;
    let ground = ring.filter((q) => q[2] <= cut);
    let plane = fitPlaneLSQ(ground);
    for (let iter = 0; plane && iter < 3; iter++) {
      const kept = ground.filter((q) => Math.abs(q[2] - planeZ(plane, q[0], q[1])) <= 0.12);
      if (kept.length < 10 || kept.length === ground.length) break;
      ground = kept;
      plane = fitPlaneLSQ(ground) || plane;
    }
    if (!plane || ground.length < 10) return null;
    return { ...plane, slopeDeg: Math.atan(Math.hypot(plane.a, plane.b)) * DEG, count: ground.length };
  }

  // =========================================================================
  // Point cloud trong hộp, PCA hướng
  // =========================================================================
  function pointsInBox(p, positions, margin = 0) {
    const R = rotationMatrix(p[3], p[4], p[5]);
    const hx = Math.abs(p[6]) / 2 + margin, hy = Math.abs(p[7]) / 2 + margin, hz = Math.abs(p[8]) / 2 + margin;
    const r2 = hx * hx + hy * hy + hz * hz;
    const out = [];
    for (let i = 0; i + 2 < positions.length; i += 3) {
      const dx = positions[i] - p[0], dy = positions[i + 1] - p[1], dz = positions[i + 2] - p[2];
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      // local = Rᵀ·d
      const lx = R[0][0] * dx + R[1][0] * dy + R[2][0] * dz;
      const ly = R[0][1] * dx + R[1][1] * dy + R[2][1] * dz;
      const lz = R[0][2] * dx + R[1][2] * dy + R[2][2] * dz;
      if (Math.abs(lx) <= hx && Math.abs(ly) <= hy && Math.abs(lz) <= hz) {
        out.push([positions[i], positions[i + 1], positions[i + 2]]);
      }
    }
    return out;
  }

  // Trục chính của cụm điểm trên mặt XY (mod π)
  function pcaYaw(pts) {
    const n = pts.length;
    let mx = 0, my = 0;
    for (const q of pts) { mx += q[0]; my += q[1]; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const q of pts) {
      const dx = q[0] - mx, dy = q[1] - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    return 0.5 * Math.atan2(2 * sxy, sxx - syy);
  }

  // Trong 4 hướng yaw + k·90°, chọn hướng gần góc hiện tại nhất (giữ L theo đầu xe)
  function nearestQuarterYaw(yaw, current) {
    let best = yaw, bestDiff = Infinity;
    for (let k = 0; k < 4; k++) {
      const cand = wrapPi(yaw + k * Math.PI / 2);
      const d = angleDiff(cand, current);
      if (d < bestDiff) { bestDiff = d; best = cand; }
    }
    return best;
  }

  // =========================================================================
  // BEV (nhìn từ trên): đa giác hộp, diện tích giao, IoU
  // =========================================================================
  function bevCorners(p) {
    const c = Math.cos(p[5]), s = Math.sin(p[5]);
    const hl = Math.abs(p[6]) / 2, hw = Math.abs(p[7]) / 2;
    return [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]]
      .map(([x, y]) => [p[0] + x * c - y * s, p[1] + x * s + y * c]); // CCW
  }

  function polyArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      a += x1 * y2 - x2 * y1;
    }
    return Math.abs(a) / 2;
  }

  // Sutherland–Hodgman, clip là đa giác lồi CCW
  function clipPolygon(subject, clip) {
    let out = subject;
    for (let i = 0; i < clip.length && out.length; i++) {
      const A = clip[i], B = clip[(i + 1) % clip.length];
      const inside = (P) => (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]) >= 0;
      const cross = (P, Q) => {
        const den = (P[0] - Q[0]) * (A[1] - B[1]) - (P[1] - Q[1]) * (A[0] - B[0]);
        if (Math.abs(den) < 1e-12) return Q;
        const t = ((P[0] - A[0]) * (A[1] - B[1]) - (P[1] - A[1]) * (A[0] - B[0])) / den;
        return [P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])];
      };
      const input = out;
      out = [];
      for (let j = 0; j < input.length; j++) {
        const P = input[j], Q = input[(j + 1) % input.length];
        const pIn = inside(P), qIn = inside(Q);
        if (qIn) {
          if (!pIn) out.push(cross(P, Q));
          out.push(Q);
        } else if (pIn) {
          out.push(cross(P, Q));
        }
      }
    }
    return out;
  }

  // null nếu không giao; ngược lại { inter, iou, ioa1, ioa2 }
  function bevOverlap(p1, p2) {
    const r1 = 0.5 * Math.hypot(p1[6], p1[7]), r2 = 0.5 * Math.hypot(p2[6], p2[7]);
    const dx = p1[0] - p2[0], dy = p1[1] - p2[1];
    if (dx * dx + dy * dy >= (r1 + r2) * (r1 + r2)) return null;
    const poly = clipPolygon(bevCorners(p1), bevCorners(p2));
    if (poly.length < 3) return null;
    const inter = polyArea(poly);
    if (inter <= 0) return null;
    const a1 = Math.abs(p1[6] * p1[7]), a2 = Math.abs(p2[6] * p2[7]);
    return { inter, iou: inter / (a1 + a2 - inter), ioa1: inter / a1, ioa2: inter / a2 };
  }

  // =========================================================================
  // Cầu nối CVAT: Redux store, job, frame, ObjectState, canvas 3D
  // =========================================================================
  let cachedStore = null;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function hasAnnotationState(store) {
    try {
      return !!store?.getState?.()?.annotation;
    } catch (e) {
      return false;
    }
  }

  // Tìm store qua React fiber (Provider nằm phía trên các component CVAT)
  function findStoreFromFiber() {
    const selectors = [
      '.cvat-canvas-container',
      '.cvat-objects-sidebar',
      '.cvat-player-frame-selector',
      '.cvat-annotation-header',
      '#root > *',
      '#root',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const key = Object.keys(el).find((k) => (
        k.startsWith('__reactFiber$') ||
        k.startsWith('__reactInternalInstance$') ||
        k.startsWith('__reactContainer$')
      ));
      if (!key) continue;
      let fiber = el[key];
      if (fiber?.current) fiber = fiber.current;
      for (let depth = 0; fiber && depth < 1000; depth++) {
        const props = fiber.memoizedProps;
        const store = props?.store || props?.value?.store;
        if (hasAnnotationState(store)) return store;
        fiber = fiber.return;
      }
    }
    return null;
  }

  function getStore() {
    if (hasAnnotationState(cachedStore)) return cachedStore;
    cachedStore = hasAnnotationState(window.store) ? window.store : findStoreFromFiber();
    return cachedStore;
  }

  function annotationState() {
    return getStore()?.getState()?.annotation || null;
  }

  // Job hiện tại luôn đọc từ store => tự đúng khi chuyển job trong SPA
  function getJob() {
    const job = annotationState()?.job?.instance;
    return job && typeof job.annotations?.get === 'function' ? job : null;
  }

  function frameInput() {
    return document.querySelector('.cvat-player-frame-selector input') ||
      document.querySelector('input.cvat-player-frame-selector');
  }

  function getFrame() {
    const n = annotationState()?.player?.frame?.number;
    if (Number.isInteger(n)) return n;
    const v = parseInt(frameInput()?.value, 10);
    return Number.isInteger(v) ? v : undefined;
  }

  function activeId() {
    const id = annotationState()?.annotations?.activatedStateID;
    return Number.isInteger(id) ? id : null;
  }

  function labelName(s) {
    return typeof s?.label === 'string' ? s.label : (s?.label?.name || '');
  }

  function isCuboid(s) {
    return !!s?.points && s.points.length >= 9;
  }

  // Track: chỉ keyframe; shape: luôn coi như keyframe
  function isKey(s) {
    return s?.objectType !== 'track' || !!s.keyframe;
  }

  function jobBounds() {
    const job = getJob();
    if (!job) return null;
    const start = Number.isInteger(job.startFrame) ? job.startFrame : 0;
    const stop = Number.isInteger(job.stopFrame) ? job.stopFrame : null;
    return stop === null ? null : { start, stop };
  }

  async function getStates(frame) {
    const job = getJob();
    if (!job) return [];
    return job.annotations.get(frame, true);
  }

  async function getState(id, frame) {
    const states = await getStates(frame);
    const key = String(id);
    return states.find((s) => String(s.clientID) === key) ||
      states.find((s) => s.serverID !== undefined && String(s.serverID) === key) ||
      null;
  }

  async function saveState(state) {
    if (typeof state?.save !== 'function') throw new Error('ObjectState.save() không tồn tại');
    return state.save();
  }

  // Tên file frame (cột "Item ID" trong báo cáo QA)
  const frameNameCache = new Map();
  async function frameName(frame) {
    const job = getJob();
    const key = `${job?.id}:${frame}`;
    if (frameNameCache.has(key)) return frameNameCache.get(key);
    let name = '';
    try {
      const data = await job.frames.get(frame);
      name = String(data?.filename || data?.name || '').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
    } catch (e) {}
    frameNameCache.set(key, name);
    return name;
  }

  // =========================================================================
  // Làm mới canvas sau khi sửa annotation
  // =========================================================================
  async function refreshViaStore() {
    try {
      const store = getStore();
      const job = getJob();
      const frame = getFrame();
      if (!store || !job || !Number.isInteger(frame)) return false;
      const root = store.getState();
      const ann = root.annotation.annotations;
      const showAll = !!root.settings?.workspace?.showAllInterpolationTracks;
      const states = await job.annotations.get(frame, showAll, ann.filters || []);
      const history = typeof job.actions?.get === 'function' ? await job.actions.get() : ann.history;
      // Cùng action CVAT dùng sau undo/redo
      store.dispatch({
        type: 'FETCH_ANNOTATIONS_SUCCESS',
        payload: { states, history, minZ: ann.zLayer?.min ?? 0, maxZ: ann.zLayer?.max ?? 0 },
      });
      return true;
    } catch (e) {
      console.warn(LOG, 'Làm mới qua store lỗi, chuyển sang đổi frame:', e);
      return false;
    }
  }

  async function waitForFrame(target, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const f = annotationState()?.player?.frame;
      if (f && f.number === target && !f.fetching) return true;
      await sleep(60);
    }
    return getFrame() === target;
  }

  async function goToFrame(target) {
    if (getFrame() === target) return true;
    const input = frameInput();
    if (!input) return false;
    try {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      input.focus();
      setter.call(input, String(target));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(80);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      input.blur();
      return await waitForFrame(target, 5000);
    } catch (e) {
      return false;
    }
  }

  // Dự phòng: sang frame bên cạnh rồi quay lại để CVAT vẽ lại
  async function bounceFrame() {
    const original = getFrame();
    const b = jobBounds();
    if (!Number.isInteger(original) || !b || b.start === b.stop) return true;
    const other = original < b.stop ? original + 1 : original - 1;
    await goToFrame(other);
    return goToFrame(original);
  }

  async function refreshView() {
    if (!getSettings().bounceRefresh && await refreshViaStore()) return true;
    return bounceFrame();
  }

  function activateObject(id) {
    try {
      getStore()?.dispatch({
        type: 'ACTIVATE_OBJECT',
        payload: { activatedStateID: id, activatedElementID: null, activatedAttributeID: null },
      });
    } catch (e) {}
  }

  async function jumpTo(id, frame) {
    if (Number.isInteger(frame)) await goToFrame(frame);
    if (Number.isInteger(id)) {
      setField('cqt-target-id', id);
      activateObject(id);
    }
  }

  // =========================================================================
  // Canvas 3D (three.js) của CVAT
  // =========================================================================
  function getCanvas3dViews() {
    return annotationState()?.canvas?.instance?.view?.views || null;
  }

  function getPerspectiveView() {
    const v = getCanvas3dViews()?.perspective;
    return v?.camera ? v : null;
  }

  function getPointCloudPositions() {
    const views = getCanvas3dViews();
    if (!views) return null;
    for (const key of ['perspective', 'top', 'side', 'front']) {
      const cloud = views[key]?.scene?.children?.find(
        (o) => o?.isPoints && o.geometry?.attributes?.position?.array?.length
      );
      if (cloud) return cloud.geometry.attributes.position.array;
    }
    return null;
  }

  // Mesh cuboid trong view perspective (CVAT đặt name = clientID)
  function findDrawnMesh(id) {
    const scene = getPerspectiveView()?.scene;
    if (!scene) return null;
    const name = String(id);
    let found = null;
    scene.traverse?.((o) => {
      if (!found && o.isMesh && o.name === name) found = o;
    });
    return found;
  }

  // =========================================================================
  // Ô nhập, trạng thái, log
  // =========================================================================
  function $(id) {
    return document.getElementById(id);
  }

  function val(id) {
    return $(id)?.value;
  }

  function numVal(id) {
    const raw = val(id);
    if (raw === undefined || String(raw).trim() === '') return NaN;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : NaN;
  }

  function intVal(id) {
    const n = parseInt(val(id), 10);
    return Number.isInteger(n) ? n : NaN;
  }

  function isChecked(id) {
    return !!$(id)?.checked;
  }

  function setField(id, value) {
    const el = $(id);
    if (el) el.value = value;
  }

  function setStatus(msg, type = '') {
    const el = $('cqt-status');
    if (el) {
      el.textContent = msg;
      el.className = 'cqt-status ' + type;
    }
    const log = $('cqt-log');
    if (log && type) {
      const lines = [`[${new Date().toLocaleTimeString()}] ${msg}`, ...log.textContent.split('\n')];
      log.textContent = lines.slice(0, 60).join('\n');
    }
  }

  function fail(msg) {
    setStatus('⚠️ ' + msg, 'error');
    return null;
  }

  function resolveTargetId() {
    const typed = intVal('cqt-target-id');
    if (Number.isInteger(typed)) return typed;
    return activeId();
  }

  function requireTarget() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return fail('Nhập Target Object ID hoặc chọn 1 object!');
    if (!getJob()) return fail('Chưa kết nối CVAT Job!');
    return id;
  }

  function readRange() {
    const targetId = requireTarget();
    if (targetId === null) return null;
    const startFrame = intVal('cqt-frame-start');
    const endFrame = intVal('cqt-frame-end');
    if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame) || startFrame > endFrame) {
      return fail('Dải frame không hợp lệ (Start <= End)!');
    }
    return { targetId, startFrame, endFrame };
  }

  async function requireCuboidAtFrame(id, frame = getFrame()) {
    if (!Number.isInteger(frame)) return fail('Không đọc được frame hiện tại.');
    const s = await getState(id, frame);
    if (!isCuboid(s)) return fail(`Không thấy cuboid #${id} ở frame ${frame}.`);
    return s;
  }

  function editSuffix(res) {
    let msg = ' Ctrl+S để lưu.';
    if (res.errors) msg += ` ⚠️ ${res.errors} lần lưu lỗi (xem Console).`;
    if (!res.restored) msg += ' ⚠️ Canvas chưa làm mới, hãy chuyển frame.';
    return msg;
  }

  // =========================================================================
  // Snapshot (undo riêng cho thao tác hàng loạt) — lưu trong bộ nhớ theo job,
  // vì clientID chỉ có giá trị trong phiên hiện tại của trang.
  // CVAT vẫn ghi từng lần save vào lịch sử riêng (Ctrl+Z của CVAT).
  // =========================================================================
  const snapshots = [];

  function snapshotItem(state, frame) {
    return {
      clientID: state.clientID,
      frame,
      objectType: state.objectType,
      points: [...state.points],
      keyframe: isKey(state),
      outside: !!state.outside,
      occluded: !!state.occluded,
    };
  }

  function pushSnapshot(label, items) {
    if (!items.length) return;
    snapshots.unshift({ jobId: getJob()?.id, ts: Date.now(), label, items });
    if (snapshots.length > 10) snapshots.length = 10;
    refreshSnapshotList();
  }

  function refreshSnapshotList() {
    const select = $('cqt-snap-select');
    if (!select) return;
    const jobId = getJob()?.id;
    select.innerHTML = '';
    const list = snapshots.map((s, i) => ({ s, i })).filter(({ s }) => s.jobId === jobId);
    if (!list.length) {
      select.add(new Option('(chưa có snapshot)', ''));
      return;
    }
    for (const { s, i } of list) {
      select.add(new Option(`${new Date(s.ts).toLocaleTimeString()} · ${s.label} · ${s.items.length}`, String(i)));
    }
  }

  async function restoreSnapshot(index) {
    const snap = snapshots[index];
    if (!snap) return fail('Không có snapshot để khôi phục.');
    if (snap.jobId !== getJob()?.id) return fail('Snapshot thuộc job khác.');
    if (!confirm(`Khôi phục snapshot "${snap.label}" (${snap.items.length} mục)?`)) return;

    setStatus(`⏳ Đang khôi phục "${snap.label}"...`);
    let restored = 0;
    let errors = 0;
    // Đi ngược thứ tự đã sửa
    for (const item of [...snap.items].reverse()) {
      try {
        const s = await getState(item.clientID, item.frame);
        if (!s) continue;
        // Không gỡ keyframe (quy định dự án): frame vốn nội suy sẽ giữ keyframe, nhưng về đúng giá trị cũ
        s.points = item.points;
        if (s.objectType === 'track') s.outside = item.outside;
        s.occluded = item.occluded;
        await saveState(s);
        restored++;
      } catch (e) {
        errors++;
        console.warn(LOG, 'Restore lỗi tại frame', item.frame, e);
      }
    }
    const ok = await refreshView();
    setStatus(
      `✅ Đã khôi phục ${restored}/${snap.items.length} mục từ "${snap.label}".` +
      (errors ? ` ⚠️ ${errors} lỗi.` : '') + (ok ? '' : ' Hãy chuyển frame để thấy thay đổi.'),
      errors ? 'warn' : 'success'
    );
  }

  // =========================================================================
  // Batch: mọi thao tác sửa đều đi qua đây (snapshot + await save + refresh)
  // =========================================================================
  function createBatch(label) {
    const items = [];
    const seen = new Set();
    let changed = 0;
    let errors = 0;
    return {
      // mutate(state) trả về false = không đổi gì
      async edit(state, frame, mutate) {
        const before = snapshotItem(state, frame);
        if (mutate(state) === false) return false;
        try {
          await saveState(state);
        } catch (e) {
          errors++;
          console.warn(LOG, `Lưu #${state.clientID} frame ${frame} lỗi:`, e);
          return false;
        }
        const key = `${state.clientID}:${frame}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push(before);
        }
        changed++;
        return true;
      },
      get changed() {
        return changed;
      },
      async finish(refresh = true) {
        pushSnapshot(label, items);
        const restored = changed && refresh ? await refreshView() : true;
        return { changed, errors, restored };
      },
    };
  }

  // Sửa 1 object trên dải frame
  async function editRange(label, opts, mutate) {
    const { targetId, startFrame, endFrame, keyframesOnly = false, includeOutside = false } = opts;
    const batch = createBatch(label);
    let skipped = 0;
    let seen = 0;
    for (let f = startFrame; f <= endFrame; f++) {
      if (f > startFrame && (f - startFrame) % 25 === 0) {
        setStatus(`⏳ ${label}: frame ${f}/${endFrame}...`);
        await sleep(0);
      }
      const s = await getState(targetId, f);
      if (!isCuboid(s)) continue;
      if (s.outside && !includeOutside) { skipped++; continue; }
      seen++;
      if (keyframesOnly && !isKey(s)) { skipped++; continue; }
      await batch.edit(s, f, (st) => mutate(st, f));
    }
    const res = await batch.finish();
    return { ...res, skipped, seen };
  }

  // Các frame (không outside) có object, có thể kèm cả frame nội suy
  async function collectTrack(id, from, to) {
    const b = jobBounds();
    if (b) {
      from = Math.max(from, b.start);
      to = Math.min(to, b.stop);
    }
    const out = [];
    for (let f = from; f <= to; f++) {
      if (f > from && (f - from) % 100 === 0) {
        setStatus(`⏳ Đọc #${id}: frame ${f}/${to}...`);
        await sleep(0);
      }
      const s = await getState(id, f);
      if (isCuboid(s) && !s.outside) out.push({ frame: f, state: s });
    }
    return out;
  }

  // Dò frame đầu/cuối của object trong job (không ghi vào ô nhập)
  async function detectSpan(id) {
    const b = jobBounds();
    if (!b) return fail('Không đọc được dải frame của job.');
    const list = await collectTrack(id, b.start, b.stop);
    if (!list.length) return fail(`Không thấy object #${id} trong job.`);
    return { startFrame: list[0].frame, endFrame: list[list.length - 1].frame, count: list.length };
  }

  // =========================================================================
  // Mặt đất: một "ground plane" duy nhất (dốc từ point cloud, hoặc phẳng theo Z)
  // =========================================================================
  let groundPlane = null; // { a, b, c, slopeDeg, count?, source }

  function setGroundPlane(plane, source, refPoints) {
    groundPlane = { ...plane, source };
    const el = $('cqt-plane-display');
    if (el) {
      const z0 = refPoints ? planeZ(plane, refPoints[0], refPoints[1]) : plane.c;
      el.textContent = plane.a || plane.b
        ? `Plane dốc ${plane.slopeDeg.toFixed(1)}°: Z = ${fmtSigned(plane.a, 4)}·X ${fmtSigned(plane.b, 4)}·Y ${fmtSigned(plane.c, 3)} ` +
          `(Z tại box ≈ ${z0.toFixed(3)}m${plane.count ? `, ${plane.count} điểm` : ''}) — ${source}`
        : `Mặt phẳng ngang Z = ${plane.c.toFixed(3)}m — ${source}`;
    }
    if (!(plane.a || plane.b)) setField('cqt-ground-z', plane.c.toFixed(3));
  }

  function onGroundZInput() {
    const z = numVal('cqt-ground-z');
    if (Number.isFinite(z)) setGroundPlane(flatPlane(z), 'nhập tay');
  }

  function planeFromCloud(points) {
    const positions = getPointCloudPositions();
    if (!positions) return null;
    return estimateGroundPlane(points, positions);
  }

  async function calcGroundPlane() {
    const id = requireTarget();
    if (id === null) return null;
    const s = await requireCuboidAtFrame(id);
    if (!s) return null;
    if (!getPointCloudPositions()) return fail('Không đọc được point cloud.');
    const plane = planeFromCloud(s.points);
    if (!plane) return fail('Không đủ điểm quanh object để fit mặt đất.');
    setGroundPlane(plane, `cloud quanh #${id} @f${getFrame()}`, s.points);
    setStatus(`📐 Đã tính plane dốc ${plane.slopeDeg.toFixed(1)}° từ ${plane.count} điểm. Bấm "Fit mặt đất".`, 'success');
    return plane;
  }

  async function groundFromOthers() {
    const frame = getFrame();
    if (!Number.isInteger(frame)) return fail('Không đọc được frame hiện tại.');
    const targetId = resolveTargetId();
    const zs = (await getStates(frame))
      .filter((s) => s.clientID !== targetId && !s.outside && isCuboid(s))
      .map((s) => bottomZ(s.points));
    if (zs.length < 2) return fail(`Cần ít nhất 2 cuboid khác ở frame ${frame} (đang có ${zs.length}).`);
    const z = median(zs);
    setGroundPlane(flatPlane(z), `trung vị đáy ${zs.length} box khác @f${frame}`);
    setStatus(`📊 Ground Z = ${z.toFixed(3)}m (trung vị ${zs.length} box khác).`, 'success');
  }

  async function groundFromThisBox() {
    const id = requireTarget();
    if (id === null) return;
    const s = await requireCuboidAtFrame(id);
    if (!s) return;
    const z = bottomZ(s.points);
    setGroundPlane(flatPlane(z), `đáy #${id}`);
    setStatus(`📌 Ground Z = đáy #${id}: ${z.toFixed(3)}m.`, 'success');
  }

  async function ensureGroundPlane() {
    if (groundPlane) return groundPlane;
    return calcGroundPlane();
  }

  function groundRange(range) {
    if (val('cqt-ground-scope') !== 'current') return { from: range.startFrame, to: range.endFrame };
    const f = getFrame();
    return Number.isInteger(f) ? { from: f, to: f } : null;
  }

  async function checkGround() {
    const range = readRange();
    if (!range) return;
    const plane = await ensureGroundPlane();
    if (!plane) return;
    const r = groundRange(range);
    if (!r) return fail('Không đọc được frame hiện tại.');

    setStatus(`⏳ Đang đo đáy #${range.targetId}...`);
    let minGap = Infinity, maxGap = -Infinity, frames = 0, sunk = 0, floating = 0;
    for (const { state } of await collectTrack(range.targetId, r.from, r.to)) {
      const gap = groundGap(state.points, plane);
      frames++;
      if (gap < -0.01) sunk++;
      if (gap > 0.01) floating++;
      minGap = Math.min(minGap, gap);
      maxGap = Math.max(maxGap, gap);
    }
    if (!frames) return fail(`Không thấy #${range.targetId} trong dải.`);
    setStatus(
      `📏 Đáy #${range.targetId} so với mặt đất: min ${fmtSigned(minGap, 3)}m, max ${fmtSigned(maxGap, 3)}m ` +
      `trên ${frames} frame. ${sunk} lún, ${floating} lơ lửng >1cm.`,
      sunk + floating ? 'warn' : 'success'
    );
  }

  async function applyGroundFit() {
    const range = readRange();
    if (!range) return;
    const plane = await ensureGroundPlane();
    if (!plane) return;
    const r = groundRange(range);
    if (!r) return fail('Không đọc được frame hiện tại.');

    const mode = val('cqt-ground-mode') || 'snap';
    const direction = val('cqt-ground-direction') || 'both';
    const keyframesOnly = val('cqt-ground-scope') === 'keyframes';
    let skippedDir = 0;
    let minDz = Infinity, maxDz = -Infinity;

    const res = await editRange('Fit mặt đất', {
      targetId: range.targetId, startFrame: r.from, endFrame: r.to, keyframesOnly,
    }, (s) => {
      const after = fitToGround(s.points, plane, mode);
      const dz = after[2] - s.points[2];
      const rotChanged = Math.abs(after[3] - s.points[3]) > 1e-6 || Math.abs(after[4] - s.points[4]) > 1e-6;
      if (Math.abs(dz) < 1e-4 && !rotChanged) return false;
      if ((direction === 'down' && dz > 0) || (direction === 'up' && dz < 0)) {
        skippedDir++;
        return false;
      }
      s.points = after;
      minDz = Math.min(minDz, dz);
      maxDz = Math.max(maxDz, dz);
      return true;
    });

    if (!res.changed) {
      if (!res.seen) return fail(`Không thấy #${range.targetId} trong dải.`);
      return setStatus(
        keyframesOnly && res.skipped === res.seen
          ? 'ℹ️ Không có keyframe nào trong dải. Chọn phạm vi "Mọi frame".'
          : `ℹ️ Không có frame nào cần đổi${skippedDir ? ` (bỏ qua ${skippedDir} do hướng "${direction}")` : ''}.`,
        'warn'
      );
    }
    setStatus(
      `✅ Fit mặt đất #${range.targetId}: ${res.changed} frame (dz ${fmtSigned(minDz, 3)} → ${fmtSigned(maxDz, 3)}m).` +
      (skippedDir ? ` Bỏ qua ${skippedDir} frame do hướng "${direction}".` : '') + editSuffix(res),
      'success'
    );
  }

  // Alt+G: đặt object(s) lên mặt đất cục bộ (tính từ cloud quanh từng object) tại frame hiện tại
  async function quickGroundSnap(ids) {
    const frame = getFrame();
    if (!Number.isInteger(frame)) return fail('Không đọc được frame hiện tại.');
    const list = ids?.length ? ids : [resolveTargetId()].filter(Number.isInteger);
    if (!list.length) return fail('Chọn object trước!');

    const mode = val('cqt-ground-mode') || 'snap';
    const batch = createBatch('Hạ chạm đất');
    let noCloud = 0;
    for (const id of list) {
      const s = await getState(id, frame);
      if (!isCuboid(s) || s.outside) continue;
      const plane = planeFromCloud(s.points) || groundPlane;
      if (!plane) { noCloud++; continue; }
      await batch.edit(s, frame, (st) => {
        const after = fitToGround(st.points, plane, mode);
        if (Math.abs(after[2] - st.points[2]) < 1e-4 && mode === 'snap') return false;
        st.points = after;
        return true;
      });
    }
    const res = await batch.finish();
    if (!res.changed) {
      return setStatus(noCloud ? '⚠️ Không đủ điểm cloud để tìm mặt đất.' : 'ℹ️ Đã nằm sát mặt đất.', noCloud ? 'error' : 'success');
    }
    setStatus(`⬇️ Đã hạ chạm đất ${res.changed} object tại frame ${frame}.` + editSuffix(res), 'success');
  }

  // =========================================================================
  // Smart Snap: hút box theo cụm điểm LiDAR
  // =========================================================================

  // Trả về { points, n } hoặc { error }.
  // Lặp: mỗi lượt cắt lại cụm điểm theo box của lượt trước, để hướng không bị lệch do box ban đầu xoay sai.
  function computeSmartSnap(p, positions, fitSize) {
    let result = smartSnapOnce(p, positions, fitSize, p[5]);
    for (let iter = 0; iter < 4 && !result.error; iter++) {
      const next = smartSnapOnce(result.points, positions, fitSize, p[5]);
      if (next.error) break;
      const converged = angleDiff(next.points[5], result.points[5]) < 0.2 * RAD &&
        Math.hypot(next.points[0] - result.points[0], next.points[1] - result.points[1]) < 0.01;
      result = next;
      if (converged) break;
    }
    return result;
  }

  function smartSnapOnce(p, positions, fitSize, refYaw) {
    const plane = estimateGroundPlane(p, positions);
    let pts = pointsInBox(p, positions, 0.3);
    // Bỏ điểm mặt đường
    if (plane) {
      pts = pts.filter((q) => q[2] - planeZ(plane, q[0], q[1]) > 0.15);
    } else if (pts.length) {
      const floor = percentile(pts.map((q) => q[2]), 0.02) + 0.15;
      pts = pts.filter((q) => q[2] > floor);
    }
    if (pts.length < 10) return { error: `Chỉ có ${pts.length} điểm trong vùng box (cần ≥ 10).` };

    const yaw = nearestQuarterYaw(pcaYaw(pts), refYaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    let mx = 0, my = 0;
    for (const q of pts) { mx += q[0]; my += q[1]; }
    mx /= pts.length;
    my /= pts.length;
    const us = pts.map((q) => (q[0] - mx) * c + (q[1] - my) * s);
    const vs = pts.map((q) => -(q[0] - mx) * s + (q[1] - my) * c);
    const uMin = percentile(us, 0.02), uMax = percentile(us, 0.98);
    const vMin = percentile(vs, 0.02), vMax = percentile(vs, 0.98);
    const zMax = percentile(pts.map((q) => q[2]), 0.99);

    // Vị trí cảm biến (gốc toạ độ) trong hệ local => mặt nhìn thấy là mặt gần cảm biến
    const sensorU = (0 - mx) * c + (0 - my) * s;
    const sensorV = -(0 - mx) * s + (0 - my) * c;
    const place = (lo, hi, size, sensor) => {
      if (fitSize || hi - lo >= size) return (lo + hi) / 2;
      return sensor < (lo + hi) / 2 ? lo + size / 2 : hi - size / 2;
    };

    const L = fitSize ? Math.max(0.2, uMax - uMin) : Math.abs(p[6]);
    const W = fitSize ? Math.max(0.2, vMax - vMin) : Math.abs(p[7]);
    const cu = place(uMin, uMax, L, sensorU);
    const cv = place(vMin, vMax, W, sensorV);

    const out = [...p];
    out[0] = mx + cu * c - cv * s;
    out[1] = my + cu * s + cv * c;
    out[3] = 0;
    out[4] = 0;
    out[5] = yaw;
    out[6] = L;
    out[7] = W;
    const ground = plane || flatPlane(percentile(pts.map((q) => q[2]), 0.01));
    const bottom = planeZ(ground, out[0], out[1]);
    out[8] = fitSize ? Math.max(0.3, zMax - bottom) : Math.abs(p[8]);
    out[2] = bottom + out[8] / 2;
    return { points: fitToGround(out, ground, 'snap'), n: pts.length };
  }

  async function smartSnap(ids) {
    const frame = getFrame();
    if (!Number.isInteger(frame)) return fail('Không đọc được frame hiện tại.');
    const list = ids?.length ? ids : [resolveTargetId()].filter(Number.isInteger);
    if (!list.length) return fail('Chọn object trước!');
    const positions = getPointCloudPositions();
    if (!positions) return fail('Không đọc được point cloud.');

    const fitSize = isChecked('cqt-snap-fit-size');
    const batch = createBatch(fitSize ? 'Smart Snap (fit size)' : 'Smart Snap');
    const errors = [];
    let lastN = 0;
    for (const id of list) {
      const s = await getState(id, frame);
      if (!isCuboid(s) || s.outside) continue;
      const r = computeSmartSnap([...s.points], positions, fitSize);
      if (r.error) { errors.push(`#${id}: ${r.error}`); continue; }
      lastN = r.n;
      await batch.edit(s, frame, (st) => { st.points = r.points; });
    }
    const res = await batch.finish();
    if (!res.changed) return fail(errors.join(' ') || 'Không snap được object nào.');
    setStatus(
      `🧲 Smart Snap ${res.changed} object` + (list.length === 1 ? ` (${lastN} điểm)` : '') +
      (fitSize ? ', đã fit cả size' : ', giữ nguyên LWH') + '.' +
      (errors.length ? ` Lỗi: ${errors.join(' ')}` : '') + editSuffix(res),
      errors.length ? 'warn' : 'success'
    );
  }

  // Chỉ xoay yaw theo trục chính của cụm điểm
  async function alignYawToCloud() {
    const id = requireTarget();
    if (id === null) return;
    const frame = getFrame();
    const s = await requireCuboidAtFrame(id, frame);
    if (!s) return;
    const positions = getPointCloudPositions();
    if (!positions) return fail('Không đọc được point cloud.');
    const pts = pointsInBox(s.points, positions, 0.15);
    if (pts.length < 15) return fail(`Chỉ có ${pts.length} điểm trong box, không đủ để nắn góc.`);

    // Chỉ lật trong mod π (giữ đầu xe), không đổi trục L/W
    let yaw = pcaYaw(pts);
    if (angleDiff(yaw, s.points[5]) > Math.PI / 2) yaw = wrapPi(yaw + Math.PI);
    const batch = createBatch('Nắn theo cloud');
    await batch.edit(s, frame, (st) => {
      const p = [...st.points];
      p[5] = yaw;
      st.points = p;
    });
    const res = await batch.finish();
    await inspectHeading(id, frame);
    setStatus(`☁️ Đã nắn #${id} theo trục cụm điểm (${(yaw * DEG).toFixed(1)}°, ${pts.length} điểm).` + editSuffix(res), 'success');
  }

  // =========================================================================
  // Object: chọn target, dải frame
  // =========================================================================
  async function detectActive() {
    const id = activeId();
    const frame = getFrame();
    if (!Number.isInteger(frame)) return fail('Không đọc được frame hiện tại. Click vào canvas rồi thử lại.');
    if (id === null) return fail('Chưa chọn object nào trên canvas!');
    setField('cqt-target-id', id);
    setField('cqt-frame-start', frame);
    setField('cqt-frame-end', frame);
    setField('cqt-frame-count', 1);
    await fetchLWH(id, frame);
    await matchPresetAndLimits(id, frame);
  }

  function applyFrameCount() {
    const start = intVal('cqt-frame-start');
    const count = intVal('cqt-frame-count');
    if (!Number.isInteger(start) || !Number.isInteger(count) || count < 1) {
      return fail('Nhập Start Frame và tổng số frame (>= 1).');
    }
    const b = jobBounds();
    let end = start + count - 1;
    const cut = b && end > b.stop;
    if (cut) end = b.stop;
    setField('cqt-frame-end', end);
    setStatus(`📏 Dải áp dụng: ${start}–${end} (${end - start + 1} frame)${cut ? ` (cắt tại frame cuối ${b.stop})` : ''}.`, 'success');
  }

  async function detectSpanAndFill() {
    const id = requireTarget();
    if (id === null) return null;
    setStatus(`⏳ Đang dò dải frame của #${id}...`);
    const span = await detectSpan(id);
    if (!span) return null;
    setField('cqt-frame-start', span.startFrame);
    setField('cqt-frame-end', span.endFrame);
    setField('cqt-frame-count', span.endFrame - span.startFrame + 1);
    setStatus(`🔍 #${id}: frame ${span.startFrame}–${span.endFrame} (${span.count} frame có object).`, 'success');
    return span;
  }

  // =========================================================================
  // LWH
  // =========================================================================
  function readLWHInputs() {
    const l = numVal('cqt-lwh-l'), w = numVal('cqt-lwh-w'), h = numVal('cqt-lwh-h');
    return l > 0 && w > 0 && h > 0 ? { l, w, h } : null;
  }

  function writeLWHInputs(l, w, h) {
    setField('cqt-lwh-l', l.toFixed(3));
    setField('cqt-lwh-w', w.toFixed(3));
    setField('cqt-lwh-h', h.toFixed(3));
  }

  async function fetchLWH(id = resolveTargetId(), frame = getFrame()) {
    if (!Number.isInteger(id)) return fail('Nhập Target Object ID trước!');
    const s = await getState(id, frame);
    if (!isCuboid(s)) return fail(`Không thấy cuboid #${id} ở frame ${frame}.`);
    const [, , , , , , l, w, h] = s.points;
    writeLWHInputs(l, w, h);
    inspectHeading(id, frame);

    const label = labelName(s);
    const lim = getLimitsForLabel(label);
    const out = lim ? limitViolations(l, w, h, lim) : [];
    setStatus(
      `✅ #${id} [${label}] LWH ${fmtLWH(l, w, h)}` +
      (out.length ? ` ⚠️ Ngoài limits: ${out.join('; ')}.` : (lim ? ' (trong limits).' : '.')),
      out.length ? 'warn' : 'success'
    );
  }

  // Kẹp LWH theo limits của class nếu bật "Tự clamp"
  async function clampLWHInputs(id, lwh) {
    if (!isChecked('cqt-limit-clamp-on-apply')) return { ...lwh, note: '' };
    const s = await getState(id, getFrame());
    const lim = getLimitsForLabel(labelName(s));
    if (!lim) return { ...lwh, note: '' };
    const c = clampLWH(lwh.l, lwh.w, lwh.h, lim);
    if (sameLWH([0, 0, 0, 0, 0, 0, lwh.l, lwh.w, lwh.h], c.l, c.w, c.h, 1e-9)) return { ...c, note: '' };
    writeLWHInputs(c.l, c.w, c.h);
    return { ...c, note: ` Đã kẹp theo limits [${labelName(s)}].` };
  }

  // scope: 'range' (dải Start–End) | 'track' (mọi keyframe của track) | 'frame' (chỉ frame hiện tại)
  async function applyLWH(scope) {
    const id = requireTarget();
    if (id === null) return;
    const input = readLWHInputs();
    if (!input) return fail('Nhập đủ L, W, H dương!');

    let opts;
    if (scope === 'frame') {
      const f = getFrame();
      if (!Number.isInteger(f)) return fail('Không đọc được frame hiện tại.');
      opts = { targetId: id, startFrame: f, endFrame: f };
    } else if (scope === 'track') {
      setStatus(`⏳ Đang dò dải frame của #${id}...`);
      const span = await detectSpan(id);
      if (!span) return;
      opts = { targetId: id, ...span, keyframesOnly: true };
    } else {
      const range = readRange();
      if (!range) return;
      opts = { ...range, keyframesOnly: isChecked('cqt-lwh-keyframe-only') };
    }

    const { l, w, h, note } = await clampLWHInputs(id, input);
    const keepGround = isChecked('cqt-keep-ground');
    const res = await editRange('LWH', opts, (s) => {
      if (sameLWH(s.points, l, w, h, 1e-9)) return false;
      s.points = withLWH(s.points, l, w, h, keepGround);
      return true;
    });

    if (!res.changed) {
      return setStatus(res.seen ? `ℹ️ #${id} đã có LWH ${fmtLWH(l, w, h)} trong phạm vi này.` : `⚠️ Không thấy #${id} trong phạm vi.`, res.seen ? 'success' : 'error');
    }
    const where = scope === 'frame' ? `frame ${opts.startFrame}` :
      scope === 'track' ? `${res.changed} keyframe (frame ${opts.startFrame}–${opts.endFrame}), frame nội suy tự theo` :
        `${res.changed} frame`;
    setStatus(`📐 LWH #${id} → ${fmtLWH(l, w, h)} trên ${where}.` + note + editSuffix(res), 'success');
  }



  async function copyTransform() {
    const id = requireTarget();
    if (id === null) return;
    const s = await requireCuboidAtFrame(id);
    if (!s) return;
    lsSet(LS.clipboard, { points: [...s.points], label: labelName(s), ts: Date.now() });
    setStatus(`📋 Đã copy transform #${id}.`, 'success');
  }

  async function pasteTransform() {
    const id = requireTarget();
    if (id === null) return;
    const clip = lsGet(LS.clipboard, null);
    if (!clip?.points) return fail('Chưa copy transform nào.');
    const frame = getFrame();
    const s = await requireCuboidAtFrame(id, frame);
    if (!s) return;
    const batch = createBatch('Paste transform');
    await batch.edit(s, frame, (st) => { st.points = [...clip.points]; });
    const res = await batch.finish();
    setStatus(`📥 Đã paste transform vào #${id} tại frame ${frame}.` + editSuffix(res), 'success');
  }

  // =========================================================================
  // Keyframe
  // =========================================================================
  // Chỉ được thêm keyframe, không gỡ (quy định dự án)
  async function setKeyframe() {
    const id = requireTarget();
    if (id === null) return;
    const frame = getFrame();
    const s = await requireCuboidAtFrame(id, frame);
    if (!s) return;
    if (s.objectType !== 'track') return fail('Object này là shape, không có keyframe.');
    if (s.keyframe) return setStatus(`ℹ️ #${id} frame ${frame} đã là keyframe.`, 'success');
    const batch = createBatch('Đặt keyframe');
    await batch.edit(s, frame, (st) => { st.keyframe = true; });
    const res = await batch.finish();
    setStatus(`⭐ Đã đặt keyframe #${id} tại frame ${frame}.` + editSuffix(res), 'success');
  }


  // =========================================================================
  // Preset LWH theo label
  // =========================================================================
  function getPresets() {
    return lsGet(LS.presets, {});
  }

  function refreshPresetList(selectLabel) {
    const select = $('cqt-preset-select');
    if (!select) return;
    const presets = getPresets();
    const labels = Object.keys(presets).sort();
    select.innerHTML = '';
    if (!labels.length) return select.add(new Option('(chưa có preset)', ''));
    for (const label of labels) {
      const p = presets[label];
      select.add(new Option(`${label}: ${p.l}×${p.w}×${p.h}`, label, false, label === selectLabel));
    }
  }

  async function matchPresetAndLimits(id, frame) {
    const s = await getState(id, frame);
    const label = labelName(s);
    if (!label) return;
    if (getPresets()[label]) refreshPresetList(label);
    const key = findLimitKey(label);
    if (key) refreshLimitClassList(key);
  }

  async function savePreset() {
    const id = requireTarget();
    if (id === null) return;
    const lwh = readLWHInputs();
    if (!lwh) return fail('Nhập LWH trước khi lưu preset!');
    const label = labelName(await getState(id, getFrame()));
    if (!label) return fail('Không lấy được label của object!');
    const presets = getPresets();
    presets[label] = lwh;
    lsSet(LS.presets, presets);
    refreshPresetList(label);
    setStatus(`💾 Đã lưu preset "${label}": ${lwh.l}×${lwh.w}×${lwh.h}`, 'success');
  }

  function applyPreset() {
    const label = val('cqt-preset-select');
    const p = getPresets()[label];
    if (!p) return fail('Chưa có preset nào được chọn.');
    writeLWHInputs(p.l, p.w, p.h);
    setStatus(`📐 Đã điền preset "${label}" — bấm Áp dụng LWH.`, 'success');
  }

  function deletePreset() {
    const label = val('cqt-preset-select');
    const presets = getPresets();
    if (!presets[label] || !confirm(`Xoá preset "${label}"?`)) return;
    delete presets[label];
    lsSet(LS.presets, presets);
    refreshPresetList();
    setStatus(`Đã xoá preset "${label}".`, 'success');
  }

  // =========================================================================
  // Limits LWH theo class
  // =========================================================================
  function getLimits() {
    const all = lsGet(LS.limits, null);
    if (all && typeof all === 'object') return all;
    const seeded = JSON.parse(JSON.stringify(DEFAULT_LIMITS));
    lsSet(LS.limits, seeded);
    return seeded;
  }

  // vehicles → vehicle, two_wheeler → two_wheel, Pedestrians → pedestrian
  function normalizeClass(value) {
    let s = String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '_');
    if (s.endsWith('ers')) s = s.slice(0, -3);
    else if (s.endsWith('er')) s = s.slice(0, -2);
    else if (s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
    return s;
  }

  function findLimitKey(label) {
    if (!label) return null;
    return Object.keys(getLimits()).find((k) => normalizeClass(k) === normalizeClass(label)) || null;
  }

  function getLimitsForLabel(label) {
    const key = findLimitKey(label);
    return key ? getLimits()[key] : null;
  }

  function clampLWH(l, w, h, lim) {
    return { l: clamp(l, lim.l[0], lim.l[1]), w: clamp(w, lim.w[0], lim.w[1]), h: clamp(h, lim.h[0], lim.h[1]) };
  }

  function limitViolations(l, w, h, lim) {
    const out = [];
    const check = (name, v, [lo, hi]) => {
      if (v < lo - 1e-9) out.push(`${name} ${v.toFixed(2)} < ${lo}`);
      else if (v > hi + 1e-9) out.push(`${name} ${v.toFixed(2)} > ${hi}`);
    };
    check('L', l, lim.l);
    check('W', w, lim.w);
    check('H', h, lim.h);
    return out;
  }

  function limitText(lim) {
    return `L ${lim.l[0]}–${lim.l[1]}, W ${lim.w[0]}–${lim.w[1]}, H ${lim.h[0]}–${lim.h[1]}`;
  }

  const LIMIT_FIELDS = ['l-min', 'l-max', 'w-min', 'w-max', 'h-min', 'h-max'];

  function loadLimitForm(key) {
    const lim = getLimits()[key];
    const values = lim ? [lim.l[0], lim.l[1], lim.w[0], lim.w[1], lim.h[0], lim.h[1]] : ['', '', '', '', '', ''];
    LIMIT_FIELDS.forEach((f, i) => setField(`cqt-limit-${f}`, values[i]));
  }

  function refreshLimitClassList(selected) {
    const select = $('cqt-limit-class');
    if (!select) return;
    const all = getLimits();
    const keys = Object.keys(all).sort();
    select.innerHTML = '';
    if (!keys.length) select.add(new Option('(chưa có class)', ''));
    for (const key of keys) select.add(new Option(`${key}: ${limitText(all[key])}`, key));
    if (selected && keys.includes(selected)) select.value = selected;
    loadLimitForm(select.value);
  }

  function saveLimitForm() {
    const key = String(val('cqt-limit-class-name') || '').trim() || String(val('cqt-limit-class') || '').trim();
    if (!key) return fail('Chọn class có sẵn hoặc nhập tên class mới.');
    const v = LIMIT_FIELDS.map((f) => numVal(`cqt-limit-${f}`));
    if (v.some((x) => !(x > 0))) return fail('Nhập đủ 6 ngưỡng dương (min/max cho L, W, H).');
    if (v[0] > v[1] || v[2] > v[3] || v[4] > v[5]) return fail('Min không được lớn hơn max.');
    const all = getLimits();
    const actualKey = findLimitKey(key) || key;
    all[actualKey] = { l: [v[0], v[1]], w: [v[2], v[3]], h: [v[4], v[5]] };
    lsSet(LS.limits, all);
    setField('cqt-limit-class-name', '');
    refreshLimitClassList(actualKey);
    setStatus(`💾 Đã lưu limits "${actualKey}": ${limitText(all[actualKey])}.`, 'success');
  }

  function deleteLimitClass() {
    const key = val('cqt-limit-class');
    const all = getLimits();
    if (!key || !(key in all) || !confirm(`Xoá limits của class "${key}"?`)) return;
    delete all[key];
    lsSet(LS.limits, all);
    refreshLimitClassList();
    setStatus(`Đã xoá limits class "${key}".`, 'success');
  }

  function resetLimits() {
    if (!confirm('Reset toàn bộ limits về ngưỡng tiêu chuẩn?')) return;
    lsSet(LS.limits, JSON.parse(JSON.stringify(DEFAULT_LIMITS)));
    refreshLimitClassList('vehicle');
    setStatus('↺ Đã reset limits về tiêu chuẩn.', 'success');
  }

  async function fillClassNameFromObject() {
    const id = requireTarget();
    if (id === null) return;
    const label = labelName(await getState(id, getFrame()));
    if (!label) return fail('Không lấy được label của object ở frame hiện tại.');
    setField('cqt-limit-class-name', label);
    const key = findLimitKey(label);
    if (key) refreshLimitClassList(key);
    setStatus(key ? `📌 Class "${label}" — đã nạp limits có sẵn.` : `📌 Class "${label}" — nhập limits rồi bấm Lưu.`, 'success');
  }

  function clampMutator(lim, stats) {
    return (s) => {
      const p = s.points;
      const c = clampLWH(p[6], p[7], p[8], lim);
      if (sameLWH(p, c.l, c.w, c.h, 1e-9)) return false;
      if (stats && !stats.example) stats.example = `${fmtLWH(p[6], p[7], p[8])} → ${fmtLWH(c.l, c.w, c.h)}`;
      s.points = withLWH(p, c.l, c.w, c.h, true);
      return true;
    };
  }


  function classScope() {
    const b = jobBounds();
    if (!b) return fail('Chưa kết nối CVAT Job!');
    if (isChecked('cqt-limit-class-all-job')) return { from: b.start, to: b.stop };
    const from = intVal('cqt-frame-start'), to = intVal('cqt-frame-end');
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) return fail('Dải frame không hợp lệ.');
    return { from, to };
  }

  async function forEachClassState(className, scope, fn) {
    for (let f = scope.from; f <= scope.to; f++) {
      if (f > scope.from && (f - scope.from) % 50 === 0) {
        setStatus(`⏳ Class "${className}": frame ${f}/${scope.to}...`);
        await sleep(0);
      }
      for (const s of await getStates(f)) {
        if (!isCuboid(s) || s.outside || normalizeClass(labelName(s)) !== normalizeClass(className)) continue;
        await fn(s, f);
      }
    }
  }

  async function checkClassLimits() {
    const className = val('cqt-limit-class');
    const lim = getLimits()[className];
    if (!lim) return fail('Chọn class có limits trước.');
    const scope = classScope();
    if (!scope) return;

    const byId = new Map();
    await forEachClassState(className, scope, (s) => {
      const rec = byId.get(s.clientID) || { id: s.clientID, frames: 0, bad: 0, example: '' };
      byId.set(s.clientID, rec);
      rec.frames++;
      const v = limitViolations(s.points[6], s.points[7], s.points[8], lim);
      if (v.length) {
        rec.bad++;
        if (!rec.example) rec.example = v.join(', ');
      }
    });
    if (!byId.size) return fail(`Không thấy object nào thuộc class "${className}".`);

    const bad = [...byId.values()].filter((r) => r.bad).sort((a, b) => b.bad - a.bad);
    const lines = [`Class "${className}" (${limitText(lim)}): ${bad.length}/${byId.size} object ngoài ngưỡng.`];
    for (const r of bad.slice(0, 20)) lines.push(`#${r.id}: ${r.bad}/${r.frames} frame — ${r.example}`);
    if (bad.length > 20) lines.push(`... +${bad.length - 20} object khác`);
    const pre = $('cqt-limit-result');
    if (pre) pre.textContent = lines.join('\n');
    setStatus(`🔎 ${lines[0]}`, bad.length ? 'warn' : 'success');
  }

  async function clampClassLimits() {
    const className = val('cqt-limit-class');
    const lim = getLimits()[className];
    if (!lim) return fail('Chọn class có limits trước.');
    const scope = classScope();
    if (!scope) return;
    const keyframesOnly = isChecked('cqt-limit-class-keyframes');
    if (!keyframesOnly && !confirm('Clamp mọi frame sẽ biến mọi frame thành keyframe. Tiếp tục?')) return;

    const batch = createBatch(`Clamp class "${className}"`);
    const objects = new Set();
    const mutate = clampMutator(lim);
    await forEachClassState(className, scope, async (s, f) => {
      if (keyframesOnly && !isKey(s)) return;
      if (await batch.edit(s, f, mutate)) objects.add(s.clientID);
    });
    const res = await batch.finish();
    if (!res.changed) return setStatus(`ℹ️ Class "${className}": không có frame nào ngoài limits.`, 'success');
    setStatus(`📏 Clamp class "${className}": ${objects.size} object, ${res.changed} frame.` + editSuffix(res), 'success');
  }

  // =========================================================================
  // Chọn nhiều box (Shift + Click trên canvas hoặc danh sách object)
  // =========================================================================
  const selection = new Set();

  function renderSelection() {
    const count = $('cqt-multi-count');
    if (count) count.textContent = String(selection.size);
    const box = $('cqt-multi-list');
    if (!box) return;
    box.innerHTML = '';
    for (const id of selection) {
      const chip = document.createElement('span');
      chip.className = 'cqt-chip';
      chip.textContent = `#${id} ✕`;
      chip.title = 'Bỏ khỏi danh sách';
      chip.addEventListener('click', () => { selection.delete(id); renderSelection(); });
      box.appendChild(chip);
    }
  }

  function toggleSelection(id) {
    if (selection.has(id)) selection.delete(id);
    else selection.add(id);
    renderSelection();
  }

  async function selectAllInFrame() {
    const frame = getFrame();
    if (!Number.isInteger(frame)) return fail('Không đọc được frame hiện tại.');
    for (const s of await getStates(frame)) {
      if (isCuboid(s) && !s.outside) selection.add(s.clientID);
    }
    renderSelection();
    setStatus(`🎯 Đã chọn ${selection.size} box ở frame ${frame}.`, 'success');
  }

  function selectedOrTarget() {
    if (selection.size) return [...selection];
    const id = resolveTargetId();
    return Number.isInteger(id) ? [id] : [];
  }


  // Không được xoá object: chỉ đánh dấu outside từ frame hiện tại
  async function outsideSelected() {
    const ids = [...selection];
    if (!ids.length) return fail('Chưa chọn box nào (Shift + Click).');
    const frame = getFrame();
    if (!Number.isInteger(frame)) return fail('Không đọc được frame hiện tại.');
    if (!confirm(`Đặt outside cho ${ids.length} object từ frame ${frame}: ${ids.map((i) => '#' + i).join(', ')}?`)) return;
    const batch = createBatch('Đặt outside');
    let shapes = 0;
    for (const id of ids) {
      const s = await getState(id, frame);
      if (!isCuboid(s) || s.outside) continue;
      if (s.objectType !== 'track') { shapes++; continue; }
      await batch.edit(s, frame, (st) => { st.outside = true; });
    }
    const res = await batch.finish();
    if (!res.changed) return fail(shapes ? 'Shape không có thuộc tính outside.' : 'Không có object nào cần đặt outside.');
    setStatus(`🙈 Đã đặt outside ${res.changed} object từ frame ${frame}.` +
      (shapes ? ` Bỏ qua ${shapes} shape (không có outside).` : '') + editSuffix(res), 'success');
  }

  // Dịch các box đang chọn (hoặc object đang chọn) tại frame hiện tại theo dX/dY/dZ
  async function shiftSelected() {
    const ids = selectedOrTarget();
    if (!ids.length) return fail('Chọn object trước!');
    const frame = getFrame();
    if (!Number.isInteger(frame)) return fail('Không đọc được frame hiện tại.');
    const dx = numVal('cqt-multi-dx') || 0, dy = numVal('cqt-multi-dy') || 0, dz = numVal('cqt-multi-dz') || 0;
    if (!dx && !dy && !dz) return fail('Nhập ít nhất một giá trị dX/dY/dZ.');
    const batch = createBatch(`Dịch ${ids.length} box`);
    for (const id of ids) {
      const s = await getState(id, frame);
      if (!isCuboid(s) || s.outside || s.lock) continue;
      await batch.edit(s, frame, (st) => {
        const p = [...st.points];
        p[0] += dx;
        p[1] += dy;
        p[2] += dz;
        st.points = p;
      });
    }
    const res = await batch.finish();
    if (!res.changed) return fail('Không có box nào được dịch.');
    setStatus(`↔️ Đã dịch ${res.changed} box (${dx}, ${dy}, ${dz}) m tại frame ${frame}.` + editSuffix(res), 'success');
  }

  // =========================================================================
  // Track: dịch, xoay, hướng đi, làm mượt, keyframe
  // =========================================================================
  function trackKeyframesOnly() {
    return isChecked('cqt-track-keyframe-only');
  }

  async function shiftTrack() {
    const range = readRange();
    if (!range) return;
    const dx = numVal('cqt-shift-x') || 0, dy = numVal('cqt-shift-y') || 0, dz = numVal('cqt-shift-z') || 0;
    if (!dx && !dy && !dz) return fail('Nhập ít nhất một giá trị dX/dY/dZ.');
    const res = await editRange(`Dịch (${dx}, ${dy}, ${dz})`, { ...range, keyframesOnly: trackKeyframesOnly() }, (s) => {
      const p = [...s.points];
      p[0] += dx;
      p[1] += dy;
      p[2] += dz;
      s.points = p;
    });
    if (!res.changed) return fail('Không có frame nào được dịch.');
    setStatus(`↔️ Đã dịch #${range.targetId} (${dx}, ${dy}, ${dz}) trên ${res.changed} frame.` + editSuffix(res), 'success');
  }

  async function rotateTrack(angleDeg) {
    const range = readRange();
    if (!range) return;
    const deg = Number.isFinite(angleDeg) ? angleDeg : numVal('cqt-rotate-deg');
    if (!Number.isFinite(deg) || deg === 0) return fail('Nhập góc xoay hợp lệ (khác 0°)!');
    const res = await editRange(`Xoay ${deg}°`, { ...range, keyframesOnly: trackKeyframesOnly() }, (s) => {
      const p = [...s.points];
      p[5] = wrapPi(p[5] + deg * RAD);
      s.points = p;
    });
    if (!res.changed) return fail('Không có frame nào được xoay.');
    setStatus(`🔄 Đã xoay ${fmtSigned(deg, 0)}° #${range.targetId} trên ${res.changed} frame.` + editSuffix(res), 'success');
  }

  // Hướng chuyển động tại vị trí i của danh sách frame (null nếu đứng yên)
  function motionYawAt(list, i) {
    const prev = list[i - 1] || list[i];
    const next = list[i + 1] || list[i];
    const span = next.frame - prev.frame;
    if (span <= 0) return null;
    const dx = next.state.points[0] - prev.state.points[0];
    const dy = next.state.points[1] - prev.state.points[1];
    if (Math.hypot(dx, dy) / span < 0.05) return null;
    return Math.atan2(dy, dx);
  }

  // Xoay đầu theo hướng đi thực tế (dùng cả frame nội suy để tính hướng)
  async function alignYawToMotion(id, from, to, keyframesOnly) {
    const list = await collectTrack(id, from - 1, to + 1);
    const batch = createBatch('Căn hướng theo hướng đi');
    let still = 0;
    for (let i = 0; i < list.length; i++) {
      const { frame, state } = list[i];
      if (frame < from || frame > to) continue;
      if (keyframesOnly && !isKey(state)) continue;
      const yaw = motionYawAt(list, i);
      if (yaw === null) { still++; continue; }
      await batch.edit(state, frame, (s) => {
        if (angleDiff(s.points[5], yaw) < 1e-4) return false;
        const p = [...s.points];
        p[5] = yaw;
        s.points = p;
        return true;
      });
    }
    const res = await batch.finish();
    return { ...res, still };
  }

  async function alignYawRange() {
    const range = readRange();
    if (!range) return;
    const res = await alignYawToMotion(range.targetId, range.startFrame, range.endFrame, trackKeyframesOnly());
    if (!res.changed) return setStatus(`ℹ️ Không có frame nào cần căn${res.still ? ` (${res.still} frame đứng yên)` : ''}.`, 'success');
    setStatus(`🧭 Đã căn hướng #${range.targetId} theo hướng đi trên ${res.changed} frame` +
      (res.still ? `, bỏ qua ${res.still} frame đứng yên` : '') + '.' + editSuffix(res), 'success');
  }

  async function alignYawCurrentFrame() {
    const id = requireTarget();
    if (id === null) return;
    const f = getFrame();
    if (!Number.isInteger(f)) return fail('Không đọc được frame hiện tại.');
    const res = await alignYawToMotion(id, f, f, false);
    if (!res.changed) {
      return setStatus(res.still ? '⚠️ Object đứng yên, không có hướng đi. Dùng "☁️ Nắn theo Cloud".' : 'ℹ️ Đã khớp hướng đi.', 'warn');
    }
    await inspectHeading(id, f);
    setStatus(`🎯 Đã nắn #${id} theo hướng đi tại frame ${f}.` + editSuffix(res), 'success');
  }

  async function inspectHeading(id, frame) {
    if (!Number.isInteger(id) || !Number.isInteger(frame)) return;
    const list = await collectTrack(id, frame - 1, frame + 1);
    const i = list.findIndex((x) => x.frame === frame);
    if (i < 0) return;
    const yaw = list[i].state.points[5];
    const text = (id2, t) => { const el = $(id2); if (el) el.textContent = t; };
    text('cqt-val-yaw', `${(yaw * DEG).toFixed(1)}°`);
    text('cqt-val-yaw-rad', yaw.toFixed(3));

    const motion = motionYawAt(list, i);
    const dev = $('cqt-val-deviation');
    if (motion === null) {
      text('cqt-val-motion', 'Đứng yên');
      if (dev) { dev.textContent = 'Đứng yên: dùng "☁️ Nắn theo Cloud".'; dev.style.color = '#94a3b8'; }
      return;
    }
    text('cqt-val-motion', `${(motion * DEG).toFixed(1)}°`);
    const diff = wrapPi(yaw - motion) * DEG;
    if (!dev) return;
    if (Math.abs(diff) <= 5) { dev.textContent = `✅ Khớp hướng đi (lệch ${diff.toFixed(1)}°)`; dev.style.color = '#4ade80'; }
    else if (Math.abs(diff) >= 135) { dev.textContent = `⚠️ NGƯỢC ĐẦU! Lệch ${Math.abs(diff).toFixed(1)}° so với hướng đi`; dev.style.color = '#f87171'; }
    else { dev.textContent = `⚠️ Lệch ${fmtSigned(diff, 1)}° so với hướng đi`; dev.style.color = '#fbbf24'; }
  }

  async function syncYawToTrack() {
    const id = requireTarget();
    if (id === null) return;
    const cur = await requireCuboidAtFrame(id);
    if (!cur) return;
    const yaw = cur.points[5];
    setStatus(`⏳ Đang dò dải frame của #${id}...`);
    const span = await detectSpan(id);
    if (!span) return;
    const res = await editRange('Đồng bộ yaw', { targetId: id, ...span, keyframesOnly: true }, (s) => {
      if (angleDiff(s.points[5], yaw) < 1e-4) return false;
      const p = [...s.points];
      p[5] = yaw;
      s.points = p;
      return true;
    });
    if (!res.changed) return setStatus(`ℹ️ Mọi keyframe của #${id} đã có yaw ${(yaw * DEG).toFixed(1)}°.`, 'success');
    setStatus(`🔗 Đồng bộ yaw ${(yaw * DEG).toFixed(1)}° cho ${res.changed} keyframe của #${id}.` + editSuffix(res), 'success');
  }

  async function keyframesInRange(range) {
    return (await collectTrack(range.targetId, range.startFrame, range.endFrame)).filter((x) => isKey(x.state));
  }

  async function smoothTrack() {
    const range = readRange();
    if (!range) return;
    const kfs = await keyframesInRange(range);
    if (kfs.length < 3) return fail('Cần ít nhất 3 keyframe trong dải để smooth.');
    const orig = kfs.map((k) => [...k.state.points]);
    const batch = createBatch('Smooth vị trí');
    for (let i = 1; i < kfs.length - 1; i++) {
      await batch.edit(kfs[i].state, kfs[i].frame, (s) => {
        const p = [...orig[i]];
        for (let k = 0; k < 3; k++) p[k] = orig[i - 1][k] * 0.25 + orig[i][k] * 0.5 + orig[i + 1][k] * 0.25;
        if (Math.hypot(p[0] - orig[i][0], p[1] - orig[i][1], p[2] - orig[i][2]) < 1e-6) return false;
        s.points = p;
        return true;
      });
    }
    const res = await batch.finish();
    if (!res.changed) return setStatus('ℹ️ Track đã mượt.', 'success');
    setStatus(`〰️ Đã smooth ${res.changed}/${kfs.length} keyframe của #${range.targetId}.` + editSuffix(res), 'success');
  }

  // =========================================================================
  // QA theo file kiểm tra (cvat1.xlsx):
  // Frame | Item ID | Track ID | Class | Loại kiểm tra | Mô tả | Giá trị | Ngưỡng / Chuẩn | Track liên quan
  // =========================================================================
  const QA_TYPES = {
    scale: 'Scale không đồng bộ',
    yaw: 'Đổi hướng đột ngột',
    overlap: 'Chồng lấn',
    dist: 'Quá xa',
    limits: 'Ngoài limits',
  };

  let lastQA = null; // { rows, data, opts, range }

  function readQAOptionsFromUI() {
    const o = getQAOptions();
    const read = (id, key, num) => {
      const el = $(id);
      if (!el) return;
      if (num) {
        const n = parseFloat(el.value);
        if (Number.isFinite(n)) o[key] = n;
      } else {
        o[key] = el.checked;
      }
    };
    read('cqt-qa-check-scale', 'scale');
    read('cqt-qa-scale-tol', 'scaleTol', true);
    read('cqt-qa-check-yaw', 'yaw');
    read('cqt-qa-yaw-threshold', 'yawThresh', true);
    read('cqt-qa-check-overlap', 'overlap');
    read('cqt-qa-pedped-iou', 'pedPedIoU', true);
    read('cqt-qa-check-dist', 'dist');
    read('cqt-qa-dist-threshold', 'distThresh', true);
    read('cqt-qa-check-limits', 'limits');
    read('cqt-qa-whole-job', 'wholeJob');
    lsSet(LS.qa, o);
    return o;
  }

  function writeQAOptionsToUI() {
    const o = getQAOptions();
    const set = (id, v) => {
      const el = $(id);
      if (!el) return;
      if (typeof v === 'boolean') el.checked = v;
      else el.value = v;
    };
    set('cqt-qa-check-scale', o.scale);
    set('cqt-qa-scale-tol', o.scaleTol);
    set('cqt-qa-check-yaw', o.yaw);
    set('cqt-qa-yaw-threshold', o.yawThresh);
    set('cqt-qa-check-overlap', o.overlap);
    set('cqt-qa-pedped-iou', o.pedPedIoU);
    set('cqt-qa-check-dist', o.dist);
    set('cqt-qa-dist-threshold', o.distThresh);
    set('cqt-qa-check-limits', o.limits);
    set('cqt-qa-whole-job', o.wholeJob);
  }

  function qaRange(opts) {
    const b = jobBounds();
    if (!b) return fail('Chưa kết nối CVAT Job!');
    if (opts.wholeJob) return { from: b.start, to: b.stop };
    const from = intVal('cqt-frame-start'), to = intVal('cqt-frame-end');
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) return fail('Dải frame không hợp lệ (Start <= End)!');
    return { from, to };
  }

  // Đọc toàn bộ cuboid trong dải: tracks (theo clientID) + danh sách theo frame
  async function scanJobData(from, to, onlyId = null) {
    const tracks = new Map();
    const frames = new Map();
    for (let f = from; f <= to; f++) {
      if (f > from && (f - from) % 20 === 0) {
        setStatus(`⏳ QA: đọc frame ${f}/${to}...`);
        await sleep(0);
      }
      const list = [];
      for (const s of await getStates(f)) {
        if (!isCuboid(s) || s.outside) continue;
        if (onlyId !== null && s.clientID !== onlyId) continue;
        let rec = tracks.get(s.clientID);
        if (!rec) {
          rec = { id: s.clientID, label: labelName(s), objectType: s.objectType, frames: [] };
          tracks.set(s.clientID, rec);
        }
        const item = { frame: f, points: [...s.points], keyframe: isKey(s) };
        rec.frames.push(item);
        list.push({ id: s.clientID, label: rec.label, points: item.points });
      }
      frames.set(f, list);
    }
    return { from, to, tracks, frames };
  }

  function trackMedianLWH(rec) {
    return {
      l: median(rec.frames.map((x) => x.points[6])),
      w: median(rec.frames.map((x) => x.points[7])),
      h: median(rec.frames.map((x) => x.points[8])),
    };
  }

  function overlapRule(cls1, cls2, opts) {
    if (normalizeClass(cls1) === 'pedestrian' && normalizeClass(cls2) === 'pedestrian') {
      return { maxIoU: opts.pedPedIoU, text: `Cho phép tối đa ${Math.round(opts.pedPedIoU * 100)}% (IOU)` };
    }
    return { maxIoU: 0, text: 'Không cho phép chồng lấn' };
  }

  function runQAChecks(data, opts) {
    const rows = [];
    const row = (frame, rec, type, desc, value, threshold, related = '') =>
      rows.push({ frame, itemId: '', trackId: rec.id, cls: rec.label, type, desc, value, threshold, related });

    for (const rec of data.tracks.values()) {
      // Scale không đồng bộ: so với size chuẩn (median) của track
      if (opts.scale && rec.frames.length > 1) {
        const m = trackMedianLWH(rec);
        for (const x of rec.frames) {
          const d = [x.points[6] - m.l, x.points[7] - m.w, x.points[8] - m.h];
          if (Math.max(...d.map(Math.abs)) <= opts.scaleTol) continue;
          row(x.frame, rec, QA_TYPES.scale,
            `Scale lệch so với kích thước chuẩn của track (chênh L ${fmtSigned(d[0])}, W ${fmtSigned(d[1])}, H ${fmtSigned(d[2])} m)`,
            fmtLWH(x.points[6], x.points[7], x.points[8]), fmtLWH(m.l, m.w, m.h));
        }
      }

      // Đổi hướng đột ngột giữa 2 frame liên tiếp
      if (opts.yaw) {
        for (let i = 1; i < rec.frames.length; i++) {
          const a = rec.frames[i - 1], b = rec.frames[i];
          if (b.frame !== a.frame + 1) continue;
          const d = angleDiff(b.points[5], a.points[5]) * DEG;
          if (d <= opts.yawThresh) continue;
          row(b.frame, rec, QA_TYPES.yaw,
            `Obj thay đổi hướng đột ngột ${d.toFixed(1)}° (yaw ${(wrapPi(a.points[5]) * DEG).toFixed(1)}° ở frame ${a.frame} -> ${(wrapPi(b.points[5]) * DEG).toFixed(1)}° ở frame ${b.frame})`,
            d.toFixed(2), `≤ ${opts.yawThresh}°`);
        }
      }

      // Quá xa gốc toạ độ
      if (opts.dist) {
        for (const x of rec.frames) {
          const d = Math.hypot(x.points[0], x.points[1], x.points[2]);
          if (d <= opts.distThresh) continue;
          row(x.frame, rec, QA_TYPES.dist,
            `Cách gốc tọa độ ${d.toFixed(2)} m (> ${opts.distThresh} m): obj ở quá xa, cần kiểm tra`,
            d.toFixed(2), `≤ ${opts.distThresh} m`);
        }
      }

      // Ngoài ngưỡng LWH tiêu chuẩn của class
      const lim = opts.limits ? getLimitsForLabel(rec.label) : null;
      if (lim) {
        for (const x of rec.frames) {
          const v = limitViolations(x.points[6], x.points[7], x.points[8], lim);
          if (!v.length) continue;
          row(x.frame, rec, QA_TYPES.limits, `Kích thước ngoài chuẩn class ${rec.label} (${v.join('; ')})`,
            fmtLWH(x.points[6], x.points[7], x.points[8]), limitText(lim));
        }
      }
    }

    // Chồng lấn BEV trong cùng frame
    if (opts.overlap) {
      for (const [f, list] of data.frames) {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const A = list[i], B = list[j];
            const ov = bevOverlap(A.points, B.points);
            if (!ov) continue;
            const rule = overlapRule(A.label, B.label, opts);
            if (rule.maxIoU > 0 ? ov.iou <= rule.maxIoU : ov.inter <= 1e-4) continue;
            for (const [self, other, ioa] of [[A, B, ov.ioa1], [B, A, ov.ioa2]]) {
              row(f, { id: self.id, label: self.label }, QA_TYPES.overlap,
                `Chồng lấn với track ${other.id} (${other.label}): IoU ${ov.iou.toFixed(3)}, IoA ${ioa.toFixed(3)}, diện tích giao ${ov.inter.toFixed(3)} m²`,
                ov.iou.toFixed(4), rule.text, other.id);
            }
          }
        }
      }
    }

    const order = Object.values(QA_TYPES);
    rows.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.trackId - b.trackId || a.frame - b.frame);
    return rows;
  }

  async function fillItemIds(rows) {
    const names = new Map();
    for (const f of new Set(rows.map((r) => r.frame))) names.set(f, await frameName(f));
    for (const r of rows) r.itemId = names.get(r.frame) || '';
  }

  async function scanQA() {
    const opts = readQAOptionsFromUI();
    const range = qaRange(opts);
    if (!range) return null;
    setStatus('⏳ Đang quét QA...');
    const data = await scanJobData(range.from, range.to);
    if (!data.tracks.size) return fail('Không có cuboid nào trong dải.');
    const rows = runQAChecks(data, opts);
    await fillItemIds(rows);
    lastQA = { rows, data, opts, range };
    renderQAResult();
    const tracks = new Set(rows.map((r) => r.trackId)).size;
    setStatus(
      `🔎 QA ${range.from}–${range.to}: ${data.tracks.size} object, ${rows.length} lỗi ở ${tracks} object.`,
      rows.length ? 'warn' : 'success'
    );
    return lastQA;
  }

  function renderQAResult() {
    const box = $('cqt-qa-result');
    const filter = $('cqt-qa-filter');
    if (!box || !lastQA) return;
    const { rows } = lastQA;

    const counts = {};
    for (const r of rows) counts[r.type] = (counts[r.type] || 0) + 1;
    const current = filter?.value || '';
    if (filter) {
      filter.innerHTML = '';
      filter.add(new Option(`Tất cả (${rows.length})`, ''));
      for (const t of Object.values(QA_TYPES)) if (counts[t]) filter.add(new Option(`${t} (${counts[t]})`, t));
      filter.value = counts[current] ? current : '';
    }

    const shown = rows.filter((r) => !filter?.value || r.type === filter.value);
    box.innerHTML = '';
    if (!rows.length) {
      box.textContent = 'Không phát hiện lỗi.';
      return;
    }
    const LIMIT = 400;
    shown.slice(0, LIMIT).forEach((r) => {
      const div = document.createElement('div');
      div.className = 'cqt-qa-row';
      div.title = 'Bấm để nhảy tới frame và chọn object';
      const head = document.createElement('b');
      head.textContent = `f${r.frame} · #${r.trackId} ${r.cls} · ${r.type}`;
      div.appendChild(head);
      div.appendChild(document.createElement('br'));
      div.appendChild(document.createTextNode(r.desc));
      div.addEventListener('click', () => jumpTo(r.trackId, r.frame));
      box.appendChild(div);
    });
    if (shown.length > LIMIT) {
      const more = document.createElement('div');
      more.textContent = `... +${shown.length - LIMIT} dòng (xem đầy đủ trong CSV)`;
      box.appendChild(more);
    }
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportQA() {
    if (!lastQA?.rows.length) return fail('Chưa có dữ liệu QA. Bấm "Quét QA" trước.');
    const header = ['Frame', 'Item ID', 'Track ID', 'Class', 'Loại kiểm tra', 'Mô tả', 'Giá trị', 'Ngưỡng / Chuẩn', 'Track liên quan'];
    const lines = [header.join(',')];
    for (const r of lastQA.rows) {
      lines.push([r.frame, r.itemId, r.trackId, r.cls, r.type, r.desc, r.value, r.threshold, r.related].map(csvEscape).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cvat_qa_job${getJob()?.id ?? ''}_${lastQA.range.from}-${lastQA.range.to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`📤 Đã export ${lastQA.rows.length} dòng CSV.`, 'success');
  }

  // =========================================================================
  // Auto-fix có xem trước
  // Mỗi "op" là một đề xuất sửa cho 1 track; op.apply(batch) thực hiện sửa.
  // Chỉ sửa keyframe (frame nội suy tự theo) để track không bị phình keyframe.
  // =========================================================================
  function framesText(frames, max = 12) {
    const list = frames.slice(0, max).map((f) => 'f' + f).join(', ');
    return frames.length > max ? `${list}, … (+${frames.length - max})` : list;
  }

  function planSizeFix(rec, opts) {
    const m = trackMedianLWH(rec);
    const lim = opts.limits ? getLimitsForLabel(rec.label) : null;
    const t = lim ? clampLWH(m.l, m.w, m.h, lim) : m;
    const clamped = !sameLWH([0, 0, 0, 0, 0, 0, m.l, m.w, m.h], t.l, t.w, t.h, 1e-9);
    const frames = rec.frames.filter((x) => x.keyframe && !sameLWH(x.points, t.l, t.w, t.h, 1e-4)).map((x) => x.frame);
    if (!frames.length) return null;
    return {
      type: 'size', trackId: rec.id, auto: true, checked: true,
      title: `#${rec.id} [${rec.label}] · Size → ${fmtLWH(t.l, t.w, t.h)}${clamped ? ' (đã kẹp limits)' : ''}`,
      detail: `${frames.length} keyframe, giữ đáy: ${framesText(frames)}`,
      apply: async (batch) => {
        for (const f of frames) {
          const s = await getState(rec.id, f);
          if (!isCuboid(s) || s.outside) continue;
          await batch.edit(s, f, (st) => {
            if (sameLWH(st.points, t.l, t.w, t.h, 1e-6)) return false;
            st.points = withLWH(st.points, t.l, t.w, t.h, true);
            return true;
          });
        }
      },
    };
  }

  // Lật 180° các frame ngược đầu. Hướng đúng = theo hướng di chuyển (nếu xe chạy), ngược lại theo đa số frame.
  function planYawFix(rec, opts) {
    const fr = rec.frames;
    if (fr.length < 2) return [];
    const parity = [0];
    const manual = [];
    for (let i = 1; i < fr.length; i++) {
      const d = angleDiff(fr[i].points[5], fr[i - 1].points[5]);
      let p = parity[i - 1];
      if (d > 135 * RAD) p ^= 1;
      else if (d > opts.yawThresh * RAD && fr[i].frame === fr[i - 1].frame + 1) manual.push(fr[i].frame);
      parity.push(p);
    }

    const votes = [0, 0];
    for (let i = 0; i < fr.length; i++) {
      const prev = fr[i - 1] || fr[i], next = fr[i + 1] || fr[i];
      const span = next.frame - prev.frame;
      if (span <= 0) continue;
      const dx = next.points[0] - prev.points[0], dy = next.points[1] - prev.points[1];
      if (Math.hypot(dx, dy) / span < 0.1) continue;
      const agree = Math.cos(fr[i].points[5] - Math.atan2(dy, dx)) > 0;
      votes[agree ? parity[i] : 1 - parity[i]]++;
    }
    let good;
    let basis;
    if (votes[0] + votes[1] >= 3 && votes[0] !== votes[1]) {
      good = votes[0] > votes[1] ? 0 : 1;
      basis = 'theo hướng di chuyển';
    } else {
      const ones = parity.filter((p) => p === 1).length;
      good = ones > parity.length - ones ? 1 : 0;
      basis = 'theo đa số frame (xe đứng yên)';
    }

    const keyIdx = fr.map((x, i) => (x.keyframe ? i : -1)).filter((i) => i >= 0);
    const targets = [];
    for (let i = 0; i < fr.length; i++) {
      if (parity[i] === good) continue;
      if (fr[i].keyframe) { targets.push(fr[i].frame); continue; }
      // Frame nội suy: chỉ sửa trực tiếp khi 2 keyframe kề bên đều đúng (lật keyframe không chữa được nó)
      const prevK = [...keyIdx].reverse().find((k) => k < i);
      const nextK = keyIdx.find((k) => k > i);
      const prevWrong = prevK !== undefined && parity[prevK] !== good;
      const nextWrong = nextK !== undefined && parity[nextK] !== good;
      if (!prevWrong && !nextWrong) targets.push(fr[i].frame);
    }

    const ops = [];
    if (targets.length) {
      ops.push({
        type: 'yaw', trackId: rec.id, auto: true, checked: true,
        title: `#${rec.id} [${rec.label}] · Lật 180° ${targets.length} frame ngược đầu`,
        detail: `Hướng chuẩn ${basis}: ${framesText(targets)}`,
        apply: async (batch) => {
          for (const f of targets) {
            const s = await getState(rec.id, f);
            if (!isCuboid(s) || s.outside) continue;
            await batch.edit(s, f, (st) => {
              const p = [...st.points];
              p[5] = wrapPi(p[5] + Math.PI);
              st.points = p;
            });
          }
        },
      });
    }
    if (manual.length) {
      ops.push({
        type: 'yaw', trackId: rec.id, auto: false, frame: manual[0],
        title: `#${rec.id} [${rec.label}] · Đổi hướng ${opts.yawThresh}–135° (không phải lật đầu)`,
        detail: `Cần sửa tay: ${framesText(manual)}`,
      });
    }
    return ops;
  }

  // Quá xa: đặt outside cho các đoạn frame vượt ngưỡng
  function planFarFix(rec, opts) {
    const far = (x) => Math.hypot(x.points[0], x.points[1], x.points[2]) > opts.distThresh;
    const fr = rec.frames;
    const segments = [];
    for (let i = 0; i < fr.length; i++) {
      if (!far(fr[i])) continue;
      const last = segments[segments.length - 1];
      if (last && last.endIdx === i - 1 && fr[i].frame === fr[i - 1].frame + 1) last.endIdx = i;
      else segments.push({ startIdx: i, endIdx: i });
    }
    if (!segments.length) return null;
    const desc = segments.map((s) => `f${fr[s.startIdx].frame}–f${fr[s.endIdx].frame}`).join(', ');
    if (rec.objectType !== 'track') {
      return {
        type: 'far', trackId: rec.id, auto: false, frame: fr[segments[0].startIdx].frame,
        title: `#${rec.id} [${rec.label}] · Quá xa > ${opts.distThresh}m (shape)`,
        detail: `Shape không có outside, cần xoá/kiểm tra tay: ${desc}`,
      };
    }
    return {
      type: 'far', trackId: rec.id, auto: true, checked: false,
      title: `#${rec.id} [${rec.label}] · Đặt outside ${segments.length} đoạn quá xa > ${opts.distThresh}m`,
      detail: `Ẩn track ở: ${desc} (mặc định không chọn — xem lại trước)`,
      apply: async (batch) => {
        for (const seg of segments) {
          const a = fr[seg.startIdx].frame;
          const b = fr[seg.endIdx].frame;
          const after = fr[seg.endIdx + 1];
          // Giữ phần track sau đoạn xa: chốt keyframe ngay sau đoạn trước khi đặt outside
          if (after && after.frame === b + 1) {
            const s = await getState(rec.id, after.frame);
            if (s && !s.outside && !s.keyframe) await batch.edit(s, after.frame, (st) => { st.keyframe = true; });
          }
          for (let k = seg.startIdx; k <= seg.endIdx; k++) {
            const x = fr[k];
            if (x.frame !== a && !x.keyframe) continue;
            const s = await getState(rec.id, x.frame);
            if (s && !s.outside) await batch.edit(s, x.frame, (st) => { st.outside = true; });
          }
        }
      },
    };
  }

  function planOverlapNotes(rows) {
    const pairs = new Map();
    for (const r of rows) {
      if (r.type !== QA_TYPES.overlap || r.trackId > r.related) continue;
      const key = `${r.trackId}-${r.related}`;
      const p = pairs.get(key) || { a: r.trackId, b: r.related, cls: r.cls, frames: [], maxIoU: 0 };
      p.frames.push(r.frame);
      p.maxIoU = Math.max(p.maxIoU, parseFloat(r.value) || 0);
      pairs.set(key, p);
    }
    return [...pairs.values()].map((p) => ({
      type: 'overlap', trackId: p.a, auto: false, frame: p.frames[0],
      title: `#${p.a} ↔ #${p.b} · Chồng lấn ${p.frames.length} frame (IoU max ${p.maxIoU.toFixed(3)})`,
      detail: `Cần sửa tay: ${framesText(p.frames)}`,
    }));
  }

  // types: tập loại cần đề xuất ('size', 'yaw', 'far', 'overlap')
  function planFixes(qa, types) {
    const { rows, data, opts } = qa;
    const flagged = (type) => new Set(rows.filter((r) => r.type === type).map((r) => r.trackId));
    const ops = [];
    // Lỗi nằm ở frame mà sửa keyframe không chữa được => báo để sửa tay
    const manualNote = (type, id, text) => {
      const rec = data.tracks.get(id);
      const frame = rows.find((r) => r.trackId === id)?.frame;
      ops.push({ type, trackId: id, auto: false, frame, title: `#${id} [${rec.label}] · ${text}`, detail: 'Không tự sửa được, cần kiểm tra tay.' });
    };
    if (types.has('size')) {
      const ids = new Set([...flagged(QA_TYPES.scale), ...flagged(QA_TYPES.limits)]);
      for (const id of ids) {
        const op = planSizeFix(data.tracks.get(id), opts);
        if (op) ops.push(op);
        else manualNote('size', id, 'Size lệch nhưng mọi keyframe đã đúng chuẩn');
      }
    }
    if (types.has('yaw')) {
      for (const id of flagged(QA_TYPES.yaw)) {
        const yawOps = planYawFix(data.tracks.get(id), opts);
        if (yawOps.length) ops.push(...yawOps);
        else manualNote('yaw', id, 'Đổi hướng đột ngột');
      }
    }
    if (types.has('far')) {
      for (const id of flagged(QA_TYPES.dist)) {
        const op = planFarFix(data.tracks.get(id), opts);
        if (op) ops.push(op);
      }
    }
    if (types.has('overlap')) ops.push(...planOverlapNotes(rows));
    return ops;
  }

  async function previewAutoFix() {
    const qa = lastQA || await scanQA();
    if (!qa) return;
    const ops = planFixes(qa, new Set(['size', 'yaw', 'far', 'overlap']));
    if (!ops.length) return setStatus('✅ Không có lỗi nào cần sửa.', 'success');
    openFixPreview('Xem trước auto-fix QA', ops);
  }

  // Dùng cho nút ở tab Track: chỉ xét object đang chọn trên toàn job
  async function previewFixForTarget(kind) {
    const id = requireTarget();
    if (id === null) return;
    const b = jobBounds();
    if (!b) return fail('Chưa kết nối CVAT Job!');
    const opts = { ...readQAOptionsFromUI(), scale: false, overlap: false, limits: false, yaw: kind === 'yaw', dist: kind === 'far' };
    setStatus(`⏳ Đang quét #${id}...`);
    const data = await scanJobData(b.start, b.stop, id);
    if (!data.tracks.size) return fail(`Không thấy #${id} trong job.`);
    const rows = runQAChecks(data, opts);
    const ops = planFixes({ rows, data, opts }, new Set([kind]));
    if (!ops.length) {
      return setStatus(kind === 'yaw'
        ? `ℹ️ #${id} không có bước nhảy góc > ${opts.yawThresh}°.`
        : `ℹ️ #${id} không có frame nào xa hơn ${opts.distThresh}m.`, 'success');
    }
    for (const op of ops) if (op.auto) op.checked = true;
    openFixPreview(kind === 'yaw' ? `Sửa đổi hướng #${id}` : `Cắt phần quá xa #${id}`, ops);
  }

  function openFixPreview(title, ops) {
    $('cqt-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'cqt-modal';
    modal.innerHTML = `
      <div class="cqt-modal-box">
        <div class="cqt-modal-head"><span></span><button class="cqt-modal-x" title="Đóng">✕</button></div>
        <div class="cqt-modal-tools">
          <button class="cqt-btn cqt-btn-secondary" data-act="all">Chọn tất cả</button>
          <button class="cqt-btn cqt-btn-secondary" data-act="none">Bỏ chọn</button>
        </div>
        <div class="cqt-modal-body"></div>
        <div class="cqt-modal-foot">
          <button class="cqt-btn cqt-btn-ground" data-act="apply"></button>
          <button class="cqt-btn cqt-btn-secondary" data-act="close">Đóng</button>
        </div>
      </div>`;
    modal.querySelector('.cqt-modal-head span').textContent = title;
    const body = modal.querySelector('.cqt-modal-body');
    const applyBtn = modal.querySelector('[data-act="apply"]');
    const autoOps = ops.filter((o) => o.auto);
    const manualOps = ops.filter((o) => !o.auto);
    const updateCount = () => {
      const n = autoOps.filter((o) => o.checked).length;
      applyBtn.textContent = autoOps.length ? `⚡ Áp dụng ${n} sửa đã chọn` : 'Không có mục tự sửa được';
      applyBtn.disabled = n === 0;
    };

    const section = (text) => {
      const h = document.createElement('div');
      h.className = 'cqt-modal-section';
      h.textContent = text;
      body.appendChild(h);
    };
    const item = (op, withCheckbox) => {
      const row = document.createElement('label');
      row.className = 'cqt-fix-row';
      if (withCheckbox) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = op.checked;
        cb.addEventListener('change', () => { op.checked = cb.checked; updateCount(); });
        op.checkbox = cb;
        row.appendChild(cb);
      }
      const text = document.createElement('div');
      const t = document.createElement('b');
      t.textContent = op.title;
      const d = document.createElement('div');
      d.className = 'cqt-fix-detail';
      d.textContent = op.detail;
      text.append(t, d);
      row.appendChild(text);
      if (!withCheckbox) {
        row.title = 'Bấm để nhảy tới frame lỗi';
        row.addEventListener('click', () => jumpTo(op.trackId, op.frame));
      }
      body.appendChild(row);
    };

    if (autoOps.length) section(`Tự sửa được (${autoOps.length})`);
    autoOps.forEach((op) => item(op, true));
    if (manualOps.length) section(`Cần sửa tay — bấm để nhảy tới (${manualOps.length})`);
    manualOps.forEach((op) => item(op, false));
    updateCount();

    const close = () => modal.remove();
    modal.querySelector('.cqt-modal-x').addEventListener('click', close);
    modal.querySelector('[data-act="close"]').addEventListener('click', close);
    if (!autoOps.length) modal.querySelector('.cqt-modal-tools').style.display = 'none';
    modal.querySelector('[data-act="all"]').addEventListener('click', () => {
      autoOps.forEach((o) => { o.checked = true; o.checkbox.checked = true; });
      updateCount();
    });
    modal.querySelector('[data-act="none"]').addEventListener('click', () => {
      autoOps.forEach((o) => { o.checked = false; o.checkbox.checked = false; });
      updateCount();
    });
    applyBtn.addEventListener('click', async () => {
      const chosen = autoOps.filter((o) => o.checked);
      if (!chosen.length) return;
      applyBtn.disabled = true;
      close();
      await applyFixes(title, chosen);
    });
    document.body.appendChild(modal);
  }

  async function applyFixes(title, ops) {
    const batch = createBatch(title);
    // Size trước, rồi yaw, rồi outside (outside ẩn frame nên làm cuối)
    const order = { size: 0, yaw: 1, far: 2 };
    const sorted = [...ops].sort((a, b) => order[a.type] - order[b.type]);
    for (let i = 0; i < sorted.length; i++) {
      setStatus(`⏳ Đang sửa ${i + 1}/${sorted.length}: ${sorted[i].title}`);
      await sorted[i].apply(batch);
    }
    const res = await batch.finish();
    if (lastQA) await scanQA();
    setStatus(
      `⚡ Đã áp dụng ${ops.length} đề xuất (${res.changed} lần sửa). Có snapshot để khôi phục.` + editSuffix(res),
      res.errors ? 'warn' : 'success'
    );
  }

  // =========================================================================
  // Workflow kiểu Blender trên canvas 3D
  //   G / R / S         : di chuyển / xoay / co giãn object đang chọn theo chuột
  //                       (nhiều box: Shift+Click để chọn, G/R/S áp cho cả nhóm, R xoay quanh tâm nhóm)
  //   X / Y / Z         : khoá trục (bấm lần 2 = trục local của box)
  //   gõ số             : nhập giá trị chính xác (m, độ, hệ số)
  //   Ctrl (khi kéo)    : bắt bước 0.1m / 5° / 0.05
  //   Enter / chuột trái: xác nhận — Esc / chuột phải: huỷ
  //   Numpad 7 / 1 / 3  : nhìn Top / Front / Side box (Ctrl = phía đối diện), Numpad . : focus
  // =========================================================================
  const vec = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  };

  function invert4(a) {
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    return [
      (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det,
      (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
      (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det,
      (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
      (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det,
      (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
      (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det,
      (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
    ];
  }

  // Ma trận cột (three.js), có chia w
  function applyMat4(e, v) {
    const w = e[3] * v[0] + e[7] * v[1] + e[11] * v[2] + e[15];
    return [
      (e[0] * v[0] + e[4] * v[1] + e[8] * v[2] + e[12]) / w,
      (e[1] * v[0] + e[5] * v[1] + e[9] * v[2] + e[13]) / w,
      (e[2] * v[0] + e[6] * v[1] + e[10] * v[2] + e[14]) / w,
    ];
  }

  function canvasRect() {
    const el = getPerspectiveView()?.renderer?.domElement;
    const r = el?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? r : null;
  }

  function pointerOverCanvas(x, y) {
    const r = canvasRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function mouseRay(x, y) {
    const v = getPerspectiveView();
    const r = canvasRect();
    if (!v || !r) return null;
    const cam = v.camera;
    cam.updateMatrixWorld?.();
    const pInv = cam.projectionMatrixInverse?.elements || invert4(cam.projectionMatrix.elements);
    if (!pInv) return null;
    const nx = ((x - r.left) / r.width) * 2 - 1;
    const ny = -((y - r.top) / r.height) * 2 + 1;
    const a = applyMat4(cam.matrixWorld.elements, applyMat4(pInv, [nx, ny, -1]));
    const b = applyMat4(cam.matrixWorld.elements, applyMat4(pInv, [nx, ny, 1]));
    const d = vec.sub(b, a);
    const len = Math.hypot(d[0], d[1], d[2]);
    return { o: a, d: vec.scale(d, 1 / len) };
  }

  function rayPlane(ray, normal, point) {
    if (!ray) return null;
    const den = vec.dot(normal, ray.d);
    if (Math.abs(den) < 1e-9) return null;
    const t = vec.dot(normal, vec.sub(point, ray.o)) / den;
    return t < 0 ? null : vec.add(ray.o, vec.scale(ray.d, t));
  }

  let lastMouse = { x: 0, y: 0 };
  let swallowClicksUntil = 0;
  const xf = { active: false, items: [] };

  function axisVector(axis, local, yaw) {
    if (axis === 'Z') return [0, 0, 1];
    if (!local) return axis === 'X' ? [1, 0, 0] : [0, 1, 0];
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return axis === 'X' ? [c, s, 0] : [-s, c, 0];
  }

  // Mọi phép chiếu chuột dùng tâm nhóm (pivot) làm điểm tựa
  function groundHit(mouse) {
    return rayPlane(mouseRay(mouse.x, mouse.y), [0, 0, 1], xf.pivot);
  }

  function verticalHit(mouse) {
    const v = getPerspectiveView();
    const e = v.camera.matrixWorld.elements;
    const n = [e[8], e[9], 0]; // hướng nhìn chiếu xuống mặt ngang
    if (Math.hypot(n[0], n[1]) < 1e-6) return null;
    return rayPlane(mouseRay(mouse.x, mouse.y), n, xf.pivot);
  }

  function typedValue() {
    if (!xf.typed || xf.typed === '-' || xf.typed === '.') return null;
    const n = parseFloat(xf.typed);
    return Number.isFinite(n) ? n : null;
  }

  // Tham số chung cho cả nhóm, tính từ chuột / số đã gõ
  function computeParams(mouse, ctrl) {
    const typed = typedValue();
    const c = xf.pivot;
    const refYaw = xf.items[0].orig[5]; // trục local theo object đang active

    if (xf.mode === 'G') {
      let delta = [0, 0, 0];
      if (typed !== null) {
        delta = vec.scale(axisVector(xf.axis || 'X', xf.local || !xf.axis, refYaw), typed);
      } else if (xf.axis === 'Z') {
        const h0 = verticalHit(xf.startMouse), h1 = verticalHit(mouse);
        if (h0 && h1) delta = [0, 0, h1[2] - h0[2]];
      } else {
        const h0 = groundHit(xf.startMouse), h1 = groundHit(mouse);
        if (h0 && h1) {
          const d = vec.sub(h1, h0);
          d[2] = 0;
          if (xf.axis) {
            const ax = axisVector(xf.axis, xf.local, refYaw);
            delta = vec.scale(ax, vec.dot(d, ax));
          } else {
            delta = d;
          }
        }
      }
      if (ctrl && typed === null) delta = delta.map((x) => Math.round(x * 10) / 10);
      return { delta, info: `Δ ${delta.map((x) => fmtSigned(x)).join(', ')} m` };
    }

    if (xf.mode === 'R') {
      let angle = 0;
      if (typed !== null) {
        angle = typed * RAD;
      } else if (xf.axis === 'X' || xf.axis === 'Y') {
        angle = (mouse.x - xf.startMouse.x) * 0.5 * RAD;
      } else {
        const h0 = groundHit(xf.startMouse), h1 = groundHit(mouse);
        if (h0 && h1) angle = Math.atan2(h1[1] - c[1], h1[0] - c[0]) - Math.atan2(h0[1] - c[1], h0[0] - c[0]);
      }
      angle = wrapPi(angle);
      if (ctrl && typed === null) angle = Math.round(angle / (5 * RAD)) * 5 * RAD;
      const idx = xf.axis === 'X' ? 3 : xf.axis === 'Y' ? 4 : 5;
      return { angle, idx, info: `${idx === 3 ? 'Roll' : idx === 4 ? 'Pitch' : 'Yaw'} ${fmtSigned(angle * DEG, 1)}°` };
    }

    let k = 1;
    if (typed !== null) {
      k = typed;
    } else {
      const h0 = groundHit(xf.startMouse), h1 = groundHit(mouse);
      if (h0 && h1) {
        const d0 = Math.hypot(h0[0] - c[0], h0[1] - c[1]);
        if (d0 > 0.05) k = Math.hypot(h1[0] - c[0], h1[1] - c[1]) / d0;
      }
    }
    if (ctrl && typed === null) k = Math.round(k / 0.05) * 0.05;
    k = Math.max(0.05, k);
    return { k, info: `×${k.toFixed(3)}${xf.axis ? ` (${{ X: 'L', Y: 'W', Z: 'H' }[xf.axis]})` : ''}` };
  }

  function applyParams(o, prm) {
    const p = [...o];
    if (xf.mode === 'G') {
      for (let i = 0; i < 3; i++) p[i] += prm.delta[i];
    } else if (xf.mode === 'R') {
      if (prm.idx === 5 && xf.items.length > 1) {
        // Xoay cả nhóm quanh tâm nhóm: vị trí quay theo, yaw từng box cộng thêm
        const c = Math.cos(prm.angle), s = Math.sin(prm.angle);
        const dx = o[0] - xf.pivot[0], dy = o[1] - xf.pivot[1];
        p[0] = xf.pivot[0] + dx * c - dy * s;
        p[1] = xf.pivot[1] + dx * s + dy * c;
      }
      p[prm.idx] = wrapPi(o[prm.idx] + prm.angle);
    } else {
      // Co giãn kích thước từng box, giữ đáy, không đổi vị trí tâm XY
      const dims = [o[6], o[7], o[8]].map((x, i) => (!xf.axis || 'XYZ'[i] === xf.axis ? Math.max(0.05, x * prm.k) : x));
      return withLWH(o, dims[0], dims[1], dims[2], true);
    }
    return p;
  }

  function previewMesh(it) {
    const m = it.mesh, m0 = it.mesh0, o = it.orig, p = it.points;
    if (!m || !m0) return;
    m.position.set(m0.pos[0] + p[0] - o[0], m0.pos[1] + p[1] - o[1], m0.pos[2] + p[2] - o[2]);
    m.rotation.set(m0.rot[0] + p[3] - o[3], m0.rot[1] + p[4] - o[4], m0.rot[2] + p[5] - o[5]);
    m.scale.set(m0.scl[0] * p[6] / o[6], m0.scl[1] * p[7] / o[7], m0.scl[2] * p[8] / o[8]);
  }

  function restoreMeshes() {
    for (const it of xf.items || []) {
      const m = it.mesh, m0 = it.mesh0;
      if (!m || !m0) continue;
      m.position.set(...m0.pos);
      m.rotation.set(...m0.rot);
      m.scale.set(...m0.scl);
    }
  }

  function hud(text) {
    let el = $('cqt-hud');
    if (!text) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'cqt-hud';
      document.body.appendChild(el);
    }
    const r = canvasRect();
    if (r) {
      el.style.left = `${r.left + r.width / 2}px`;
      el.style.top = `${r.top + 12}px`;
    }
    el.textContent = text;
  }

  function targetsText() {
    const ids = xf.items.map((it) => '#' + it.id);
    return ids.length > 4 ? `${ids.length} box (${ids.slice(0, 4).join(', ')}, …)` : ids.join(', ');
  }

  function updateTransform(ctrl = false) {
    if (!xf.active) return;
    const prm = computeParams(lastMouse, ctrl);
    xf.info = prm.info;
    for (const it of xf.items) {
      it.points = applyParams(it.orig, prm);
      previewMesh(it);
    }
    const names = { G: 'Di chuyển', R: 'Xoay', S: 'Co giãn' };
    const axis = xf.axis ? ` · trục ${xf.axis}${xf.local || xf.mode === 'S' ? ' (local)' : ''}` : '';
    const typed = xf.typed ? ` · nhập: ${xf.typed}_` : '';
    hud(`${names[xf.mode]} ${targetsText()}${axis} · ${xf.info}${typed}   |   Enter/chuột trái: OK · Esc/chuột phải: huỷ · X/Y/Z: trục · Ctrl: bắt bước` +
      (xf.items.every((it) => it.mesh) ? '' : '  (có box không xem trước được, sẽ áp khi xác nhận)'));
  }

  // Box sẽ bị tác động: cả danh sách chọn (nếu object đang active nằm trong đó), ngược lại chỉ object active
  function transformTargets() {
    const id = activeId();
    if (selection.size && (id === null || selection.has(id))) {
      return id === null ? [...selection] : [id, ...[...selection].filter((x) => x !== id)];
    }
    return id === null ? [] : [id];
  }

  async function startTransform(mode) {
    const ids = transformTargets();
    const frame = getFrame();
    if (!ids.length || !Number.isInteger(frame)) return;
    const states = await getStates(frame);
    const items = [];
    let locked = 0;
    for (const id of ids) {
      const s = states.find((x) => x.clientID === id);
      if (!isCuboid(s) || s.outside) continue;
      if (s.lock) { locked++; continue; }
      const mesh = findDrawnMesh(id);
      items.push({
        id, state: s, orig: [...s.points], points: [...s.points], mesh,
        mesh0: mesh ? {
          pos: [mesh.position.x, mesh.position.y, mesh.position.z],
          rot: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
          scl: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
        } : null,
      });
    }
    if (!items.length) return setStatus(locked ? '🔒 Object đang bị khoá.' : 'ℹ️ Không có box nào để thao tác ở frame này.', 'warn');
    const pivot = [0, 1, 2].map((k) => items.reduce((sum, it) => sum + it.orig[k], 0) / items.length);
    Object.assign(xf, {
      active: true, mode, axis: null, local: false, typed: '', frame, items, pivot,
      startMouse: { ...lastMouse }, info: '',
    });
    if (locked) setStatus(`🔒 Bỏ qua ${locked} box đang bị khoá.`, 'warn');
    updateTransform();
  }

  function endTransform() {
    xf.active = false;
    hud(null);
    swallowClicksUntil = Date.now() + 300;
  }

  function cancelTransform() {
    restoreMeshes();
    endTransform();
    setStatus('↩️ Đã huỷ thao tác.', '');
  }

  async function confirmTransform() {
    const { items, frame, mode } = xf;
    endTransform();
    const moved = items.filter((it) => it.points.some((v, i) => Math.abs(v - it.orig[i]) > 1e-9));
    if (!moved.length) return restoreMeshes();
    const batch = createBatch(`${mode} ${targetsText()}`);
    for (const it of moved) await batch.edit(it.state, frame, (s) => { s.points = it.points; });
    const res = await batch.finish();
    if (!res.changed) restoreMeshes();
    setStatus(`✅ ${mode} ${targetsText()}: ${xf.info}.` + editSuffix(res), res.changed ? 'success' : 'error');
  }

  function swallow(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function handleTransformKey(e) {
    swallow(e);
    const k = e.key;
    if (k === 'Escape') return cancelTransform();
    if (k === 'Enter') return confirmTransform();
    if (e.code === 'KeyX' || e.code === 'KeyY' || e.code === 'KeyZ') {
      const axis = e.code.slice(3);
      if (xf.mode === 'S') xf.axis = xf.axis === axis ? null : axis;
      else if (xf.axis !== axis) { xf.axis = axis; xf.local = false; }
      else if (!xf.local && axis !== 'Z') xf.local = true;
      else { xf.axis = null; xf.local = false; }
    } else if (e.code === 'KeyG' || e.code === 'KeyR' || e.code === 'KeyS') {
      restoreMeshes();
      Object.assign(xf, { mode: e.code.slice(3), axis: null, local: false, typed: '', startMouse: { ...lastMouse } });
    } else if (/^[0-9]$/.test(k) || k === '.' || k === ',') {
      xf.typed += k === ',' ? '.' : k;
    } else if (k === '-') {
      xf.typed = xf.typed.startsWith('-') ? xf.typed.slice(1) : '-' + xf.typed;
    } else if (k === 'Backspace') {
      xf.typed = xf.typed.slice(0, -1);
    }
    updateTransform(e.ctrlKey);
  }

  // =========================================================================
  // Camera
  // =========================================================================
  async function cameraView(kind, opposite = false) {
    const v = getPerspectiveView();
    if (!v) return fail('Không tìm thấy camera 3D của CVAT.');
    const controls = v.controls;
    const cam = v.camera;
    let target = null, yaw = 0, size = 4;
    const id = resolveTargetId();
    if (Number.isInteger(id)) {
      const s = await getState(id, getFrame());
      if (isCuboid(s) && !s.outside) {
        target = s.points.slice(0, 3);
        yaw = s.points[5];
        size = Math.max(s.points[6], s.points[7], s.points[8]);
      }
    }
    const t0 = controls?.getTarget?.();
    const curTarget = t0 ? [t0.x, t0.y, t0.z] : [0, 0, 0];
    if (!target) {
      if (kind === 'focus') return fail('Chọn object để focus.');
      target = curTarget;
    }
    const dist = Math.max(size * 2.5, 6);
    const sign = opposite ? -1 : 1;
    const h = [Math.cos(yaw), Math.sin(yaw), 0];
    const left = [-Math.sin(yaw), Math.cos(yaw), 0];
    let eye;
    if (kind === 'top') {
      eye = vec.add(target, vec.add([0, 0, sign * dist], vec.scale(h, -0.01)));
    } else if (kind === 'front') {
      eye = vec.add(target, vec.add(vec.scale(h, sign * dist), [0, 0, dist * 0.15]));
    } else if (kind === 'side') {
      eye = vec.add(target, vec.add(vec.scale(left, sign * dist), [0, 0, dist * 0.15]));
    } else {
      const pos = [cam.position.x, cam.position.y, cam.position.z];
      let dir = vec.sub(pos, curTarget);
      const len = Math.hypot(...dir) || 1;
      dir = vec.scale(dir, 1 / len);
      eye = vec.add(target, vec.scale(dir, dist));
    }
    if (typeof controls?.setLookAt === 'function') {
      controls.setLookAt(eye[0], eye[1], eye[2], target[0], target[1], target[2], true);
    } else {
      cam.position.set(...eye);
      cam.lookAt(...target);
      controls?.target?.set?.(...target);
      controls?.update?.();
    }
  }

  // =========================================================================
  // Phím tắt + chuột (đăng ký 1 lần)
  // =========================================================================
  function isTyping(e) {
    const t = e.target;
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  const NUMPAD_VIEWS = { Numpad7: 'top', Numpad1: 'front', Numpad3: 'side', NumpadDecimal: 'focus' };
  const ALT_ACTIONS = {
    KeyQ: () => togglePanel(),
    KeyG: () => quickGroundSnap(selectedOrTarget()),
    KeyS: () => smartSnap(selectedOrTarget()),
    KeyF: () => cameraView('focus'),
    Digit7: () => cameraView('top'),
    Digit1: () => cameraView('front'),
    Digit3: () => cameraView('side'),
  };

  function onKeyDown(e) {
    if (xf.active) return handleTransformKey(e);
    if (!document.getElementById('cvat-quicktool-wrapper')) return;

    if (e.altKey && !e.ctrlKey && !e.metaKey && ALT_ACTIONS[e.code]) {
      if (isTyping(e) && e.code !== 'KeyQ') return;
      swallow(e);
      ALT_ACTIONS[e.code]();
      return;
    }
    if (isTyping(e) || e.altKey || e.metaKey || e.repeat) return;
    if (!getSettings().blenderKeys || !pointerOverCanvas(lastMouse.x, lastMouse.y)) return;

    if (NUMPAD_VIEWS[e.code]) {
      swallow(e);
      cameraView(NUMPAD_VIEWS[e.code], e.ctrlKey);
      return;
    }
    if (!e.ctrlKey && !e.shiftKey && (e.code === 'KeyG' || e.code === 'KeyR' || e.code === 'KeyS') && transformTargets().length) {
      swallow(e);
      startTransform(e.code.slice(3));
    }
  }

  function installGlobalHandlers() {
    if (window.__cqtHandlers) return;
    window.__cqtHandlers = true;

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('mousemove', (e) => {
      lastMouse = { x: e.clientX, y: e.clientY };
      if (xf.active) updateTransform(e.ctrlKey);
    }, true);
    window.addEventListener('mousedown', (e) => {
      if (!xf.active) return;
      swallow(e);
      if (e.button === 0) confirmTransform();
      else cancelTransform();
    }, true);
    for (const type of ['mouseup', 'click', 'contextmenu']) {
      window.addEventListener(type, (e) => {
        if (xf.active || Date.now() < swallowClicksUntil) swallow(e);
      }, true);
    }
    // Shift + Click trên canvas / danh sách object => thêm/bớt khỏi danh sách chọn
    document.addEventListener('click', (e) => {
      if (!e.shiftKey || e.target.closest?.('#cvat-quicktool-wrapper, #cqt-modal')) return;
      if (!document.getElementById('cvat-quicktool-wrapper')) return;
      setTimeout(() => {
        const id = activeId();
        if (id !== null) toggleSelection(id);
      }, 150);
    }, true);
  }

  // =========================================================================
  // Giao diện
  // =========================================================================
  const STYLES = `
    #cvat-quicktool-wrapper {
      position: fixed; top: 100px; right: 0; z-index: 999999;
      display: flex; align-items: flex-start;
      transform: translateX(340px);
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px; user-select: none;
    }
    #cvat-quicktool-wrapper.hover-open, #cvat-quicktool-wrapper.pinned { transform: translateX(0) !important; }
    #cvat-quicktool-handle {
      width: 28px; background: #1890ff; color: #fff; padding: 12px 4px;
      border-radius: 8px 0 0 8px; cursor: pointer; font-weight: 600; font-size: 11px;
      box-shadow: -3px 2px 10px rgba(0,0,0,0.45); writing-mode: vertical-rl;
    }
    #cvat-quicktool-handle:hover { background: #40a9ff; }
    #cvat-quicktool-wrapper.pinned #cvat-quicktool-handle { background: #52c41a; }
    #cvat-quicktool-panel {
      width: 340px; background: #1f1f1f; color: #e6e6e6; border: 1px solid #383838; border-right: none;
      border-radius: 8px 0 0 8px; box-shadow: -8px 8px 24px rgba(0,0,0,0.7);
      overflow: hidden; display: flex; flex-direction: column; max-height: 88vh;
    }
    #cvat-quicktool-header {
      padding: 9px 12px; background: #2a2a2a; display: flex; justify-content: space-between;
      align-items: center; border-bottom: 1px solid #383838; cursor: move;
    }
    #cvat-quicktool-header .title { font-weight: 600; color: #1890ff; display: flex; align-items: center; gap: 6px; }
    .cqt-badge { background: #141414; border: 1px solid #434343; padding: 1px 5px; border-radius: 3px; color: #8c8c8c; font-size: 10px; font-family: monospace; }
    #cvat-quicktool-header .actions button { background: none; border: none; color: #8c8c8c; cursor: pointer; font-size: 13px; padding: 2px 4px; border-radius: 3px; }
    #cvat-quicktool-header .actions button:hover { color: #fff; background: #383838; }
    #cvat-quicktool-header .actions button.active { color: #52c41a; background: #162312; }
    .cqt-camera { display: flex; gap: 3px; padding: 4px 8px; background: #181818; border-bottom: 1px solid #2e2e2e; }
    .cqt-tabs { display: flex; background: #242424; border-bottom: 1px solid #383838; }
    .cqt-tab { flex: 1; padding: 7px 0; background: none; border: none; border-bottom: 2px solid transparent; color: #8c8c8c; font-size: 11px; font-weight: 600; cursor: pointer; }
    .cqt-tab:hover { color: #ddd; }
    .cqt-tab.active { color: #1890ff; border-bottom-color: #1890ff; }
    #cvat-quicktool-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; min-height: 0; flex: 1 1 auto; }
    .cqt-pane { display: none; flex-direction: column; gap: 8px; }
    .cqt-pane.active { display: flex; }
    .cqt-row { display: flex; align-items: center; gap: 8px; }
    .cqt-wrap { flex-wrap: wrap; }
    .cqt-col { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
    .cqt-label { color: #aaa; font-size: 11px; }
    .cqt-h { font-weight: 600; color: #fff; font-size: 11px; }
    .cqt-hint { font-size: 10px; color: #94a3b8; line-height: 1.4; }
    .cqt-card { background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 7px; display: flex; flex-direction: column; gap: 5px; }
    .cqt-input { background: #141414; border: 1px solid #434343; border-radius: 4px; color: #fff; padding: 6px 8px; font-size: 12px; outline: none; width: 100%; box-sizing: border-box; }
    .cqt-input:focus { border-color: #1890ff; }
    .cqt-input.cqt-mini { width: 52px; padding: 2px 4px; font-size: 11px; display: inline-block; }
    .cqt-btn { background: #1890ff; border: none; color: #fff; padding: 7px 10px; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px; flex: 1; }
    .cqt-btn:hover { background: #40a9ff; }
    .cqt-btn:disabled { opacity: 0.5; cursor: default; }
    .cqt-btn.cqt-sm { padding: 3px 5px; font-size: 10px; }
    .cqt-btn.cqt-none { flex: none; }
    .cqt-btn-secondary { background: #333; color: #ddd; }
    .cqt-btn-secondary:hover { background: #444; color: #fff; }
    .cqt-btn-danger { background: #cf1322; }
    .cqt-btn-danger:hover { background: #f5222d; }
    .cqt-btn-ground { background: #237804; }
    .cqt-btn-ground:hover { background: #389e0d; }
    .cqt-divider { height: 1px; background: #333; margin: 2px 0; }
    .cqt-check { color: #aaa; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px; }
    .cqt-check input { margin: 0; cursor: pointer; }
    .cqt-chip { background: #0c4a6e; color: #e0f2fe; border-radius: 10px; padding: 1px 7px; font-size: 10px; cursor: pointer; }
    .cqt-status { font-size: 11px; padding: 7px 9px; margin: 0 12px 12px; border-radius: 4px; background: #141414; color: #aaa; min-height: 18px; word-break: break-word; line-height: 1.45; flex: none; }
    .cqt-status.success { color: #52c41a; background: #162312; border: 1px solid #274916; }
    .cqt-status.error { color: #ff4d4f; background: #2a1215; border: 1px solid #58181c; }
    .cqt-status.warn { color: #faad14; background: #2b2111; border: 1px solid #594214; }
    .cqt-log { background: #141414; border: 1px solid #333; border-radius: 4px; color: #aaa; font-size: 10px; line-height: 1.45; padding: 7px; margin: 0; max-height: 140px; overflow: auto; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, Menlo, monospace; }
    #cqt-qa-result { max-height: 280px; font-family: inherit; font-size: 11px; white-space: normal; padding: 4px; }
    .cqt-qa-row { padding: 4px 5px; border-bottom: 1px solid #262626; cursor: pointer; }
    .cqt-qa-row:hover { background: #1f2937; }
    .cqt-qa-row b { color: #fbbf24; font-weight: 600; }
    #cqt-modal { position: fixed; inset: 0; z-index: 1000000; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; font-size: 12px; }
    .cqt-modal-box { width: min(640px, 92vw); max-height: 82vh; background: #1f1f1f; color: #e6e6e6; border: 1px solid #383838; border-radius: 8px; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,0.7); }
    .cqt-modal-head { padding: 10px 14px; font-weight: 600; color: #1890ff; display: flex; justify-content: space-between; border-bottom: 1px solid #383838; }
    .cqt-modal-x { background: none; border: none; color: #8c8c8c; cursor: pointer; font-size: 14px; }
    .cqt-modal-tools, .cqt-modal-foot { display: flex; gap: 6px; padding: 8px 14px; }
    .cqt-modal-foot { border-top: 1px solid #383838; }
    .cqt-modal-body { overflow-y: auto; padding: 0 14px 8px; }
    .cqt-modal-section { margin: 10px 0 4px; color: #94a3b8; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .cqt-fix-row { display: flex; gap: 8px; align-items: flex-start; padding: 6px; border-radius: 4px; cursor: pointer; }
    .cqt-fix-row:hover { background: #262626; }
    .cqt-fix-row input { margin-top: 2px; }
    .cqt-fix-detail { color: #94a3b8; font-size: 11px; margin-top: 2px; word-break: break-word; }
    #cqt-hud { position: fixed; transform: translateX(-50%); z-index: 1000001; background: rgba(15,23,42,0.92); color: #e2e8f0; border: 1px solid #38bdf8; border-radius: 6px; padding: 5px 10px; font: 12px ui-monospace, Menlo, monospace; pointer-events: none; white-space: nowrap; }
  `;

  const PANEL_HTML = `
    <div id="cvat-quicktool-handle" title="Di chuột để mở, bấm để ghim (Alt+Q)"><span>◀ TOOLBOX</span></div>
    <div id="cvat-quicktool-panel">
      <div id="cvat-quicktool-header" title="Kéo để di chuyển panel">
        <div class="title"><span>📦</span> CVAT Toolbox <span class="cqt-badge">v${VERSION}</span></div>
        <div class="actions">
          <button id="cqt-btn-pin" title="Ghim">📌</button>
          <button id="cqt-btn-close" title="Thu gọn">✕</button>
        </div>
      </div>

      <div class="cqt-camera">
        <button data-cam="focus" class="cqt-btn cqt-btn-secondary cqt-sm" title="Focus vào object (Numpad . / Alt+F)">🎯 Focus</button>
        <button data-cam="top" class="cqt-btn cqt-btn-secondary cqt-sm" title="Nhìn từ trên (Numpad 7 / Alt+7)">🔝 Top</button>
        <button data-cam="front" class="cqt-btn cqt-btn-secondary cqt-sm" title="Nhìn đầu xe (Numpad 1 / Alt+1)">🚗 Front</button>
        <button data-cam="side" class="cqt-btn cqt-btn-secondary cqt-sm" title="Nhìn sườn xe (Numpad 3 / Alt+3)">↔️ Side</button>
      </div>

      <div class="cqt-tabs">
        <button class="cqt-tab active" data-tab="object">Object</button>
        <button class="cqt-tab" data-tab="ground">Ground</button>
        <button class="cqt-tab" data-tab="track">Track</button>
        <button class="cqt-tab" data-tab="qa">QA</button>
        <button class="cqt-tab" data-tab="settings">Cài đặt</button>
      </div>

      <div id="cvat-quicktool-body">
        <!-- ================= OBJECT ================= -->
        <div class="cqt-pane active" data-pane="object">
          <div class="cqt-row">
            <div class="cqt-col">
              <span class="cqt-label">Target Object ID (trống = object đang chọn)</span>
              <input type="number" id="cqt-target-id" class="cqt-input" placeholder="Ví dụ: 13" />
            </div>
            <button id="cqt-btn-detect" class="cqt-btn cqt-btn-secondary cqt-none" style="margin-top:17px;" title="Lấy object đang chọn">🎯 Auto</button>
          </div>

          <div class="cqt-row">
            <button id="cqt-btn-smart-snap" class="cqt-btn cqt-btn-ground" title="Hút box theo cụm điểm LiDAR: căn tâm, xoay theo dáng xe, đặt đáy lên mặt đất (Alt+S)">🧲 Smart Snap (Alt+S)</button>
            <label class="cqt-check" title="Bật: tính lại cả L/W/H theo cụm điểm. Tắt: giữ LWH, bám mặt gần cảm biến."><input type="checkbox" id="cqt-snap-fit-size" /> Fit size</label>
          </div>

          <div class="cqt-card">
            <div class="cqt-row" style="justify-content:space-between;">
              <span class="cqt-h">🎯 Chọn nhiều box (<span id="cqt-multi-count">0</span>)</span>
              <button id="cqt-btn-multi-clear" class="cqt-btn cqt-btn-secondary cqt-sm cqt-none">Bỏ chọn</button>
            </div>
            <div id="cqt-multi-list" class="cqt-row cqt-wrap" style="gap:4px;"></div>
            <div class="cqt-row" style="gap:4px;">
              <button id="cqt-btn-multi-select-all" class="cqt-btn cqt-btn-secondary cqt-sm">Tất cả trong frame</button>
              <button id="cqt-btn-multi-snap" class="cqt-btn cqt-btn-ground cqt-sm">🧲 Snap</button>
              <button id="cqt-btn-multi-ground" class="cqt-btn cqt-btn-secondary cqt-sm">⬇️ Chạm đất</button>
              <button id="cqt-btn-multi-outside" class="cqt-btn cqt-btn-danger cqt-sm" title="Đặt outside từ frame hiện tại (không xoá)">🙈 Outside</button>
            </div>
            <div class="cqt-row" style="gap:4px;">
              <input type="number" step="0.1" id="cqt-multi-dx" class="cqt-input" placeholder="dX" />
              <input type="number" step="0.1" id="cqt-multi-dy" class="cqt-input" placeholder="dY" />
              <input type="number" step="0.1" id="cqt-multi-dz" class="cqt-input" placeholder="dZ" />
              <button id="cqt-btn-multi-shift" class="cqt-btn cqt-btn-secondary cqt-sm cqt-none" title="Dịch các box đã chọn tại frame hiện tại">↔️ Dịch</button>
            </div>
            <div class="cqt-hint">Giữ <b>Shift + Click</b> object trên canvas hoặc danh sách để thêm/bớt. Rê chuột lên canvas bấm <b>G / R / S</b> để di chuyển / xoay (quanh tâm nhóm) / co giãn cả nhóm.</div>
          </div>

          <div class="cqt-row">
            <div class="cqt-col"><span class="cqt-label">Start Frame</span><input type="number" id="cqt-frame-start" class="cqt-input" value="0" /></div>
            <div class="cqt-col"><span class="cqt-label">End Frame</span><input type="number" id="cqt-frame-end" class="cqt-input" value="0" /></div>
            <div class="cqt-col"><span class="cqt-label">Số frame</span><input type="number" min="1" id="cqt-frame-count" class="cqt-input" /></div>
          </div>
          <div class="cqt-row" style="justify-content:space-between;">
            <span class="cqt-label">Frame hiện tại: <b id="cqt-current-frame" style="color:#1890ff;">?</b></span>
            <button id="cqt-btn-detect-span" class="cqt-btn cqt-btn-secondary cqt-sm cqt-none" title="Dò frame đầu/cuối mà object tồn tại">🔍 Tự lấy dải frame</button>
          </div>

          <div class="cqt-divider"></div>
          <div class="cqt-row" style="justify-content:space-between;">
            <span class="cqt-h">Kích thước LWH (m)</span>
            <button id="cqt-btn-get-lwh" class="cqt-btn cqt-btn-secondary cqt-sm cqt-none">Lấy size</button>
          </div>
          <div class="cqt-row">
            <div class="cqt-col"><span class="cqt-label">L</span><input type="number" step="0.01" id="cqt-lwh-l" class="cqt-input" /></div>
            <div class="cqt-col"><span class="cqt-label">W</span><input type="number" step="0.01" id="cqt-lwh-w" class="cqt-input" /></div>
            <div class="cqt-col"><span class="cqt-label">H</span><input type="number" step="0.01" id="cqt-lwh-h" class="cqt-input" /></div>
          </div>
          <div class="cqt-row" style="gap:14px;">
            <label class="cqt-check" title="Giữ cao độ đáy khi đổi H"><input type="checkbox" id="cqt-keep-ground" checked /> Giữ đáy</label>
            <label class="cqt-check" title="Áp dụng dải chỉ sửa keyframe"><input type="checkbox" id="cqt-lwh-keyframe-only" checked /> Chỉ keyframe</label>
          </div>
          <button id="cqt-btn-apply-lwh" class="cqt-btn">📐 Áp dụng LWH cho dải Start–End</button>
          <div class="cqt-row">
            <button id="cqt-btn-sync-track" class="cqt-btn cqt-btn-secondary" title="Áp LWH cho mọi keyframe của track; frame nội suy tự theo">🔗 Toàn track</button>
            <button id="cqt-btn-apply-frame" class="cqt-btn cqt-btn-secondary" title="Chỉ frame hiện tại">✂️ Chỉ frame này</button>
          </div>

          <div class="cqt-divider"></div>
          <span class="cqt-h">Preset theo label</span>
          <div class="cqt-row">
            <select id="cqt-preset-select" class="cqt-input"></select>
            <button id="cqt-btn-preset-apply" class="cqt-btn cqt-btn-secondary cqt-none">Dùng</button>
          </div>
          <div class="cqt-row">
            <button id="cqt-btn-preset-save" class="cqt-btn cqt-btn-secondary">💾 Lưu preset</button>
            <button id="cqt-btn-preset-delete" class="cqt-btn cqt-btn-danger">Xoá preset</button>
          </div>

          <div class="cqt-divider"></div>
          <div class="cqt-row">
            <button id="cqt-btn-copy-transform" class="cqt-btn cqt-btn-secondary">📋 Copy transform</button>
            <button id="cqt-btn-paste-transform" class="cqt-btn cqt-btn-secondary">📥 Paste</button>
          </div>

          <button id="cqt-btn-set-keyframe" class="cqt-btn cqt-btn-secondary" title="Đặt keyframe tại frame hiện tại">⭐ Đặt keyframe</button>
        </div>

        <!-- ================= GROUND ================= -->
        <div class="cqt-pane" data-pane="ground">
          <div id="cqt-plane-display" class="cqt-card cqt-hint">Chưa có mặt đất — bấm "Plane từ cloud" hoặc nhập Z.</div>
          <div class="cqt-row">
            <button id="cqt-btn-calc-plane" class="cqt-btn cqt-btn-secondary" title="Fit mặt phẳng dốc Z=aX+bY+c từ point cloud quanh object">📐 Plane từ cloud</button>
          </div>
          <div class="cqt-row">
            <button id="cqt-btn-ground-others" class="cqt-btn cqt-btn-secondary" title="Mặt phẳng ngang = trung vị đáy các box khác">📊 Z box khác</button>
            <button id="cqt-btn-ground-from-box" class="cqt-btn cqt-btn-secondary" title="Mặt phẳng ngang = đáy box hiện tại">📌 Z từ box này</button>
          </div>
          <div class="cqt-row">
            <div class="cqt-col"><span class="cqt-label">Hoặc nhập Z mặt đất (m)</span><input type="number" step="0.01" id="cqt-ground-z" class="cqt-input" placeholder="vd: -1.70" /></div>
            <div class="cqt-col">
              <span class="cqt-label">Cách đặt</span>
              <select id="cqt-ground-mode" class="cqt-input">
                <option value="snap">Snap đáy (giữ nghiêng)</option>
                <option value="flat">Đặt phẳng (rx=ry=0)</option>
                <option value="tilt">Nghiêng theo dốc</option>
              </select>
            </div>
          </div>
          <div class="cqt-row">
            <div class="cqt-col">
              <span class="cqt-label">Phạm vi</span>
              <select id="cqt-ground-scope" class="cqt-input">
                <option value="keyframes">Keyframe trong dải</option>
                <option value="all">Mọi frame (bake)</option>
                <option value="current">Frame hiện tại</option>
              </select>
            </div>
            <div class="cqt-col">
              <span class="cqt-label">Hướng</span>
              <select id="cqt-ground-direction" class="cqt-input">
                <option value="both">Cả hai</option>
                <option value="down">Chỉ hạ</option>
                <option value="up">Chỉ nâng</option>
              </select>
            </div>
          </div>
          <div class="cqt-row">
            <button id="cqt-btn-check-ground" class="cqt-btn cqt-btn-secondary">📏 Kiểm tra đáy</button>
            <button id="cqt-btn-apply-ground" class="cqt-btn cqt-btn-ground">⬇️ Fit mặt đất</button>
          </div>
          <div class="cqt-hint">Plane dốc tính từ cloud của frame hiện tại; áp cho dải dài trên đường cong có thể lệch — kiểm tra lại. <b>Alt+G</b>: tự tính mặt đất quanh từng object (đang chọn) và hạ chạm đất ở frame hiện tại.</div>
        </div>

        <!-- ================= TRACK ================= -->
        <div class="cqt-pane" data-pane="track">
          <label class="cqt-check"><input type="checkbox" id="cqt-track-keyframe-only" checked /> Chỉ sửa keyframe trong dải (frame nội suy tự theo)</label>

          <div class="cqt-divider"></div>
          <span class="cqt-h">Dịch chuyển cả dải (m)</span>
          <div class="cqt-row">
            <div class="cqt-col"><span class="cqt-label">dX</span><input type="number" step="0.01" id="cqt-shift-x" class="cqt-input" value="0" /></div>
            <div class="cqt-col"><span class="cqt-label">dY</span><input type="number" step="0.01" id="cqt-shift-y" class="cqt-input" value="0" /></div>
            <div class="cqt-col"><span class="cqt-label">dZ</span><input type="number" step="0.01" id="cqt-shift-z" class="cqt-input" value="0" /></div>
          </div>
          <button id="cqt-btn-shift" class="cqt-btn">↔️ Dịch chuyển</button>

          <div class="cqt-divider"></div>
          <span class="cqt-h">Hướng (yaw)</span>
          <div class="cqt-card">
            <div class="cqt-row" style="justify-content:space-between;">
              <span>🧭 Góc đầu: <b id="cqt-val-yaw" style="color:#38bdf8;">--</b> (<span id="cqt-val-yaw-rad">--</span> rad)</span>
              <span>🚗 Hướng đi: <b id="cqt-val-motion">--</b></span>
            </div>
            <div id="cqt-val-deviation" style="font-weight:600;color:#fbbf24;">(Bấm 🎯 Auto ở tab Object để đo)</div>
            <div class="cqt-row" style="gap:4px;">
              <button id="cqt-btn-quick-fix-heading" class="cqt-btn cqt-btn-ground" title="Xoay đầu theo hướng di chuyển, chỉ frame hiện tại">🎯 Nắn theo hướng đi</button>
              <button id="cqt-btn-quick-fix-cloud" class="cqt-btn cqt-btn-secondary" title="Xoay theo trục chính cụm điểm, chỉ frame hiện tại">☁️ Nắn theo Cloud</button>
            </div>
          </div>
          <div class="cqt-row">
            <button id="cqt-btn-sync-yaw" class="cqt-btn cqt-btn-ground" title="Yaw của frame hiện tại cho mọi keyframe của track">🔗 Đồng bộ góc toàn track</button>
            <button id="cqt-btn-fix-yaw-jumps" class="cqt-btn cqt-btn-secondary" title="Tìm frame lật đầu trong track, xem trước rồi sửa">⚡ Sửa frame lệch góc</button>
          </div>
          <div class="cqt-row">
            <div class="cqt-col"><span class="cqt-label">Góc xoay (°)</span><input type="number" step="1" id="cqt-rotate-deg" class="cqt-input" value="180" /></div>
            <button id="cqt-btn-rotate-angle" class="cqt-btn cqt-btn-secondary" style="margin-top:17px;">🔄 Xoay</button>
          </div>
          <div class="cqt-row" style="gap:4px;">
            <button data-rotate="180" class="cqt-btn cqt-btn-secondary">180°</button>
            <button data-rotate="90" class="cqt-btn cqt-btn-secondary">+90°</button>
            <button data-rotate="-90" class="cqt-btn cqt-btn-secondary">-90°</button>
          </div>
          <button id="cqt-btn-align-yaw" class="cqt-btn cqt-btn-secondary" title="Xoay đầu theo hướng di chuyển trên cả dải">🧭 Căn hướng theo hướng đi (cả dải)</button>
          <button id="cqt-btn-cut-far" class="cqt-btn cqt-btn-secondary" title="Đặt outside cho phần track xa hơn ngưỡng 'Quá xa' ở tab QA (có xem trước)">✂️ Cắt phần track quá xa</button>

          <div class="cqt-divider"></div>
          <button id="cqt-btn-smooth" class="cqt-btn cqt-btn-secondary">〰️ Smooth vị trí keyframe</button>
        </div>

        <!-- ================= QA ================= -->
        <div class="cqt-pane" data-pane="qa">
          <div class="cqt-card">
            <label class="cqt-check"><input type="checkbox" id="cqt-qa-check-scale" /> Scale không đồng bộ, lệch &gt; <input type="number" step="0.001" id="cqt-qa-scale-tol" class="cqt-input cqt-mini" /> m so với size chuẩn track</label>
            <label class="cqt-check"><input type="checkbox" id="cqt-qa-check-yaw" /> Đổi hướng đột ngột &gt; <input type="number" id="cqt-qa-yaw-threshold" class="cqt-input cqt-mini" />°</label>
            <label class="cqt-check"><input type="checkbox" id="cqt-qa-check-overlap" /> Chồng lấn (ped–ped cho IoU ≤ <input type="number" step="0.05" id="cqt-qa-pedped-iou" class="cqt-input cqt-mini" />)</label>
            <label class="cqt-check"><input type="checkbox" id="cqt-qa-check-dist" /> Quá xa &gt; <input type="number" id="cqt-qa-dist-threshold" class="cqt-input cqt-mini" /> m</label>
            <label class="cqt-check"><input type="checkbox" id="cqt-qa-check-limits" /> Ngoài limits LWH của class</label>
            <label class="cqt-check"><input type="checkbox" id="cqt-qa-whole-job" /> Quét toàn job (bỏ chọn = dải Start–End)</label>
          </div>
          <div class="cqt-row">
            <button id="cqt-btn-qa-scan" class="cqt-btn">🔎 Quét QA</button>
            <button id="cqt-btn-qa-autofix" class="cqt-btn cqt-btn-ground" title="Xem trước các sửa đề xuất, chọn rồi mới áp dụng">⚡ Xem trước auto-fix</button>
          </div>
          <div class="cqt-row">
            <select id="cqt-qa-filter" class="cqt-input"><option value="">Tất cả</option></select>
            <button id="cqt-btn-qa-export" class="cqt-btn cqt-btn-secondary cqt-none">📤 CSV</button>
          </div>
          <div id="cqt-qa-result" class="cqt-log">Chưa quét. Bấm "Quét QA". Bấm vào một dòng để nhảy tới lỗi.</div>

          <div class="cqt-divider"></div>
          <span class="cqt-h">Snapshot / Restore (thao tác hàng loạt)</span>
          <div class="cqt-row">
            <select id="cqt-snap-select" class="cqt-input"></select>
            <button id="cqt-btn-snap-restore" class="cqt-btn cqt-btn-secondary cqt-none">Restore</button>
          </div>
          <div class="cqt-hint">Snapshot mất khi tải lại trang. Từng lần sửa cũng có trong Ctrl+Z của CVAT.</div>
          <pre id="cqt-log" class="cqt-log">Log thao tác...</pre>
        </div>

        <!-- ================= CÀI ĐẶT ================= -->
        <div class="cqt-pane" data-pane="settings">
          <span class="cqt-h">Phím tắt</span>
          <label class="cqt-check"><input type="checkbox" id="cqt-set-blender" /> Phím kiểu Blender trên canvas 3D</label>
          <div class="cqt-hint">
            Rê chuột trên canvas 3D, chọn 1 object rồi:<br>
            <b>G</b> di chuyển · <b>R</b> xoay · <b>S</b> co giãn (giữ đáy) — áp cho cả nhóm nếu đã Shift+Click chọn nhiều box → <b>X/Y/Z</b> khoá trục (X/Y bấm 2 lần = trục của box) · gõ số để nhập chính xác · <b>Ctrl</b> bắt bước · <b>Enter</b>/chuột trái OK · <b>Esc</b>/chuột phải huỷ.<br>
            <b>Numpad 7/1/3</b> Top/Front/Side (Ctrl = phía đối diện) · <b>Numpad .</b> Focus.<br>
            <b>Alt+Q</b> panel · <b>Alt+S</b> Smart Snap · <b>Alt+G</b> chạm đất · <b>Alt+F/7/1/3</b> camera.
          </div>
          <label class="cqt-check" title="Dùng khi canvas không tự cập nhật sau khi sửa"><input type="checkbox" id="cqt-set-bounce" /> Làm mới canvas bằng chuyển frame (chậm, dự phòng)</label>

          <div class="cqt-divider"></div>
          <span class="cqt-h">Limits LWH theo class</span>
          <div class="cqt-row">
            <select id="cqt-limit-class" class="cqt-input"></select>
            <button id="cqt-btn-limit-delete" class="cqt-btn cqt-btn-danger cqt-none">Xoá</button>
          </div>
          <div class="cqt-row">
            <input id="cqt-limit-class-name" class="cqt-input" placeholder="Class mới (bỏ trống = class đang chọn)" />
            <button id="cqt-btn-limit-from-object" class="cqt-btn cqt-btn-secondary cqt-none" title="Lấy label của object đang chọn">📌</button>
          </div>
          <div class="cqt-row"><span class="cqt-label" style="width:14px;">L</span><input type="number" step="0.01" id="cqt-limit-l-min" class="cqt-input" placeholder="min" /><input type="number" step="0.01" id="cqt-limit-l-max" class="cqt-input" placeholder="max" /></div>
          <div class="cqt-row"><span class="cqt-label" style="width:14px;">W</span><input type="number" step="0.01" id="cqt-limit-w-min" class="cqt-input" placeholder="min" /><input type="number" step="0.01" id="cqt-limit-w-max" class="cqt-input" placeholder="max" /></div>
          <div class="cqt-row"><span class="cqt-label" style="width:14px;">H</span><input type="number" step="0.01" id="cqt-limit-h-min" class="cqt-input" placeholder="min" /><input type="number" step="0.01" id="cqt-limit-h-max" class="cqt-input" placeholder="max" /></div>
          <div class="cqt-row">
            <button id="cqt-btn-limit-save" class="cqt-btn">💾 Lưu limits</button>
            <button id="cqt-btn-limit-reset" class="cqt-btn cqt-btn-secondary">↺ Tiêu chuẩn</button>
          </div>
          <label class="cqt-check"><input type="checkbox" id="cqt-limit-clamp-on-apply" checked /> Tự kẹp khi Áp dụng LWH</label>
          <div class="cqt-divider"></div>
          <span class="cqt-h">Cả class</span>
          <label class="cqt-check"><input type="checkbox" id="cqt-limit-class-all-job" checked /> Quét toàn job (bỏ chọn = dải Start–End)</label>
          <label class="cqt-check"><input type="checkbox" id="cqt-limit-class-keyframes" checked /> Chỉ keyframe</label>
          <div class="cqt-row">
            <button id="cqt-btn-limit-check-class" class="cqt-btn cqt-btn-secondary">🔎 Check class</button>
            <button id="cqt-btn-limit-clamp-class" class="cqt-btn cqt-btn-ground">📏 Clamp class</button>
          </div>
          <pre id="cqt-limit-result" class="cqt-log">Chưa kiểm tra class.</pre>
        </div>
      </div>

      <div id="cqt-status" class="cqt-status">Đang khởi tạo...</div>
    </div>
  `;

  let panelApi = null;

  function togglePanel() {
    panelApi?.toggle();
  }

  function createUI() {
    if ($('cvat-quicktool-wrapper')) return;
    if (!$('cqt-style')) {
      const style = document.createElement('style');
      style.id = 'cqt-style';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }
    const wrapper = document.createElement('div');
    wrapper.id = 'cvat-quicktool-wrapper';
    wrapper.innerHTML = PANEL_HTML;
    document.body.appendChild(wrapper);

    bindPanel(wrapper);
    bindActions(wrapper);
    restorePanelTop(wrapper);
    writeQAOptionsToUI();
    const s = getSettings();
    $('cqt-set-blender').checked = s.blenderKeys;
    $('cqt-set-bounce').checked = s.bounceRefresh;

    const job = getJob();
    const frame = getFrame();
    if (job) {
      if (Number.isInteger(frame)) {
        setField('cqt-frame-start', frame);
        setField('cqt-frame-end', frame);
      }
      setStatus(`✅ Đã kết nối CVAT Job #${job.id ?? ''} (frame ${frame ?? '?'})`, 'success');
    } else {
      setStatus('⚠️ Đang kết nối CVAT... Hãy click vào màn hình!', '');
    }
    refreshPresetList();
    refreshSnapshotList();
    refreshLimitClassList();
    renderSelection();
    syncFrameLabel();
  }

  function bindPanel(wrapper) {
    let hideTimer = null;
    const pinBtn = wrapper.querySelector('#cqt-btn-pin');
    const setPinned = (on) => {
      wrapper.classList.toggle('pinned', on);
      pinBtn.classList.toggle('active', on);
      if (!on) wrapper.classList.remove('hover-open');
    };
    panelApi = {
      toggle() {
        const open = wrapper.classList.contains('pinned') || wrapper.classList.contains('hover-open');
        setPinned(!open);
      },
    };

    wrapper.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer);
      wrapper.classList.add('hover-open');
    });
    wrapper.addEventListener('mouseleave', () => {
      if (wrapper.classList.contains('pinned')) return;
      hideTimer = setTimeout(() => wrapper.classList.remove('hover-open'), 350);
    });
    pinBtn.addEventListener('click', () => setPinned(!wrapper.classList.contains('pinned')));
    wrapper.querySelector('#cqt-btn-close').addEventListener('click', () => setPinned(false));
    wrapper.querySelector('#cvat-quicktool-handle').addEventListener('click', () => setPinned(!wrapper.classList.contains('pinned')));

    wrapper.querySelectorAll('.cqt-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        wrapper.querySelectorAll('.cqt-tab').forEach((t) => t.classList.toggle('active', t === tab));
        wrapper.querySelectorAll('.cqt-pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === tab.dataset.tab));
        wrapper.querySelector('#cvat-quicktool-body').scrollTop = 0;
      });
    });

    // Kéo panel theo chiều dọc
    const header = wrapper.querySelector('#cvat-quicktool-header');
    let drag = null;
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      drag = { y: e.clientY, top: parseInt(getComputedStyle(wrapper).top, 10) || 100 };
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      wrapper.style.top = `${clamp(drag.top + e.clientY - drag.y, 0, window.innerHeight - 80)}px`;
    });
    window.addEventListener('mouseup', () => {
      if (!drag) return;
      drag = null;
      lsSet(LS.top, parseInt(wrapper.style.top, 10) || 100);
    });
  }

  function restorePanelTop(wrapper) {
    const top = lsGet(LS.top, null);
    if (Number.isFinite(top)) wrapper.style.top = `${clamp(top, 0, window.innerHeight - 80)}px`;
  }

  // Mọi handler async đều bọc lỗi để không bao giờ "bấm mà không có gì xảy ra"
  function guarded(fn) {
    return async (...args) => {
      try {
        await fn(...args);
      } catch (e) {
        console.error(LOG, e);
        setStatus('❌ Lỗi: ' + (e?.message || e), 'error');
      }
    };
  }

  function bindActions(wrapper) {
    const on = (id, fn, event = 'click') => {
      const el = wrapper.querySelector('#' + id);
      if (!el) return console.warn(LOG, 'Thiếu phần tử #' + id);
      el.addEventListener(event, guarded(fn));
    };

    wrapper.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', guarded(() => cameraView(b.dataset.cam))));
    wrapper.querySelectorAll('[data-rotate]').forEach((b) => b.addEventListener('click', guarded(() => rotateTrack(Number(b.dataset.rotate)))));

    // Object
    on('cqt-btn-detect', detectActive);
    on('cqt-btn-smart-snap', () => smartSnap());
    on('cqt-btn-multi-clear', () => { selection.clear(); renderSelection(); });
    on('cqt-btn-multi-select-all', selectAllInFrame);
    on('cqt-btn-multi-snap', () => (selection.size ? smartSnap([...selection]) : fail('Chưa chọn box nào (Shift + Click).')));
    on('cqt-btn-multi-ground', () => (selection.size ? quickGroundSnap([...selection]) : fail('Chưa chọn box nào (Shift + Click).')));
    on('cqt-btn-multi-outside', outsideSelected);
    on('cqt-btn-multi-shift', shiftSelected);
    on('cqt-frame-count', applyFrameCount, 'change');
    on('cqt-frame-start', () => { if (intVal('cqt-frame-count') >= 1) applyFrameCount(); }, 'change');
    on('cqt-btn-detect-span', detectSpanAndFill);
    on('cqt-btn-get-lwh', () => fetchLWH());
    on('cqt-btn-apply-lwh', () => applyLWH('range'));
    on('cqt-btn-sync-track', () => applyLWH('track'));
    on('cqt-btn-apply-frame', () => applyLWH('frame'));
    on('cqt-btn-preset-save', savePreset);
    on('cqt-btn-preset-apply', applyPreset);
    on('cqt-btn-preset-delete', deletePreset);
    on('cqt-btn-copy-transform', copyTransform);
    on('cqt-btn-paste-transform', pasteTransform);
    on('cqt-btn-set-keyframe', setKeyframe);

    // Ground
    on('cqt-btn-calc-plane', calcGroundPlane);
    on('cqt-btn-ground-others', groundFromOthers);
    on('cqt-btn-ground-from-box', groundFromThisBox);
    on('cqt-ground-z', onGroundZInput, 'change');
    on('cqt-btn-check-ground', checkGround);
    on('cqt-btn-apply-ground', applyGroundFit);

    // Track
    on('cqt-btn-shift', shiftTrack);
    on('cqt-btn-quick-fix-heading', alignYawCurrentFrame);
    on('cqt-btn-quick-fix-cloud', alignYawToCloud);
    on('cqt-btn-sync-yaw', syncYawToTrack);
    on('cqt-btn-fix-yaw-jumps', () => previewFixForTarget('yaw'));
    on('cqt-btn-rotate-angle', () => rotateTrack());
    on('cqt-btn-align-yaw', alignYawRange);
    on('cqt-btn-cut-far', () => previewFixForTarget('far'));
    on('cqt-btn-smooth', smoothTrack);

    // QA
    wrapper.querySelectorAll('[id^="cqt-qa-"]').forEach((el) => {
      if (el.tagName === 'INPUT') el.addEventListener('change', () => readQAOptionsFromUI());
    });
    on('cqt-btn-qa-scan', scanQA);
    on('cqt-btn-qa-autofix', previewAutoFix);
    on('cqt-btn-qa-export', exportQA);
    on('cqt-qa-filter', renderQAResult, 'change');
    on('cqt-btn-snap-restore', () => {
      const idx = parseInt(val('cqt-snap-select'), 10);
      return Number.isInteger(idx) ? restoreSnapshot(idx) : fail('Chưa có snapshot.');
    });

    // Cài đặt
    const saveSettings = () => lsSet(LS.settings, {
      blenderKeys: isChecked('cqt-set-blender'),
      bounceRefresh: isChecked('cqt-set-bounce'),
    });
    on('cqt-set-blender', saveSettings, 'change');
    on('cqt-set-bounce', saveSettings, 'change');
    on('cqt-limit-class', () => { setField('cqt-limit-class-name', ''); loadLimitForm(val('cqt-limit-class')); }, 'change');
    on('cqt-btn-limit-save', saveLimitForm);
    on('cqt-btn-limit-delete', deleteLimitClass);
    on('cqt-btn-limit-reset', resetLimits);
    on('cqt-btn-limit-from-object', fillClassNameFromObject);
    on('cqt-btn-limit-check-class', checkClassLimits);
    on('cqt-btn-limit-clamp-class', clampClassLimits);
  }

  function syncFrameLabel() {
    const el = $('cqt-current-frame');
    if (!el) return;
    const f = getFrame();
    el.textContent = Number.isInteger(f) ? String(f) : '?';
  }

  // =========================================================================
  // Khởi động
  // =========================================================================
  console.log(LOG, `Khởi động v${VERSION}`);
  installGlobalHandlers();
  setInterval(() => {
    if (/\/jobs\/\d+/.test(window.location.pathname) && document.querySelector('#root')) createUI();
    syncFrameLabel();
  }, 1000);
})();
