import { mulberry32, hash01 } from "./rng.js";

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const srgbToLinear = (c) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

/** Separable box blur, edge-clamped. */
function boxBlur(src, w, h, r) {
  if (r < 1) return Float32Array.from(src);
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / win;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Approximate gaussian: three box blurs. */
const softBlur = (src, w, h, r) => boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r);

/** Marks everything reachable from the image border through background pixels, so enclosed dark areas stay solid. */
function fillHoles(fg, w, h) {
  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (!bg[i] && !fg[i]) { bg[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = bg[i] ? 0 : 1;
  return out;
}

/** Bilinear sample at continuous pixel coords (pixel centres at +0.5). */
function bilinear(arr, w, h, x, y) {
  x -= 0.5; y -= 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const xa = Math.min(w - 1, Math.max(0, x0)), xb = Math.min(w - 1, Math.max(0, x0 + 1));
  const ya = Math.min(h - 1, Math.max(0, y0)), yb = Math.min(h - 1, Math.max(0, y0 + 1));
  const top = arr[ya * w + xa] * (1 - fx) + arr[ya * w + xb] * fx;
  const bot = arr[yb * w + xa] * (1 - fx) + arr[yb * w + xb] * fx;
  return top * (1 - fy) + bot * fy;
}

/** p-th percentile (0..1) of arr values where mask>0 (strided for speed). */
function percentile(arr, mask, p) {
  const v = [];
  const stride = Math.max(1, (arr.length / 60000) | 0);
  for (let i = 0; i < arr.length; i += stride) if (mask[i] > 0) v.push(arr[i]);
  if (!v.length) return 0;
  v.sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(v.length * p))];
}

// ---- spatial hash for nearest-site queries ---------------------------------------------------------
function buildGrid(sites, N, w, h, cell) {
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const start = new Int32Array(gw * gh + 1);
  const cid = new Int32Array(N);
  for (let k = 0; k < N; k++) {
    const cx = Math.min(gw - 1, Math.max(0, (sites[2 * k] / cell) | 0));
    const cy = Math.min(gh - 1, Math.max(0, (sites[2 * k + 1] / cell) | 0));
    const c = cy * gw + cx;
    cid[k] = c;
    start[c + 1]++;
  }
  for (let i = 0; i < gw * gh; i++) start[i + 1] += start[i];
  const fill = start.slice(0, gw * gh);
  const items = new Int32Array(N);
  for (let k = 0; k < N; k++) items[fill[cid[k]]++] = k;
  return { gw, gh, start, items, cell };
}

/** Nearest site to (x,y). Returns index; squared distance in nearest.d2. */
const nearest = { d2: 0 };
function nearestSite(grid, sites, x, y, skip = -1) {
  const { gw, gh, start, items, cell } = grid;
  const cx = Math.min(gw - 1, Math.max(0, (x / cell) | 0));
  const cy = Math.min(gh - 1, Math.max(0, (y / cell) | 0));
  let best = -1, bd = Infinity;
  const maxR = Math.max(gw, gh);
  for (let r = 0; r <= maxR; r++) {
    const x0 = cx - r, x1 = cx + r, y0 = cy - r, y1 = cy + r;
    for (let gy = Math.max(0, y0); gy <= Math.min(gh - 1, y1); gy++) {
      const fullRow = gy === y0 || gy === y1 || r === 0;
      const step = fullRow ? 1 : 2 * r;
      for (let gx = x0; gx <= x1; gx += step) {
        if (gx < 0 || gx >= gw) continue;
        const c = gy * gw + gx;
        for (let t = start[c]; t < start[c + 1]; t++) {
          const k = items[t];
          if (k === skip) continue;
          const dx = sites[2 * k] - x, dy = sites[2 * k + 1] - y;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = k; }
        }
      }
    }
    if (best >= 0 && bd <= r * cell * (r * cell)) break;
  }
  nearest.d2 = bd;
  return best;
}

