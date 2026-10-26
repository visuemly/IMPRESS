

/* COLOR TRACKING----------------------------------- */ 

const ColorTracking2 = (() => {

    const root = document.getElementById("slide-vier");

  const MIN_BLOB_AREA = 800;

  const calibration = { hueTol: 10, satMin: 100, valMin: 80 };

  const colorDetectors2 = [
    { id: "color1", name: "Color 1", stroke: "#d6002e", enabled: true, hue: 0, ranges: [] },
    { id: "color2", name: "Color 2", stroke: "#f6ff00", enabled: true, hue: 0, ranges: [] },
    { id: "color3", name: "Color 3", stroke: "#00c6e5", enabled: true, hue: 0, ranges: [] }
  ];

  let video, canvas, ctx, statusEl, pickHintEl;
  let activePick = -1;
  let onReady = () => {};
  let onFrame = () => {};

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
  }

  function rgbToOpenCvHue(r, g, b) {
    const src = cv.matFromArray(1, 1, cv.CV_8UC3, [r, g, b]);
    const hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);
    const h = hsv.data[0];
    src.delete();
    hsv.delete();
    return h;
  }

  function hsvRangesFromHue(h, satMin, valMin, hueTol) {
    const sm = satMin, vm = valMin;

    if (h <= hueTol) {
      return [
        [[0, sm, vm], [h + hueTol, 255, 255]],
        [[180 - (hueTol - h), sm, vm], [180, 255, 255]]
      ];
    }
    if (h >= 180 - hueTol) {
      return [
        [[h - hueTol, sm, vm], [180, 255, 255]],
        [[0, sm, vm], [hueTol - (180 - h), 255, 255]]
      ];
    }
    return [[[h - hueTol, sm, vm], [h + hueTol, 255, 255]]];
  }

  function rebuildRanges(detector) {
    detector.ranges = hsvRangesFromHue(
      detector.hue, calibration.satMin, calibration.valMin, calibration.hueTol
    );
  }

  function applyColorToDetector(detector, hex) {
    const [r, g, b] = hexToRgb(hex);
    detector.stroke = hex;
    detector.hue = rgbToOpenCvHue(r, g, b);
    rebuildRanges(detector);
  }

  function buildMask(hsv, rangePairs) {
    let mask = null;
    for (const [lowArr, highArr] of rangePairs) {
      const low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [...lowArr, 0]);
      const high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [...highArr, 255]);
      const part = new cv.Mat();
      cv.inRange(hsv, low, high, part);
      low.delete();
      high.delete();

      if (!mask) {
        mask = part;
      } else {
        const merged = new cv.Mat();
        cv.bitwise_or(mask, part, merged);
        mask.delete();
        part.delete();
        mask = merged;
      }
    }
    return mask;
  }

  function refineMask(mask) {
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(7, 7));
    const refined = new cv.Mat();
    cv.morphologyEx(mask, refined, cv.MORPH_OPEN, kernel);
    cv.morphologyEx(refined, refined, cv.MORPH_CLOSE, kernel);
    kernel.delete();
    return refined;
  }

  // Gibt jetzt Mittelpunkt UND Eckpunkte des gedrehten Rechtecks zurück
  function detectColor(hsv, detector) {
    if (!detector.enabled) return null;

    const mask = buildMask(hsv, detector.ranges);
    const refined = refineMask(mask);
    mask.delete();

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(refined, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area >= MIN_BLOB_AREA && area > bestArea) {
        const rect = cv.minAreaRect(cnt);
        best = {
          x: rect.center.x,
          y: rect.center.y,
          vertices: cv.RotatedRect.points(rect).map(p => ({ x: p.x, y: p.y }))
        };
        bestArea = area;
      }
      cnt.delete();
    }

    refined.delete();
    contours.delete();
    hierarchy.delete();
    return best;
  }

  // ---------- Zeichnen ----------

  // Kamerabild gespiegelt auf den Canvas zeichnen
  function drawMirroredVideo() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Rechteck + Koordinaten-Label
  function drawBlob(blob, stroke, index) {
    const v = blob.vertices;

    ctx.beginPath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.moveTo(v[0].x, v[0].y);
    for (let j = 1; j < 4; j++) ctx.lineTo(v[j].x, v[j].y);
    ctx.closePath();
    ctx.stroke();

    const label = `${index + 1}: x ${Math.round(blob.x)}, y ${Math.round(blob.y)}`;
    const ys = v.map(p => p.y);
    let labelY = Math.min(...ys) - 6;

    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    // Label unter das Rechteck setzen
    if (labelY < 16) {
      labelY = Math.max(...ys) + 16;
      ctx.textBaseline = "top";
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.strokeText(label, blob.x, labelY);
    ctx.fillStyle = stroke;
    ctx.fillText(label, blob.x, labelY);
  }

function processFrame() {
  const r = root.getBoundingClientRect();
  if (video.readyState < 2 || r.bottom < 0 || r.top > innerHeight) {
    requestAnimationFrame(processFrame);
    return;
  }
  try {
      drawMirroredVideo();

      const src = cv.imread(canvas);   // liest das bereits gespiegelte Bild
      const hsv = new cv.Mat();
      cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

      const blobs = colorDetectors2.map(d => detectColor(hsv, d));

      src.delete();
      hsv.delete();

      blobs.forEach((b, i) => {
        if (b) drawBlob(b, colorDetectors2[i].stroke, i);
      });

      const center = i => (blobs[i] ? { x: blobs[i].x, y: blobs[i].y } : null);

      onFrame({
        center1: center(0),
        center2: center(1),
        center3: center(2),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      });
    } catch (e) {
      console.error("processFrame error:", e);
    }
    requestAnimationFrame(processFrame);
  }

  // ---------- UI ----------

  function buildSlots() {
    colorDetectors2.forEach((det, i) => {
const wrap = root.querySelector("#color-slot-" + (i + 1));
      if (!wrap) return;

      wrap.innerHTML = `
        <div class="color-slot" id="slot-${i}">
          <input type="color" value="${det.stroke}">
          <span class="color-slot__name">${det.name}</span>
          <label class="enable">
            <input type="checkbox" checked> aktiv
          </label>
          <div class="color-slot__actions">
            <button type="button">Von Video sampeln</button>
          </div>
        </div>`;

      const colorInput = wrap.querySelector('input[type="color"]');
      const enableInput = wrap.querySelector('input[type="checkbox"]');
      const sampleBtn = wrap.querySelector("button");

      colorInput.addEventListener("input", () => applyColorToDetector(det, colorInput.value));
      enableInput.addEventListener("change", () => { det.enabled = enableInput.checked; });
      sampleBtn.addEventListener("click", () => setPicking(activePick === i ? -1 : i));
    });
  }

  function setPicking(i) {
    activePick = i;
    canvas.classList.toggle("is-picking", i >= 0);
    if (pickHintEl) pickHintEl.hidden = i < 0;
    document.querySelectorAll(".color-slot").forEach((el, idx) =>
      el.classList.toggle("is-active", idx === i)
    );
  }

  function wireSliders() {
    const bind = (id, key) => {
      const input = document.getElementById(id);
      const out = document.getElementById(id + "-val");
      if (!input) return;
      input.addEventListener("input", () => {
        calibration[key] = Number(input.value);
        if (out) out.textContent = input.value;
        colorDetectors2.forEach(rebuildRanges);
      });
    };
    bind("hue-tol", "hueTol");
    bind("sat-min", "satMin");
    bind("val-min", "valMin");
  }

  function wireCanvasPicking() {
    canvas.addEventListener("click", (e) => {
      if (activePick < 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) * canvas.width / rect.width);
      const y = Math.round((e.clientY - rect.top) * canvas.height / rect.height);

      // Mittelwert über 7x7 Pixel
      const size = 7;
      const data = ctx.getImageData(
        Math.max(0, x - 3), Math.max(0, y - 3), size, size
      ).data;
      let r = 0, g = 0, b = 0;
      const n = data.length / 4;
      for (let k = 0; k < data.length; k += 4) {
        r += data[k]; g += data[k + 1]; b += data[k + 2];
      }
      const hex = rgbToHex(Math.round(r / n), Math.round(g / n), Math.round(b / n));

      const det = colorDetectors2[activePick];
      applyColorToDetector(det, hex);
      document.querySelector(`#slot-${activePick} input[type="color"]`).value = hex;
      setPicking(-1);
    });
  }

  // ---------- Start ----------

