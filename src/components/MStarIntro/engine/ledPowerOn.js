import * as THREE from "three";

/**
 * LED "power-on" for the MB word.
 *
 * No extra geometry, no overlay plane: the effect is injected into the existing MB materials, so it can
 * only ever light pixels that belong to the letters. Nothing outside the word is affected.
 *
 *  uReveal 0 -> panels are unpowered (near-black, faint grid still visible)
 *  uReveal 0..1 -> power spreads outward from the centre of the word; every LED cell ignites with a small
 *                  random delay, and a thin bright wavefront rides the edge of the lit region (only on the letters)
 *  uReveal 1 -> fully powered, material looks exactly as before
 */
export const POWER = {
  dim: 0.045,        // brightness of an unpowered panel (0 = invisible, 1 = fully lit)
  edge: 0.42,        // softness of the power front (normalised to word half-size)
  cellJitter: 0.2,   // per-LED random ignition delay
  cell: 0.06,        // LED cell size in word units (matches ledM cellSize roughly)
  front: 1.1,        // brightness of the wavefront
  frontWidth: 0.16,
  tint: [0.66, 0.82, 1.0],
};

export function createPowerUniforms(center, half) {
  return {
    uReveal: { value: 0 },
    uCenter: { value: new THREE.Vector2(center.x, center.y) },
    uHalf: { value: new THREE.Vector2(half.x, half.y) },
    uDim: { value: POWER.dim },
    uEdge: { value: POWER.edge },
    uJitter: { value: POWER.cellJitter },
    uCell: { value: POWER.cell },
    uFront: { value: POWER.front },
    uFrontW: { value: POWER.frontWidth },
    uTint: { value: new THREE.Vector3(...POWER.tint) },
  };
}

export function applyPowerOn(material, uniforms) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLedPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLedPos = position;");

    const head = /* glsl */ `
      varying vec3 vLedPos;
      uniform float uReveal, uDim, uEdge, uJitter, uCell, uFront, uFrontW;
      uniform vec2 uCenter, uHalf;
      uniform vec3 uTint;
      float ledHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    `;
    const apply = /* glsl */ `
      {
        vec2 q = (vLedPos.xy - uCenter) / uHalf;
        float d = length(q);
        float h = ledHash(floor(vLedPos.xy / uCell));
        d += (h - 0.5) * uJitter;                         // cells ignite slightly out of order
        float r = mix(-0.3, 1.9, uReveal);                // power front radius (word is ~1.4 at the corners)
        float lit = 1.0 - smoothstep(r - uEdge, r, d);    // 1 behind the front, 0 ahead of it
        float k = mix(uDim, 1.0, lit);
        float fr = exp(-pow((d - (r - uEdge * 0.35)) / uFrontW, 2.0)) * (1.0 - smoothstep(0.8, 1.0, uReveal));
        gl_FragColor.rgb = gl_FragColor.rgb * k + uTint * fr * uFront * (0.55 + 0.9 * h) * step(0.0001, uReveal);
      }
    `;

    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\n" + head);
    const hook = shader.fragmentShader.includes("#include <opaque_fragment>")
      ? "#include <opaque_fragment>"
      : "#include <output_fragment>";
    shader.fragmentShader = shader.fragmentShader.replace(hook, hook + "\n" + apply);
  };
  material.customProgramCacheKey = () => "ledPowerOn";
  material.needsUpdate = true;
}