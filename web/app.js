import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.min.mjs",
  import.meta.url
).toString();

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
  opacity: 0.5,
  offsetX: 0,
  offsetY: 0,
  scaleB: 1,
  viewZoom: 1,
  bitmapA: null,
  bitmapB: null,
};

const els = {
  fileA: document.getElementById("fileA"),
  fileB: document.getElementById("fileB"),
  nameA: document.getElementById("nameA"),
  nameB: document.getElementById("nameB"),
  pageA: document.getElementById("pageA"),
  pageB: document.getElementById("pageB"),
  opacity: document.getElementById("opacity"),
  opacityLabel: document.getElementById("opacityLabel"),
  offsetX: document.getElementById("offsetX"),
  offsetY: document.getElementById("offsetY"),
  offsetXLabel: document.getElementById("offsetXLabel"),
  offsetYLabel: document.getElementById("offsetYLabel"),
  scaleB: document.getElementById("scaleB"),
  scaleBLabel: document.getElementById("scaleBLabel"),
  status: document.getElementById("status"),
  overlayCanvas: document.getElementById("overlayCanvas"),
  previewA: document.getElementById("previewA"),
  previewB: document.getElementById("previewB"),
  zoomLabel: document.getElementById("zoomLabel"),
};

function setStatus(message) {
  els.status.textContent = message;
}

