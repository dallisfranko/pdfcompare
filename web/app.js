import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";

/** Bump this when shipping UI changes so users can confirm they loaded the new build. */
const APP_VERSION = "0.6.0";
const MAX_VIEW_ZOOM = 8;
const MIN_VIEW_ZOOM = 0.05;
/** Marker size in screen pixels (does not grow when you zoom the drawing). */
const MARKER_SCREEN_PX = 7;

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.min.mjs",
  import.meta.url
).toString();

const COLOR_A = { r: 198, g: 40, b: 40 };   // red
const COLOR_B = { r: 21, g: 101, b: 192 };  // blue

const state = {
  docA: null,
  docB: null,
  bytesA: null,
  bytesB: null,
  nameA: null,
  nameB: null,
  pageA: 1,
  pageB: 1,
  pageCountA: 0,
  pageCountB: 0,
  opacity: 1,
  viewZoom: 1,
  panX: 0,
  panY: 0,
  bitmapA: null,
  bitmapB: null,
  tintedA: null,
  tintedB: null,
  // similarity transform mapping B -> A space
  transform: null,
  alignStep: "idle", // idle | a1 | b1 | a2 | b2
  alignPoints: { a1: null, b1: null, a2: null, b2: null },
  snapPreview: null, // { x, y, snapped } while aligning
};

const els = {
  fileA: document.getElementById("fileA"),
  fileB: document.getElementById("fileB"),
  nameA: document.getElementById("nameA"),
  nameB: document.getElementById("nameB"),
  pageA: document.getElementById("pageA"),
  pageB: document.getElementById("pageB"),
  pageMeta: document.getElementById("pageMeta"),
  prevBoth: document.getElementById("prevBoth"),
  nextBoth: document.getElementById("nextBoth"),
  opacity: document.getElementById("opacity"),
  opacityLabel: document.getElementById("opacityLabel"),
  status: document.getElementById("status"),
  alignStatus: document.getElementById("alignStatus"),
  overlayCanvas: document.getElementById("overlayCanvas"),
  viewport: document.getElementById("viewport"),
  viewportInner: document.getElementById("viewportInner"),
  zoomLabel: document.getElementById("zoomLabel"),
  alignStartBtn: document.getElementById("alignStartBtn"),
  alignCancelBtn: document.getElementById("alignCancelBtn"),
  snapContent: document.getElementById("snapContent"),
  alignRef: document.getElementById("alignRef"),
  alignRefTitle: document.getElementById("alignRefTitle"),
  alignRefCanvas: document.getElementById("alignRefCanvas"),
};

function setStatus(message) {
  els.status.textContent = message;
}

function setViewportEmpty(isEmpty) {
  els.viewport.classList.toggle("is-empty", isEmpty);
}

function setAlignStatus(message) {
  els.alignStatus.textContent = message;
}

function applyViewTransform() {
  els.viewportInner.style.transform =
    `translate(${state.panX}px, ${state.panY}px) scale(${state.viewZoom})`;
  els.zoomLabel.textContent = `${Math.round(state.viewZoom * 100)}%`;
}

function fitToViewport() {
  const canvas = els.overlayCanvas;
  if (!canvas.width || !canvas.height) return;
  const rect = els.viewport.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;
  const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height) * 0.98;
  state.viewZoom = Math.max(MIN_VIEW_ZOOM, Math.min(MAX_VIEW_ZOOM, scale));
  state.panX = (rect.width - canvas.width * state.viewZoom) / 2;
  state.panY = (rect.height - canvas.height * state.viewZoom) / 2;
  applyViewTransform();
}

async function destroyDoc(which) {
  const docKey = which === "A" ? "docA" : "docB";
  const bytesKey = which === "A" ? "bytesA" : "bytesB";
  const nameKey = which === "A" ? "nameA" : "nameB";
  if (state[docKey]) {
    await state[docKey].destroy();
    state[docKey] = null;
  }
  state[bytesKey] = null;
  state[nameKey] = null;
}