/** Density-weighted Lloyd relaxation. mass = per-pixel weight; sites = [x0,y0,x1,y1,...] in pixel space. */
function lloyd(sites, N, mass, w, h, iters, cell, stride) {
  const sx = new Float64Array(N), sy = new Float64Array(N), sm = new Float64Array(N);
  for (let it = 0; it < iters; it++) {
    const grid = buildGrid(sites, N, w, h, cell);
    sx.fill(0); sy.fill(0); sm.fill(0);
    for (let y = 0; y < h; y += stride) {
      for (let x = 0; x < w; x += stride) {
        const m = mass[y * w + x];
        if (m <= 0) continue;
        const px = x + 0.5, py = y + 0.5;
        const s = nearestSite(grid, sites, px, py);
        if (s < 0) continue;
        sx[s] += m * px; sy[s] += m * py; sm[s] += m;
      }
    }
    for (let k = 0; k < N; k++) {
      if (sm[k] > 0) {
        sites[2 * k] = sx[k] / sm[k];
        sites[2 * k + 1] = sy[k] / sm[k];
      }
    }
  }
}

export const DEFAULT_SAMPLER = {
  seed: 1337,
  source: "mono", // 'mono' = track the monochrome plate only (ASCII-style) | 'blend' = mono + colour luminance
  colorTint: true, // still read hue from the colour plate for the stars' tint (false => pure neutral chrome)
  portraitHeight: 4.5, // world units
  offset: [0, -0.02], // world x/y offset
  monoThreshold: 0.012, // silhouette threshold on the clean monochrome plate

  // --- tone / density ---
  toneLow: 0.02, // percentile mapped to 0 (contrast stretch inside the silhouette)
  toneHigh: 0.985, // percentile mapped to 1
  lumFloor: 0.1, // minimum density inside the silhouette
  lumGamma: 1.0, // higher = darker areas thin out more
  localContrast: 0.55, // large-scale unsharp (separates lips/skin/shadow)
  detailGain: 1.3, // fine-scale unsharp (carries eyes / lips / brows)
  detailRadius: 0.004, // fraction of image width
  localRadius: 0.02,
  gradBoost: 2.2, // extra density along edges of facial features
  edgeBoost: 1.6, // extra density on the silhouette rim
  face: { cx: 0.37, cy: 0.235, rx: 0.19, ry: 0.2, boost: 1.5 }, // normalised image coords (set boost: 1 to disable)

  // --- placement ---
  relaxIterations: 7, // Lloyd iterations (0 = skip, faster but less accurate)

  // --- star look ---
  sizeK: 0.78, // star radius relative to nearest-neighbour distance
  minRadius: 0.01,
  maxRadius: 0.024,
  depth: 1.0, // sculpture depth multiplier
  domeK: 0.9,
  reliefK: 0.5, // luminance-driven relief (was 0.75)
  zJitter: 0.006,
  // --- floor + rise (intro motion) ---
  floorLevel: 0.93, // floor height as a fraction of the portrait half-height, measured down from the centre
  floorThickness: 0.16, // depth of the star bed, in portrait half-heights
  floorHalfWidth: 1.7, // half-width of the star bed, in portrait half-heights (make it cover your screen width)
  floorSpread: 0.75, // 0 = stars sit right below their target, 1 = fully random across the bed
  floorDepth: 1.6, // z spread of the bed
  riseFraction: 0.05, // share of the stars that actually travel up from the floor; the rest appear gradually in place
  bedCount: 30, // stars visible on the floor right after the explosion (they rise first); everyone else spawns there as they start rising
  floorStars: 60, // extra stars (absolute number) that never rise: they stay on the floor
  riseBottomUp: true, // true: bottom of the portrait forms first, then upward; false: top first
};

/**
 * @param {{color: Uint8ClampedArray, mono: Uint8ClampedArray, width: number, height: number}} px  RGBA buffers, same size
 * @param {number} count particles
 */
