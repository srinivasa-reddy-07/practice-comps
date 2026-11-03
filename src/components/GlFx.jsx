import React, { useEffect, useRef } from "react";
import * as THREE from "three";

/*
  GlFx: one small WebGL layer behind the timeline.
  - fullscreen fragment shader: domain-warped smoke tinted by the current film's colour
  - scroll velocity stretches the smoke into streaks (the line "leans into" the move)
  - cursor bends the smoke and adds a soft light
  - a shockwave ring fires from the active dot each time the film changes
  - ~500 dust points with scroll parallax

  Cost control: DPR capped at 1.25, no antialias, no postprocessing,
  pauses when off-screen or tab hidden, skipped with prefers-reduced-motion.

  Exposes (through apiRef.current):
    setTone("#hex")        smoothly blends the colour
    pulse(clientX, clientY) shockwave from a screen point
*/

const hexToVec = (hex) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return new THREE.Vector3(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
};

const FULL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FULL_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime, uVel, uTravel, uPulseT, uAspect;
  uniform vec2 uMouse, uPulseC;
  uniform vec3 uTone;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.02 + 7.3;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
    vec2 m = (uMouse - 0.5) * vec2(uAspect, 1.0);

    // cursor bends the field
    vec2 dm = p - m;
    float md = length(dm);
    float lens = exp(-md * 3.2);
    p += normalize(dm + 1e-4) * lens * 0.09;

    // shockwave from the active dot
    vec2 pc = (uPulseC - 0.5) * vec2(uAspect, 1.0);
    float pr = length(p - pc);
    float front = uPulseT * 1.6;
    float ring = smoothstep(0.07, 0.0, abs(pr - front)) * (1.0 - uPulseT);
    p += normalize(p - pc + 1e-4) * ring * 0.05;

    // travel + velocity streaks
    float streak = 1.0 + min(abs(uVel), 1.0) * 3.0;
    p.x = p.x / streak + uTravel * 0.55;

    float t = uTime * 0.05;
    vec2 q = vec2(fbm(p * 1.5 + t), fbm(p * 1.5 + vec2(5.2, 1.3) - t));
    float f = fbm(p * 1.3 + 2.4 * q + t * 0.6);
    float v = smoothstep(0.28, 0.95, f);

    vec3 base = vec3(0.020, 0.020, 0.024);
    vec3 col = mix(base, uTone * 0.5, v * v);
    col += uTone * pow(v, 5.0) * 0.4;
    col += uTone * lens * 0.14;
    col += uTone * ring * 0.55;

    // thin film-strip scanline shimmer that wakes up with speed
    float scan = sin(vUv.y * 900.0) * 0.5 + 0.5;
    col += uTone * scan * 0.012 * min(abs(uVel) * 2.0, 1.0);

    // vignette
    float vig = smoothstep(1.15, 0.2, length((uv - 0.5) * vec2(1.15, 1.0)));
    col *= mix(0.45, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const DUST_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime, uTravel, uVel, uDpr;
  varying float vA;
  void main() {
    float speed = 0.25 + aSeed * 1.1;
    float x = mod(position.x - uTravel * speed * 0.7 + 1.1, 2.2) - 1.1;
    float y = position.y + sin(uTime * 0.25 + aSeed * 40.0) * 0.025;
    gl_Position = vec4(x, y, 0.0, 1.0);
    gl_PointSize = (1.2 + aSeed * 3.2) * uDpr * (1.0 + min(abs(uVel), 1.0) * 0.8);
    vA = 0.15 + aSeed * 0.55;
  }
`;

const DUST_FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uTone;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    gl_FragColor = vec4(uTone * 1.3, a);
  }
`;

export default function GlFx({ apiRef, className = "", dust = 520 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
      });
    } catch {
      return; // no WebGL: the page still works, just without the shader
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    renderer.setPixelRatio(dpr);
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera(); // unused: shaders write clip space directly

    const tone = hexToVec("#8f7bff");
    const toneTarget = tone.clone();

    const u = {
      uTime: { value: 0 },
      uVel: { value: 0 },
      uTravel: { value: 0 },
      uPulseT: { value: 1 },
      uAspect: { value: 1 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uPulseC: { value: new THREE.Vector2(0.5, 0.5) },
      uTone: { value: tone },
      uDpr: { value: dpr },
    };

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: FULL_VERT,
        fragmentShader: FULL_FRAG,
        uniforms: u,
        depthTest: false,
        depthWrite: false,
      }),
    );
    bg.frustumCulled = false;
    scene.add(bg);

    const pos = new Float32Array(dust * 3);
    const seed = new Float32Array(dust);
    for (let i = 0; i < dust; i++) {
      pos[i * 3] = Math.random() * 2.2 - 1.1;
      pos[i * 3 + 1] = Math.random() * 2 - 1;
      seed[i] = Math.random();
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const points = new THREE.Points(
      dustGeo,
      new THREE.ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        uniforms: u,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.frustumCulled = false;
    scene.add(points);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      u.uAspect.value = w / h;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* input */
    const mouseT = new THREE.Vector2(0.5, 0.5);
    const onMove = (e) => {
      const r = mount.getBoundingClientRect();
      mouseT.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    if (apiRef) {
      apiRef.current = {
        setTone: (hex) => toneTarget.copy(hexToVec(hex)),
        pulse: (cx, cy) => {
          const r = mount.getBoundingClientRect();
          u.uPulseC.value.set((cx - r.left) / r.width, 1 - (cy - r.top) / r.height);
          u.uPulseT.value = 0;
        },
      };
    }

    /* loop */
    let raf = 0;
    let running = true;
    let visible = true;
    let lastY = window.scrollY;
    let vel = 0;
    let last = performance.now();

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!running || !visible) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      vel += (Math.max(-1, Math.min(1, dy / 70)) - vel) * 0.1;

      u.uTime.value += dt;
      u.uVel.value = vel;
      u.uTravel.value = y * 0.00045;
      if (u.uPulseT.value < 1) u.uPulseT.value = Math.min(1, u.uPulseT.value + dt * 0.6);
      u.uMouse.value.lerp(mouseT, 0.08);
      u.uTone.value.lerp(toneTarget, 0.05);

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
      },
      { threshold: 0 },
    );
    io.observe(mount);

    const onVis = () => {
      running = !document.hidden;
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      if (apiRef) apiRef.current = null;
      bg.geometry.dispose();
      bg.material.dispose();
      dustGeo.dispose();
      points.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [apiRef, dust]);

  return <div ref={mountRef} aria-hidden="true" className={className} />;
}