function resetAlignment(keepMessage = false) {
  state.transform = null;
  state.alignStep = "idle";
  state.alignPoints = { a1: null, b1: null, a2: null, b2: null };
  state.snapPreview = null;
  hideAlignReference();
  els.viewport.classList.remove("aligning");
  els.alignStartBtn.hidden = false;
  els.alignCancelBtn.hidden = true;
  if (!keepMessage) setAlignStatus("Alignment: none");
}

function hideAlignReference() {
  if (!els.alignRef) return;
  els.alignRef.hidden = true;
}

/** Show a crop of the landmark just picked so the matching spot is easier to find on the other PDF. */
function showAlignReference(sourceCanvas, pt, title) {
  if (!els.alignRef || !sourceCanvas || !pt) {
    hideAlignReference();
    return;
  }
  const pad = 90;
  const sx = Math.max(0, Math.round(pt.x - pad));
  const sy = Math.max(0, Math.round(pt.y - pad));
  const sw = Math.min(sourceCanvas.width - sx, pad * 2);
  const sh = Math.min(sourceCanvas.height - sy, pad * 2);
  const out = els.alignRefCanvas;
  const size = 160;
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  if (sw > 0 && sh > 0) {
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, size, size);
  }
  const lx = ((pt.x - sx) / Math.max(sw, 1)) * size;
  const ly = ((pt.y - sy) / Math.max(sh, 1)) * size;
  ctx.strokeStyle = "#ffd54f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lx - 14, ly);
  ctx.lineTo(lx + 14, ly);
  ctx.moveTo(lx, ly - 14);
  ctx.lineTo(lx, ly + 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(lx, ly, 6, 0, Math.PI * 2);
  ctx.stroke();
  els.alignRefTitle.textContent = title;
  els.alignRef.hidden = false;
}

/** Keep the current zoom; only re-center when the shown page size changes a lot. */
function showAlignDocument(fit = false) {
  composeOverlay();
  if (fit) fitToViewport();
  else applyViewTransform();
}

async function clearEverything() {
  await destroyDoc("A");
  await destroyDoc("B");
  state.bitmapA = null;
  state.bitmapB = null;
  state.tintedA = null;
  state.tintedB = null;
  state.pageA = 1;
  state.pageB = 1;
  state.pageCountA = 0;
  state.pageCountB = 0;
  state.opacity = 1;
  state.viewZoom = 1;
  state.panX = 0;
  state.panY = 0;
  resetAlignment();

  els.fileA.value = "";
  els.fileB.value = "";
  els.nameA.textContent = "No file chosen";
  els.nameB.textContent = "No file chosen";
  els.pageA.innerHTML = "";
  els.pageB.innerHTML = "";
  els.pageA.disabled = true;
  els.pageB.disabled = true;
  els.opacity.value = "1";
  els.opacityLabel.textContent = "100%";
  els.overlayCanvas.width = 0;
  els.overlayCanvas.height = 0;
  updatePageControls();
  applyViewTransform();
  setViewportEmpty(true);
  setStatus("Cleared.");
}

function fillPageSelect(select, count, selected) {
  select.innerHTML = "";
  for (let i = 1; i <= count; i += 1) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = String(i);
    if (i === selected) opt.selected = true;
    select.appendChild(opt);
  }
  select.disabled = count < 1;
}

function syncSelect(select, count, page) {
  if (select.options.length !== count) {
    fillPageSelect(select, count, page);
  } else if (count > 0) {
    select.value = String(page);
    select.disabled = false;
  } else {
    select.disabled = true;
  }
}

function updatePageControls() {
  const hasA = state.pageCountA > 0;
  const hasB = state.pageCountB > 0;
  const ready = hasA && hasB;

  syncSelect(els.pageA, state.pageCountA, state.pageA);
  syncSelect(els.pageB, state.pageCountB, state.pageB);

  els.prevBoth.disabled = !ready || (state.pageA <= 1 && state.pageB <= 1);
  els.nextBoth.disabled =
    !ready ||
    (state.pageA >= state.pageCountA && state.pageB >= state.pageCountB);

  if (!hasA && !hasB) {
    els.pageMeta.textContent = "Load both PDFs";
  } else if (!ready) {
    els.pageMeta.textContent = "Choose the other PDF";
  } else {
    els.pageMeta.innerHTML =
      `<span class="meta-a">A ${state.pageA}/${state.pageCountA}</span>` +
      ` · ` +
      `<span class="meta-b">B ${state.pageB}/${state.pageCountB}</span>`;
  }
}