async function startCamera() {
  processFrame();
}

  function bootOpenCv() {
    if (statusEl) statusEl.textContent = "OpenCV loaded";
    colorDetectors2.forEach(d => applyColorToDetector(d, d.stroke));
    onReady();
    startCamera().catch(err => console.error("Kamera-Fehler:", err));
  }

  function waitForOpenCv() {
    const timer = setInterval(() => {
      if (typeof cv === "undefined") return;

      if (cv instanceof Promise) {
        clearInterval(timer);
        cv.then(m => { window.cv = m; bootOpenCv(); });
      } else if (cv.Mat) {
        clearInterval(timer);
        bootOpenCv();
      }
    }, 100);
  }

  return {
    init(hooks = {}) {
      video = document.getElementById("video1");
      canvas = document.getElementById("canvas4");
      ctx = canvas.getContext("2d", { willReadFrequently: true });
      statusEl = document.getElementById("status");
      pickHintEl = document.getElementById("pick-hint");

      onReady = hooks.onReady || onReady;
      onFrame = hooks.onFrame || onFrame;

      buildSlots();
      wireSliders();
      wireCanvasPicking();
      waitForOpenCv();
    }
  };

})();


/* SCRIPT 04----------------------------------- */ 



const divVier = document.getElementById('slide-vier');

// Jeder Text hat seinen eigenen Grössenbereich (in vh)
const specimens = [
  { el: document.getElementById("flex-item-1-text"), min: 1,   max: 50, size: 19.2 },
  { el: document.getElementById("flex-item-2-text"), min: 1,   max: 50,  size: 2.5  },
  { el: document.getElementById("flex-item-3-text"), min: 1,   max: 30, size: 5    }
];

const SIZE_SMOOTH = 0.35;

function rangeMap(value, inMin, inMax, outMin, outMax) {
  const t = Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
  return outMin + (outMax - outMin) * t;
}

function onTrackFrame({ center1, center2, center3, canvasWidth }) {
  [center1, center2, center3].forEach((center, i) => {
    if (!center) return;
    const s = specimens[i];
    const target = rangeMap(center.x, 0, canvasWidth, s.min, s.max);
    s.size += (target - s.size) * SIZE_SMOOTH;
    s.el.style.fontSize = s.size + "vh";
  });
}
function bootOpenCv() {
  if (statusEl) statusEl.textContent = "OpenCV loaded";
  colorDetectors2.forEach(d => applyColorToDetector(d, d.stroke));
  opencvReady = true;
  onReady();
  processFrame();
}

ColorTracking2.init({ onFrame: onTrackFrame });