/* =================================================================
   PhotoGl: the detail photo as a living shader.
   - the picture "develops" outward in a ripple from where you clicked
     (from the centre when you step to the next film)
   - RGB split + lens that follow the cursor, stronger when you move fast
   - one canvas, only renders while the overlay is open
================================================================= */
const PHOTO_FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2 uRes, uTexRes, uOrigin, uMouse;
  uniform float uP, uTime, uSpeed;
  uniform vec3 uTone;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  vec2 cover(vec2 uv) {
    vec2 ratio = uRes / uTexRes;
    float s = max(ratio.x, ratio.y);
    vec2 par = (uMouse - 0.5) * -0.025;
    return (uv - 0.5) * ratio / s * 0.93 + 0.5 + par;
  }

  void main() {
    vec2 asp = vec2(uRes.x / uRes.y, 1.0);
    vec2 uv = vUv;

    // ripple that sweeps out from the origin
    vec2 d = (uv - uOrigin) * asp;
    float r = length(d);
    vec2 dir = d / (r + 1e-4);
    float front = uP * 2.3;
    float env = exp(-pow((r - front) * 4.5, 2.0));
    float wave = sin((r - front) * 42.0) * env * (1.0 - uP);
    vec2 off = dir * wave * 0.03;

    // cursor lens
    vec2 md = (uv - uMouse) * asp;
    float lens = exp(-dot(md, md) * 8.0);
    off -= md * lens * (0.05 + uSpeed * 0.05);

    // chromatic split: ripple radial, cursor speed horizontal
    float ca = 0.0015 + uSpeed * 0.014 + env * (1.0 - uP) * 0.012;
    vec2 cv = mix(vec2(1.0, 0.0), dir, env) * ca;

    vec3 col;
    col.r = texture2D(uTex, cover(uv + off + cv)).r;
    col.g = texture2D(uTex, cover(uv + off)).g;
    col.b = texture2D(uTex, cover(uv + off - cv)).b;

    // not yet reached by the front: undeveloped (dark, grey, crushed)
    float reach = smoothstep(front + 0.04, front - 0.18, r);
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 undev = vec3(g) * 0.18;
    col = mix(undev, col, reach);

    // light riding the wavefront, in the film's colour
    col += uTone * env * (1.0 - uP) * 0.45;
    col += uTone * lens * 0.06;

    float vig = smoothstep(1.2, 0.25, length((uv - 0.5) * vec2(1.1, 1.0)));
    col *= mix(0.7, 1.0, vig);
    col += (hash(vUv * uRes + uTime) - 0.5) * 0.035;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function PhotoGl({ src, open, index, x, y, className = "" }) {
  const mountRef = useRef(null);
  const api = useRef(null);
  const live = useRef({ open: false, was: false, hold: 0, ox: 0.5, oy: 0.5 });
  live.current.open = open;

  /* renderer, created once */
  useEffect(() => {
    const mount = mountRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    const canvas = renderer.domElement;
    canvas.style.cssText =
      "display:block;width:100%;height:100%;opacity:0;transition:opacity .35s";
    mount.appendChild(canvas);

    const u = {
      uTex: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTexRes: { value: new THREE.Vector2(1, 1) },
      uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uP: { value: 1 },
      uTime: { value: 0 },
      uSpeed: { value: 0 },
      uTone: { value: new THREE.Vector3(0.6, 0.5, 1) },
    };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: FULL_VERT,
        fragmentShader: PHOTO_FRAG,
        uniforms: u,
        depthTest: false,
        depthWrite: false,
      }),
    );
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.Camera();

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      u.uRes.value.set(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const mouseT = new THREE.Vector2(0.5, 0.5);
    let lastM = new THREE.Vector2(0.5, 0.5);
    const onMove = (e) => {
      const r = mount.getBoundingClientRect();
      mouseT.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let t = 1;
    api.current = {
      canvas,
      u,
      play(cx, cy) {
        const r = mount.getBoundingClientRect();
        const ox = cx == null ? 0.5 : (cx - r.left) / r.width;
        const oy = cy == null ? 0.5 : 1 - (cy - r.top) / r.height;
        live.current.ox = ox;
        live.current.oy = oy;
        u.uOrigin.value.set(ox, oy);
        t = 0;
        u.uP.value = 0;
      },
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!live.current.open && now > live.current.hold) return;
      u.uTime.value += dt;
      if (t < 1) {
        t = Math.min(1, t + dt / 1.9);
        u.uP.value = 1 - Math.pow(1 - t, 2.4);
      }
      u.uMouse.value.lerp(mouseT, 0.09);
      const sp = u.uMouse.value.distanceTo(lastM) * 14;
      lastM.copy(u.uMouse.value);
      u.uSpeed.value += (Math.min(sp, 1) - u.uSpeed.value) * 0.12;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      u.uTex.value?.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      api.current = null;
    };
  }, []);

  /* texture follows the current film */
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    let dead = false;
    a.canvas.style.transition = "none";
    a.canvas.style.opacity = "0"; // the plain <img> underneath shows meanwhile
    new THREE.TextureLoader().load(
      src,
      (tex) => {
        if (dead) return tex.dispose();
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        a.u.uTex.value?.dispose();
        a.u.uTex.value = tex;
        a.u.uTexRes.value.set(tex.image.width, tex.image.height);
        a.canvas.style.transition = "opacity .35s";
        a.canvas.style.opacity = "1";
        if (live.current.open) a.play(null, null);
      },
      undefined,
      () => {},
    );
    return () => {
      dead = true;
    };
  }, [src]);

  /* open: ripple from the click. step: ripple from the centre. close: keep rendering until it wipes out */
  useEffect(() => {
    const a = api.current;
    if (!a) return;
    const L = live.current;
    if (open) {
      if (!L.was) {
        a.play(x, y);
        a.u.uMouse.value.set(0.5, 0.5);
      } else a.play(null, null);
    } else if (L.was) {
      L.hold = performance.now() + 1200;
    }
    L.was = open;
  }, [open, index, x, y]);

  return <div ref={mountRef} aria-hidden="true" className={className} />;
}