import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* 1. Procedural LED dot-matrix textures (emissive + normal)           */
/* ------------------------------------------------------------------ */

const CELL_PX = 64; // resolution of one LED cell

/** One LED cell as a height field (dome) -> returns Float32Array 0..1 */
function dotHeight(size) {
  const h = new Float32Array(size * size);
  const c = (size - 1) / 2;
  const r = size * 0.38;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c) / r;
      const t = Math.min(Math.max(1 - d, 0), 1);
      h[y * size + x] = t * t * (3 - 2 * t); // smoothstep dome
    }
  }
  return h;
}

function heightToNormalCanvas(h, size, strength = 4) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(size, size);
  const at = (x, y) =>
    h[((y + size) % size) * size + ((x + size) % size)]; // wraps -> seamless
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255; // flip Y for GL
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function heightToGlowCanvas(h, size) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.pow(h[i], 0.6) * 255; // wide soft bulb, hot centre
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/**
 * cellSize = size of one LED in geometry units (smaller = more dots).
 * Extruded front faces use x/y of the shape as UVs, so repeat = 1 / cellSize.
 */
export function createLedTextures(cellSize = 0.06, renderer) {
  const h = dotHeight(CELL_PX);
  const make = (canvas, isColor) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / cellSize, 1 / cellSize);
    t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
    if (isColor) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return {
    glow: make(heightToGlowCanvas(h, CELL_PX), true),
    normal: make(heightToNormalCanvas(h, CELL_PX), false),
  };
}

/* ------------------------------------------------------------------ */
/* 2. Geometry: slab-serif M with star cut-outs + a star in the notch  */
/* ------------------------------------------------------------------ */

function starPath(cx, cy, outer, inner, points = 5, rot = Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

function mShape() {
  // Chunky slab-serif M, 3 wide x 2 tall (CCW)
  const p = [
    [0, 0], [1.1, 0], [1.1, 0.2], [0.9, 0.2], [0.9, 1.1],
    [1.5, 0.3], [2.1, 1.1], [2.1, 0.2], [1.9, 0.2], [1.9, 0],
    [3, 0], [3, 0.2], [2.8, 0.2], [2.8, 1.8], [3, 1.8], [3, 2],
    [2.2, 2], [1.5, 1.0], [0.8, 2], [0, 2], [0, 1.8], [0.2, 1.8],
    [0.2, 0.2], [0, 0.2],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape(p);

  // star holes punched through both legs
  [0.55, 2.45].forEach((x) => {
    shape.holes.push(new THREE.Path(starPath(x, 1.0, 0.24, 0.1).reverse()));
  });
  return shape;
}

const extrudeOpts = (depth) => ({
  depth,
  bevelEnabled: true,
  bevelThickness: 0.04,
  bevelSize: 0.03,
  bevelSegments: 2,
});

/** Word layout in shape units: "M" (3 wide) + gap + "B" (2.45 wide), centred. */
export const MB_LAYOUT = (() => {
  const mW = 3, bW = 2.45, gap = 0.3;
  const total = mW + gap + bW;
  const mx = -total / 2; // left edge of M
  const bx = mx + mW + gap; // left edge of B
  return { mW, bW, gap, total, mx, bx, mCenter: mx + mW / 2 };
})();

/** x = left edge of the M in shape units (default: M alone, centred). */
export function createLedMGeometry({ scale = 1, depth = 0.4, x = -1.5 } = {}) {
  const geo = new THREE.ExtrudeGeometry(mShape(), extrudeOpts(depth));
  geo.translate(x, -1, -depth / 2);
  geo.scale(scale, scale, scale);
  return geo;
}

/** Solid star that sits in the V-notch of the M (shares the LED material).
 *  cx = x of the M's centre line. */
export function createNotchStarGeometry({ scale = 1, depth = 0.4, cx = 0 } = {}) {
  const s = new THREE.Shape(starPath(0, 0, 0.3, 0.13));
  const geo = new THREE.ExtrudeGeometry(s, extrudeOpts(depth * 0.8));
  geo.translate(cx, 0.55, -depth * 0.4); // notch centre sits 0.55 above middle
  geo.scale(scale, scale, scale);
  return geo;
}

/** Slab-serif B (2.45 wide x 2 tall) with two counters and a star cut-out in the stem. */
function bShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(1.35, 0);
  s.bezierCurveTo(2.1, 0, 2.45, 0.25, 2.45, 0.5); // lower bowl
  s.bezierCurveTo(2.45, 0.78, 2.2, 0.95, 1.9, 1.0); // waist
  s.bezierCurveTo(2.15, 1.05, 2.3, 1.25, 2.3, 1.5); // upper bowl
  s.bezierCurveTo(2.3, 1.78, 2.05, 2, 1.35, 2);
  s.lineTo(0, 2);
  s.lineTo(0, 1.8);
  s.lineTo(0.2, 1.8);
  s.lineTo(0.2, 0.2);
  s.lineTo(0, 0.2);
  s.closePath();

  // upper counter
  const top = new THREE.Path();
  top.moveTo(0.9, 1.28);
  top.lineTo(1.3, 1.28);
  top.bezierCurveTo(1.62, 1.28, 1.7, 1.4, 1.7, 1.45);
  top.bezierCurveTo(1.7, 1.52, 1.62, 1.62, 1.3, 1.62);
  top.lineTo(0.9, 1.62);
  top.closePath();
  s.holes.push(top);

  // lower counter
  const bot = new THREE.Path();
  bot.moveTo(0.9, 0.38);
  bot.lineTo(1.4, 0.38);
  bot.bezierCurveTo(1.85, 0.38, 1.9, 0.55, 1.9, 0.6);
  bot.bezierCurveTo(1.9, 0.68, 1.85, 0.82, 1.4, 0.82);
  bot.lineTo(0.9, 0.82);
  bot.closePath();
  s.holes.push(bot);

  // star punched through the stem, matching the M's legs
  s.holes.push(new THREE.Path(starPath(0.55, 1.0, 0.24, 0.1).reverse()));
  return s;
}

/** x = left edge of the B in shape units. */
export function createLedBGeometry({ scale = 1, depth = 0.4, x = 0 } = {}) {
  const geo = new THREE.ExtrudeGeometry(bShape(), extrudeOpts(depth));
  geo.translate(x, -1, -depth / 2);
  geo.scale(scale, scale, scale);
  return geo;
}

/* ------------------------------------------------------------------ */
/* 3. Materials: [front/back faces = LED matrix, sides = dark metal]   */
/* ------------------------------------------------------------------ */

export function createLedMaterials({ envMap, renderer, cellSize = 0.06 } = {}) {
  const tex = createLedTextures(cellSize, renderer);

  const front = new THREE.MeshStandardMaterial({
    color: 0x0a0d14,
    metalness: 0.5,
    roughness: 0.35,
    normalMap: tex.normal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    emissive: 0xdfeaff, // cool white like the reference
    emissiveMap: tex.glow,
    emissiveIntensity: 1.8, // >1 plays nicely with bloom
    envMap,
    envMapIntensity: 0.3,
  });

  const side = new THREE.MeshStandardMaterial({
    color: 0x9aa4b4,
    metalness: 1,
    roughness: 0.25,
    envMap,
    envMapIntensity: 0.42,
  });

  return { materials: [front, side], textures: tex };
}