// ==UserScript==
// @name         CVAT Cuboid Toolbox (3D)
// @namespace    https://github.com/vantixapps/cvat-tools
// @version      2.5.0
// @description  Toolbox 3D cuboid cho CVAT: LWH/preset, fit mặt đất theo point cloud, track tools, QA, snapshot.
// @author       Antigravity
// @match        https://cvat-test.vantixapps.net/*
// @match        http://localhost:8080/*
// @match        http://127.0.0.1:8080/*
// @grant        none
// @inject-into  page
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  console.log('[CVAT-Toolbox] Khởi động v2.5.0');

  // =========================================================================
  // CSS
  // =========================================================================
  const STYLES = `
    #cvat-quicktool-wrapper {
      position: fixed;
      top: 100px;
      right: 0;
      z-index: 999999;
      display: flex;
      align-items: flex-start;
      transform: translateX(340px);
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 12px;
      user-select: none;
    }
    #cvat-quicktool-wrapper.expanded,
    #cvat-quicktool-wrapper.hover-open,
    #cvat-quicktool-wrapper.pinned {
      transform: translateX(0) !important;
    }
    #cvat-quicktool-handle {
      width: 28px;
      background: #1890ff;
      color: #fff;
      padding: 12px 4px;
      border-top-left-radius: 8px;
      border-bottom-left-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 11px;
      box-shadow: -3px 2px 10px rgba(0, 0, 0, 0.45);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transition: background 0.2s;
    }
    #cvat-quicktool-handle:hover { background: #40a9ff; }
    #cvat-quicktool-wrapper.pinned #cvat-quicktool-handle { background: #52c41a; }

    #cvat-quicktool-panel {
      width: 340px;
      background: #1f1f1f;
      color: #e6e6e6;
      border: 1px solid #383838;
      border-right: none;
      border-top-left-radius: 8px;
      border-bottom-left-radius: 8px;
      box-shadow: -8px 8px 24px rgba(0, 0, 0, 0.7);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 88vh;
    }

    #cvat-quicktool-header {
      padding: 9px 12px;
      background: #2a2a2a;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #383838;
      cursor: move;
    }
    #cvat-quicktool-header .title {
      font-weight: 600;
      color: #1890ff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #cvat-quicktool-header .hotkey-badge {
      background: #141414;
      border: 1px solid #434343;
      padding: 1px 5px;
      border-radius: 3px;
      color: #8c8c8c;
      font-size: 10px;
      font-family: monospace;
    }
    #cvat-quicktool-header .actions button {
      background: none;
      border: none;
      color: #8c8c8c;
      cursor: pointer;
      font-size: 13px;
      padding: 2px 4px;
      border-radius: 3px;
    }
    #cvat-quicktool-header .actions button:hover { color: #fff; background: #383838; }
    #cvat-quicktool-header .actions button.active { color: #52c41a; background: #162312; }

    .cqt-tabs {
      display: flex;
      background: #242424;
      border-bottom: 1px solid #383838;
    }
    .cqt-tab {
      flex: 1;
      padding: 7px 0;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: #8c8c8c;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .cqt-tab:hover { color: #ddd; }
    .cqt-tab.active { color: #1890ff; border-bottom-color: #1890ff; }

    #cvat-quicktool-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      min-height: 0;
      flex: 1 1 auto;
    }
    .cqt-pane { display: none; flex-direction: column; gap: 9px; }
    .cqt-pane.active { display: flex; }

    .cqt-row { display: flex; align-items: center; gap: 8px; }
    .cqt-col { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
    .cqt-label { color: #aaa; font-size: 11px; }
    .cqt-input {
      background: #141414;
      border: 1px solid #434343;
      border-radius: 4px;
      color: #fff;
      padding: 6px 8px;
      font-size: 12px;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .cqt-input:focus { border-color: #1890ff; }
    select.cqt-input {
      appearance: none;
      -webkit-appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, #8c8c8c 50%),
                        linear-gradient(135deg, #8c8c8c 50%, transparent 50%);
      background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
      background-size: 5px 5px, 5px 5px;
      background-repeat: no-repeat;
      padding-right: 22px;
      cursor: pointer;
    }
    .cqt-btn {
      background: #1890ff;
      border: none;
      color: #fff;
      padding: 7px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      font-size: 11px;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      flex: 1;
    }
    .cqt-btn:hover { background: #40a9ff; }
    .cqt-btn:active { background: #096dd9; }
    .cqt-btn-secondary { background: #333; color: #ddd; }
    .cqt-btn-secondary:hover { background: #444; color: #fff; }
    .cqt-btn-danger { background: #cf1322; }
    .cqt-btn-danger:hover { background: #f5222d; }
    .cqt-btn-ground { background: #237804; }
    .cqt-btn-ground:hover { background: #389e0d; }
    .cqt-divider { height: 1px; background: #333; margin: 2px 0; }
    .cqt-check {
      color: #aaa;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .cqt-check input { margin: 0; cursor: pointer; }
    .cqt-status {
      font-size: 11px;
      padding: 7px 9px;
      margin: 0 12px 12px;
      border-radius: 4px;
      background: #141414;
      color: #aaa;
      min-height: 18px;
      word-break: break-word;
      line-height: 1.45;
      flex: none;
    }
    .cqt-status.success { color: #52c41a; background: #162312; border: 1px solid #274916; }
    .cqt-status.error { color: #ff4d4f; background: #2a1215; border: 1px solid #58181c; }
    .cqt-status.warn { color: #faad14; background: #2b2111; border: 1px solid #594214; }
    .cqt-log {
      background: #141414;
      border: 1px solid #333;
      border-radius: 4px;
      color: #aaa;
      font-size: 10px;
      line-height: 1.45;
      padding: 7px;
      margin: 0;
      max-height: 140px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.innerHTML = STYLES;
  document.head.appendChild(styleEl);

  // =========================================================================
  // Local storage keys
  // =========================================================================
  const LS_PRESETS = 'cqt_presets_v2';
  const LS_SNAPSHOTS = 'cqt_snapshots_v2';
  const LS_CLIPBOARD = 'cqt_clipboard_v2';
  const LS_TOP = 'cqt_panel_top_v2';
  const LS_LIMITS = 'cqt_limits_v2';
  const LS_AUTOCLAMP = 'cqt_autoclamp_v2';

  let autoClampEnabled = true;

  const DEFAULT_LIMITS = {
    vehicle: { l: [3.2, 5.5], w: [1.6, 2.2], h: [1.5, 1.9] },
    two_wheel: { l: [1.5, 2.0], w: [0.6, 0.9], h: [1.5, 1.8] },
    pedestrian: { l: [0.65, 1.0], w: [0.65, 1.0], h: [1.2, 1.9] },
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
      console.warn('[CVAT-Toolbox] localStorage lỗi:', e);
    }
  }

  // =========================================================================
  // Toán học hộp xoay (CVAT: points = [x,y,z,rx,ry,rz,L,W,H], góc radian)
  // =========================================================================
  function rotationRowZ(rx, ry, rz) {
    const ca = Math.cos(rx), sa = Math.sin(rx);
    const cb = Math.cos(ry), sb = Math.sin(ry);
    const cc = Math.cos(rz), sc = Math.sin(rz);
    return [
      sa * sc - ca * cc * sb,
      sa * cc + ca * sc * sb,
      ca * cb,
    ];
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

  function lowestOffset(points) {
    const hx = Math.abs(points[6]) / 2;
    const hy = Math.abs(points[7]) / 2;
    const hz = Math.abs(points[8]) / 2;
    const r = rotationRowZ(points[3], points[4], points[5]);
    return Math.abs(r[0]) * hx + Math.abs(r[1]) * hy + Math.abs(r[2]) * hz;
  }

  function bottomZ(points) {
    return points[2] - lowestOffset(points);
  }

  function fitPointsToGround(points, groundZ, mode) {
    const p = points.slice();
    if (mode === 'flat') {
      p[3] = 0;
      p[4] = 0;
    }
    p[2] = groundZ + lowestOffset(p);
    return p;
  }

  function tiltDegrees(points) {
    return Math.max(Math.abs(points[3]), Math.abs(points[4])) * 180 / Math.PI;
  }

  function fmtMeters(n) {
    return (n >= 0 ? '+' : '') + n.toFixed(3) + 'm';
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function percentile(values, p) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
    return sorted[idx];
  }

  // =========================================================================
  // Point cloud (scene của CVAT 3D)
  // =========================================================================
  function getPointCloudPositions() {
    try {
      const canvas = getReduxStore()?.getState()?.annotation?.canvas?.instance;
      if (!canvas) return null;

      const scenes = [
        canvas.view?.views?.perspective?.scene,
        canvas.view?.views?.side?.scene,
        canvas.view?.views?.front?.scene,
        canvas.view?.views?.top?.scene,
      ].filter(Boolean);

      for (const scene of scenes) {
        const cloud = scene.children?.find(
          (obj) => obj && obj.isPoints && obj.geometry?.attributes?.position?.array?.length
        );
        if (cloud) return cloud.geometry.attributes.position.array;
      }
    } catch (e) {
      console.warn('[CVAT-Toolbox] Không đọc được point cloud:', e);
    }
    return null;
  }

  // Ước lượng cao độ mặt đường quanh hộp
  function estimateGroundZ(points, positions) {
    const cx = points[0];
    const cy = points[1];
    const l = Math.abs(points[6]);
    const w = Math.abs(points[7]);
    const rz = points[5];
    const halfDiag = 0.5 * Math.hypot(l, w);
    const rOut = halfDiag + 3.0;

    const cos = Math.cos(-rz);
    const sin = Math.sin(-rz);
    const insideX = l / 2 + 0.4;
    const insideY = w / 2 + 0.4;

    const ring = [];
    const fallback = [];

    for (let i = 0; i + 2 < positions.length; i += 3) {
      const dx = positions[i] - cx;
      const dy = positions[i + 1] - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > rOut * rOut) continue;

      const z = positions[i + 2];
      if (!Number.isFinite(z)) continue;

      fallback.push(z);

      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const insideFootprint = Math.abs(lx) <= insideX && Math.abs(ly) <= insideY;
      if (!insideFootprint) ring.push(z);
    }

    const source = ring.length >= 30 ? ring : fallback;
    if (source.length < 10) return null;

    source.sort((a, b) => a - b);
    const low = source[Math.floor(source.length * 0.1)];
    const cluster = source.filter((z) => Math.abs(z - low) <= 0.3);
    const z = median(cluster);

    return { z, count: source.length, radius: rOut };
  }

  // =========================================================================
  // CVAT context
  // =========================================================================
  let cachedContext = null;
  let cachedReduxStore = null;

  function isUsableJob(job) {
    return !!job && typeof job?.annotations?.get === 'function';
  }

  function isValidStore(store) {
    try {
      const st = store?.getState?.();
      return !!(st?.annotation && st.annotation.player && st.annotation.player.frame);
    } catch (e) {
      return false;
    }
  }

  function peekStoreJob() {
    try {
      const store = isValidStore(window.store) ? window.store : cachedReduxStore;
      return store?.getState?.()?.annotation?.job?.instance || null;
    } catch (e) {
      return null;
    }
  }

  function getCvatContext() {
    if (cachedContext?.jobInstance && isUsableJob(cachedContext.jobInstance)) {
      const storeJob = peekStoreJob();
      // Cache còn đúng job hiện tại (hoặc không xác định được) => dùng tiếp
      if (!isUsableJob(storeJob) || storeJob === cachedContext.jobInstance) {
        return cachedContext;
      }
      // Người dùng đã chuyển job trong SPA => bỏ cache
      cachedContext = null;
      cachedReduxStore = null;
    }
    try {
      // Store Redux là nguồn đáng tin nhất cho job hiện tại
      let store = isValidStore(window.store) ? window.store : null;
      let jobInstance = null;

      if (store) {
        const storeJob = store.getState()?.annotation?.job?.instance;
        if (isUsableJob(storeJob)) jobInstance = storeJob;
      }

      const candidateSelectors = [
        '.cvat-player-frame-selector',
        '.cvat-objects-sidebar',
        '.cvat-player-next-button',
        '.cvat-app',
        '#root',
      ];

      for (const sel of candidateSelectors) {
        const el = document.querySelector(sel);
        if (!el) continue;

        const keys = Object.keys(el);
        for (const k of keys) {
          if (
            k.startsWith('__reactFiber') ||
            k.startsWith('__reactInternalInstance$') ||
            k.startsWith('__reactContainer')
          ) {
            let curr = el[k];
            if (curr?.current) curr = curr.current;

            let depth = 0;
            while (curr && depth < 60 && (!store || !jobInstance)) {
              depth++;
              if (!store && curr.memoizedProps?.store?.getState) store = curr.memoizedProps.store;
              if (!jobInstance && isUsableJob(curr.memoizedProps?.jobInstance)) jobInstance = curr.memoizedProps.jobInstance;
              if (!jobInstance && isUsableJob(curr.memoizedProps?.job)) jobInstance = curr.memoizedProps.job;
              curr = curr.return;
            }
          }
          if (store && jobInstance) break;
        }
        if (store && jobInstance) break;
      }

      if (isValidStore(store)) {
        const fromStore = store.getState()?.annotation?.job?.instance;
        if (isUsableJob(fromStore)) jobInstance = fromStore;
      }
      if (!jobInstance) {
        const globalJob = window.cvat?.job || window.jobInstance || null;
        if (isUsableJob(globalJob)) jobInstance = globalJob;
      }
      if (!store && window.store?.getState) store = window.store;

      if (isUsableJob(jobInstance) && isValidStore(store)) {
        cachedContext = { store, jobInstance };
      }
      return { store, jobInstance };
    } catch (e) {
      console.warn('[CVAT-Toolbox] Lỗi quét context:', e);
      return { store: null, jobInstance: null };
    }
  }

  function findState(states, targetId) {
    const id = String(targetId);
    return states.find((s) => (
      String(s.clientID) === id ||
      String(s.serverID) === id ||
      String(s.id) === id
    ));
  }

  function resetContextCache() {
    cachedContext = null;
    cachedReduxStore = null;
  }

  async function getCurrentState(targetId, frame) {
    const { jobInstance } = getCvatContext();
    if (!isUsableJob(jobInstance)) return null;
    const states = await jobInstance.annotations.get(frame, true);
    return findState(states, targetId) || null;
  }

  function getFrameNumber() {
    const st = getReduxStore()?.getState?.();
    const n = st?.annotation?.player?.frame?.number;
    if (Number.isFinite(n)) return n;

    // Fallback: đọc ô frame trên thanh player (khi store chưa sẵn sàng)
    const input =
      document.querySelector('.cvat-player-frame-selector input') ||
      document.querySelector('input.cvat-player-frame-selector');
    const v = parseInt(input?.value, 10);
    return Number.isFinite(v) ? v : undefined;
  }

  // =========================================================================
  // Status + log
  // =========================================================================
  function setStatus(msg, type = '') {
    const el = document.querySelector('#cqt-status');
    if (el) {
      el.textContent = msg;
      el.className = 'cqt-status ' + type;
    }
    const log = document.querySelector('#cqt-log');
    if (log && type) {
      const time = new Date().toLocaleTimeString();
      log.textContent = `[${time}] ${msg}\n` + log.textContent;
      const lines = log.textContent.split('\n');
      if (lines.length > 60) log.textContent = lines.slice(0, 60).join('\n');
    }
  }

  // =========================================================================
  // Làm mới canvas mà vẫn giữ nguyên frame (đã fix selector + chờ load)
  // =========================================================================
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getReduxStore() {
    if (cachedReduxStore && isValidStore(cachedReduxStore)) return cachedReduxStore;
    cachedReduxStore = null;

    if (isValidStore(window.store)) {
      cachedReduxStore = window.store;
      return cachedReduxStore;
    }

    const { store } = getCvatContext();
    if (isValidStore(store)) {
      cachedReduxStore = store;
      return cachedReduxStore;
    }
    return null;
  }

  function getPlayerState() {
    return getReduxStore()?.getState()?.annotation?.player?.frame || null;
  }

  function getPlayerFrame() {
    return getPlayerState()?.number;
  }

  async function waitForFrame(target, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const frame = getPlayerState();
      if (frame && frame.number === target && !frame.fetching) return true;
      await sleep(60);
    }
    return getPlayerFrame() === target;
  }

  async function waitForFrameChange(from, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const frame = getPlayerState();
      if (frame && !frame.fetching && frame.number !== from) return frame.number;
      await sleep(60);
    }
    return null;
  }

  async function setFrameViaInput(target) {
    const input =
      document.querySelector('.cvat-player-frame-selector input') ||
      document.querySelector('input.cvat-player-frame-selector');
    if (!input) return false;

    try {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      input.focus();
      setter.call(input, String(target));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(100);
      input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
      }));
      input.blur();
      return await waitForFrame(target, 5000);
    } catch (e) {
      return false;
    }
  }

  async function refreshCanvas() {
    try {
      window.dispatchEvent(new Event('resize'));
    } catch (e) { }

    const original = getPlayerFrame();
    if (!Number.isInteger(original)) return true;

    const nextBtn = document.querySelector('.cvat-player-next-button');
    const prevBtn =
      document.querySelector('.cvat-player-previous-button') ||
      document.querySelector('.cvat-player-prev-button');
    if (!nextBtn || !prevBtn) return true;

    const job = getReduxStore()?.getState()?.annotation?.job?.instance;
    const atFirst = Number.isInteger(job?.startFrame) && original <= job.startFrame;
    const atLast = Number.isInteger(job?.stopFrame) && original >= job.stopFrame;
    if (atFirst && atLast) return true;

    const dir = atLast ? -1 : 1;
    const goBtn = dir === 1 ? nextBtn : prevBtn;
    const backBtn = dir === 1 ? prevBtn : nextBtn;

    const goDisabled =
      goBtn.classList.contains('cvat-player-next-button-empty') ||
      goBtn.getAttribute('aria-disabled') === 'true' ||
      !!goBtn.closest('button')?.disabled;
    if (goDisabled) return true;

    goBtn.click();
    if ((await waitForFrameChange(original, 6000)) === null) {
      return getPlayerFrame() === original;
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      backBtn.click();
      if (await waitForFrame(original, 6000)) return true;
    }

    return await setFrameViaInput(original);
  }

  // =========================================================================
  // Snapshot (undo riêng cho batch)
  // =========================================================================
  function snapshotItem(state, frame) {
    return {
      clientID: state.clientID,
      frame,
      points: [...state.points],
      keyframe: !!state.keyframe,
      outside: !!state.outside,
      occluded: !!state.occluded,
    };
  }

  function pushSnapshot(label, items) {
    if (!items.length) return;
    const all = lsGet(LS_SNAPSHOTS, []);
    all.unshift({
      ts: Date.now(),
      label,
      count: items.length,
      items: items.slice(0, 2000),
    });
    lsSet(LS_SNAPSHOTS, all.slice(0, 6));
    refreshSnapshotList();
  }

  async function restoreSnapshot(index) {
    const all = lsGet(LS_SNAPSHOTS, []);
    const snap = all[index];
    if (!snap) return setStatus('⚠️ Không có snapshot để khôi phục.', 'error');

    const { jobInstance } = getCvatContext();
    if (!jobInstance) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    if (!confirm(`Khôi phục snapshot "${snap.label}" (${snap.items.length} mục)?`)) return;

    setStatus(`⏳ Đang khôi phục snapshot "${snap.label}"...`);
    let restored = 0;
    for (const item of snap.items) {
      try {
        const states = await jobInstance.annotations.get(item.frame, true);
        const s = findState(states, item.clientID);
        if (!s) continue;
        s.points = item.points;
        s.keyframe = item.keyframe;
        s.outside = item.outside;
        s.occluded = item.occluded;
        saveState(s, jobInstance);
        restored++;
      } catch (e) {
        console.warn('[CVAT-Toolbox] Restore lỗi tại frame', item.frame, e);
      }
    }

    await refreshCanvas();
    setStatus(`✅ Đã khôi phục ${restored}/${snap.items.length} mục từ snapshot "${snap.label}".`, 'success');
  }

  function refreshSnapshotList() {
    const select = document.querySelector('#cqt-snap-select');
    if (!select) return;
    const all = lsGet(LS_SNAPSHOTS, []);
    select.innerHTML = '';
    if (!all.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(chưa có snapshot)';
      select.appendChild(opt);
      return;
    }
    all.forEach((snap, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${new Date(snap.ts).toLocaleTimeString()} · ${snap.label} · ${snap.items.length}`;
      select.appendChild(opt);
    });
  }

  // =========================================================================
  // Batch update chung
  // =========================================================================
  function saveState(state, jobInstance) {
    if (typeof state.save === 'function') state.save();
    else if (state.__internal && typeof state.__internal.save === 'function') {
      state.__internal.save(state);
    }
    if (jobInstance?.annotations?.put) {
      try {
        jobInstance.annotations.put([state]);
      } catch (e) { }
    }
  }

  async function batchUpdate(opts) {
    const { jobInstance } = getCvatContext();
    if (!jobInstance) {
      setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');
      return { changed: 0, skipped: 0 };
    }

    const snapItems = [];
    let changed = 0;
    let skipped = 0;

    for (let f = opts.startFrame; f <= opts.endFrame; f++) {
      if (opts.progress && f > opts.startFrame && (f - opts.startFrame) % 25 === 0) {
        setStatus(`⏳ ${opts.label}: frame ${f}/${opts.endFrame}...`);
      }
      const states = await jobInstance.annotations.get(f, true);
      const s = findState(states, opts.targetId);
      if (!s || !s.points || s.points.length < 9) continue;
      if (s.outside && !opts.includeOutside) {
        skipped++;
        continue;
      }
      if (opts.keyframesOnly && !s.keyframe) {
        skipped++;
        continue;
      }

      const item = snapshotItem(s, f);
      const result = opts.apply(s, f);
      if (result === false) continue;

      snapItems.push(item);
      saveState(s, jobInstance);
      changed++;
    }

    pushSnapshot(opts.label, snapItems);
    return { changed, skipped };
  }

  // =========================================================================
  // UI
  // =========================================================================
  function val(id) {
    return document.querySelector(`#${id}`)?.value;
  }

  function numVal(id) {
    const n = parseFloat(val(id));
    return Number.isFinite(n) ? n : NaN;
  }

  function intVal(id) {
    const n = parseInt(val(id), 10);
    return Number.isFinite(n) ? n : NaN;
  }

  function syncFrameLabel() {
    const el = document.querySelector('#cqt-current-frame');
    if (!el) return;
    const f = getFrameNumber();
    el.textContent = Number.isFinite(f) ? String(f) : '?';
  }

  function activeId() {
    return getReduxStore()?.getState()?.annotation?.annotations?.activatedStateID;
  }

  function resolveTargetId() {
    let id = intVal('cqt-target-id');
    if (!Number.isInteger(id)) {
      const a = activeId();
      if (a !== null && a !== undefined) id = a;
    }
    return Number.isInteger(id) ? id : NaN;
  }

  function readRange() {
    const targetId = resolveTargetId();
    const startFrame = intVal('cqt-frame-start');
    const endFrame = intVal('cqt-frame-end');
    if (!Number.isInteger(targetId)) {
      setStatus('⚠️ Nhập Target Object ID hoặc chọn 1 object!', 'error');
      return null;
    }
    if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame) || startFrame > endFrame) {
      setStatus('⚠️ Dải frame không hợp lệ (Start <= End)!', 'error');
      return null;
    }
    return { targetId, startFrame, endFrame };
  }

  function createUI() {
    if (document.querySelector('#cvat-quicktool-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'cvat-quicktool-wrapper';
    wrapper.innerHTML = `
      <div id="cvat-quicktool-handle" title="Di chuột để mở, bấm để ghim (Alt+Q)">
        <span>◀ TOOLBOX</span>
      </div>

      <div id="cvat-quicktool-panel">
        <div id="cvat-quicktool-header" title="Kéo để di chuyển panel">
          <div class="title">
            <span>📦</span> CVAT Toolbox
            <span class="hotkey-badge">Alt+Q</span>
          </div>
          <div class="actions">
            <button id="cqt-btn-pin" title="Ghim">📌</button>
            <button id="cqt-btn-close" title="Thu gọn">✕</button>
          </div>
        </div>

        <div class="cqt-tabs">
          <button class="cqt-tab active" data-tab="object">Object</button>
          <button class="cqt-tab" data-tab="ground">Ground</button>
          <button class="cqt-tab" data-tab="track">Track</button>
          <button class="cqt-tab" data-tab="qa">QA</button>
          <button class="cqt-tab" data-tab="limits">Limits</button>
        </div>

        <div id="cvat-quicktool-body">
          <!-- ================= OBJECT ================= -->
          <div class="cqt-pane active" data-pane="object">
            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">Target Object ID</span>
                <input type="number" id="cqt-target-id" class="cqt-input" placeholder="Ví dụ: 13" />
              </div>
              <button id="cqt-btn-detect" class="cqt-btn cqt-btn-secondary" style="margin-top:17px;flex:none;" title="Lấy object đang chọn">
                🎯 Auto
              </button>
            </div>

            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">Start Frame</span>
                <input type="number" id="cqt-frame-start" class="cqt-input" value="0" />
              </div>
              <div class="cqt-col">
                <span class="cqt-label">End Frame</span>
                <input type="number" id="cqt-frame-end" class="cqt-input" value="0" />
              </div>
            </div>

            <div class="cqt-row" style="justify-content:space-between;">
              <span class="cqt-label">Frame hiện tại: <b id="cqt-current-frame" style="color:#1890ff;">?</b></span>
            </div>

            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">Tổng số frame của object</span>
                <input type="number" min="1" id="cqt-frame-count" class="cqt-input" placeholder="VD: 120" />
              </div>
              <button id="cqt-btn-apply-count" class="cqt-btn cqt-btn-secondary" style="margin-top:17px;">Dùng</button>
            </div>
            <button id="cqt-btn-detect-span" class="cqt-btn cqt-btn-secondary" title="Dò frame đầu/cuối mà object tồn tại">
              🔍 Tự lấy dải frame của object
            </button>

            <div class="cqt-divider"></div>

            <div class="cqt-row" style="justify-content:space-between;align-items:baseline;">
              <span class="cqt-label" style="font-weight:600;color:#fff;">1. Kích thước LWH (m)</span>
              <div style="display:flex;gap:6px;">
                <button id="cqt-btn-clamp-inputs" class="cqt-btn cqt-btn-secondary" style="flex:none;padding:2px 6px;font-size:10px;" title="Kẹp LWH đang nhập theo limits của class">
                  📏 Kẹp
                </button>
                <button id="cqt-btn-get-lwh" class="cqt-btn cqt-btn-secondary" style="flex:none;padding:2px 6px;font-size:10px;">
                  Lấy size
                </button>
              </div>
            </div>
            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">L</span>
                <input type="number" step="0.01" id="cqt-lwh-l" class="cqt-input" placeholder="L" />
              </div>
              <div class="cqt-col">
                <span class="cqt-label">W</span>
                <input type="number" step="0.01" id="cqt-lwh-w" class="cqt-input" placeholder="W" />
              </div>
              <div class="cqt-col">
                <span class="cqt-label">H</span>
                <input type="number" step="0.01" id="cqt-lwh-h" class="cqt-input" placeholder="H" />
              </div>
            </div>
            <div class="cqt-row" style="gap:14px;flex-wrap:wrap;">
              <label class="cqt-check" title="Giữ cao độ mặt đáy khi đổi H (đúng cả khi box nghiêng)">
                <input type="checkbox" id="cqt-keep-ground" checked /> Giữ đáy
              </label>
              <label class="cqt-check" title="Chỉ sửa frame đang là keyframe">
                <input type="checkbox" id="cqt-lwh-keyframe-only" /> Chỉ keyframe
              </label>
              <label class="cqt-check" title="Tự kẹp LWH vào limits của class khi nhập hoặc áp dụng">
                <input type="checkbox" id="cqt-obj-clamp-on-apply" checked /> Tự kẹp limits
              </label>
            </div>
            <button id="cqt-btn-apply-lwh" class="cqt-btn">📐 Áp dụng LWH</button>
            <div class="cqt-row">
              <button id="cqt-btn-sync-track" class="cqt-btn cqt-btn-secondary" title="Lấy LWH đang nhập, áp cho toàn bộ keyframe của track">
                🔗 Đồng bộ toàn track
              </button>
              <button id="cqt-btn-apply-frame" class="cqt-btn cqt-btn-secondary" title="Chỉ áp dụng cho frame hiện tại, các frame khác giữ nguyên">
                ✂️ Chỉ frame này
              </button>
            </div>

            <div class="cqt-divider"></div>

            <div class="cqt-label" style="font-weight:600;color:#fff;">Preset theo label</div>
            <div class="cqt-row">
              <select id="cqt-preset-select" class="cqt-input"></select>
              <button id="cqt-btn-preset-apply" class="cqt-btn cqt-btn-secondary" style="flex:none;">Dùng</button>
            </div>
            <div class="cqt-row">
              <button id="cqt-btn-preset-save" class="cqt-btn cqt-btn-secondary">💾 Lưu preset</button>
              <button id="cqt-btn-preset-delete" class="cqt-btn cqt-btn-danger">Xoá preset</button>
            </div>

            <div class="cqt-divider"></div>

            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">Copy size từ ID</span>
                <input type="number" id="cqt-src-id" class="cqt-input" placeholder="ID mẫu" />
              </div>
              <button id="cqt-btn-match-size" class="cqt-btn cqt-btn-secondary" style="margin-top:17px;">Copy</button>
            </div>
            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">Scale LWH (×)</span>
                <input type="number" step="0.01" id="cqt-scale-factor" class="cqt-input" value="1" />
              </div>
              <button id="cqt-btn-scale" class="cqt-btn cqt-btn-secondary" style="margin-top:17px;">Scale</button>
            </div>
            <div class="cqt-row">
              <button id="cqt-btn-copy-transform" class="cqt-btn cqt-btn-secondary">📋 Copy transform</button>
              <button id="cqt-btn-paste-transform" class="cqt-btn cqt-btn-secondary">📥 Paste</button>
            </div>

            <div class="cqt-divider"></div>

            <button id="cqt-btn-toggle-keyframe" class="cqt-btn cqt-btn-secondary">⭐ Bật / Gỡ keyframe [K]</button>
            <button id="cqt-btn-clear-keyframes" class="cqt-btn cqt-btn-danger">⚡ Gỡ keyframe trong dải</button>
          </div>

          <!-- ================= GROUND ================= -->
          <div class="cqt-pane" data-pane="ground">
            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">Cao độ mặt đất (m)</span>
                <input type="number" step="0.01" id="cqt-ground-z" class="cqt-input" value="0" />
              </div>
              <div class="cqt-col">
                <span class="cqt-label">Chế độ</span>
                <select id="cqt-ground-mode" class="cqt-input">
                  <option value="snap">Snap đáy (giữ nghiêng)</option>
                  <option value="flat">Đặt phẳng đáy</option>
                </select>
              </div>
            </div>

            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">Phạm vi</span>
                <select id="cqt-ground-scope" class="cqt-input">
                  <option value="keyframes">Chỉ keyframe trong dải</option>
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
              <button id="cqt-btn-ground-cloud" class="cqt-btn cqt-btn-secondary">☁️ Z point cloud</button>
              <button id="cqt-btn-ground-others" class="cqt-btn cqt-btn-secondary">📊 Z box khác</button>
            </div>
            <div class="cqt-row">
              <button id="cqt-btn-ground-from-box" class="cqt-btn cqt-btn-secondary">📌 Z từ box này</button>
              <button id="cqt-btn-occupancy" class="cqt-btn cqt-btn-secondary">🧊 Occupancy</button>
            </div>
            <div class="cqt-row">
              <button id="cqt-btn-check-ground" class="cqt-btn cqt-btn-secondary">📏 Kiểm tra đáy</button>
              <button id="cqt-btn-apply-ground" class="cqt-btn cqt-btn-ground">⬇️ Fit mặt đất</button>
            </div>

            <div class="cqt-divider"></div>
            <button id="cqt-btn-obb" class="cqt-btn cqt-btn-secondary" title="Beta: fit box theo cụm point cloud quanh box hiện tại">
              🎯 Fit box theo cloud (beta)
            </button>
          </div>

          <!-- ================= TRACK ================= -->
          <div class="cqt-pane" data-pane="track">
            <label class="cqt-check">
              <input type="checkbox" id="cqt-track-keyframe-only" checked /> Chỉ sửa keyframe trong dải
            </label>

            <div class="cqt-divider"></div>
            <div class="cqt-label" style="font-weight:600;color:#fff;">Dịch chuyển cả dải (m)</div>
            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">dX</span>
                <input type="number" step="0.01" id="cqt-shift-x" class="cqt-input" value="0" />
              </div>
              <div class="cqt-col">
                <span class="cqt-label">dY</span>
                <input type="number" step="0.01" id="cqt-shift-y" class="cqt-input" value="0" />
              </div>
              <div class="cqt-col">
                <span class="cqt-label">dZ</span>
                <input type="number" step="0.01" id="cqt-shift-z" class="cqt-input" value="0" />
              </div>
            </div>
            <button id="cqt-btn-shift" class="cqt-btn">↔️ Dịch chuyển</button>

            <div class="cqt-divider"></div>
            <button id="cqt-btn-rotate180" class="cqt-btn cqt-btn-secondary">🔄 Xoay 180° (yaw)</button>

            <div class="cqt-divider"></div>
            <div class="cqt-label" style="font-weight:600;color:#fff;">Làm mượt vị trí keyframe</div>
            <button id="cqt-btn-smooth" class="cqt-btn cqt-btn-secondary">〰️ Smooth vị trí</button>

            <div class="cqt-divider"></div>
            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">Ngưỡng decimate (m)</span>
                <input type="number" step="0.01" id="cqt-decimate-threshold" class="cqt-input" value="0.05" />
              </div>
              <button id="cqt-btn-decimate" class="cqt-btn cqt-btn-secondary" style="margin-top:17px;">✂️ Decimate</button>
            </div>
            <div class="cqt-row">
              <div class="cqt-col">
                <span class="cqt-label">Resample mỗi N frame</span>
                <input type="number" id="cqt-resample-step" class="cqt-input" value="5" />
              </div>
              <button id="cqt-btn-resample" class="cqt-btn cqt-btn-secondary" style="margin-top:17px;">➕ Resample</button>
            </div>
          </div>

          <!-- ================= QA ================= -->
          <div class="cqt-pane" data-pane="qa">
            <button id="cqt-btn-qa-scan" class="cqt-btn">🔎 Quét QA toàn dải</button>
            <pre id="cqt-qa-result" class="cqt-log">Chưa quét. Bấm "Quét QA".</pre>
            <button id="cqt-btn-qa-export" class="cqt-btn cqt-btn-secondary">📤 Export CSV</button>

            <div class="cqt-divider"></div>
            <div class="cqt-label" style="font-weight:600;color:#fff;">Snapshot / Restore</div>
            <div class="cqt-row">
              <select id="cqt-snap-select" class="cqt-input"></select>
              <button id="cqt-btn-snap-restore" class="cqt-btn cqt-btn-secondary" style="flex:none;">Restore</button>
            </div>
            <button id="cqt-btn-snap-clear" class="cqt-btn cqt-btn-danger">Xoá tất cả snapshot</button>

            <div class="cqt-divider"></div>
            <pre id="cqt-log" class="cqt-log">Log thao tác...</pre>
            <button id="cqt-btn-copy-log" class="cqt-btn cqt-btn-secondary">📋 Copy log</button>
          </div>

          <!-- ================= LIMITS ================= -->
          <div class="cqt-pane" data-pane="limits">
            <div class="cqt-label" style="font-weight:600;color:#fff;">Giới hạn LWH theo class</div>
            <div class="cqt-row">
              <select id="cqt-limit-class" class="cqt-input"></select>
              <button id="cqt-btn-limit-delete" class="cqt-btn cqt-btn-danger" style="flex:none;">Xoá</button>
            </div>
            <div class="cqt-row">
              <input id="cqt-limit-class-name" class="cqt-input" placeholder="Class mới (bỏ trống = class đang chọn)" />
              <button id="cqt-btn-limit-from-object" class="cqt-btn cqt-btn-secondary" style="flex:none;" title="Lấy label của object đang chọn">📌</button>
            </div>

            <div class="cqt-row">
              <span class="cqt-label" style="width:14px;">L</span>
              <input type="number" step="0.01" id="cqt-limit-l-min" class="cqt-input" placeholder="min" />
              <input type="number" step="0.01" id="cqt-limit-l-max" class="cqt-input" placeholder="max" />
            </div>
            <div class="cqt-row">
              <span class="cqt-label" style="width:14px;">W</span>
              <input type="number" step="0.01" id="cqt-limit-w-min" class="cqt-input" placeholder="min" />
              <input type="number" step="0.01" id="cqt-limit-w-max" class="cqt-input" placeholder="max" />
            </div>
            <div class="cqt-row">
              <span class="cqt-label" style="width:14px;">H</span>
              <input type="number" step="0.01" id="cqt-limit-h-min" class="cqt-input" placeholder="min" />
              <input type="number" step="0.01" id="cqt-limit-h-max" class="cqt-input" placeholder="max" />
            </div>

            <button id="cqt-btn-limit-save" class="cqt-btn">💾 Lưu limits</button>
            <button id="cqt-btn-limit-reset" class="cqt-btn cqt-btn-secondary">↺ Reset mặc định</button>

            <div class="cqt-divider"></div>
            <label class="cqt-check">
              <input type="checkbox" id="cqt-limit-clamp-on-apply" checked /> Tự clamp khi Áp dụng LWH
            </label>
            <label class="cqt-check">
              <input type="checkbox" id="cqt-limit-keyframe-only" /> Clamp chỉ keyframe
            </label>
            <button id="cqt-btn-limit-clamp" class="cqt-btn cqt-btn-ground">📏 Clamp object theo limits</button>
            <button id="cqt-btn-limit-clamp-track" class="cqt-btn cqt-btn-secondary">⚡ Clamp toàn track (tự lấy dải)</button>

            <div class="cqt-divider"></div>
            <div class="cqt-label" style="font-weight:600;color:#fff;">Cả class</div>
            <label class="cqt-check">
              <input type="checkbox" id="cqt-limit-class-all-job" checked /> Quét toàn job (bỏ chọn = dải Start–End)
            </label>
            <label class="cqt-check">
              <input type="checkbox" id="cqt-limit-class-keyframes" checked /> Clamp class chỉ keyframe
            </label>
            <button id="cqt-btn-limit-check-class" class="cqt-btn cqt-btn-secondary">🔎 Check toàn bộ class</button>
            <button id="cqt-btn-limit-clamp-class" class="cqt-btn cqt-btn-ground">📏 Clamp toàn bộ class</button>
            <pre id="cqt-limit-result" class="cqt-log">Chưa kiểm tra class.</pre>
            <button id="cqt-btn-copy-limit-result" class="cqt-btn cqt-btn-secondary">📋 Copy kết quả check</button>
          </div>
        </div>

        <div id="cqt-status" class="cqt-status">Đang khởi tạo...</div>
      </div>
    `;

    document.body.appendChild(wrapper);
    bindEvents(wrapper);
    autoClampEnabled = lsGet(LS_AUTOCLAMP, true) !== false;
    setAutoClamp(autoClampEnabled, false);
    restorePanelTop(wrapper);

    const { jobInstance } = getCvatContext();
    if (isUsableJob(jobInstance)) {
      const curFrame = getFrameNumber() ?? 0;
      document.querySelector('#cqt-frame-start').value = curFrame;
      document.querySelector('#cqt-frame-end').value = curFrame;
      setStatus(`✅ Đã kết nối CVAT Job #${jobInstance.id || ''} (frame ${curFrame})`, 'success');
    } else {
      setStatus('⚠️ Đang kết nối CVAT... Hãy click vào màn hình!', '');
    }

    refreshPresetList();
    refreshSnapshotList();
    refreshLimitClassList();
    syncFrameLabel();
  }

  function bindEvents(wrapper) {
    let hideTimer = null;
    let isPinned = false;

    wrapper.addEventListener('mouseenter', () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
      wrapper.classList.add('hover-open');
    });

    wrapper.addEventListener('mouseleave', () => {
      if (isPinned) return;
      hideTimer = setTimeout(() => {
        wrapper.classList.remove('hover-open');
      }, 350);
    });

    const pinBtn = wrapper.querySelector('#cqt-btn-pin');
    pinBtn.addEventListener('click', () => {
      isPinned = !isPinned;
      if (isPinned) {
        wrapper.classList.add('pinned');
        pinBtn.classList.add('active');
      } else {
        wrapper.classList.remove('pinned');
        pinBtn.classList.remove('active');
      }
    });

    wrapper.querySelector('#cqt-btn-close').addEventListener('click', () => {
      isPinned = false;
      wrapper.classList.remove('pinned', 'hover-open');
      pinBtn.classList.remove('active');
    });

    wrapper.querySelector('#cvat-quicktool-handle').addEventListener('click', () => {
      if (wrapper.classList.contains('pinned')) {
        isPinned = false;
        wrapper.classList.remove('pinned');
        pinBtn.classList.remove('active');
      } else {
        isPinned = true;
        wrapper.classList.add('pinned');
        pinBtn.classList.add('active');
      }
    });

    // Tabs
    wrapper.querySelectorAll('.cqt-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        wrapper.querySelectorAll('.cqt-tab').forEach((t) => t.classList.remove('active'));
        wrapper.querySelectorAll('.cqt-pane').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        wrapper.querySelector(`.cqt-pane[data-pane="${tab.dataset.tab}"]`)?.classList.add('active');
        const body = wrapper.querySelector('#cvat-quicktool-body');
        if (body) body.scrollTop = 0;
      });
    });

    // Kéo panel
    bindPanelDrag(wrapper);

    // Phím tắt
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q' || e.key === 'œ')) {
        e.preventDefault();
        e.stopPropagation();
        const isOpen =
          wrapper.classList.contains('expanded') ||
          wrapper.classList.contains('pinned') ||
          wrapper.classList.contains('hover-open');
        if (isOpen) {
          isPinned = false;
          wrapper.classList.remove('pinned', 'hover-open', 'expanded');
          pinBtn.classList.remove('active');
        } else {
          isPinned = true;
          wrapper.classList.add('pinned');
          pinBtn.classList.add('active');
          setTimeout(() => {
            wrapper.querySelector('#cqt-target-id')?.focus();
            wrapper.querySelector('#cqt-target-id')?.select();
          }, 100);
        }
        return;
      }
      if (e.altKey && (e.code === 'KeyG' || e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        e.stopPropagation();
        wrapper.querySelector('#cqt-btn-apply-ground')?.click();
      }
    });

    // ----- Object tab -----
    wrapper.querySelector('#cqt-btn-detect').addEventListener('click', () => {
      const id = activeId();
      const frame = getFrameNumber();
      if (!Number.isFinite(frame)) {
        return setStatus('⚠️ Không đọc được frame hiện tại. Hãy click vào canvas rồi thử lại.', 'error');
      }
      if (id !== null && id !== undefined) {
        wrapper.querySelector('#cqt-target-id').value = id;
        wrapper.querySelector('#cqt-frame-start').value = frame;
        wrapper.querySelector('#cqt-frame-end').value = frame;
        setFieldValue('cqt-frame-count', 1);
        syncFrameLabel();
        setStatus(`🎯 Đã bắt Object #${id} (frame ${frame})`, 'success');
        fetchLWHForObject(id, frame);
        updatePresetSelectionForObject(id, frame);
      } else {
        setStatus('⚠️ Chưa chọn object nào trên canvas!', 'error');
      }
    });

    wrapper.querySelector('#cqt-btn-get-lwh').addEventListener('click', async () => {
      const id = resolveTargetId();
      if (!Number.isInteger(id)) return setStatus('⚠️ Nhập Target Object ID trước!', 'error');
      await fetchLWHForObject(id, getFrameNumber() || 0);
    });

    wrapper.querySelector('#cqt-btn-apply-lwh').addEventListener('click', () => applyLWH());
    wrapper.querySelector('#cqt-btn-apply-count').addEventListener('click', () => applyFrameCount());
    wrapper.querySelector('#cqt-btn-sync-track').addEventListener('click', () => syncLWHToTrack());
    wrapper.querySelector('#cqt-btn-apply-frame').addEventListener('click', () => applyLWHCurrentFrame());
    wrapper.querySelector('#cqt-btn-clamp-inputs').addEventListener('click', () => clampInputsNow(false));

    ['cqt-lwh-l', 'cqt-lwh-w', 'cqt-lwh-h'].forEach((id) => {
      wrapper.querySelector(`#${id}`).addEventListener('change', () => {
        if (autoClampEnabled) clampInputsNow(true);
      });
    });

    wrapper.querySelector('#cqt-limit-clamp-on-apply').addEventListener('change', (e) => setAutoClamp(e.target.checked));
    wrapper.querySelector('#cqt-obj-clamp-on-apply').addEventListener('change', (e) => setAutoClamp(e.target.checked));

    wrapper.querySelector('#cqt-btn-copy-log').addEventListener('click', () => copyLog());
    wrapper.querySelector('#cqt-btn-copy-limit-result').addEventListener('click', () => copyLimitResult());
    wrapper.querySelector('#cqt-frame-count').addEventListener('change', () => {
      if (Number.isInteger(intVal('cqt-frame-start')) && Number.isInteger(intVal('cqt-frame-count'))) {
        applyFrameCount();
      }
    });
    wrapper.querySelector('#cqt-frame-start').addEventListener('change', () => {
      const count = intVal('cqt-frame-count');
      if (Number.isInteger(intVal('cqt-frame-start')) && Number.isInteger(count) && count >= 1) {
        applyFrameCount();
      }
    });
    wrapper.querySelector('#cqt-btn-detect-span').addEventListener('click', () => detectSpanAndFill());
    wrapper.querySelector('#cqt-btn-preset-save').addEventListener('click', () => savePresetForCurrent());
    wrapper.querySelector('#cqt-btn-preset-apply').addEventListener('click', () => applySelectedPreset());
    wrapper.querySelector('#cqt-btn-preset-delete').addEventListener('click', () => deleteSelectedPreset());
    wrapper.querySelector('#cqt-btn-match-size').addEventListener('click', () => copySizeFromObject());
    wrapper.querySelector('#cqt-btn-scale').addEventListener('click', () => scaleTrack());
    wrapper.querySelector('#cqt-btn-copy-transform').addEventListener('click', () => copyTransform());
    wrapper.querySelector('#cqt-btn-paste-transform').addEventListener('click', () => pasteTransform());
    wrapper.querySelector('#cqt-btn-toggle-keyframe').addEventListener('click', () => toggleKeyframeProperty());
    wrapper.querySelector('#cqt-btn-clear-keyframes').addEventListener('click', () => clearKeyframes());

    // ----- Ground tab -----
    wrapper.querySelector('#cqt-btn-ground-cloud').addEventListener('click', () => estimateGroundFromCloud());
    wrapper.querySelector('#cqt-btn-ground-others').addEventListener('click', () => estimateGroundFromOthers());
    wrapper.querySelector('#cqt-btn-ground-from-box').addEventListener('click', () => setGroundFromCurrentBox());
    wrapper.querySelector('#cqt-btn-occupancy').addEventListener('click', () => checkOccupancy());
    wrapper.querySelector('#cqt-btn-check-ground').addEventListener('click', () => checkGround());
    wrapper.querySelector('#cqt-btn-apply-ground').addEventListener('click', () => applyGroundFit());
    wrapper.querySelector('#cqt-btn-obb').addEventListener('click', () => fitBoxToCloud());

    // ----- Track tab -----
    wrapper.querySelector('#cqt-btn-shift').addEventListener('click', () => shiftTrack());
    wrapper.querySelector('#cqt-btn-rotate180').addEventListener('click', () => rotateTrack180());
    wrapper.querySelector('#cqt-btn-smooth').addEventListener('click', () => smoothTrack());
    wrapper.querySelector('#cqt-btn-decimate').addEventListener('click', () => decimateKeyframes());
    wrapper.querySelector('#cqt-btn-resample').addEventListener('click', () => resampleKeyframes());

    // ----- QA tab -----
    wrapper.querySelector('#cqt-btn-qa-scan').addEventListener('click', () => scanQA());
    wrapper.querySelector('#cqt-btn-qa-export').addEventListener('click', () => exportQA());
    wrapper.querySelector('#cqt-btn-snap-restore').addEventListener('click', () => {
      const idx = parseInt(val('cqt-snap-select'), 10);
      if (Number.isFinite(idx)) restoreSnapshot(idx);
    });
    wrapper.querySelector('#cqt-btn-snap-clear').addEventListener('click', () => {
      if (confirm('Xoá toàn bộ snapshot?')) {
        lsSet(LS_SNAPSHOTS, []);
        refreshSnapshotList();
        setStatus('Đã xoá toàn bộ snapshot.', 'success');
      }
    });

    // ----- Limits tab -----
    wrapper.querySelector('#cqt-limit-class').addEventListener('change', () => {
      setFieldValue('cqt-limit-class-name', '');
      loadLimitForm(val('cqt-limit-class'));
    });
    wrapper.querySelector('#cqt-btn-limit-save').addEventListener('click', () => saveLimitForm());
    wrapper.querySelector('#cqt-btn-limit-delete').addEventListener('click', () => deleteLimitClass());
    wrapper.querySelector('#cqt-btn-limit-reset').addEventListener('click', () => resetLimits());
    wrapper.querySelector('#cqt-btn-limit-from-object').addEventListener('click', () => fillClassNameFromObject());
    wrapper.querySelector('#cqt-btn-limit-clamp').addEventListener('click', () => clampObjectByLimits());
    wrapper.querySelector('#cqt-btn-limit-clamp-track').addEventListener('click', () => clampWholeTrack());
    wrapper.querySelector('#cqt-btn-limit-check-class').addEventListener('click', () => checkClassLimits());
    wrapper.querySelector('#cqt-btn-limit-clamp-class').addEventListener('click', () => clampClassLimits());
  }

  function bindPanelDrag(wrapper) {
    const header = wrapper.querySelector('#cvat-quicktool-header');
    let dragging = false;
    let startY = 0;
    let startTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      startY = e.clientY;
      startTop = parseInt(wrapper.style.top || getComputedStyle(wrapper).top, 10) || 100;
      document.body.style.cursor = 'move';
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const top = Math.max(0, Math.min(window.innerHeight - 80, startTop + (e.clientY - startY)));
      wrapper.style.top = `${top}px`;
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      try {
        lsSet(LS_TOP, parseInt(wrapper.style.top, 10) || 100);
      } catch (e) { }
    });
  }

  function restorePanelTop(wrapper) {
    const top = lsGet(LS_TOP, null);
    if (Number.isFinite(top)) {
      wrapper.style.top = `${Math.max(0, Math.min(window.innerHeight - 80, top))}px`;
    }
  }

  // =========================================================================
  // Object features
  // =========================================================================
  async function fetchLWHForObject(targetId, frame) {
    let { jobInstance } = getCvatContext();
    if (!isUsableJob(jobInstance)) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    // Luôn ưu tiên frame đang đứng trên player (tránh truyền frame cũ = 0)
    const liveFrame = getFrameNumber();
    let targetFrame = Number.isFinite(liveFrame) ? liveFrame : (Number.isFinite(frame) ? frame : 0);

    try {
      let state = await getCurrentState(targetId, targetFrame);

      // Cache/job hoặc frame có thể đã cũ => quét lại một lần
      if (!state) {
        resetContextCache();
        const fresh = getCvatContext();
        const freshFrame = getFrameNumber();
        if (isUsableJob(fresh.jobInstance) && Number.isFinite(freshFrame) && freshFrame !== targetFrame) {
          jobInstance = fresh.jobInstance;
          targetFrame = freshFrame;
          state = await getCurrentState(targetId, targetFrame);
        }
      }

      if (!state || !state.points || state.points.length < 9) {
        let count = 0;
        try {
          count = (await jobInstance.annotations.get(targetFrame, true)).length;
        } catch (e) { }

        // Tìm quanh frame hiện tại (±30) để gợi ý frame có object
        let foundAt = null;
        const stop = Number.isInteger(jobInstance?.stopFrame) ? jobInstance.stopFrame : Infinity;
        for (let d = 1; d <= 30 && foundAt === null; d++) {
          for (const f of [targetFrame - d, targetFrame + d]) {
            if (f < 0 || f > stop) continue;
            try {
              const states = await jobInstance.annotations.get(f, true);
              const s2 = findState(states, targetId);
              if (s2 && !s2.outside && s2.points && s2.points.length >= 9) {
                foundAt = f;
                break;
              }
            } catch (e) { }
          }
        }

        if (foundAt !== null) {
          return setStatus(
            `ℹ️ #${targetId} không có ở frame ${targetFrame}, nhưng thấy ở frame ${foundAt}. ` +
            'Chuyển tới frame đó rồi thử lại.',
            'warn'
          );
        }

        return setStatus(
          `⚠️ Không thấy cuboid #${targetId} ở frame ${targetFrame} ` +
          `(job #${jobInstance?.id ?? '?'}, ${count} object tại frame).`,
          'error'
        );
      }
      const l = state.points[6];
      const w = state.points[7];
      const h = state.points[8];
      document.querySelector('#cqt-lwh-l').value = l.toFixed(3);
      document.querySelector('#cqt-lwh-w').value = w.toFixed(3);
      document.querySelector('#cqt-lwh-h').value = h.toFixed(3);

      // Đối chiếu limits của class
      const label = typeof state.label === 'string' ? state.label : (state.label?.name || '');
      const lim = getLimitsForLabel(label);
      const out = [];
      if (lim) {
        if (l < lim.l[0] || l > lim.l[1]) out.push(`L ${l.toFixed(2)} ngoài ${lim.l[0]}–${lim.l[1]}`);
        if (w < lim.w[0] || w > lim.w[1]) out.push(`W ${w.toFixed(2)} ngoài ${lim.w[0]}–${lim.w[1]}`);
        if (h < lim.h[0] || h > lim.h[1]) out.push(`H ${h.toFixed(2)} ngoài ${lim.h[0]}–${lim.h[1]}`);
      }

      setStatus(
        `✅ LWH #${targetId}: L=${l.toFixed(2)}, W=${w.toFixed(2)}, H=${h.toFixed(2)}` +
        (out.length ? ` ⚠️ Ngoài limits [${label}]: ${out.join(', ')}.` : (lim ? ` (trong limits [${label}]).` : '')),
        out.length ? 'warn' : 'success'
      );
    } catch (err) {
      setStatus('❌ Lỗi đọc LWH: ' + err.message, 'error');
    }
  }

  function setAutoClamp(value, persist = true) {
    autoClampEnabled = !!value;
    if (persist) lsSet(LS_AUTOCLAMP, autoClampEnabled);
    ['cqt-limit-clamp-on-apply', 'cqt-obj-clamp-on-apply'].forEach((id) => {
      const el = document.querySelector(`#${id}`);
      if (el && el.checked !== autoClampEnabled) el.checked = autoClampEnabled;
    });
  }

  async function clampInputsNow(silent = false) {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) {
      if (!silent) setStatus('⚠️ Chọn object trước!', 'error');
      return;
    }

    const l = numVal('cqt-lwh-l');
    const w = numVal('cqt-lwh-w');
    const h = numVal('cqt-lwh-h');
    if (!(l > 0 && w > 0 && h > 0)) {
      if (!silent) setStatus('⚠️ Nhập đủ L, W, H dương!', 'error');
      return;
    }

    const label = await getLabelForTarget(id, intVal('cqt-frame-start'));
    const lim = label ? getLimitsForLabel(label) : null;
    if (!lim) {
      if (!silent) setStatus(`⚠️ Chưa có limits cho class "${label || '?'}".`, 'error');
      return;
    }

    const c = clampLWHValues(l, w, h, lim);
    const changes = [];
    if (Math.abs(c.l - l) > 1e-9) changes.push(`L ${l.toFixed(2)}→${c.l.toFixed(2)}`);
    if (Math.abs(c.w - w) > 1e-9) changes.push(`W ${w.toFixed(2)}→${c.w.toFixed(2)}`);
    if (Math.abs(c.h - h) > 1e-9) changes.push(`H ${h.toFixed(2)}→${c.h.toFixed(2)}`);

    if (!changes.length) {
      if (!silent) setStatus(`ℹ️ LWH đã trong limits [${label}].`, 'success');
      return;
    }

    setFieldValue('cqt-lwh-l', c.l.toFixed(3));
    setFieldValue('cqt-lwh-w', c.w.toFixed(3));
    setFieldValue('cqt-lwh-h', c.h.toFixed(3));
    setStatus(`📏 Kẹp limits [${label}]: ${changes.join(', ')}.`, 'success');
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { }

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function copyLog() {
    const text = document.querySelector('#cqt-log')?.textContent?.trim() || '';
    if (!text || text === 'Log thao tác...') {
      return setStatus('⚠️ Log đang trống.', 'error');
    }
    const ok = await copyToClipboard(text);
    setStatus(
      ok ? '📋 Đã copy log vào clipboard.' : '❌ Không copy được (clipboard bị chặn).',
      ok ? 'success' : 'error'
    );
  }

  async function copyLimitResult() {
    const text = document.querySelector('#cqt-limit-result')?.textContent?.trim() || '';
    if (!text || text === 'Chưa kiểm tra class.') {
      return setStatus('⚠️ Chưa có kết quả check để copy.', 'error');
    }
    const ok = await copyToClipboard(text);
    setStatus(
      ok ? '📋 Đã copy kết quả check class.' : '❌ Không copy được (clipboard bị chặn).',
      ok ? 'success' : 'error'
    );
  }

  async function clampLWHInputs(targetId, frameHint, l, w, h) {
    if (!autoClampEnabled) {
      return { l, w, h, note: '', changed: false, label: null };
    }

    const label = await getLabelForTarget(targetId, frameHint);
    const lim = label ? getLimitsForLabel(label) : null;
    if (!lim) return { l, w, h, note: '', changed: false, label };

    const c = clampLWHValues(l, w, h, lim);
    const changes = [];
    if (Math.abs(c.l - l) > 1e-9) changes.push(`L ${l.toFixed(2)}→${c.l.toFixed(2)}`);
    if (Math.abs(c.w - w) > 1e-9) changes.push(`W ${w.toFixed(2)}→${c.w.toFixed(2)}`);
    if (Math.abs(c.h - h) > 1e-9) changes.push(`H ${h.toFixed(2)}→${c.h.toFixed(2)}`);

    return {
      l: c.l,
      w: c.w,
      h: c.h,
      note: changes.length ? ` Kẹp limits [${label}]: ${changes.join(', ')}.` : '',
      changed: changes.length > 0,
      label,
    };
  }

  async function applyLWH() {
    const range = readRange();
    if (!range) return;

    let l = numVal('cqt-lwh-l');
    let w = numVal('cqt-lwh-w');
    let h = numVal('cqt-lwh-h');
    if (!(l > 0 && w > 0 && h > 0)) {
      return setStatus('⚠️ Nhập đủ L, W, H dương!', 'error');
    }

    const clamped = await clampLWHInputs(range.targetId, range.startFrame, l, w, h);
    l = clamped.l;
    w = clamped.w;
    h = clamped.h;
    const clampNote = clamped.note;
    if (clamped.changed) {
      setFieldValue('cqt-lwh-l', l.toFixed(3));
      setFieldValue('cqt-lwh-w', w.toFixed(3));
      setFieldValue('cqt-lwh-h', h.toFixed(3));
    }

    const keepGround = document.querySelector('#cqt-keep-ground').checked;
    const keyframesOnly = document.querySelector('#cqt-lwh-keyframe-only').checked;

    const { changed, skipped } = await batchUpdate({
      ...range,
      label: 'LWH',
      keyframesOnly,
      progress: true,
      apply: (s) => {
        if (
          Math.abs(s.points[6] - l) < 1e-9 &&
          Math.abs(s.points[7] - w) < 1e-9 &&
          Math.abs(s.points[8] - h) < 1e-9
        ) return false;
        const p = [...s.points];
        const oldBottom = bottomZ(p);
        p[6] = l;
        p[7] = w;
        p[8] = h;
        if (keepGround) p[2] = oldBottom + lowestOffset(p);
        s.points = p;
        return true;
      },
    });

    if (!changed) {
      return setStatus(`⚠️ Không có frame nào được sửa (bỏ qua ${skipped}).`, 'error');
    }

    const restored = await refreshCanvas();
    setStatus(
      `✅ Đổi LWH #${range.targetId} trên ${changed} frame` +
      (skipped ? ` (bỏ qua ${skipped})` : '') +
      `.` + clampNote +
      ` Ctrl+S để lưu.` +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  // Đồng bộ LWH đang nhập cho toàn bộ keyframe của track.
  // Chỉ sửa keyframe: các frame nội suy ở giữa sẽ tự nhận cùng LWH,
  // nên track không bị phình keyframe.
  async function syncLWHToTrack() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');

    let l = numVal('cqt-lwh-l');
    let w = numVal('cqt-lwh-w');
    let h = numVal('cqt-lwh-h');
    if (!(l > 0 && w > 0 && h > 0)) {
      return setStatus('⚠️ Nhập đủ L, W, H dương!', 'error');
    }

    const span = await detectObjectSpan(id);
    if (!span) return;

    const clamped = await clampLWHInputs(id, getFrameNumber() ?? span.startFrame, l, w, h);
    l = clamped.l;
    w = clamped.w;
    h = clamped.h;
    if (clamped.changed) {
      setFieldValue('cqt-lwh-l', l.toFixed(3));
      setFieldValue('cqt-lwh-w', w.toFixed(3));
      setFieldValue('cqt-lwh-h', h.toFixed(3));
    }

    const { jobInstance } = getCvatContext();
    if (!isUsableJob(jobInstance)) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    const keepGround = document.querySelector('#cqt-keep-ground').checked;
    const keyframes = [];

    for (let f = span.startFrame; f <= span.endFrame; f++) {
      const s = await getCurrentState(id, f);
      if (s?.points?.length >= 9 && !s.outside && s.keyframe) {
        keyframes.push({ frame: f, state: s });
      }
    }

    // Shape hoặc track không có keyframe trong dải: dùng frame hiện tại
    if (!keyframes.length) {
      const f = getFrameNumber() ?? span.startFrame;
      const s = await getCurrentState(id, f);
      if (s?.points?.length >= 9 && !s.outside) keyframes.push({ frame: f, state: s });
    }

    if (!keyframes.length) {
      return setStatus('⚠️ Không tìm thấy keyframe nào của object để đồng bộ.', 'error');
    }

    const snap = [];
    let changed = 0;

    for (const { frame, state } of keyframes) {
      const p = [...state.points];
      if (
        Math.abs(p[6] - l) < 1e-9 &&
        Math.abs(p[7] - w) < 1e-9 &&
        Math.abs(p[8] - h) < 1e-9
      ) continue;

      snap.push(snapshotItem(state, frame));
      const oldBottom = bottomZ(p);
      p[6] = l;
      p[7] = w;
      p[8] = h;
      if (keepGround) p[2] = oldBottom + lowestOffset(p);
      state.points = p;
      saveState(state, jobInstance);
      changed++;
    }

    if (!changed) {
      return setStatus(
        `ℹ️ Toàn track #${id} đã có LWH ${l.toFixed(2)}×${w.toFixed(2)}×${h.toFixed(2)}.`,
        'success'
      );
    }

    pushSnapshot('Sync LWH track', snap);
    const restored = await refreshCanvas();

    setStatus(
      `🔗 Đồng bộ #${id}: ${changed}/${keyframes.length} keyframe trong frame ${span.startFrame}–${span.endFrame} ` +
      `→ LWH ${l.toFixed(2)}×${w.toFixed(2)}×${h.toFixed(2)}.` + clamped.note +
      ' Các frame nội suy sẽ theo keyframe.' +
      ' Ctrl+S để lưu.' +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  // Chỉ sửa LWH tại đúng frame hiện tại; các frame khác giữ nguyên.
  async function applyLWHCurrentFrame() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');

    const frame = getFrameNumber();
    if (!Number.isFinite(frame)) return setStatus('⚠️ Không đọc được frame hiện tại.', 'error');

    let l = numVal('cqt-lwh-l');
    let w = numVal('cqt-lwh-w');
    let h = numVal('cqt-lwh-h');
    if (!(l > 0 && w > 0 && h > 0)) {
      return setStatus('⚠️ Nhập đủ L, W, H dương!', 'error');
    }

    const clamped = await clampLWHInputs(id, frame, l, w, h);
    l = clamped.l;
    w = clamped.w;
    h = clamped.h;
    if (clamped.changed) {
      setFieldValue('cqt-lwh-l', l.toFixed(3));
      setFieldValue('cqt-lwh-w', w.toFixed(3));
      setFieldValue('cqt-lwh-h', h.toFixed(3));
    }

    const { jobInstance } = getCvatContext();
    if (!isUsableJob(jobInstance)) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    const state = await getCurrentState(id, frame);
    if (!state?.points || state.points.length < 9) {
      return setStatus(`⚠️ Không thấy cuboid #${id} ở frame ${frame}.`, 'error');
    }

    const p = [...state.points];
    if (
      Math.abs(p[6] - l) < 1e-9 &&
      Math.abs(p[7] - w) < 1e-9 &&
      Math.abs(p[8] - h) < 1e-9
    ) {
      return setStatus(`ℹ️ #${id} tại frame ${frame} đã có đúng LWH này.`, 'success');
    }

    const wasKeyframe = !!state.keyframe;
    const keepGround = document.querySelector('#cqt-keep-ground').checked;
    const oldBottom = bottomZ(p);
    p[6] = l;
    p[7] = w;
    p[8] = h;
    if (keepGround) p[2] = oldBottom + lowestOffset(p);

    pushSnapshot('LWH frame', [snapshotItem(state, frame)]);
    state.points = p;
    saveState(state, jobInstance);

    const restored = await refreshCanvas();
    setStatus(
      `✂️ Chỉ frame ${frame}: LWH ${l.toFixed(2)}×${w.toFixed(2)}×${h.toFixed(2)}.` + clamped.note +
      ' Các frame khác giữ nguyên.' +
      (wasKeyframe ? '' : ' (Đã tạo keyframe tại frame này.)') +
      ' Ctrl+S để lưu.' +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  function getPresets() {
    return lsGet(LS_PRESETS, {});
  }

  function refreshPresetList(selectLabel) {
    const select = document.querySelector('#cqt-preset-select');
    if (!select) return;
    const presets = getPresets();
    const labels = Object.keys(presets).sort();
    select.innerHTML = '';
    if (!labels.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(chưa có preset)';
      select.appendChild(opt);
      return;
    }
    labels.forEach((label) => {
      const p = presets[label];
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = `${label}: ${p.l}×${p.w}×${p.h}`;
      if (selectLabel && label === selectLabel) opt.selected = true;
      select.appendChild(opt);
    });
  }

  async function updatePresetSelectionForObject(targetId, frame) {
    try {
      const s = await getCurrentState(targetId, frame);
      if (!s?.label) return;

      if (getPresets()[s.label]) refreshPresetList(s.label);

      // Chọn luôn class limits tương ứng (nếu có)
      const all = getLimits();
      const key = Object.keys(all).find((k) => normalizeClass(k) === normalizeClass(s.label));
      const select = document.querySelector('#cqt-limit-class');
      if (key && select) {
        select.value = key;
        loadLimitForm(key);
      }
    } catch (e) { }
  }

  async function savePresetForCurrent() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');
    const l = numVal('cqt-lwh-l');
    const w = numVal('cqt-lwh-w');
    const h = numVal('cqt-lwh-h');
    if (!(l > 0 && w > 0 && h > 0)) return setStatus('⚠️ Nhập LWH trước khi lưu preset!', 'error');

    const s = await getCurrentState(id, getFrameNumber() || 0);
    const label = typeof s?.label === 'string' ? s.label : (s?.label?.name || '');
    if (!label) return setStatus('⚠️ Không lấy được label của object!', 'error');

    const presets = getPresets();
    presets[label] = { l, w, h };
    lsSet(LS_PRESETS, presets);
    refreshPresetList(label);
    setStatus(`💾 Đã lưu preset "${label}": ${l}×${w}×${h}`, 'success');
  }

  function applySelectedPreset() {
    const label = val('cqt-preset-select');
    const presets = getPresets();
    if (!label || !presets[label]) return setStatus('⚠️ Chưa có preset nào được chọn.', 'error');
    const p = presets[label];
    document.querySelector('#cqt-lwh-l').value = p.l;
    document.querySelector('#cqt-lwh-w').value = p.w;
    document.querySelector('#cqt-lwh-h').value = p.h;
    setStatus(`📐 Đã điền preset "${label}" — bấm Áp dụng LWH.`, 'success');
  }

  function deleteSelectedPreset() {
    const label = val('cqt-preset-select');
    const presets = getPresets();
    if (!label || !presets[label]) return;
    if (!confirm(`Xoá preset "${label}"?`)) return;
    delete presets[label];
    lsSet(LS_PRESETS, presets);
    refreshPresetList();
    setStatus(`Đã xoá preset "${label}".`, 'success');
  }

  // =========================================================================
  // Limits LWH theo class
  // =========================================================================
  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getLimits() {
    const all = lsGet(LS_LIMITS, null);
    if (all && typeof all === 'object') return all;
    const seeded = cloneJson(DEFAULT_LIMITS);
    lsSet(LS_LIMITS, seeded);
    return seeded;
  }

  function saveLimitsStore(all) {
    lsSet(LS_LIMITS, all);
  }

  function normalizeClass(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function getLimitsForLabel(label) {
    if (!label) return null;
    const all = getLimits();
    const key = Object.keys(all).find((k) => normalizeClass(k) === normalizeClass(label));
    return key ? all[key] : null;
  }

  function clampValue(value, range) {
    return Math.min(Math.max(value, range[0]), range[1]);
  }

  function clampLWHValues(l, w, h, lim) {
    return {
      l: clampValue(l, lim.l),
      w: clampValue(w, lim.w),
      h: clampValue(h, lim.h),
    };
  }

  function setFieldValue(id, value) {
    const el = document.querySelector(`#${id}`);
    if (el) el.value = value;
  }

  function loadLimitForm(key) {
    const lim = getLimits()[key];
    const ids = [
      'cqt-limit-l-min', 'cqt-limit-l-max',
      'cqt-limit-w-min', 'cqt-limit-w-max',
      'cqt-limit-h-min', 'cqt-limit-h-max',
    ];
    if (!lim) {
      ids.forEach((id) => setFieldValue(id, ''));
      return;
    }
    setFieldValue('cqt-limit-l-min', lim.l[0]);
    setFieldValue('cqt-limit-l-max', lim.l[1]);
    setFieldValue('cqt-limit-w-min', lim.w[0]);
    setFieldValue('cqt-limit-w-max', lim.w[1]);
    setFieldValue('cqt-limit-h-min', lim.h[0]);
    setFieldValue('cqt-limit-h-max', lim.h[1]);
  }

  function refreshLimitClassList(selected) {
    const select = document.querySelector('#cqt-limit-class');
    if (!select) return;
    const all = getLimits();
    const keys = Object.keys(all).sort();
    select.innerHTML = '';

    if (!keys.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(chưa có class)';
      select.appendChild(opt);
    } else {
      keys.forEach((key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${key}: L ${all[key].l[0]}–${all[key].l[1]} · W ${all[key].w[0]}–${all[key].w[1]} · H ${all[key].h[0]}–${all[key].h[1]}`;
        select.appendChild(opt);
      });
    }

    if (selected && keys.includes(selected)) select.value = selected;
    loadLimitForm(select.value);
  }

  function saveLimitForm() {
    const typed = String(val('cqt-limit-class-name') || '').trim();
    const key = typed || String(val('cqt-limit-class') || '').trim();
    if (!key) return setStatus('⚠️ Chọn class có sẵn hoặc nhập tên class mới.', 'error');

    const lMin = numVal('cqt-limit-l-min');
    const lMax = numVal('cqt-limit-l-max');
    const wMin = numVal('cqt-limit-w-min');
    const wMax = numVal('cqt-limit-w-max');
    const hMin = numVal('cqt-limit-h-min');
    const hMax = numVal('cqt-limit-h-max');
    const values = [lMin, lMax, wMin, wMax, hMin, hMax];

    if (values.some((v) => !Number.isFinite(v) || v <= 0)) {
      return setStatus('⚠️ Nhập đủ 6 ngưỡng dương (min/max cho L, W, H).', 'error');
    }
    if (lMin > lMax || wMin > wMax || hMin > hMax) {
      return setStatus('⚠️ Min không được lớn hơn max.', 'error');
    }

    const all = getLimits();
    // Nếu đã có class cùng tên (không phân biệt hoa thường) thì cập nhật class đó
    const existing = Object.keys(all).find((k) => normalizeClass(k) === normalizeClass(key));
    const actualKey = existing || key;
    all[actualKey] = { l: [lMin, lMax], w: [wMin, wMax], h: [hMin, hMax] };
    saveLimitsStore(all);

    setFieldValue('cqt-limit-class-name', '');
    refreshLimitClassList(actualKey);
    setStatus(
      `💾 Đã lưu limits "${actualKey}": L ${lMin}–${lMax}, W ${wMin}–${wMax}, H ${hMin}–${hMax}.`,
      'success'
    );
  }

  function deleteLimitClass() {
    const key = String(val('cqt-limit-class') || '').trim();
    if (!key) return;
    const all = getLimits();
    if (!(key in all)) return;
    if (!confirm(`Xoá limits của class "${key}"?`)) return;

    delete all[key];
    saveLimitsStore(all);
    refreshLimitClassList();
    setStatus(`Đã xoá limits class "${key}".`, 'success');
  }

  function resetLimits() {
    if (!confirm('Reset toàn bộ limits về mặc định (vehicle, two_wheel, pedestrian)?')) return;
    saveLimitsStore(cloneJson(DEFAULT_LIMITS));
    refreshLimitClassList('vehicle');
    setStatus('↺ Đã reset limits về mặc định.', 'success');
  }

  async function getLabelForTarget(targetId, frameHint) {
    const tried = new Set();
    const candidates = [];
    const live = getFrameNumber();
    if (Number.isFinite(live)) candidates.push(live);
    if (Number.isInteger(frameHint)) candidates.push(frameHint);
    candidates.push(0);

    for (const frame of candidates) {
      if (tried.has(frame)) continue;
      tried.add(frame);
      const s = await getCurrentState(targetId, frame);
      if (s?.label) return typeof s.label === 'string' ? s.label : (s.label?.name || null);
    }
    return null;
  }

  async function fillClassNameFromObject() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');

    const label = await getLabelForTarget(id, intVal('cqt-frame-start'));
    if (!label) return setStatus('⚠️ Không lấy được label của object.', 'error');

    setFieldValue('cqt-limit-class-name', label);

    const all = getLimits();
    const key = Object.keys(all).find((k) => normalizeClass(k) === normalizeClass(label));
    if (key) refreshLimitClassList(key);

    setStatus(
      key
        ? `📌 Class của object là "${label}" — đã nạp limits có sẵn.`
        : `📌 Class của object là "${label}" — nhập limits rồi bấm Lưu.`,
      'success'
    );
  }

  function applyFrameCount() {
    const start = intVal('cqt-frame-start');
    const count = intVal('cqt-frame-count');
    if (!Number.isInteger(start) || !Number.isInteger(count) || count < 1) {
      return setStatus('⚠️ Nhập Start Frame và tổng số frame (>= 1).', 'error');
    }

    const { jobInstance } = getCvatContext();
    const stop = Number.isInteger(jobInstance?.stopFrame) ? jobInstance.stopFrame : null;
    let end = start + count - 1;
    let note = '';
    if (Number.isInteger(stop) && end > stop) {
      end = stop;
      note = ` (vượt frame cuối ${stop}, đã cắt)`;
    }

    setFieldValue('cqt-frame-end', end);
    setStatus(`📏 Dải áp dụng: ${start}–${end} (${end - start + 1} frame).${note}`, 'success');
  }

  async function detectObjectSpan(targetId) {
    const { jobInstance } = getCvatContext();
    if (!isUsableJob(jobInstance)) {
      setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');
      return null;
    }

    const jobStart = Number.isInteger(jobInstance.startFrame) ? jobInstance.startFrame : 0;
    const jobStop = Number.isInteger(jobInstance.stopFrame) ? jobInstance.stopFrame : null;
    if (!Number.isInteger(jobStop)) {
      return setStatus('⚠️ Không đọc được frame cuối của job.', 'error');
    }

    if (jobStop - jobStart > 5000 &&
      !confirm(`Job có ${jobStop - jobStart + 1} frame, dò toàn bộ có thể mất vài giây. Tiếp tục?`)) {
      return null;
    }

    let first = null;
    let last = null;
    let count = 0;

    setStatus(`⏳ Đang dò dải frame của #${targetId}...`);
    for (let f = jobStart; f <= jobStop; f++) {
      if (f > jobStart && (f - jobStart) % 100 === 0) {
        setStatus(`⏳ Dò frame ${f}/${jobStop}...`);
        await sleep(0);
      }
      const s = await getCurrentState(targetId, f);
      if (s?.points?.length >= 9 && !s.outside) {
        if (first === null) first = f;
        last = f;
        count++;
      }
    }

    if (first === null) {
      setStatus(`⚠️ Không thấy object #${targetId} trong job.`, 'error');
      return null;
    }

    const spanFrames = last - first + 1;
    setFieldValue('cqt-frame-start', first);
    setFieldValue('cqt-frame-end', last);
    setFieldValue('cqt-frame-count', spanFrames);
    setStatus(
      `🔍 #${targetId}: frame ${first}–${last} (${spanFrames} frame, ${count} frame có object).`,
      'success'
    );
    return { startFrame: first, endFrame: last, count, spanFrames };
  }

  async function detectSpanAndFill() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');
    await detectObjectSpan(id);
  }

  async function clampWholeTrack() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');

    const span = await detectObjectSpan(id);
    if (!span) return;
    await clampObjectByLimits();
  }

  function matchClassLabel(label, className) {
    const value = typeof label === 'string' ? label : (label?.name || '');
    return normalizeClass(value) === normalizeClass(className);
  }

  function getClassScope() {
    const { jobInstance } = getCvatContext();
    if (!isUsableJob(jobInstance)) {
      setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');
      return null;
    }

    const allJob = document.querySelector('#cqt-limit-class-all-job')?.checked;
    let from;
    let to;

    if (allJob) {
      from = Number.isInteger(jobInstance.startFrame) ? jobInstance.startFrame : intVal('cqt-frame-start');
      to = Number.isInteger(jobInstance.stopFrame) ? jobInstance.stopFrame : intVal('cqt-frame-end');
    } else {
      from = intVal('cqt-frame-start');
      to = intVal('cqt-frame-end');
    }

    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) {
      setStatus('⚠️ Dải frame không hợp lệ.', 'error');
      return null;
    }

    if (to - from > 5000 &&
      !confirm(`Sẽ quét ${to - from + 1} frame, có thể mất vài giây. Tiếp tục?`)) {
      return null;
    }

    return { from, to, jobInstance, allJob };
  }

  async function checkClassLimits() {
    const className = String(val('cqt-limit-class') || '').trim();
    const lim = className ? getLimits()[className] : null;
    if (!lim) return setStatus('⚠️ Chọn class có limits trước.', 'error');

    const scope = getClassScope();
    if (!scope) return;

    const byId = new Map();
    setStatus(`⏳ Check class "${className}"...`);

    for (let f = scope.from; f <= scope.to; f++) {
      if (f > scope.from && (f - scope.from) % 100 === 0) {
        setStatus(`⏳ Check "${className}": frame ${f}/${scope.to}...`);
        await sleep(0);
      }

      const states = await scope.jobInstance.annotations.get(f, true);
      for (const s of states) {
        if (!s?.points || s.points.length < 9 || s.outside) continue;
        if (!matchClassLabel(s.label, className)) continue;

        const id = s.clientID;
        let rec = byId.get(id);
        if (!rec) {
          rec = {
            id,
            frames: 0,
            keyframes: 0,
            badFrames: 0,
            minL: Infinity, maxL: -Infinity,
            minW: Infinity, maxW: -Infinity,
            minH: Infinity, maxH: -Infinity,
          };
          byId.set(id, rec);
        }

        const l = s.points[6];
        const w = s.points[7];
        const h = s.points[8];

        rec.frames++;
        if (s.keyframe) rec.keyframes++;
        rec.minL = Math.min(rec.minL, l);
        rec.maxL = Math.max(rec.maxL, l);
        rec.minW = Math.min(rec.minW, w);
        rec.maxW = Math.max(rec.maxW, w);
        rec.minH = Math.min(rec.minH, h);
        rec.maxH = Math.max(rec.maxH, h);

        const eps = 1e-9;
        const bad =
          l < lim.l[0] - eps || l > lim.l[1] + eps ||
          w < lim.w[0] - eps || w > lim.w[1] + eps ||
          h < lim.h[0] - eps || h > lim.h[1] + eps;
        if (bad) rec.badFrames++;
      }
    }

    if (!byId.size) {
      return setStatus(`⚠️ Không thấy object nào thuộc class "${className}" trong phạm vi quét.`, 'error');
    }

    const badObjects = [...byId.values()].filter((r) => r.badFrames > 0);
    const badFrames = badObjects.reduce((sum, r) => sum + r.badFrames, 0);

    const lines = [];
    lines.push(
      `Class "${className}": ${byId.size} object / ${[...byId.values()].reduce((s, r) => s + r.frames, 0)} frame.`
    );
    lines.push(`Ngoài ngưỡng: ${badObjects.length}/${byId.size} object, ${badFrames} frame.`);

    badObjects.sort((a, b) => b.badFrames - a.badFrames);
    for (const r of badObjects.slice(0, 20)) {
      const parts = [];
      if (r.maxL > lim.l[1] + 1e-9) parts.push(`L max ${r.maxL.toFixed(2)} (>${lim.l[1]})`);
      if (r.minL < lim.l[0] - 1e-9) parts.push(`L min ${r.minL.toFixed(2)} (<${lim.l[0]})`);
      if (r.maxW > lim.w[1] + 1e-9) parts.push(`W max ${r.maxW.toFixed(2)} (>${lim.w[1]})`);
      if (r.minW < lim.w[0] - 1e-9) parts.push(`W min ${r.minW.toFixed(2)} (<${lim.w[0]})`);
      if (r.maxH > lim.h[1] + 1e-9) parts.push(`H max ${r.maxH.toFixed(2)} (>${lim.h[1]})`);
      if (r.minH < lim.h[0] - 1e-9) parts.push(`H min ${r.minH.toFixed(2)} (<${lim.h[0]})`);

      lines.push(
        `#${r.id}: ${r.badFrames}/${r.frames} frame ngoài` +
        (parts.length ? ` — ${parts.join(', ')}` : '')
      );
    }
    if (badObjects.length > 20) lines.push(`... +${badObjects.length - 20} object khác`);

    const pre = document.querySelector('#cqt-limit-result');
    if (pre) pre.textContent = lines.join('\n');

    setStatus(
      `🔎 Class "${className}": ${badObjects.length}/${byId.size} object ngoài ngưỡng (${badFrames} frame). ` +
      'Xem chi tiết ở tab Limits.',
      badObjects.length ? 'warn' : 'success'
    );
  }

  async function clampClassLimits() {
    const className = String(val('cqt-limit-class') || '').trim();
    const lim = className ? getLimits()[className] : null;
    if (!lim) return setStatus('⚠️ Chọn class có limits trước.', 'error');

    const scope = getClassScope();
    if (!scope) return;

    const keyframesOnly = document.querySelector('#cqt-limit-class-keyframes').checked;
    if (!keyframesOnly &&
      !confirm('Clamp mọi frame của mọi object trong class sẽ tạo keyframe ở tất cả frame. Tiếp tục?')) {
      return;
    }

    setStatus(`⏳ Clamp class "${className}"...`);

    const snap = [];
    const objects = new Set();
    let changed = 0;
    let scanned = 0;

    for (let f = scope.from; f <= scope.to; f++) {
      if (f > scope.from && (f - scope.from) % 100 === 0) {
        setStatus(`⏳ Clamp "${className}": frame ${f}/${scope.to}...`);
        await sleep(0);
      }

      const states = await scope.jobInstance.annotations.get(f, true);
      for (const s of states) {
        if (!s?.points || s.points.length < 9 || s.outside) continue;
        if (!matchClassLabel(s.label, className)) continue;
        if (keyframesOnly && !s.keyframe) continue;

        const p = [...s.points];
        const before = { l: p[6], w: p[7], h: p[8] };
        const after = clampLWHValues(before.l, before.w, before.h, lim);
        if (
          Math.abs(after.l - before.l) < 1e-9 &&
          Math.abs(after.w - before.w) < 1e-9 &&
          Math.abs(after.h - before.h) < 1e-9
        ) continue;

        snap.push(snapshotItem(s, f));
        const oldBottom = bottomZ(p);
        p[6] = after.l;
        p[7] = after.w;
        p[8] = after.h;
        p[2] = oldBottom + lowestOffset(p);
        s.points = p;
        saveState(s, scope.jobInstance);
        changed++;
        objects.add(s.clientID);
      }
      scanned++;
    }

    if (!changed) {
      return setStatus(
        `ℹ️ Class "${className}": không có frame nào ngoài limits trong phạm vi quét.`,
        'success'
      );
    }

    pushSnapshot(`Clamp class "${className}"`, snap);
    const restored = await refreshCanvas();

    setStatus(
      `📏 Clamp class "${className}": ${objects.size} object, ${changed} frame. ` +
      'Ctrl+S để lưu.' +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  async function clampObjectByLimits() {
    const range = readRange();
    if (!range) return;

    const label = await getLabelForTarget(range.targetId, range.startFrame);
    const lim = label ? getLimitsForLabel(label) : null;
    if (!lim) {
      return setStatus(
        `⚠️ Chưa có limits cho class "${label || '?'}". Vào tab Limits nhập và Lưu trước.`,
        'error'
      );
    }

    const keyframesOnly = document.querySelector('#cqt-limit-keyframe-only').checked;
    const stats = { frames: 0, l: 0, w: 0, h: 0, example: null };

    const { changed } = await batchUpdate({
      ...range,
      label: 'Clamp limits',
      keyframesOnly,
      progress: true,
      apply: (s) => {
        const p = [...s.points];
        const before = { l: p[6], w: p[7], h: p[8] };
        const after = clampLWHValues(before.l, before.w, before.h, lim);

        const dl = Math.abs(after.l - before.l) > 1e-9;
        const dw = Math.abs(after.w - before.w) > 1e-9;
        const dh = Math.abs(after.h - before.h) > 1e-9;
        if (!dl && !dw && !dh) return false;

        const oldBottom = bottomZ(p);
        p[6] = after.l;
        p[7] = after.w;
        p[8] = after.h;
        p[2] = oldBottom + lowestOffset(p);
        s.points = p;

        stats.frames++;
        if (dl) stats.l++;
        if (dw) stats.w++;
        if (dh) stats.h++;

        if (!stats.example) {
          const parts = [];
          if (dl) parts.push(`L ${before.l.toFixed(2)}→${after.l.toFixed(2)}`);
          if (dw) parts.push(`W ${before.w.toFixed(2)}→${after.w.toFixed(2)}`);
          if (dh) parts.push(`H ${before.h.toFixed(2)}→${after.h.toFixed(2)}`);
          stats.example = parts.join(', ');
        }
        return true;
      },
    });

    if (!changed) {
      return setStatus(
        `ℹ️ #${range.targetId} [${label}] đã nằm trong limits (L ${lim.l[0]}–${lim.l[1]}, W ${lim.w[0]}–${lim.w[1]}, H ${lim.h[0]}–${lim.h[1]}).`,
        'success'
      );
    }

    const restored = await refreshCanvas();
    const parts = [];
    if (stats.l) parts.push(`L×${stats.l}`);
    if (stats.w) parts.push(`W×${stats.w}`);
    if (stats.h) parts.push(`H×${stats.h}`);

    setStatus(
      `📏 Clamp #${range.targetId} [${label}]: ${changed} frame (${parts.join(', ')}). ` +
      (stats.example ? `Ví dụ: ${stats.example}. ` : '') +
      'Ctrl+S để lưu.' +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  async function copySizeFromObject() {
    const srcId = intVal('cqt-src-id');
    if (!Number.isInteger(srcId)) return setStatus('⚠️ Nhập ID object mẫu!', 'error');
    const s = await getCurrentState(srcId, getFrameNumber() || 0);
    if (!s || !s.points || s.points.length < 9) {
      return setStatus(`⚠️ Không thấy object #${srcId} ở frame hiện tại.`, 'error');
    }
    document.querySelector('#cqt-lwh-l').value = s.points[6].toFixed(3);
    document.querySelector('#cqt-lwh-w').value = s.points[7].toFixed(3);
    document.querySelector('#cqt-lwh-h').value = s.points[8].toFixed(3);
    setStatus(`📋 Đã copy size từ #${srcId} — bấm Áp dụng LWH cho object đích.`, 'success');
  }

  async function scaleTrack() {
    const range = readRange();
    if (!range) return;
    const factor = numVal('cqt-scale-factor');
    if (!(factor > 0.01 && factor < 100)) return setStatus('⚠️ Hệ số scale không hợp lệ!', 'error');
    if (Math.abs(factor - 1) < 1e-9) return setStatus('ℹ️ Hệ số = 1, không cần scale.', 'warn');
    const keyframesOnly = document.querySelector('#cqt-lwh-keyframe-only').checked;

    const { changed } = await batchUpdate({
      ...range,
      label: `Scale ×${factor}`,
      keyframesOnly,
      progress: true,
      apply: (s) => {
        const p = [...s.points];
        const oldBottom = bottomZ(p);
        p[6] *= factor;
        p[7] *= factor;
        p[8] *= factor;
        p[2] = oldBottom + lowestOffset(p);
        s.points = p;
        return true;
      },
    });

    if (!changed) return setStatus('⚠️ Không có frame nào được scale.', 'error');
    const restored = await refreshCanvas();
    setStatus(
      `✅ Scale ×${factor} cho #${range.targetId}: ${changed} frame. Ctrl+S để lưu.` +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  async function copyTransform() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');
    const s = await getCurrentState(id, getFrameNumber() || 0);
    if (!s || !s.points) return setStatus('⚠️ Không thấy object ở frame hiện tại.', 'error');
    lsSet(LS_CLIPBOARD, { points: [...s.points], label: s.label, ts: Date.now() });
    setStatus(`📋 Đã copy transform #${id} (${s.points.length} giá trị).`, 'success');
  }

  async function pasteTransform() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');
    const clip = lsGet(LS_CLIPBOARD, null);
    if (!clip?.points) return setStatus('⚠️ Chưa copy transform nào.', 'error');

    const { jobInstance } = getCvatContext();
    if (!jobInstance) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    const frame = getFrameNumber() || 0;
    const s = await getCurrentState(id, frame);
    if (!s) return setStatus('⚠️ Không thấy object ở frame hiện tại.', 'error');

    pushSnapshot('Paste transform', [snapshotItem(s, frame)]);
    s.points = [...clip.points];
    saveState(s, jobInstance);

    const restored = await refreshCanvas();
    setStatus(
      `📥 Đã paste transform vào #${id} tại frame ${frame}.` +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  async function toggleKeyframeProperty() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');

    const item = document.getElementById(`cvat-objects-sidebar-state-item-${id}`);
    if (!item) return setStatus(`⚠️ Không thấy #${id} trong sidebar (phải bật danh sách Objects).`, 'error');

    const star = item.querySelector(
      '.anticon-star, [aria-label="star"], svg[data-icon="star"], [aria-label*="keyframe"], [title*="keyframe"]'
    );
    if (!star) return setStatus(`⚠️ Không tìm thấy nút keyframe của #${id} ở frame này.`, 'error');

    const btn = star.closest('button') || star;
    if (btn.disabled || btn.classList.contains('ant-btn-disabled')) {
      return setStatus('⚠️ Đây là keyframe duy nhất của track, CVAT không cho gỡ.', 'warn');
    }

    btn.click();
    setStatus(`⭐ Đã toggle keyframe #${id} tại frame ${getFrameNumber()}.`, 'success');
  }

  async function clearKeyframes() {
    const range = readRange();
    if (!range) return;

    const { jobInstance } = getCvatContext();
    if (!jobInstance) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    if (!confirm(`Gỡ keyframe trung gian của #${range.targetId} trong dải ${range.startFrame}–${range.endFrame}?`)) {
      return;
    }

    const frames = [];
    for (let f = range.startFrame; f <= range.endFrame; f++) {
      const s = await getCurrentState(range.targetId, f);
      if (s && !s.outside && s.keyframe) frames.push({ frame: f, state: s });
    }

    if (!frames.length) return setStatus('ℹ️ Không có keyframe nào trong dải.', 'success');

    // Giữ lại keyframe đầu tiên (anchor)
    const toRemove = frames.slice(1);
    if (!toRemove.length) return setStatus('⚠️ Chỉ có 1 keyframe anchor, không thể gỡ.', 'warn');

    const snap = [];
    let removed = 0;
    for (const { frame, state } of toRemove) {
      snap.push(snapshotItem(state, frame));
      state.keyframe = false;
      saveState(state, jobInstance);
      removed++;
    }
    pushSnapshot('Clear keyframes', snap);

    const restored = await refreshCanvas();
    setStatus(
      `⚡ Đã gỡ ${removed} keyframe của #${range.targetId}. Ctrl+S để lưu.` +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  // =========================================================================
  // Init
  // =========================================================================
  const interval = setInterval(() => {
    syncFrameLabel();
    if (document.querySelector('#root') && window.location.href.includes('/jobs/')) {
      createUI();
    }
  }, 1000);

  // =========================================================================
  // Ground features
  // =========================================================================
  async function estimateGroundFromCloud() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');
    const frame = getFrameNumber() || 0;
    const s = await getCurrentState(id, frame);
    if (!s?.points || s.points.length < 9) {
      return setStatus(`⚠️ Không thấy cuboid #${id} ở frame ${frame}.`, 'error');
    }

    const positions = getPointCloudPositions();
    if (!positions) {
      return setStatus('⚠️ Không đọc được point cloud. Dùng "Z box khác" hoặc nhập tay.', 'error');
    }

    const est = estimateGroundZ(s.points, positions);
    if (!est) return setStatus('⚠️ Không đủ điểm quanh object để ước lượng mặt đường.', 'error');

    document.querySelector('#cqt-ground-z').value = est.z.toFixed(3);
    setStatus(
      `☁️ Ground Z ≈ ${est.z.toFixed(3)}m (${est.count} điểm, bán kính ${est.radius.toFixed(1)}m). Bấm Fit.`,
      'success'
    );
  }

  async function estimateGroundFromOthers() {
    const frame = getFrameNumber() || 0;
    const targetId = resolveTargetId();
    const { jobInstance } = getCvatContext();
    if (!jobInstance) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    const states = await jobInstance.annotations.get(frame, true);
    const zs = states
      .filter((s) => s.clientID !== targetId && !s.outside && s.points && s.points.length >= 9)
      .map((s) => bottomZ(s.points))
      .filter((z) => Number.isFinite(z));

    if (zs.length < 2) {
      return setStatus(`⚠️ Cần ít nhất 2 cuboid khác ở frame ${frame} (đang có ${zs.length}).`, 'error');
    }

    const z = median(zs);
    document.querySelector('#cqt-ground-z').value = z.toFixed(3);
    setStatus(
      `📊 Ground Z = trung vị ${zs.length} box khác = ${z.toFixed(3)}m (frame ${frame}). Bấm Fit.`,
      'success'
    );
  }

  async function setGroundFromCurrentBox() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');
    const s = await getCurrentState(id, getFrameNumber() || 0);
    if (!s?.points) return setStatus('⚠️ Không thấy object ở frame hiện tại.', 'error');
    const z = bottomZ(s.points);
    document.querySelector('#cqt-ground-z').value = z.toFixed(3);
    setStatus(`📌 Đã lấy Z = đáy hiện tại của #${id}: ${z.toFixed(3)}m.`, 'success');
  }

  async function checkOccupancy() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');
    const frame = getFrameNumber() || 0;
    const s = await getCurrentState(id, frame);
    if (!s?.points || s.points.length < 9) return setStatus('⚠️ Không thấy object.', 'error');

    const positions = getPointCloudPositions();
    if (!positions) return setStatus('⚠️ Không đọc được point cloud.', 'error');

    const p = s.points;
    const R = rotationMatrix(p[3], p[4], p[5]);
    const hx = Math.abs(p[6]) / 2;
    const hy = Math.abs(p[7]) / 2;
    const hz = Math.abs(p[8]) / 2;
    const nearRadius = Math.hypot(hx, hy, hz) + 1.0;

    let inside = 0;
    let near = 0;

    for (let i = 0; i + 2 < positions.length; i += 3) {
      const dx = positions[i] - p[0];
      const dy = positions[i + 1] - p[1];
      const dz = positions[i + 2] - p[2];
      if (dx * dx + dy * dy + dz * dz > nearRadius * nearRadius) continue;
      near++;

      // local = R^T * d
      const lx = R[0][0] * dx + R[1][0] * dy + R[2][0] * dz;
      const ly = R[0][1] * dx + R[1][1] * dy + R[2][1] * dz;
      const lz = R[0][2] * dx + R[1][2] * dy + R[2][2] * dz;

      if (Math.abs(lx) <= hx + 0.03 && Math.abs(ly) <= hy + 0.03 && Math.abs(lz) <= hz + 0.03) {
        inside++;
      }
    }

    if (!near) return setStatus('⚠️ Không có điểm cloud quanh box.', 'error');
    const pct = (inside / near) * 100;
    setStatus(
      `🧊 Occupancy #${id}: ${inside}/${near} điểm gần box nằm trong hộp (${pct.toFixed(0)}%). ` +
      'Quá thấp = box lệch/rỗng; quá cao = box ôm quá nhiều.',
      pct < 5 ? 'warn' : 'success'
    );
  }

  async function checkGround() {
    const range = readRange();
    if (!range) return;

    const groundZ = numVal('cqt-ground-z');
    if (!Number.isFinite(groundZ)) return setStatus('⚠️ Cao độ mặt đất không hợp lệ!', 'error');

    const { jobInstance } = getCvatContext();
    if (!jobInstance) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    setStatus(`⏳ Đang đo đáy #${range.targetId}...`);
    let minGap = Infinity;
    let maxGap = -Infinity;
    let frames = 0;
    let keyframes = 0;
    let sunk = 0;
    let floating = 0;
    let maxTilt = 0;

    for (let f = range.startFrame; f <= range.endFrame; f++) {
      const s = await getCurrentState(range.targetId, f);
      if (!s?.points || s.points.length < 9 || s.outside) continue;
      const gap = bottomZ(s.points) - groundZ;
      frames++;
      if (s.keyframe) keyframes++;
      if (gap < -0.01) sunk++;
      if (gap > 0.01) floating++;
      minGap = Math.min(minGap, gap);
      maxGap = Math.max(maxGap, gap);
      maxTilt = Math.max(maxTilt, tiltDegrees(s.points));
    }

    if (!frames) return setStatus(`⚠️ Không thấy #${range.targetId} trong dải.`, 'error');

    const bad = sunk + floating;
    setStatus(
      `📏 Đáy #${range.targetId} so với Z=${groundZ}: min ${fmtMeters(minGap)}, max ${fmtMeters(maxGap)} ` +
      `trên ${frames} frame (${keyframes} keyframe). ${sunk} lún, ${floating} bay >1cm.` +
      (maxTilt > 1 ? ` Nghiêng tối đa ${maxTilt.toFixed(1)}°.` : ''),
      bad ? 'warn' : 'success'
    );
  }

  async function applyGroundFit() {
    const range = readRange();
    if (!range) return;

    const groundZ = numVal('cqt-ground-z');
    if (!Number.isFinite(groundZ)) return setStatus('⚠️ Cao độ mặt đất không hợp lệ!', 'error');

    const mode = val('cqt-ground-mode') || 'snap';
    const scope = val('cqt-ground-scope') || 'keyframes';
    const direction = val('cqt-ground-direction') || 'both';

    const { jobInstance } = getCvatContext();
    if (!jobInstance) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    const currentFrame = getFrameNumber() || 0;
    let from = range.startFrame;
    let to = range.endFrame;
    if (scope === 'current') {
      from = currentFrame;
      to = currentFrame;
    }

    setStatus(`⏳ Fit mặt đất #${range.targetId} (frame ${from}–${to})...`);

    const snap = [];
    let changed = 0;
    let scanned = 0;
    let minDz = Infinity;
    let maxDz = -Infinity;
    let maxTilt = 0;
    let skippedDir = 0;
    let keyframesSeen = 0;

    for (let f = from; f <= to; f++) {
      const s = await getCurrentState(range.targetId, f);
      if (!s?.points || s.points.length < 9 || s.outside) continue;
      scanned++;
      if (scope === 'keyframes') {
        if (!s.keyframe) continue;
        keyframesSeen++;
      }

      const before = [...s.points];
      const after = fitPointsToGround(before, groundZ, mode);
      const dz = after[2] - before[2];
      const angleChanged = mode === 'flat' && (Math.abs(before[3]) > 1e-9 || Math.abs(before[4]) > 1e-9);
      if (Math.abs(dz) < 1e-6 && !angleChanged) continue;

      if (direction === 'down' && dz > 0) {
        skippedDir++;
        continue;
      }
      if (direction === 'up' && dz < 0) {
        skippedDir++;
        continue;
      }

      snap.push(snapshotItem(s, f));
      s.points = after;
      saveState(s, jobInstance);
      changed++;
      minDz = Math.min(minDz, dz);
      maxDz = Math.max(maxDz, dz);
      maxTilt = Math.max(maxTilt, tiltDegrees(before));
    }

    if (!changed) {
      if (!scanned) return setStatus(`⚠️ Không thấy #${range.targetId} trong dải.`, 'error');
      if (scope === 'keyframes' && !keyframesSeen) {
        return setStatus('ℹ️ Không có keyframe nào trong dải. Chọn "Mọi frame".', 'warn');
      }
      return setStatus('ℹ️ Không có frame nào cần thay đổi.', 'success');
    }

    pushSnapshot('Fit ground', snap);
    const restored = await refreshCanvas();

    let msg =
      `✅ Fit ${mode === 'flat' ? 'phẳng đáy' : 'snap đáy'} #${range.targetId}: ${changed} frame ` +
      `(dz ${fmtMeters(minDz)} → ${fmtMeters(maxDz)}).`;
    if (skippedDir) msg += ` Bỏ qua ${skippedDir} frame do hướng "${direction}".`;
    if (mode === 'snap' && maxTilt > 2) {
      msg += ` ⚠️ Nghiêng tới ${maxTilt.toFixed(1)}° — chỉ 1 góc chạm đất.`;
    }
    if (!restored) msg += ' ⚠️ Chưa tự về frame cũ.';
    msg += ' Ctrl+S để lưu.';

    setStatus(msg, maxTilt > 2 && mode === 'snap' ? 'warn' : 'success');
  }

  // Beta: fit lại hộp theo cụm point cloud quanh hộp hiện tại (PCA trên XY).
  async function fitBoxToCloud() {
    const id = resolveTargetId();
    if (!Number.isInteger(id)) return setStatus('⚠️ Chọn object trước!', 'error');
    const frame = getFrameNumber() || 0;
    const s = await getCurrentState(id, frame);
    if (!s?.points || s.points.length < 9) return setStatus('⚠️ Không thấy object.', 'error');

    const positions = getPointCloudPositions();
    if (!positions) return setStatus('⚠️ Không đọc được point cloud.', 'error');

    const p = s.points;
    const R = rotationMatrix(p[3], p[4], p[5]);
    const hx = Math.abs(p[6]) / 2 + 0.2;
    const hy = Math.abs(p[7]) / 2 + 0.2;
    const hz = Math.abs(p[8]) / 2 + 0.2;

    const xs = [];
    const ys = [];
    const zs = [];
    for (let i = 0; i + 2 < positions.length; i += 3) {
      const dx = positions[i] - p[0];
      const dy = positions[i + 1] - p[1];
      const dz = positions[i + 2] - p[2];
      if (dx * dx + dy * dy + dz * dz > (Math.hypot(hx, hy, hz) + 0.5) ** 2) continue;
      const lx = R[0][0] * dx + R[1][0] * dy + R[2][0] * dz;
      const ly = R[0][1] * dx + R[1][1] * dy + R[2][1] * dz;
      const lz = R[0][2] * dx + R[1][2] * dy + R[2][2] * dz;
      if (Math.abs(lx) <= hx && Math.abs(ly) <= hy && Math.abs(lz) <= hz) {
        xs.push(positions[i]);
        ys.push(positions[i + 1]);
        zs.push(positions[i + 2]);
      }
    }

    if (xs.length < 60) {
      return setStatus(`⚠️ Chỉ có ${xs.length} điểm trong vùng box, cần >= 60 để fit.`, 'error');
    }

    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    const yaw = 0.5 * Math.atan2(2 * sxy, sxx - syy);

    const cos = Math.cos(-yaw);
    const sin = Math.sin(-yaw);
    const lxs = [];
    const lys = [];
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      lxs.push(dx * cos - dy * sin);
      lys.push(dx * sin + dy * cos);
    }

    const lMinX = percentile(lxs, 0.01);
    const lMaxX = percentile(lxs, 0.99);
    const lMinY = percentile(lys, 0.01);
    const lMaxY = percentile(lys, 0.99);
    const zMin = percentile(zs, 0.01);
    const zMax = percentile(zs, 0.99);

    const lcx = (lMinX + lMaxX) / 2;
    const lcy = (lMinY + lMaxY) / 2;
    const cx = mx + lcx * Math.cos(yaw) - lcy * Math.sin(yaw);
    const cy = my + lcx * Math.sin(yaw) + lcy * Math.cos(yaw);
    const cz = (zMin + zMax) / 2;

    const L = Math.max(0.2, lMaxX - lMinX);
    const W = Math.max(0.2, lMaxY - lMinY);
    const H = Math.max(0.2, zMax - zMin);

    if (!confirm(
      `Fit box theo ${n} điểm cloud?\n` +
      `L=${L.toFixed(2)} W=${W.toFixed(2)} H=${H.toFixed(2)}\n` +
      'Beta: pitch/roll sẽ bị reset về 0, chỉ giữ yaw. Kiểm tra lại trước khi Ctrl+S.'
    )) return;

    const newPoints = [...p];
    newPoints[0] = cx;
    newPoints[1] = cy;
    newPoints[2] = cz;
    newPoints[3] = 0;
    newPoints[4] = 0;
    newPoints[5] = yaw;
    newPoints[6] = L;
    newPoints[7] = W;
    newPoints[8] = H;

    const { jobInstance } = getCvatContext();
    pushSnapshot('Fit box to cloud', [snapshotItem(s, frame)]);
    s.points = newPoints;
    saveState(s, jobInstance);

    const restored = await refreshCanvas();
    setStatus(
      `🎯 Fit box #${id} theo ${n} điểm: L=${L.toFixed(2)} W=${W.toFixed(2)} H=${H.toFixed(2)}. ` +
      'Beta — kiểm tra lại!' +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'warn'
    );
  }

  // =========================================================================
  // Track features
  // =========================================================================
  async function shiftTrack() {
    const range = readRange();
    if (!range) return;

    const dx = numVal('cqt-shift-x') || 0;
    const dy = numVal('cqt-shift-y') || 0;
    const dz = numVal('cqt-shift-z') || 0;
    if (!dx && !dy && !dz) return setStatus('⚠️ Nhập ít nhất một giá trị dX/dY/dZ.', 'error');

    const keyframesOnly = document.querySelector('#cqt-track-keyframe-only').checked;

    const { changed } = await batchUpdate({
      ...range,
      label: `Shift (${dx}, ${dy}, ${dz})`,
      keyframesOnly,
      progress: true,
      apply: (s) => {
        const p = [...s.points];
        p[0] += dx;
        p[1] += dy;
        p[2] += dz;
        s.points = p;
        return true;
      },
    });

    if (!changed) return setStatus('⚠️ Không có frame nào được dịch.', 'error');
    const restored = await refreshCanvas();
    setStatus(
      `↔️ Đã dịch #${range.targetId} (${dx}, ${dy}, ${dz}) trên ${changed} frame. Ctrl+S để lưu.` +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  async function rotateTrack180() {
    const range = readRange();
    if (!range) return;
    const keyframesOnly = document.querySelector('#cqt-track-keyframe-only').checked;

    const { changed } = await batchUpdate({
      ...range,
      label: 'Rotate 180',
      keyframesOnly,
      progress: true,
      apply: (s) => {
        const p = [...s.points];
        p[5] += Math.PI;
        if (p[5] > Math.PI) p[5] -= Math.PI * 2;
        s.points = p;
        return true;
      },
    });

    if (!changed) return setStatus('⚠️ Không có frame nào được xoay.', 'error');
    const restored = await refreshCanvas();
    setStatus(
      `🔄 Đã xoay 180° #${range.targetId} trên ${changed} frame. Ctrl+S để lưu.` +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  async function smoothTrack() {
    const range = readRange();
    if (!range) return;

    const keyframes = [];
    for (let f = range.startFrame; f <= range.endFrame; f++) {
      const s = await getCurrentState(range.targetId, f);
      if (s?.points && s.points.length >= 9 && !s.outside && s.keyframe) {
        keyframes.push({ frame: f, state: s, points: [...s.points] });
      }
    }

    if (keyframes.length < 3) {
      return setStatus('⚠️ Cần ít nhất 3 keyframe trong dải để smooth.', 'error');
    }

    const { jobInstance } = getCvatContext();
    const snap = [];
    let changed = 0;

    for (let i = 1; i < keyframes.length - 1; i++) {
      const prev = keyframes[i - 1].points;
      const cur = keyframes[i].points;
      const next = keyframes[i + 1].points;
      const p = [...cur];
      for (let k = 0; k < 3; k++) {
        p[k] = prev[k] * 0.25 + cur[k] * 0.5 + next[k] * 0.25;
      }
      const delta = Math.abs(p[0] - cur[0]) + Math.abs(p[1] - cur[1]) + Math.abs(p[2] - cur[2]);
      if (delta < 1e-6) continue;

      snap.push(snapshotItem(keyframes[i].state, keyframes[i].frame));
      keyframes[i].state.points = p;
      saveState(keyframes[i].state, jobInstance);
      changed++;
    }

    if (!changed) return setStatus('ℹ️ Track đã mượt, không cần thay đổi.', 'success');
    pushSnapshot('Smooth track', snap);

    const restored = await refreshCanvas();
    setStatus(
      `〰️ Đã smooth vị trí ${changed}/${keyframes.length} keyframe của #${range.targetId}. Ctrl+S để lưu.` +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  async function decimateKeyframes() {
    const range = readRange();
    if (!range) return;

    const threshold = numVal('cqt-decimate-threshold');
    if (!(threshold >= 0)) return setStatus('⚠️ Ngưỡng decimate không hợp lệ!', 'error');

    const keyframes = [];
    for (let f = range.startFrame; f <= range.endFrame; f++) {
      const s = await getCurrentState(range.targetId, f);
      if (s?.points && s.points.length >= 9 && !s.outside && s.keyframe) {
        keyframes.push({ frame: f, state: s, points: [...s.points] });
      }
    }

    if (keyframes.length < 3) {
      return setStatus('⚠️ Cần ít nhất 3 keyframe để decimate.', 'error');
    }

    if (!confirm(
      `Decimate keyframe của #${range.targetId}?\n` +
      `${keyframes.length} keyframe, ngưỡng sai số ${threshold}m.\n` +
      'Keyframe dư sẽ bị gỡ (vẫn giữ 2 keyframe đầu/cuối). Có snapshot để restore.'
    )) return;

    const { jobInstance } = getCvatContext();
    const snap = [];
    let removed = 0;
    let i = 1;

    while (i < keyframes.length - 1) {
      const a = keyframes[i - 1];
      const b = keyframes[i];
      const c = keyframes[i + 1];
      const t = (b.frame - a.frame) / (c.frame - a.frame);

      let err = 0;
      for (let k = 0; k < 9; k++) {
        const interp = a.points[k] + (c.points[k] - a.points[k]) * t;
        err = Math.max(err, Math.abs(interp - b.points[k]));
      }

      if (err <= threshold) {
        snap.push(snapshotItem(b.state, b.frame));
        b.state.keyframe = false;
        saveState(b.state, jobInstance);
        keyframes.splice(i, 1);
        removed++;
      } else {
        i++;
      }
    }

    if (!removed) return setStatus(`ℹ️ Không có keyframe nào dư (ngưỡng ${threshold}m).`, 'success');
    pushSnapshot('Decimate keyframes', snap);

    const restored = await refreshCanvas();
    setStatus(
      `✂️ Đã gỡ ${removed} keyframe dư của #${range.targetId} (còn ${keyframes.length}). Ctrl+S để lưu.` +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  async function resampleKeyframes() {
    const range = readRange();
    if (!range) return;

    const step = intVal('cqt-resample-step');
    if (!Number.isInteger(step) || step < 2) return setStatus('⚠️ Bước resample phải >= 2.', 'error');

    if (!confirm(
      `Thêm keyframe mỗi ${step} frame cho #${range.targetId} trong dải ${range.startFrame}–${range.endFrame}?\n` +
      'Thao tác này có thể tạo rất nhiều keyframe.'
    )) return;

    const { jobInstance } = getCvatContext();
    const snap = [];
    let added = 0;

    for (let f = range.startFrame; f <= range.endFrame; f += step) {
      const s = await getCurrentState(range.targetId, f);
      if (!s?.points || s.outside || s.keyframe) continue;

      snap.push(snapshotItem(s, f));
      s.keyframe = true;
      saveState(s, jobInstance);
      added++;
    }

    if (!added) return setStatus('ℹ️ Không có frame nào cần thêm keyframe.', 'success');
    pushSnapshot('Resample keyframes', snap);

    const restored = await refreshCanvas();
    setStatus(
      `➕ Đã thêm ${added} keyframe (mỗi ${step} frame) cho #${range.targetId}. Ctrl+S để lưu.` +
      (restored ? '' : ' ⚠️ Chưa tự về frame cũ.'),
      'success'
    );
  }

  // =========================================================================
  // QA features
  // =========================================================================
  let lastQARows = [];
  let lastQAMeta = null;

  function readFrameRange() {
    const startFrame = intVal('cqt-frame-start');
    const endFrame = intVal('cqt-frame-end');
    if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame) || startFrame > endFrame) {
      setStatus('⚠️ Dải frame không hợp lệ (Start <= End)!', 'error');
      return null;
    }
    return { startFrame, endFrame };
  }

  async function scanQA() {
    const range = readFrameRange();
    if (!range) return;

    const groundZ = numVal('cqt-ground-z');
    const { jobInstance } = getCvatContext();
    if (!jobInstance) return setStatus('⚠️ Chưa kết nối CVAT Job!', 'error');

    setStatus('⏳ Đang quét QA...');
    const byId = new Map();

    for (let f = range.startFrame; f <= range.endFrame; f++) {
      if (f > range.startFrame && (f - range.startFrame) % 25 === 0) {
        setStatus(`⏳ QA: frame ${f}/${range.endFrame}...`);
      }
      const states = await jobInstance.annotations.get(f, true);
      for (const s of states) {
        if (!s.points || s.points.length < 9 || s.outside) continue;

        let rec = byId.get(s.clientID);
        if (!rec) {
          rec = {
            id: s.clientID,
            label: typeof s.label === 'string' ? s.label : (s.label?.name || ''),
            frames: 0,
            keyframes: 0,
            minGap: Infinity,
            maxGap: -Infinity,
            minL: Infinity,
            maxL: -Infinity,
            minW: Infinity,
            maxW: -Infinity,
            minH: Infinity,
            maxH: -Infinity,
            first: f,
            last: f,
          };
          byId.set(s.clientID, rec);
        }

        rec.frames++;
        rec.last = f;
        if (s.keyframe) rec.keyframes++;
        if (Number.isFinite(groundZ)) {
          const gap = bottomZ(s.points) - groundZ;
          rec.minGap = Math.min(rec.minGap, gap);
          rec.maxGap = Math.max(rec.maxGap, gap);
        }
        rec.minL = Math.min(rec.minL, s.points[6]);
        rec.maxL = Math.max(rec.maxL, s.points[6]);
        rec.minW = Math.min(rec.minW, s.points[7]);
        rec.maxW = Math.max(rec.maxW, s.points[7]);
        rec.minH = Math.min(rec.minH, s.points[8]);
        rec.maxH = Math.max(rec.maxH, s.points[8]);
      }
    }

    if (!byId.size) {
      return setStatus('⚠️ Không có cuboid nào trong dải.', 'error');
    }

    const presets = getPresets();
    const rows = [];
    const lines = [];

    for (const rec of byId.values()) {
      const issues = [];

      const gapAbs = Number.isFinite(rec.minGap)
        ? Math.max(Math.abs(rec.minGap), Math.abs(rec.maxGap))
        : null;
      if (gapAbs !== null && gapAbs > 0.05) issues.push(`đáy lệch ${gapAbs.toFixed(2)}m`);

      let sizeDev = null;
      const preset = presets[rec.label];
      const lim = getLimitsForLabel(rec.label);
      const ref = preset || (lim ? {
        l: (lim.l[0] + lim.l[1]) / 2,
        w: (lim.w[0] + lim.w[1]) / 2,
        h: (lim.h[0] + lim.h[1]) / 2,
      } : null);

      if (ref) {
        sizeDev = Math.max(
          Math.abs((rec.maxL + rec.minL) / 2 - ref.l) / ref.l,
          Math.abs((rec.maxW + rec.minW) / 2 - ref.w) / ref.w,
          Math.abs((rec.maxH + rec.minH) / 2 - ref.h) / ref.h
        );
        if (sizeDev > 0.25) issues.push(`size lệch ${(sizeDev * 100).toFixed(0)}%`);
      }

      if (lim) {
        const avgL = (rec.maxL + rec.minL) / 2;
        const avgW = (rec.maxW + rec.minW) / 2;
        const avgH = (rec.maxH + rec.minH) / 2;
        if (
          avgL < lim.l[0] - 1e-9 || avgL > lim.l[1] + 1e-9 ||
          avgW < lim.w[0] - 1e-9 || avgW > lim.w[1] + 1e-9 ||
          avgH < lim.h[0] - 1e-9 || avgH > lim.h[1] + 1e-9
        ) issues.push('ngoài limits LWH');
      }

      if (rec.frames > 10 && rec.keyframes / rec.frames > 0.8) issues.push('keyframe quá dày');
      if (rec.frames < 3) issues.push('track quá ngắn');

      rows.push({
        id: rec.id,
        label: rec.label,
        frames: rec.frames,
        keyframes: rec.keyframes,
        gapMin: Number.isFinite(rec.minGap) ? rec.minGap : '',
        gapMax: Number.isFinite(rec.maxGap) ? rec.maxGap : '',
        sizeDev: sizeDev === null ? '' : sizeDev,
        issues: issues.join('; '),
      });

      if (issues.length) {
        lines.push(
          `#${rec.id} [${rec.label}] · ${rec.frames}f/${rec.keyframes}kf · ${issues.join(', ')}`
        );
      }
    }

    rows.sort((a, b) => b.issues.length - a.issues.length || a.id - b.id);
    lastQARows = rows;
    lastQAMeta = { ...range, groundZ, at: Date.now() };

    const withIssues = rows.filter((r) => r.issues).length;
    const header =
      `QA ${range.startFrame}–${range.endFrame}: ${rows.length} object, ` +
      `${withIssues} có vấn đề` +
      (Number.isFinite(groundZ) ? ` (ground Z=${groundZ})` : ' (chưa có ground Z)') +
      '.';

    const body = lines.length
      ? lines.slice(0, 40).join('\n') + (lines.length > 40 ? `\n... +${lines.length - 40} dòng` : '')
      : 'Không phát hiện vấn đề.';

    const pre = document.querySelector('#cqt-qa-result');
    if (pre) pre.textContent = `${header}\n\n${body}`;

    setStatus(header, withIssues ? 'warn' : 'success');
  }

  function csvEscape(value) {
    const s = String(value ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportQA() {
    if (!lastQARows.length) return setStatus('⚠️ Chưa có dữ liệu QA. Bấm "Quét QA" trước.', 'error');

    const header = 'clientID,label,frames,keyframes,gap_min,gap_max,size_dev,issues';
    const lines = [header];
    for (const r of lastQARows) {
      lines.push([
        r.id, r.label, r.frames, r.keyframes,
        typeof r.gapMin === 'number' ? r.gapMin.toFixed(3) : '',
        typeof r.gapMax === 'number' ? r.gapMax.toFixed(3) : '',
        typeof r.sizeDev === 'number' ? (r.sizeDev * 100).toFixed(1) + '%' : '',
        r.issues,
      ].map(csvEscape).join(','));
    }

    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const jobId = getCvatContext().jobInstance?.id || 'job';
    a.href = url;
    a.download = `cvat_qa_${jobId}_${lastQAMeta?.startFrame ?? 0}-${lastQAMeta?.endFrame ?? 0}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setStatus(`📤 Đã export ${lastQARows.length} dòng CSV.`, 'success');
  }

})();