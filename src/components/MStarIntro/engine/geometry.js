import * as THREE from 'three';

/** Faceted 5-pointed "pyramid" star (the classic chrome star), flat-shaded so every facet catches light on its own. */
export function createStarGeometry({ outer = 1, inner = 0.42, height = 0.36 } = {}) {
  const ring = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outer : inner;
    ring.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
  }
  const front = new THREE.Vector3(0, 0, height);
  const back = new THREE.Vector3(0, 0, -height);
  const v = [];
  for (let i = 0; i < 10; i++) {
    const a = ring[i], b = ring[(i + 1) % 10];
    v.push(front.x, front.y, front.z, a.x, a.y, a.z, b.x, b.y, b.z);
    v.push(back.x, back.y, back.z, b.x, b.y, b.z, a.x, a.y, a.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals(); // non-indexed => face normals
  return g;
}

// Blocky "M" outline (counter-clockwise), unit box [-1,1]^2.
export const M_OUTLINE = [
  [-1, -1], [-0.6, -1], [-0.6, 0.5], [0, -0.32], [0.6, 0.5], [0.6, -1], [1, -1],
  [1, 1], [0.52, 1], [0, 0.2], [-0.52, 1], [-1, 1],
];

/** Extruded, bevelled 3D "M" centred on the origin. */
export function createMGeometry({ scale = 1.2, depth = 0.5, bevel = 0.05 } = {}) {
  const shape = new THREE.Shape();
  M_OUTLINE.forEach(([x, y], i) => (i ? shape.lineTo(x * scale, y * scale) : shape.moveTo(x * scale, y * scale)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments: 1,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Seeded uniform samples over the M's front face (mostly) and volume, so the particles start exactly where the metal letter was. */
export function sampleMPoints(count, rand, { scale = 1.2, depth = 0.5, bevel = 0.05 } = {}) {
  const poly = M_OUTLINE.map(([x, y]) => [x * scale, y * scale]);
  const out = new Float32Array(count * 3);
  const zFront = depth / 2 + bevel;
  for (let i = 0; i < count; ) {
    const x = (rand() * 2 - 1) * scale, y = (rand() * 2 - 1) * scale;
    if (!inPoly(x, y, poly)) continue;
    out[i * 3] = x; out[i * 3 + 1] = y;
    out[i * 3 + 2] = rand() < 0.72 ? zFront + 0.004 : (rand() - 0.5) * depth;
    i++;
  }
  return out;
}
