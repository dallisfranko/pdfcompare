import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";

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
  opacity: 0.85,
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
};

const const els = {
  fileA: document.getElementById("fileA"),
  fileB: document.getElementById("fileB"),
  nameA: document.getElementById("nameA"),
  nameB: document.getElementById("nameB"),
  pageBoth: document.getElementById("pageBoth"),
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
};

function setStatus(message) {
  els.status.textContent = message;
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
  state.viewZoom = Math.max(0.05, scale);
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
  els.viewport.classList.remove("aligning");
  els.alignStartBtn.hidden = false;
  els.alignCancelBtn.hidden = true;
  if (!keepMessage) setAlignStatus("Alignment: none");
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
  state.opacity = 0.85;
  state.viewZoom = 1;
  state.panX = 0;
  state.panY = 0;
  resetAlignment();

  els.fileA.value = "";
  els.fileB.value = "";
  els.nameA.textContent = "No file chosen";
  els.nameB.textContent = "No file chosen";
  els.pageBoth.innerHTML = "";
  els.pageBoth.disabled = true;
  els.opacity.value = "0.85";
  els.opacityLabel.textContent = "85%";
  els.overlayCanvas.width = 0;
  els.overlayCanvas.height = 0;
  updatePageControls();
  applyViewTransform();
  setStatus("Cleared. Nothing from this session is kept after you leave this page.");
}

/** Shared page count when comparing: both PDFs stay on the same sheet number. */
function sharedPageCount() {
  const hasA = state.pageCountA > 0;
  const hasB = state.pageCountB > 0;
  if (hasA && hasB) return Math.min(state.pageCountA, state.pageCountB);
  if (hasA) return state.pageCountA;
  if (hasB) return state.pageCountB;
  return 0;
}

function sharedPage() {
  const count = sharedPageCount();
  if (!count) return 1;
  const hasA = state.pageCountA > 0;
  const hasB = state.pageCountB > 0;
  if (hasA && hasB) return Math.min(state.pageA, state.pageB, count);
  if (hasA) return Math.min(state.pageA, count);
  return Math.min(state.pageB, count);
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

function updatePageControls() {
  const count = sharedPageCount();
  const page = sharedPage();
  const ready = state.pageCountA > 0 && state.pageCountB > 0;

  if (els.pageBoth.options.length !== count) {
    fillPageSelect(els.pageBoth, count, page);
  } else if (count > 0) {
    els.pageBoth.value = String(page);
  }

  els.pageBoth.disabled = !ready;
  els.prevBoth.disabled = !ready || page <= 1;
  els.nextBoth.disabled = !ready || page >= count;

  if (!state.pageCountA && !state.pageCountB) {
    els.pageMeta.textContent = "Load both PDFs to flip sheets";
  } else if (!ready) {
    els.pageMeta.textContent = "Choose the other PDF to unlock sheet flip";
  } else if (state.pageCountA !== state.pageCountB) {
    els.pageMeta.textContent = `Sheet ${page} of ${count} (shared)`;
  } else {
    els.pageMeta.textContent = `Sheet ${page} of ${count}`;
  }
}

async function setSharedPage(page, { fit = true } = {}) {
  const count = sharedPageCount();
  if (!count) return;

  const next = Math.min(Math.max(1, page), count);
  const same =
    (!state.pageCountA || state.pageA === next) &&
    (!state.pageCountB || state.pageB === next) &&
    els.pageBoth.value === String(next);

  if (same) {
    updatePageControls();
    return;
  }

  if (state.pageCountA > 0) state.pageA = next;
  if (state.pageCountB > 0) state.pageB = next;
  els.pageBoth.value = String(next);

  // Changing sheets usually means a new drawing — clear alignment.
  resetAlignment();
  updatePageControls();
  if (state.docA && state.docB) {
    await refresh(true, fit);
  }
}

async function stepPages(delta) {
  if (!(state.pageCountA > 0 && state.pageCountB > 0)) return;
  await setSharedPage(sharedPage() + delta, { fit: true });
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
  } else {
    state.docB = pdf;
    state.bytesB = bytes;
    state.nameB = file.name;
    state.pageCountB = pdf.numPages;
    state.pageB = 1;
    els.nameB.textContent = file.name;
  }

  // Keep both on the same sheet once both files are present.
  if (state.pageCountA > 0 && state.pageCountB > 0) {
    const page = sharedPage();
    state.pageA = page;
    state.pageB = page;
  }

  resetAlignment();
  updatePageControls();
  setStatus(`Loaded ${file.name} in memory only. Original file was not changed.`);
  await refresh(true, true);
}