async function setPage(which, page, { fit = true } = {}) {
  if (which === "A") {
    if (!state.pageCountA) return;
    const next = Math.min(Math.max(1, page), state.pageCountA);
    if (next === state.pageA && els.pageA.value === String(next)) {
      updatePageControls();
      return;
    }
    state.pageA = next;
    els.pageA.value = String(next);
  } else {
    if (!state.pageCountB) return;
    const next = Math.min(Math.max(1, page), state.pageCountB);
    if (next === state.pageB && els.pageB.value === String(next)) {
      updatePageControls();
      return;
    }
    state.pageB = next;
    els.pageB.value = String(next);
  }

  resetAlignment();
  updatePageControls();
  if (state.docA && state.docB) {
    await refresh(true, fit);
  }
}

async function stepPages(delta) {
  if (!(state.pageCountA > 0 && state.pageCountB > 0)) return;

  const nextA = Math.min(Math.max(1, state.pageA + delta), state.pageCountA);
  const nextB = Math.min(Math.max(1, state.pageB + delta), state.pageCountB);
  if (nextA === state.pageA && nextB === state.pageB) {
    updatePageControls();
    return;
  }

  state.pageA = nextA;
  state.pageB = nextB;
  els.pageA.value = String(nextA);
  els.pageB.value = String(nextB);

  resetAlignment();
  updatePageControls();
  await refresh(true, true);
}

async function loadPdf(file, which) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0));
  const pdf = await pdfjsLib.getDocument({ data: bytes, useSystemFonts: true }).promise;

  await destroyDoc(which);
  if (which === "A") {
    state.docA = pdf;
    state.bytesA = bytes;
    state.nameA = file.name;
    state.pageCountA = pdf.numPages;
    state.pageA = 1;
    els.nameA.textContent = file.name;
    fillPageSelect(els.pageA, pdf.numPages, 1);
  } else {
    state.docB = pdf;
    state.bytesB = bytes;
    state.nameB = file.name;
    state.pageCountB = pdf.numPages;
    state.pageB = 1;
    els.nameB.textContent = file.name;
    fillPageSelect(els.pageB, pdf.numPages, 1);
  }

  resetAlignment();
  updatePageControls();
  setStatus(`Loaded ${file.name}`);
  await refresh(true, true);
}

async function renderPage(pdf, pageNumber, scale = 2.25) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Turn page ink into a solid tint so differences read like Bluebeam. */
function tintCanvas(source, { r, g, b }) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const ink = 1 - lum / 255;
    data[i] = Math.round(255 - ink * (255 - r));
    data[i + 1] = Math.round(255 - ink * (255 - g));
    data[i + 2] = Math.round(255 - ink * (255 - b));
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function computeSimilarity(a1, a2, b1, b2) {
  const ax = a2.x - a1.x;
  const ay = a2.y - a1.y;
  const bx = b2.x - b1.x;
  const by = b2.y - b1.y;
  const aLen = Math.hypot(ax, ay);
  const bLen = Math.hypot(bx, by);
  if (aLen < 2 || bLen < 2) {
    throw new Error("Pick two points that are farther apart.");
  }
  return {
    scale: aLen / bLen,
    rot: Math.atan2(ay, ax) - Math.atan2(by, bx),
    a1,
    b1,
  };
}