export function samplePortrait(px, count, options = {}) {
  const o = {
    ...DEFAULT_SAMPLER,
    ...options,
    face: { ...DEFAULT_SAMPLER.face, ...(options.face || {}) },
  };
  const { width: w, height: h } = px;
  const n = w * h;
  const monoOnly = o.source === "mono";

  // 1. luminance planes --------------------------------------------------------------------------
  const lumC = new Float32Array(n), lumM = new Float32Array(n), maxC = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = px.color[p] / 255, g = px.color[p + 1] / 255, b = px.color[p + 2] / 255;
    lumC[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    maxC[i] = Math.max(r, g, b);
    lumM[i] = (0.2126 * px.mono[p] + 0.7152 * px.mono[p + 1] + 0.0722 * px.mono[p + 2]) / 255;
  }
  // background level from the border (colour plate has a lifted black)
  const borderOf = (arr) => {
    const border = [];
    const bw = Math.max(2, Math.round(w * 0.01));
    for (let y = 0; y < h; y += 3)
      for (let x = 0; x < bw; x++) { border.push(arr[y * w + x]); border.push(arr[y * w + w - 1 - x]); }
    border.sort((a, b) => a - b);
    return border[Math.floor(border.length * 0.9)] || 0;
  };
  const bgLevel = borderOf(maxC);

  // 2. silhouette mask ---------------------------------------------------------------------------
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++)
    raw[i] = lumM[i] > o.monoThreshold || (!monoOnly && maxC[i] > bgLevel + 0.07) ? 1 : 0;
  const closed = boxBlur(raw, w, h, Math.max(2, Math.round(w * 0.006)));
  const fgBin = new Uint8Array(n);
  for (let i = 0; i < n; i++) fgBin[i] = closed[i] > 0.22 ? 1 : 0;
  const fg = fillHoles(fgBin, w, h);
  const fgSoft = boxBlur(fg, w, h, Math.max(2, Math.round(w * 0.008)));

  // 3. tone map (contrast stretched, multi-scale sharpened) ----------------------------------------
  const lumBase = new Float32Array(n);
  if (monoOnly) {
    lumBase.set(lumM);
  } else {
    for (let i = 0; i < n; i++) {
      const c = clamp((lumC[i] - bgLevel * 0.75) / (1 - bgLevel * 0.75));
      lumBase[i] = clamp(0.5 * c + 0.5 * lumM[i]);
    }
  }
  const lo = percentile(lumBase, fg, o.toneLow);
  const hi = Math.max(lo + 1e-3, percentile(lumBase, fg, o.toneHigh));
  for (let i = 0; i < n; i++) lumBase[i] = clamp((lumBase[i] - lo) / (hi - lo));

  const fine = softBlur(lumBase, w, h, Math.max(1, Math.round(w * o.detailRadius)));
  const coarse = softBlur(lumBase, w, h, Math.max(2, Math.round(w * o.localRadius)));
  const tone = new Float32Array(n);
  for (let i = 0; i < n; i++)
    tone[i] = clamp(lumBase[i] + o.localContrast * (lumBase[i] - coarse[i]) + o.detailGain * (lumBase[i] - fine[i]));

  // gradient magnitude (Sobel on lightly smoothed base) => density boost along feature edges
  const sm = softBlur(lumBase, w, h, Math.max(1, Math.round(w * 0.0025)));
  const grad = new Float32Array(n);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -sm[i - w - 1] - 2 * sm[i - 1] - sm[i + w - 1] + sm[i - w + 1] + 2 * sm[i + 1] + sm[i + w + 1];
      const gy = -sm[i - w - 1] - 2 * sm[i - w] - sm[i - w + 1] + sm[i + w - 1] + 2 * sm[i + w] + sm[i + w + 1];
      grad[i] = Math.hypot(gx, gy);
    }
  const g98 = percentile(grad, fg, 0.98) || 1;
  for (let i = 0; i < n; i++) grad[i] = clamp(grad[i] / g98);
  const gradS = boxBlur(grad, w, h, 1);

  // 4. density weight ----------------------------------------------------------------------------
  const weight = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const fy = (y / h - o.face.cy) / o.face.ry;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!fg[i]) continue;
      const fx = (x / w - o.face.cx) / o.face.rx;
      const faceBoost = 1 + (o.face.boost - 1) * Math.exp(-(fx * fx + fy * fy) * 1.6);
      const edge = clamp(fg[i] - fgSoft[i]) * 2;
      weight[i] =
        (o.lumFloor + (1 - o.lumFloor) * Math.pow(tone[i], o.lumGamma)) *
        faceBoost *
        (1 + o.edgeBoost * edge) *
        (1 + o.gradBoost * gradS[i]);
    }
  }

  // 5. exact-N placement: stratified inverse-CDF draw, then density-weighted Lloyd relaxation --------
  const rand = mulberry32(o.seed);
  const cdf = new Float64Array(n);
  let tot = 0;
  for (let i = 0; i < n; i++) { tot += weight[i]; cdf[i] = tot; }
  const N = count;
  const sites = new Float32Array(N * 2);
  for (let k = 0; k < N; k++) {
    const u = ((k + rand()) / N) * tot;
    let a = 0, b = n - 1;
    while (a < b) { const m = (a + b) >> 1; if (cdf[m] >= u) b = m; else a = m + 1; }
    sites[2 * k] = (a % w) + rand();
    sites[2 * k + 1] = ((a / w) | 0) + rand();
  }

  let fgCount = 0;
  for (let i = 0; i < n; i++) fgCount += fg[i] > 0 ? 1 : 0;
  const cell = Math.max(2, Math.sqrt(Math.max(1, fgCount) / N) * 1.1);
  if (o.relaxIterations > 0) {
    // mass = density^2: a CVT's site density scales with mass^(1/2) in 2D, so this yields site density ∝ weight
    const mass = new Float32Array(n);
    for (let i = 0; i < n; i++) mass[i] = weight[i] * weight[i];
    lloyd(sites, N, mass, w, h, o.relaxIterations, cell, n > 500000 ? 2 : 1);
  }

  // shuffle so particle index carries no spatial order
  const order = new Uint32Array(N);
  for (let i = 0; i < N; i++) order[i] = i;
  for (let i = N - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
  const sh = new Float32Array(N * 2);
  for (let k = 0; k < N; k++) { sh[2 * k] = sites[2 * order[k]]; sh[2 * k + 1] = sites[2 * order[k] + 1]; }
  sites.set(sh);

  // 6. outputs -------------------------------------------------------------------------------------
  const worldScale = o.portraitHeight / h;
  const domeBlur = boxBlur(fg, w, h, Math.round(w * 0.07));
  const lumSoft = softBlur(lumBase, w, h, Math.max(2, Math.round(w * 0.03)));
  const finalGrid = buildGrid(sites, N, w, h, cell);

  const targets = new Float32Array(N * 3);
  const size = new Float32Array(N);
  const lum = new Float32Array(N);
  const chroma = new Float32Array(N * 3);
  const pixelX = new Float32Array(N), pixelY = new Float32Array(N);

  for (let k = 0; k < N; k++) {
    const x = sites[2 * k], y = sites[2 * k + 1];
    const L = bilinear(tone, w, h, x, y);
    const z =
      ((bilinear(domeBlur, w, h, x, y) - 0.5) * o.domeK + (bilinear(lumSoft, w, h, x, y) - 0.3) * o.reliefK) * o.depth;
    targets[k * 3] = (x - w / 2) * worldScale + o.offset[0];
    targets[k * 3 + 1] = -(y - h / 2) * worldScale + o.offset[1];
    targets[k * 3 + 2] = z + (rand() - 0.5) * o.zJitter;

    // size from the real nearest-neighbour distance => stars tile the surface without overlapping
    nearestSite(finalGrid, sites, x, y, k);
    const nn = Math.sqrt(nearest.d2) || cell;
    size[k] = clamp(nn * worldScale * o.sizeK * (0.88 + 0.24 * L), o.minRadius, o.maxRadius);
    lum[k] = L;
    pixelX[k] = x;
    pixelY[k] = y;

    if (o.colorTint) {
      let r = 0, gg = 0, b = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const q =
            (Math.min(h - 1, Math.max(0, (y | 0) + dy)) * w + Math.min(w - 1, Math.max(0, (x | 0) + dx))) * 4;
          r += srgbToLinear(px.color[q] / 255);
          gg += srgbToLinear(px.color[q + 1] / 255);
          b += srgbToLinear(px.color[q + 2] / 255);
        }
      r /= 9; gg /= 9; b /= 9;
      const yl = 0.2126 * r + 0.7152 * gg + 0.0722 * b + 0.02;
      chroma[k * 3] = clamp(r / yl, 0.4, 2.2);
      chroma[k * 3 + 1] = clamp(gg / yl, 0.4, 2.2);
      chroma[k * 3 + 2] = clamp(b / yl, 0.4, 2.2);
    } else {
      chroma[k * 3] = chroma[k * 3 + 1] = chroma[k * 3 + 2] = 1;
    }
  }

  // 7. floor bed + rise ----------------------------------------------------------------------------------
  // Every star first rests on a bed along the bottom of the screen. Portrait stars then rise from it into the
  // image; `floorStars` extra stars (appended after the portrait ones) have their own floor spot as their target,
  // so they simply stay behind. Floor x is blended between a star's own target x and a uniform random x so the
  // rise reads as an organised fan rather than stars crossing each other.
  const halfH = (h / 2) * worldScale;
  const hw = halfH * o.floorHalfWidth;
  const baseY = -halfH * o.floorLevel + o.offset[1];
  const thick = halfH * o.floorThickness;
  const extra = Math.max(0, Math.round(o.floorStars));
  const T = N + extra;
  const ext = (arr, s) => { const out = new Float32Array(T * s); out.set(arr); return out; };
  const targetsT = ext(targets, 3), sizeT = ext(size, 1), lumT = ext(lum, 1), chromaT = ext(chroma, 3);
  const stream = new Float32Array(T * 4); // floorX, floorY, floorZ, swayPhase
  const misc = new Float32Array(T * 4); // swayFreq, unused, riseDelay, portraitRadius
  const floorSpot = (k, spread, tx) => {
    const fx = (1 - spread) * tx * (hw / (halfH * 0.75)) + spread * (rand() * 2 - 1) * hw;
    const fxc = Math.max(-hw, Math.min(hw, fx));
    stream[k * 4] = fxc;
    stream[k * 4 + 1] = baseY - thick * Math.pow(rand(), 1.5) + 0.08 * Math.sin(fxc * 1.1 + 1.0);
    stream[k * 4 + 2] = (rand() - 0.5) * o.floorDepth;
    stream[k * 4 + 3] = rand();
    misc[k * 4] = 0.4 + 0.8 * rand();
  };
  for (let k = 0; k < N; k++) {
    floorSpot(k, o.floorSpread, targets[k * 3]);
    const v = o.riseBottomUp ? 1 - pixelY[k] / h : pixelY[k] / h;
    // particle order is shuffled, so the first indices are spread randomly over the portrait
    const riserTotal = Math.max(Math.round(N * o.riseFraction), Math.min(N, o.bedCount));
    const isBed = k < Math.min(N, o.bedCount);
    misc[k * 4 + 1] = isBed ? 1 : k < riserTotal ? 2 : 0;
    // Timing is a single front that sweeps up the image (v: 0 = where the build starts, 1 = where it ends).
    // A riser aimed at height v arrives at roughly 0.45 + 0.30 v; in-place stars at that height only start to
    // appear a little before that, so nobody settles before the climbers have reached the area.
    misc[k * 4 + 2] = misc[k * 4 + 1] > 0 ? 0.3 * v + 0.02 * rand() : 0.38 + 0.38 * v + 0.04 * rand();
    misc[k * 4 + 3] = size[k];
  }
  for (let k = N; k < T; k++) {
    floorSpot(k, 1, 0);
    targetsT[k * 3] = stream[k * 4];
    targetsT[k * 3 + 1] = stream[k * 4 + 1];
    targetsT[k * 3 + 2] = stream[k * 4 + 2];
    sizeT[k] = 0.010 + 0.012 * rand();
    lumT[k] = 0.4 + 0.6 * rand();
    chromaT[k * 3] = chromaT[k * 3 + 1] = chromaT[k * 3 + 2] = 1;
    misc[k * 4 + 1] = 1;
    misc[k * 4 + 2] = 0;
    misc[k * 4 + 3] = sizeT[k];
  }

  return {
    count: T,
    targets: targetsT,
    size: sizeT,
    lum: lumT,
    chroma: chromaT,
    stream,
    misc,
    bounds: { halfW: (w / 2) * worldScale, halfH: (h / 2) * worldScale },
    debug: { w, h, fg, tone, weight, pixelX, pixelY },
  };
}

// ----------------------------------------------------------------------------------------------
// Browser-only: decode both portraits to identical-size RGBA buffers via an offscreen canvas.
// maxSide raised 720 -> 1024 so lips / eyelids have enough pixels to be tracked.
export async function loadPortraitPixels(colorSrc, monoSrc, maxSide = 1024) {
  const load = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = () => rej(new Error(`MStarIntro: failed to load ${src}`));
      img.src = src;
    });
  const [ci, mi] = await Promise.all([load(colorSrc), load(monoSrc)]);
  const k = Math.min(1, maxSide / Math.max(ci.naturalWidth, ci.naturalHeight));
  const width = Math.round(ci.naturalWidth * k), height = Math.round(ci.naturalHeight * k);
  const draw = (img) => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height); // mono is stretched to the colour plate's size (same framing expected)
    return ctx.getImageData(0, 0, width, height).data;
  };
  return { width, height, color: draw(ci), mono: draw(mi) };
}