async function renderPage(pdf, pageNumber, scale = 1.75) {
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
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 8 / Math.max(state.viewZoom, 0.2), 0, Math.PI * 2);
    ctx.fillStyle = which === "A" ? "#c62828" : "#1565c0";
    ctx.fill();
    ctx.lineWidth = 2 / Math.max(state.viewZoom, 0.2);
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = `${14 / Math.max(state.viewZoom, 0.2)}px sans-serif`;
    ctx.fillText(label, pt.x + 10 / Math.max(state.viewZoom, 0.2), pt.y - 10 / Math.max(state.viewZoom, 0.2));
  }
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
    if (fit) fitToViewport();
    else applyViewTransform();

    if (state.alignStep === "idle") {
      setStatus(
        `Compare ready — sheet ${state.pageA} of ${Math.min(state.pageCountA, state.pageCountB)}. ` +
          `Use ‹ › or ← → to flip both PDFs together.`
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
  els.viewport.classList.add("aligning");
  els.alignStartBtn.hidden = true;
  els.alignCancelBtn.hidden = false;
  setAlignStatus("Step 1/4: click point 1 on RED (A)");
  setStatus("Align mode: click a clear landmark on document A (red).");
  composeOverlay();
  fitToViewport();
}

function cancelAlign() {
  resetAlignment();
  composeOverlay();
  setStatus("Align cancelled.");
}

function handleAlignClick(pt) {
  const step = state.alignStep;
  if (step === "a1") {
    state.alignPoints.a1 = pt;
    state.alignStep = "b1";
    setAlignStatus("Step 2/4: click the SAME point on BLUE (B)");
    setStatus("Now click that same landmark on document B (blue).");
    composeOverlay();
    fitToViewport();
    return;
  }
  if (step === "b1") {
    state.alignPoints.b1 = pt;
    state.alignStep = "a2";
    setAlignStatus("Step 3/4: click point 2 on RED (A)");
    setStatus("Click a second landmark on document A (red), far from the first.");
    composeOverlay();
    fitToViewport();
    return;
  }
  if (step === "a2") {
    state.alignPoints.a2 = pt;
    state.alignStep = "b2";
    setAlignStatus("Step 4/4: click the SAME point 2 on BLUE (B)");
    setStatus("Click the matching second landmark on document B (blue).");
    composeOverlay();
    fitToViewport();
    return;
  }
  if (step === "b2") {
    state.alignPoints.b2 = pt;
    try {
      state.transform = computeSimilarity(
        state.alignPoints.a1,
        state.alignPoints.a2,
        state.alignPoints.b1,
        state.alignPoints.b2
      );
      state.alignStep = "idle";
      els.viewport.classList.remove("aligning");
      els.alignStartBtn.hidden = false;
      els.alignCancelBtn.hidden = true;
      setAlignStatus(
        `Aligned (scale ${state.transform.scale.toFixed(3)}, rotation ${(
          (state.transform.rot * 180) /
          Math.PI
        ).toFixed(2)}°)`
      );
      setStatus("Alignment applied. Pan/zoom the compare view to inspect differences.");
      composeOverlay();
      fitToViewport();
    } catch (err) {
      setStatus(`Align failed: ${err.message || err}`);
      resetAlignment();
      composeOverlay();
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
  if (!pan.active || event.pointerId !== pan.pointerId) return;
  const dx = event.clientX - pan.startX;
  const dy = event.clientY - pan.startY;
  if (Math.hypot(dx, dy) > 4) pan.moved = true;
  if (state.alignStep === "idle" || pan.moved) {
    state.panX = pan.origPanX + dx;
    state.panY = pan.origPanY + dy;
    applyViewTransform();
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
    state.viewZoom = Math.min(12, Math.max(0.05, state.viewZoom * factor));
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

els.pageBoth.addEventListener("change", async () => {
  await setSharedPage(Number(els.pageBoth.value) || 1, { fit: true });
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
  state.viewZoom = Math.min(12, state.viewZoom * 1.25);
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
  state.viewZoom = Math.max(0.05, state.viewZoom / 1.25);
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

setStatus("Choose two local PDFs to begin. Nothing is uploaded.");
updatePageControls();