function composeOverlay() {
  const canvasA = state.tintedA;
  const canvasB = state.tintedB;
  if (!canvasA || !canvasB) return;

  // During alignment steps, show only the active document so clicks are obvious.
  if (state.alignStep === "a1" || state.alignStep === "a2") {
    els.overlayCanvas.width = canvasA.width;
    els.overlayCanvas.height = canvasA.height;
    const ctx = els.overlayCanvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvasA.width, canvasA.height);
    ctx.drawImage(canvasA, 0, 0);
    drawAlignMarkers(ctx, "A");
    return;
  }
  if (state.alignStep === "b1" || state.alignStep === "b2") {
    els.overlayCanvas.width = canvasB.width;
    els.overlayCanvas.height = canvasB.height;
    const ctx = els.overlayCanvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvasB.width, canvasB.height);
    ctx.drawImage(canvasB, 0, 0);
    drawAlignMarkers(ctx, "B");
    return;
  }

  const width = Math.max(canvasA.width, canvasB.width);
  const height = Math.max(canvasA.height, canvasB.height);
  const out = els.overlayCanvas;
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Multiply blend: matching content goes dark; unique content stays red or blue.
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(canvasA, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = state.opacity;
  if (state.transform) {
    const t = state.transform;
    const cos = Math.cos(t.rot);
    const sin = Math.sin(t.rot);
    // Maps B local coords into A space.
    ctx.setTransform(
      t.scale * cos,
      t.scale * sin,
      -t.scale * sin,
      t.scale * cos,
      t.a1.x - (t.b1.x * t.scale * cos - t.b1.y * t.scale * sin),
      t.a1.y - (t.b1.x * t.scale * sin + t.b1.y * t.scale * cos)
    );
    ctx.drawImage(canvasB, 0, 0);
  } else {
    ctx.drawImage(canvasB, 0, 0);
  }
  ctx.restore();
}

function drawAlignMarkers(ctx, which) {
  const pts = state.alignPoints;
  const markers =
    which === "A"
      ? [
          ["1", pts.a1],
          ["2", pts.a2],
        ]
      : [
          ["1", pts.b1],
          ["2", pts.b2],
        ];
  for (const [label, pt] of markers) {
    if (!pt) continue;
    drawPointMarker(ctx, pt, label, which === "A" ? "#c62828" : "#1565c0", pt.snapped);
  }

  if (
    state.snapPreview &&
    ((which === "A" && (state.alignStep === "a1" || state.alignStep === "a2")) ||
      (which === "B" && (state.alignStep === "b1" || state.alignStep === "b2")))
  ) {
    drawSnapPreview(ctx, state.snapPreview);
  }
}

function drawPointMarker(ctx, pt, label, color, snapped) {
  const z = Math.max(state.viewZoom, 0.01);
  const r = MARKER_SCREEN_PX / z;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2 / z;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  if (snapped) {
    const s = (MARKER_SCREEN_PX + 3) / z;
    ctx.beginPath();
    ctx.moveTo(pt.x - s, pt.y);
    ctx.lineTo(pt.x + s, pt.y);
    ctx.moveTo(pt.x, pt.y - s);
    ctx.lineTo(pt.x, pt.y + s);
    ctx.strokeStyle = "#ffd54f";
    ctx.lineWidth = 2 / z;
    ctx.stroke();
  }
  ctx.fillStyle = "#111";
  ctx.font = `bold ${12 / z}px sans-serif`;
  ctx.fillText(label, pt.x + (MARKER_SCREEN_PX + 4) / z, pt.y - (MARKER_SCREEN_PX + 2) / z);
}

function drawSnapPreview(ctx, preview) {
  const z = Math.max(state.viewZoom, 0.01);
  const r = ((preview.snapped ? MARKER_SCREEN_PX + 2 : MARKER_SCREEN_PX - 1)) / z;
  ctx.beginPath();
  ctx.arc(preview.x, preview.y, r, 0, Math.PI * 2);
  ctx.strokeStyle = preview.snapped ? "#ffd54f" : "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2 / z;
  ctx.stroke();
  if (preview.snapped) {
    const s = (MARKER_SCREEN_PX + 4) / z;
    ctx.beginPath();
    ctx.moveTo(preview.x - s, preview.y);
    ctx.lineTo(preview.x + s, preview.y);
    ctx.moveTo(preview.x, preview.y - s);
    ctx.lineTo(preview.x, preview.y + s);
    ctx.stroke();
  }
}

/**
 * Snap to nearby drawing corners / endpoints (Bluebeam-style, on raster ink).
 * Uses adaptive ink threshold + Harris corners so thick CAD lines still snap.
 */