function clearBitmap(key) {
  if (state[key]) {
    state[key].close?.();
    state[key] = null;
  }
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

async function clearEverything() {
  await destroyDoc("A");
  await destroyDoc("B");
  clearBitmap("bitmapA");
  clearBitmap("bitmapB");

  state.pageA = 1;
  state.pageB = 1;
  state.pageCountA = 0;
  state.pageCountB = 0;
  state.opacity = 0.5;
  state.offsetX = 0;
  state.offsetY = 0;
  state.scaleB = 1;
  state.viewZoom = 1;

  els.fileA.value = "";
  els.fileB.value = "";
  els.nameA.textContent = "No file chosen";
  els.nameB.textContent = "No file chosen";
  els.pageA.innerHTML = "";
  els.pageB.innerHTML = "";
  els.pageA.disabled = true;
  els.pageB.disabled = true;
  els.opacity.value = "0.5";
  els.offsetX.value = "0";
  els.offsetY.value = "0";
  els.scaleB.value = "1";
  els.opacityLabel.textContent = "50%";
  els.offsetXLabel.textContent = "0";
  els.offsetYLabel.textContent = "0";
  els.scaleBLabel.textContent = "1.00";
  els.zoomLabel.textContent = "100%";
  els.overlayCanvas.width = 0;
  els.overlayCanvas.height = 0;
  els.overlayCanvas.style.transform = "scale(1)";
  els.previewA.width = 0;
  els.previewA.height = 0;
  els.previewB.width = 0;
  els.previewB.height = 0;
  setStatus("Cleared. Nothing from this session is kept after you leave this page.");
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

async function loadPdf(file, which) {
  const buffer = await file.arrayBuffer();
  // Keep a copy we own; the File object itself is never written back.
  const bytes = new Uint8Array(buffer.slice(0));
  const loadingTask = pdfjsLib.getDocument({ data: bytes, useSystemFonts: true });
  const pdf = await loadingTask.promise;

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

  setStatus(`Loaded ${file.name} in memory only. Original file was not changed.`);
  await refresh();
}

async function renderPage(pdf, pageNumber, scale = 1.5) {
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

function drawPreview(sourceCanvas, targetCanvas) {
  const maxW = 360;
  const scale = Math.min(1, maxW / sourceCanvas.width);
  targetCanvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
  targetCanvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
  const ctx = targetCanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
}

function composeOverlay(canvasA, canvasB) {
  const scaleB = state.scaleB;
  const topW = canvasB.width * scaleB;
  const topH = canvasB.height * scaleB;
  const minX = Math.min(0, state.offsetX);
  const minY = Math.min(0, state.offsetY);
  const maxX = Math.max(canvasA.width, state.offsetX + topW);
  const maxY = Math.max(canvasA.height, state.offsetY + topH);
  const width = Math.max(1, Math.ceil(maxX - minX));
  const height = Math.max(1, Math.ceil(maxY - minY));

  const out = els.overlayCanvas;
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const baseX = -minX;
  const baseY = -minY;
  ctx.drawImage(canvasA, baseX, baseY);
  ctx.save();
  ctx.globalAlpha = state.opacity;
  ctx.drawImage(
    canvasB,
    baseX + state.offsetX,
    baseY + state.offsetY,
    topW,
    topH
  );
  ctx.restore();
  out.style.transform = `scale(${state.viewZoom})`;
}

async function refresh(reRender = true) {
  if (!state.docA || !state.docB) {
    return;
  }

  try {
    if (reRender) {
      const [canvasA, canvasB] = await Promise.all([
        renderPage(state.docA, state.pageA),
        renderPage(state.docB, state.pageB),
      ]);
      state.bitmapA = canvasA;
      state.bitmapB = canvasB;
      drawPreview(canvasA, els.previewA);
      drawPreview(canvasB, els.previewB);
    }

    if (!state.bitmapA || !state.bitmapB) return;
    composeOverlay(state.bitmapA, state.bitmapB);
    setStatus(
      `Overlay ready — A p.${state.pageA} / B p.${state.pageB} · ` +
        `${Math.round(state.opacity * 100)}% opacity · ` +
        `offset ${state.offsetX},${state.offsetY}. Still temporary / local only.`
    );
  } catch (err) {
    setStatus(`Could not render: ${err.message || err}`);
  }
}

function syncLabels() {
  els.opacityLabel.textContent = `${Math.round(state.opacity * 100)}%`;
  els.offsetXLabel.textContent = String(state.offsetX);
  els.offsetYLabel.textContent = String(state.offsetY);
  els.scaleBLabel.textContent = state.scaleB.toFixed(2);
  els.zoomLabel.textContent = `${Math.round(state.viewZoom * 100)}%`;
  els.opacity.value = String(state.opacity);
  els.offsetX.value = String(state.offsetX);
  els.offsetY.value = String(state.offsetY);
  els.scaleB.value = String(state.scaleB);
}

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
  state.pageA = Number(els.pageA.value) || 1;
  await refresh(true);
});

els.pageB.addEventListener("change", async () => {
  state.pageB = Number(els.pageB.value) || 1;
  await refresh(true);
});

els.opacity.addEventListener("input", async () => {
  state.opacity = Number(els.opacity.value);
  syncLabels();
  await refresh(false);
});

els.offsetX.addEventListener("input", async () => {
  state.offsetX = Number(els.offsetX.value);
  syncLabels();
  await refresh(false);
});

els.offsetY.addEventListener("input", async () => {
  state.offsetY = Number(els.offsetY.value);
  syncLabels();
  await refresh(false);
});

els.scaleB.addEventListener("input", async () => {
  state.scaleB = Number(els.scaleB.value);
  syncLabels();
  await refresh(false);
});

document.getElementById("nudgeLeft").addEventListener("click", async () => {
  state.offsetX -= 1;
  syncLabels();
  await refresh(false);
});
document.getElementById("nudgeRight").addEventListener("click", async () => {
  state.offsetX += 1;
  syncLabels();
  await refresh(false);
});
document.getElementById("nudgeUp").addEventListener("click", async () => {
  state.offsetY -= 1;
  syncLabels();
  await refresh(false);
});
document.getElementById("nudgeDown").addEventListener("click", async () => {
  state.offsetY += 1;
  syncLabels();
  await refresh(false);
});

document.getElementById("resetAlignBtn").addEventListener("click", async () => {
  state.opacity = 0.5;
  state.offsetX = 0;
  state.offsetY = 0;
  state.scaleB = 1;
  syncLabels();
  await refresh(false);
});

document.getElementById("zoomIn").addEventListener("click", () => {
  state.viewZoom = Math.min(3, Math.round((state.viewZoom + 0.25) * 100) / 100);
  syncLabels();
  els.overlayCanvas.style.transform = `scale(${state.viewZoom})`;
});
document.getElementById("zoomOut").addEventListener("click", () => {
  state.viewZoom = Math.max(0.25, Math.round((state.viewZoom - 0.25) * 100) / 100);
  syncLabels();
  els.overlayCanvas.style.transform = `scale(${state.viewZoom})`;
});
document.getElementById("zoomReset").addEventListener("click", () => {
  state.viewZoom = 1;
  syncLabels();
  els.overlayCanvas.style.transform = "scale(1)";
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
  clearEverything();
});

window.addEventListener("pagehide", () => {
  // Best-effort discard when the tab closes/navigates away.
  clearEverything();
});

setStatus("Choose two local PDFs to begin. Nothing is uploaded.");