function findSnapPoint(sourceCanvas, x, y, screenRadius = 32) {
  if (!sourceCanvas) return { x, y, snapped: false };

  const searchRadius = Math.max(
    14,
    Math.min(96, Math.round(screenRadius / Math.max(state.viewZoom, 0.12)))
  );

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (cx < -searchRadius || cy < -searchRadius || cx >= w + searchRadius || cy >= h + searchRadius) {
    return { x, y, snapped: false };
  }

  const x0 = Math.max(0, cx - searchRadius);
  const y0 = Math.max(0, cy - searchRadius);
  const x1 = Math.min(w - 1, cx + searchRadius);
  const y1 = Math.min(h - 1, cy + searchRadius);
  const rw = x1 - x0 + 1;
  const rh = y1 - y0 + 1;
  if (rw < 5 || rh < 5) return { x, y, snapped: false };

  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const img = ctx.getImageData(x0, y0, rw, rh);
  const data = img.data;
  const gray = new Float32Array(rw * rh);
  let sum = 0;
  let count = 0;

  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    const lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    gray[i] = lum;
    sum += lum;
    count += 1;
  }

  const mean = sum / Math.max(count, 1);
  // Plans are mostly white paper; ink can be gray anti-aliased lines.
  const inkCut = Math.min(242, Math.max(170, mean - 18));
  const ink = new Uint8Array(rw * rh);
  for (let i = 0; i < gray.length; i += 1) {
    ink[i] = gray[i] < inkCut ? 1 : 0;
  }

  const dirs = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
  ];

  const candidates = [];

  // Pass 1: Harris corner response on grayscale (great for corners of walls/boxes).
  for (let ly = 2; ly < rh - 2; ly += 1) {
    for (let lx = 2; lx < rw - 2; lx += 1) {
      const i = ly * rw + lx;
      const ix =
        -gray[i - rw - 1] +
        gray[i - rw + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + rw - 1] +
        gray[i + rw + 1];
      const iy =
        -gray[i - rw - 1] -
        2 * gray[i - rw] -
        gray[i - rw + 1] +
        gray[i + rw - 1] +
        2 * gray[i + rw] +
        gray[i + rw + 1];
      const a = ix * ix;
      const b = ix * iy;
      const c = iy * iy;
      const det = a * c - b * b;
      const trace = a + c;
      const harris = det - 0.05 * trace * trace;
      if (harris < 1200) continue;

      // Prefer responses that sit on/near ink.
      let nearInk = ink[i];
      if (!nearInk) {
        for (const [dx, dy] of dirs) {
          if (ink[(ly + dy) * rw + (lx + dx)]) {
            nearInk = 1;
            break;
          }
        }
      }
      if (!nearInk) continue;

      const px = x0 + lx;
      const py = y0 + ly;
      const dist = Math.hypot(px - x, py - y);
      if (dist <= searchRadius) {
        candidates.push({ x: px, y: py, score: 50 + Math.min(harris / 80, 80), dist });
      }
    }
  }

  // Pass 2: morphological endpoints / junctions on binary ink (line tips).
  for (let ly = 1; ly < rh - 1; ly += 1) {
    for (let lx = 1; lx < rw - 1; lx += 1) {
      const idx = ly * rw + lx;
      if (!ink[idx]) continue;

      let neighbors = 0;
      let transitions = 0;
      let prev = ink[(ly + dirs[7][1]) * rw + (lx + dirs[7][0])];
      for (const [dx, dy] of dirs) {
        const v = ink[(ly + dy) * rw + (lx + dx)];
        neighbors += v;
        if (v !== prev) transitions += 1;
        prev = v;
      }

      let score = 0;
      if (neighbors === 1) score = 120; // true endpoint
      else if (neighbors === 2 && transitions >= 4) score = 95; // bend / corner
      else if (neighbors === 0) score = 40; // isolated speck — weak
      else if (neighbors >= 3) score = 90; // junction
      else if (transitions >= 6) score = 85;
      if (!score) continue;

      const px = x0 + lx;
      const py = y0 + ly;
      const dist = Math.hypot(px - x, py - y);
      if (dist <= searchRadius) candidates.push({ x: px, y: py, score, dist });
    }
  }

  if (candidates.length) {
    // Prefer high score, then closeness. Strong local magnet.
    candidates.sort((a, b) => b.score - a.score || a.dist - b.dist);
    const top = candidates[0].score;
    const best = candidates
      .filter((c) => c.score >= top - 30)
      .sort((a, b) => a.dist - b.dist)[0];
    return { x: best.x, y: best.y, snapped: true };
  }

  // Pass 3: nearest ink edge pixel (still better than free space).
  let nearest = null;
  for (let ly = 1; ly < rh - 1; ly += 1) {
    for (let lx = 1; lx < rw - 1; lx += 1) {
      const idx = ly * rw + lx;
      if (!ink[idx]) continue;
      let paperTouch = false;
      for (const [dx, dy] of dirs) {
        if (!ink[(ly + dy) * rw + (lx + dx)]) {
          paperTouch = true;
          break;
        }
      }
      if (!paperTouch) continue;
      const px = x0 + lx;
      const py = y0 + ly;
      const dist = Math.hypot(px - x, py - y);
      if (!nearest || dist < nearest.dist) nearest = { x: px, y: py, dist };
    }
  }
  if (nearest && nearest.dist <= searchRadius) {
    return { x: nearest.x, y: nearest.y, snapped: true };
  }

  return { x, y, snapped: false };
}

function activeAlignBitmap() {
  if (state.alignStep === "a1" || state.alignStep === "a2") return state.bitmapA;
  if (state.alignStep === "b1" || state.alignStep === "b2") return state.bitmapB;
  return null;
}

function applySnapIfEnabled(pt) {
  if (!els.snapContent.checked) return { ...pt, snapped: false };
  const bitmap = activeAlignBitmap();
  let snapped = findSnapPoint(bitmap, pt.x, pt.y, 34);
  // Second try with a wider magnet if the first pass missed.
  if (!snapped.snapped) {
    snapped = findSnapPoint(bitmap, pt.x, pt.y, 56);
  }
  return snapped;
}

async function refresh(reRender = true, fit = false) {
  if (!state.docA || !state.docB) return;
  try {
    if (reRender) {
      setStatus("Rendering pages…");
      const [canvasA, canvasB] = await Promise.all([
        renderPage(state.docA, state.pageA),
        renderPage(state.docB, state.pageB),
      ]);
      state.bitmapA = canvasA;
      state.bitmapB = canvasB;
      state.tintedA = tintCanvas(canvasA, COLOR_A);
      state.tintedB = tintCanvas(canvasB, COLOR_B);
    }
    composeOverlay();
    setViewportEmpty(false);
    if (fit) fitToViewport();
    else applyViewTransform();

    if (state.alignStep === "idle") {
      setStatus(
        `Ready — A p.${state.pageA}/${state.pageCountA} · B p.${state.pageB}/${state.pageCountB}`
      );
    }
    updatePageControls();
  } catch (err) {
    setStatus(`Could not render: ${err.message || err}`);
  }
}

function canvasPointFromEvent(event) {
  const rect = els.viewport.getBoundingClientRect();
  const x = (event.clientX - rect.left - state.panX) / state.viewZoom;
  const y = (event.clientY - rect.top - state.panY) / state.viewZoom;
  return { x, y };
}

function startAlign() {
  if (!state.tintedA || !state.tintedB) {
    setStatus("Open both PDFs before aligning.");
    return;
  }
  state.alignStep = "a1";
  state.alignPoints = { a1: null, b1: null, a2: null, b2: null };
  state.transform = null;
  state.snapPreview = null;
  hideAlignReference();
  els.viewport.classList.add("aligning");
  els.alignStartBtn.hidden = true;
  els.alignCancelBtn.hidden = false;
  setAlignStatus("Step 1/4: click landmark on A (red)");
  setStatus("Zoom in on A, hover until the yellow snap locks, then click.");
  showAlignDocument(true);
}

function cancelAlign() {
  resetAlignment();
  composeOverlay();
  fitToViewport();
  setStatus("Align cancelled.");
}

function handleAlignClick(pt) {
  const snapped = applySnapIfEnabled(pt);
  state.snapPreview = null;
  const step = state.alignStep;

  if (step === "a1") {
    state.alignPoints.a1 = snapped;
    state.alignStep = "b1";
    showAlignReference(state.bitmapA, snapped, "Match this on B (blue)");
    setAlignStatus("Step 2/4: click matching landmark on B");
    setStatus(
      snapped.snapped
        ? "Snapped on A. On B: pan to the same feature (preview), wait for yellow snap, click."
        : "On B: pan to the same feature (preview), wait for yellow snap, click."
    );
    showAlignDocument(true);
    return;
  }

  if (step === "b1") {
    state.alignPoints.b1 = snapped;
    state.alignStep = "a2";
    hideAlignReference();
    setAlignStatus("Step 3/4: click 2nd landmark on A");
    setStatus("On A: pick a second corner far from #1.");
    showAlignDocument(true);
    return;
  }

  if (step === "a2") {
    state.alignPoints.a2 = snapped;
    state.alignStep = "b2";
    showAlignReference(state.bitmapA, snapped, "Match #2 on B (blue)");
    setAlignStatus("Step 4/4: click matching #2 on B");
    setStatus("On B: find landmark #2 from the preview, snap, click.");
    showAlignDocument(true);
    return;
  }

  if (step === "b2") {
    state.alignPoints.b2 = snapped;
    try {
      state.transform = computeSimilarity(
        state.alignPoints.a1,
        state.alignPoints.a2,
        state.alignPoints.b1,
        state.alignPoints.b2
      );
      state.alignStep = "idle";
      state.snapPreview = null;
      hideAlignReference();
      els.viewport.classList.remove("aligning");
      els.alignStartBtn.hidden = false;
      els.alignCancelBtn.hidden = true;
      setAlignStatus(
        `Aligned (scale ${state.transform.scale.toFixed(3)}, rot ${(
          (state.transform.rot * 180) /
          Math.PI
        ).toFixed(1)}°)`
      );
      setStatus("Aligned — B mapped onto A.");
      composeOverlay();
      fitToViewport();
    } catch (err) {
      setStatus(`Align failed: ${err.message || err}`);
      resetAlignment();
      composeOverlay();
      fitToViewport();
    }
  }
}

// ---- pointer pan / align click ----
const pan = {
  active: false,
  moved: false,
  startX: 0,
  startY: 0,
  origPanX: 0,
  origPanY: 0,
  pointerId: null,
};
let snapPreviewRaf = 0;

els.viewport.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  els.viewport.setPointerCapture(event.pointerId);
  pan.active = true;
  pan.moved = false;
  pan.startX = event.clientX;
  pan.startY = event.clientY;
  pan.origPanX = state.panX;
  pan.origPanY = state.panY;
  pan.pointerId = event.pointerId;
});

els.viewport.addEventListener("pointermove", (event) => {
  if (pan.active && event.pointerId === pan.pointerId) {
    const dx = event.clientX - pan.startX;
    const dy = event.clientY - pan.startY;
    if (Math.hypot(dx, dy) > 4) pan.moved = true;
    if (state.alignStep === "idle" || pan.moved) {
      state.panX = pan.origPanX + dx;
      state.panY = pan.origPanY + dy;
      applyViewTransform();
    }
    return;
  }

  // Live snap preview while aligning (when not dragging).
  if (state.alignStep !== "idle" && els.snapContent.checked) {
    const preview = applySnapIfEnabled(canvasPointFromEvent(event));
    const prev = state.snapPreview;
    if (
      !prev ||
      prev.x !== preview.x ||
      prev.y !== preview.y ||
      prev.snapped !== preview.snapped
    ) {
      state.snapPreview = preview;
      if (!snapPreviewRaf) {
        snapPreviewRaf = requestAnimationFrame(() => {
          snapPreviewRaf = 0;
          if (state.alignStep !== "idle") composeOverlay();
        });
      }
    }
  } else if (state.snapPreview) {
    state.snapPreview = null;
    if (state.alignStep !== "idle") composeOverlay();
  }
});

function endPointer(event) {
  if (!pan.active || event.pointerId !== pan.pointerId) return;
  pan.active = false;
  const wasClick = !pan.moved;
  pan.moved = false;
  pan.pointerId = null;
  if (wasClick && state.alignStep !== "idle") {
    handleAlignClick(canvasPointFromEvent(event));
  }
}

els.viewport.addEventListener("pointerup", endPointer);
els.viewport.addEventListener("pointercancel", endPointer);

els.viewport.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const rect = els.viewport.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const beforeX = (mx - state.panX) / state.viewZoom;
    const beforeY = (my - state.panY) / state.viewZoom;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    state.viewZoom = Math.min(MAX_VIEW_ZOOM, Math.max(MIN_VIEW_ZOOM, state.viewZoom * factor));
    state.panX = mx - beforeX * state.viewZoom;
    state.panY = my - beforeY * state.viewZoom;
    applyViewTransform();
  },
  { passive: false }
);

// ---- controls ----
els.fileA.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await loadPdf(file, "A");
  } catch (err) {
    setStatus(`Could not open PDF A: ${err.message || err}`);
  }
});

els.fileB.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    await loadPdf(file, "B");
  } catch (err) {
    setStatus(`Could not open PDF B: ${err.message || err}`);
  }
});

els.pageA.addEventListener("change", async () => {
  await setPage("A", Number(els.pageA.value) || 1, { fit: true });
});

els.pageB.addEventListener("change", async () => {
  await setPage("B", Number(els.pageB.value) || 1, { fit: true });
});

els.prevBoth.addEventListener("click", async () => stepPages(-1));
els.nextBoth.addEventListener("click", async () => stepPages(1));

window.addEventListener("keydown", async (event) => {
  if (event.target && ["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) {
    return;
  }
  if (state.alignStep !== "idle") return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    await stepPages(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    await stepPages(1);
  }
});

els.opacity.addEventListener("input", async () => {
  state.opacity = Number(els.opacity.value);
  els.opacityLabel.textContent = `${Math.round(state.opacity * 100)}%`;
  composeOverlay();
});

els.alignStartBtn.addEventListener("click", startAlign);
els.alignCancelBtn.addEventListener("click", cancelAlign);

document.getElementById("resetAlignBtn").addEventListener("click", async () => {
  resetAlignment();
  composeOverlay();
  setStatus("Alignment reset.");
});

document.getElementById("zoomIn").addEventListener("click", () => {
  const rect = els.viewport.getBoundingClientRect();
  const mx = rect.width / 2;
  const my = rect.height / 2;
  const beforeX = (mx - state.panX) / state.viewZoom;
  const beforeY = (my - state.panY) / state.viewZoom;
  state.viewZoom = Math.min(MAX_VIEW_ZOOM, state.viewZoom * 1.25);
  state.panX = mx - beforeX * state.viewZoom;
  state.panY = my - beforeY * state.viewZoom;
  applyViewTransform();
});

document.getElementById("zoomOut").addEventListener("click", () => {
  const rect = els.viewport.getBoundingClientRect();
  const mx = rect.width / 2;
  const my = rect.height / 2;
  const beforeX = (mx - state.panX) / state.viewZoom;
  const beforeY = (my - state.panY) / state.viewZoom;
  state.viewZoom = Math.max(MIN_VIEW_ZOOM, state.viewZoom / 1.25);
  state.panX = mx - beforeX * state.viewZoom;
  state.panY = my - beforeY * state.viewZoom;
  applyViewTransform();
});

document.getElementById("zoomFit").addEventListener("click", () => fitToViewport());
document.getElementById("zoomReset").addEventListener("click", () => {
  state.viewZoom = 1;
  state.panX = 20;
  state.panY = 20;
  applyViewTransform();
});

document.getElementById("clearAllBtn").addEventListener("click", () => clearEverything());

window.addEventListener("pagehide", () => {
  clearEverything();
});

window.addEventListener("resize", () => {
  if (els.overlayCanvas.width) applyViewTransform();
});

setStatus(`Choose two PDFs to begin. (v${APP_VERSION})`);
updatePageControls();
console.info(`[PdfOverlay] loaded v${APP_VERSION}`);
