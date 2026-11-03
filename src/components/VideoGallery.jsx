import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const BASE = import.meta.env?.VITE_VIDEO_BASE_URL ?? "/videos";
const DEFAULT_CLIPS = Array.from({ length: 10 }, (_, i) => ({
  src: `${BASE}/v${i + 1}.mov`,
  title: `Edit ${i + 1}`,
}));


// const DEFAULT_NAV = [
//   { label: "Home", href: "/" },
//   { label: "Videos", href: "/videos" },
//   { label: "Photos", href: "/photos" },
//   { label: "About", href: "/about" },
// ];

const display = { fontFamily: "'Fraunces', Georgia, serif" };
const sans = { fontFamily: "'Instrument Sans', system-ui, sans-serif" };
const CONCURRENCY = 2;

// Sparse light streaks that stretch with speed. Set to false to remove.
const MOTES = true;
const MOTE_LEN = 220;

/* ---------------- shaders ---------------- */

const TILE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TILE_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uOuter, uTilt;
uniform float uReady, uAlpha, uHover, uLook, uTime, uSpeed, uAspect, uVidAspect, uSeed, uPlain, uSheen;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float box(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
// cover-fit a tile-space coordinate (q in -0.5..0.5) into video uv
vec2 vidUV(vec2 q, float zoom){
  vec2 uv = q / zoom;
  float r = uAspect / uVidAspect;
  if (r > 1.0) uv.y /= r; else uv.x *= r;
  return uv + 0.5;
}
void main(){
  if (uAlpha <= 0.001) discard;

  // height-normalised coordinates; quad is padded to leave room for the halo
  vec2 p = (vUv - 0.5) * uOuter;
  vec2 hs = vec2(uAspect, 1.0) * 0.5;
  float d = box(p, hs, 0.05);
  float shape = 1.0 - smoothstep(-0.003, 0.003, d);

  float focus = mix(max(uHover, uLook * 0.85), 1.0, uPlain);
  float halo = exp(-max(d, 0.0) * 6.0) * (1.0 - shape);
  // the halo stays on while watching, as a quieter ambient glow
  float haloA = halo * (0.08 + 0.55 * focus) * uReady * mix(1.0, 0.55, uPlain);
  if (shape <= 0.001 && haloA <= 0.003) discard;

  // video sampling: cover-fit, hover zoom, tilt parallax, ripple, RGB split with speed
  vec2 q = p / (hs * 2.0);
  float zoom = 1.0 + (0.035 + uHover * 0.05) * (1.0 - uPlain);
  vec2 uv = vidUV(q - uTilt * 0.10 * (1.0 - uPlain), zoom);
  uv.x += sin(uv.y * 22.0 + uTime * 3.0) * 0.0025 * uHover * (1.0 - uPlain);

  vec2 off = vec2(uSpeed * 0.010, 0.0);
  vec3 vid = vec3(texture2D(uMap, uv + off).r, texture2D(uMap, uv).g, texture2D(uMap, uv - off).b);

  float lum = dot(vid, vec3(0.299, 0.587, 0.114));
  vid = mix(vec3(lum), vid, 0.55 + 0.45 * focus);
  vid *= mix(0.45, 1.0, focus);
  // soft inner falloff gives the frame some depth
  vid *= 1.0 - 0.22 * smoothstep(0.3, 0.8, length(q)) * (1.0 - uPlain);

  vec3 ph = vec3(0.10, 0.08, 0.13) + 0.05 * sin(uTime * 1.4 + uSeed + vUv.x * 3.0 + vUv.y * 2.0);

  // wipe-in reveal with a bright leading edge
  float n = hash(floor((q + 0.5) * 16.0) + uSeed);
  float rad = length(q) * 1.4 + n * 0.3;
  float front = uReady * 1.7 - 0.2;
  float reveal = 1.0 - smoothstep(front - 0.12, front, rad);
  float edge = reveal * (1.0 - reveal) * 4.0;
  vec3 col = mix(ph, vid, reveal) + vec3(0.95, 0.62, 0.72) * edge * 0.6;

  // glass sheen that sweeps across once when the cursor lands on the tile
  float sh = smoothstep(0.10, 0.0, abs(q.x * 0.75 + q.y * 0.65 - uSheen));
  col += vec3(1.0, 0.88, 0.92) * sh * 0.20 * shape * (1.0 - uPlain);

  // rim light that slowly travels around the frame
  float rim = 1.0 - smoothstep(0.0, 0.008, abs(d + 0.004));
  vec3 rc = mix(vec3(0.85, 0.54, 0.63), vec3(0.98, 0.82, 0.70), 0.5 + 0.5 * sin(atan(p.y, p.x) * 2.0 + uTime * 0.8));
  col += rc * rim * (0.12 + 0.9 * uHover + 0.3 * uLook) * (1.0 - uPlain);

  // halo takes its colour from the video itself (ambient light)
  vec3 haloCol = vec3(0.85, 0.40, 0.58);
  if (shape < 0.5 && focus > 0.04) {
    vec2 qe = clamp(q, vec2(-0.5), vec2(0.5)) * 0.8;
    vec2 b = vidUV(qe, 1.0);
    vec3 amb = (
      texture2D(uMap, b + vec2(0.04, 0.0)).rgb +
      texture2D(uMap, b - vec2(0.04, 0.0)).rgb +
      texture2D(uMap, b + vec2(0.0, 0.04)).rgb +
      texture2D(uMap, b - vec2(0.0, 0.04)).rgb
    ) * 0.25;
    haloCol = mix(haloCol, amb * 1.5 + vec3(0.03), clamp(focus, 0.0, 1.0) * uReady * 0.85);
  }

  col = mix(haloCol, col, shape);
  float a = max(shape, haloA * 0.6);
  gl_FragColor = vec4(col, a * uAlpha);
}`;

// Backdrop: plain, smooth plum-to-rose gradient with a soft glow
const NEB_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const NEB_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vDir;
void main(){
  vec3 dd = normalize(vDir);
  // smooth plum gradient, warmest at the horizon, no texture or particles
  float h = 1.0 - abs(dd.y);
  vec3 col = mix(vec3(0.050, 0.028, 0.050), vec3(0.120, 0.052, 0.088), pow(h, 2.0));
  // one wide, soft rose glow behind the videos
  col += vec3(0.10, 0.038, 0.062) * pow(max(-dd.z, 0.0), 5.0);
  gl_FragColor = vec4(col, 1.0);
}`;

// Light streaks: each mote is a 2-vertex line, tail stretched by travel speed.
// Positions are recycled in the shader, so there is no per-frame CPU work.
const MOTE_VERT = /* glsl */ `
attribute float aEnd;
attribute float aSeed;
uniform float uTravel, uAmp, uLen, uFade, uTime;
varying float vA;
const float ML = ${MOTE_LEN.toFixed(1)};
vec2 curve(float s){
  return uAmp * vec2(sin(s * 0.011) + 0.35 * sin(s * 0.027 + 1.3), 0.6 * cos(s * 0.008 + 0.4));
}
void main(){
  float d = mod(position.z - uTravel, ML);
  float s = uTravel + d;
  vec3 p = vec3(position.xy + curve(s), -uTravel - d);
  p.xy += vec2(sin(uTime * 0.3 + aSeed * 40.0), cos(uTime * 0.27 + aSeed * 31.0)) * 0.8;
  p.z -= aEnd * uLen;
  float fade = smoothstep(0.0, 14.0, d) * (1.0 - smoothstep(ML * 0.55, ML, d));
  vA = fade * (0.18 + 0.5 * aSeed) * (1.0 - aEnd) * uFade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const MOTE_FRAG = /* glsl */ `
varying float vA;
void main(){ gl_FragColor = vec4(0.96, 0.78, 0.84, vA); }`;

const FINAL_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const FINAL_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uTime, uFx, uAspect, uPlain, uShock, uShockAmp;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 c = vUv - 0.5;
  vec2 ca = c * vec2(uAspect, 1.0);
  float r2 = dot(ca, ca);
  float rr = sqrt(r2);
  float fx = clamp(uFx, 0.0, 1.6);

  // one-shot shockwave radiating from the centre (entry, focus, close)
  float wave = exp(-pow((rr - uShock * 1.15) * 7.0, 2.0)) * (1.0 - uShock) * uShockAmp;
  vec2 sdir = ca / (rr + 1e-4);
  vec2 shock = vec2(sdir.x / uAspect, sdir.y) * wave * 0.035;

  vec2 uv = 0.5 + c * (1.0 - fx * 0.10 * r2) - shock;
  vec2 dir = c * (0.0015 + 0.008 * fx) * (0.5 + r2 * 3.0);
  vec3 col = vec3(texture2D(tDiffuse, uv + dir).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir).b);
  col += vec3(0.95, 0.60, 0.72) * wave * 0.10;

  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col *= mix(vec3(1.0), vec3(1.07, 0.99, 0.94), smoothstep(0.35, 1.0, l));
  col += vec3(0.010, 0.004, 0.018) * (1.0 - smoothstep(0.0, 0.4, l));

  float v = 1.0 - smoothstep(0.25, 0.95, sqrt(r2));
  col *= mix(0.5, 1.0, v);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.03;
  gl_FragColor = vec4(mix(col, texture2D(tDiffuse, vUv - shock).rgb, uPlain), 1.0);
}`;

/* ---------------- helpers ---------------- */

const mod = (a, m) => ((a % m) + m) % m;
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const fmt = (s) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// JS twin of the GLSL curve()
const curveAt = (s, amp, out) =>
  out.set(
    amp * (Math.sin(s * 0.011) + 0.35 * Math.sin(s * 0.027 + 1.3)),
    amp * 0.6 * Math.cos(s * 0.008 + 0.4),
  );

// UI sounds only: no music, no ambience. Created on the entry click.
function makeAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const blip = (f0, f1, dur, vol) => {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  // one second of noise, reused for every whoosh
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const whoosh = (vol = 0.07, rising = true) => {
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(rising ? 260 : 1600, t);
    f.frequency.exponentialRampToValueAtTime(rising ? 2400 : 220, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + 1.05);
  };

  return {
    setMaster: (on) =>
      master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05),
    tick: () => blip(1400, 700, 0.09, 0.05),
    click: () => blip(900, 420, 0.08, 0.08),
    whoosh,
    suspend: () => ctx.suspend?.(),
    resume: () => ctx.resume?.(),
    close: () => ctx.close?.(),
  };
}

// Letters rise out of a mask. Pure CSS, so there is no re-render cost.
function Split({ text, delay = 0, step = 0.04 }) {
  let n = 0;
  const words = text.split(" ");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, wi) => (
          <span key={wi}>
            <span className="-mx-[0.08em] -my-[0.12em] inline-block overflow-hidden px-[0.08em] py-[0.12em] align-bottom">
              {[...w].map((c, ci) => (
                <span
                  key={ci}
                  className="vg-ch inline-block"
                  style={{ animationDelay: `${(delay + n++ * step).toFixed(3)}s` }}
                >
                  {c}
                </span>
              ))}
            </span>
            {wi < words.length - 1 && " "}
          </span>
        ))}
      </span>
    </>
  );
}

/* ---------------- component ---------------- */

export default function VideoGallery({
  clips = DEFAULT_CLIPS,
  // navLinks = DEFAULT_NAV,
  homeHref = "/",
  homeLabel = "Home",
  title = "The Cloud Cuckoo Land",
  subtitle = "A collection of video edits",
}) {
  const rootRef = useRef(null);
  const mountRef = useRef(null);
  const ringRef = useRef(null);
  const ringLabelRef = useRef(null);
  const dotRef = useRef(null);
  const heroRef = useRef(null);
  const barRef = useRef(null);
  const thumbRef = useRef(null);
  const timeRef = useRef(null);
  const lastFocus = useRef(0);
  const api = useRef({});

  const [ready, setReady] = useState(0);
  const [slow, setSlow] = useState(false);
  const [entered, setEntered] = useState(false);
  const [focus, setFocus] = useState(null);
  const [focusSeq, setFocusSeq] = useState(0);
  const [near, setNear] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [hint, setHint] = useState(true);
  const [fine] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches,
  );

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, []);

  /* ---------------- the world ---------------- */
  useEffect(() => {
    const root = rootRef.current;
    const mount = mountRef.current;
    const ring = ringRef.current;
    const ringLabel = ringLabelRef.current;
    const dot = dotRef.current;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const small = window.innerWidth < 768;

    // Tube layout: rings of tiles wrapped around a winding travel path
    const RINGS = 10;
    const PER_RING = small ? 5 : 3;
    const R_BASE = small ? 26 : 65;
    const SPACING = small ? 24 : 36;
    const N = RINGS * PER_RING;
    const L = RINGS * SPACING;
    const AMP = (small ? 5 : 10) * (reduce ? 0.35 : 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: false, // MSAA lives on the composer's render target instead
      powerPreference: "high-performance",
    });
    const PR = Math.min(window.devicePixelRatio, small ? 1.5 : 1.75);
    renderer.setPixelRatio(PR);
    renderer.setClearColor(0x0d0a10);
    const canvas = renderer.domElement;
    canvas.style.touchAction = "none";
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);

    /* post-processing */
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: small ? 0 : 4,
    });
    const composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(PR);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.45,
      0.8,
      0.6,
    );
    composer.addPass(bloom);
    const fin = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uFx: { value: 0 },
        uAspect: { value: 1 },
        uPlain: { value: 0 },
        uShock: { value: 1 },
        uShockAmp: { value: 1 },
      },
      vertexShader: FINAL_VERT,
      fragmentShader: FINAL_FRAG,
    });
    composer.addPass(fin);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      fin.uniforms.uAspect.value = w / h;
    };
    resize();

    /* mutable world state */
    const W = {
      travel: 0,
      uv: 0,
      cruise: reduce ? 1.5 : 3.5,
      yaw: 0,
      pitch: 0,
      tyaw: 0,
      tpitch: 0,
      fovBase: 72,
      fx: 0,
      flash: 0,
      reveal: 0.35,
      F: 0,
      S: 1,
      focus: null,
      sound: true,
      fvid: null,
      entered: false,
      paused: false,
      overUI: false,
      down: false,
      dragDist: 0,
      lastY: 0,
      lastT: 0,
      swipe: 0,
      lastNav: 0,
      touched: false,
      near: -1,
      plain: 0,
      shock: 1,
      shockAmp: 1,
      lastSec: -1,
    };
    let audio = null;

    const pulse = (amp = 1) => {
      if (reduce) return;
      gsap.killTweensOf(W, "shock");
      W.shock = 0;
      W.shockAmp = amp;
      gsap.to(W, { shock: 1, duration: 1.8, ease: "power2.out" });
    };

    const sources = clips.map((clip) => ({
      clip,
      video: null,
      texture: null,
      tiles: [],
      settled: false,
    }));

    /* backdrop: smooth gradient that follows the camera */
    const nebMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: NEB_VERT,
      fragmentShader: NEB_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    const nebGeo = new THREE.SphereGeometry(400, 24, 16);
    const neb = new THREE.Mesh(nebGeo, nebMat);
    neb.renderOrder = -3;
    neb.frustumCulled = false;
    scene.add(neb);

    /* light streaks: live inside the tube, so they always read in front of the tiles */
    let moteGeo = null;
    let moteMat = null;
    if (MOTES && !reduce) {
      const M = small ? 90 : 240;
      const pos = new Float32Array(M * 2 * 3);
      const end = new Float32Array(M * 2);
      const seed = new Float32Array(M * 2);
      const mr = rng(77);
      for (let i = 0; i < M; i++) {
        const a = mr() * Math.PI * 2;
        const r = (small ? 3 : 6) + Math.sqrt(mr()) * R_BASE * 0.78;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const z = mr() * MOTE_LEN;
        const s = mr();
        for (let e = 0; e < 2; e++) {
          const j = i * 2 + e;
          pos.set([x, y, z], j * 3);
          end[j] = e;
          seed[j] = s;
        }
      }
      moteGeo = new THREE.BufferGeometry();
      moteGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      moteGeo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
      moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      moteMat = new THREE.ShaderMaterial({
        uniforms: {
          uTravel: { value: 0 },
          uAmp: { value: AMP },
          uLen: { value: 0.5 },
          uFade: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: MOTE_VERT,
        fragmentShader: MOTE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const lines = new THREE.LineSegments(moteGeo, moteMat);
      lines.frustumCulled = false;
      lines.renderOrder = 5;
      scene.add(lines);
    }

    /* tiles */
    const dummy = new THREE.DataTexture(
      new Uint8Array([20, 16, 26, 255]),
      1,
      1,
    );
    dummy.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(1, 1);
    const rand = rng(11);

    const aspects = [16 / 9, 16 / 9, 9 / 16, 16 / 9, 4 / 3, 16 / 9, 1];
    const tiles = [];
    const sc = small ? 0.62 : 1;
    const TILT = small ? 45 : 80;
    const heightFor = (a) =>
      (a < 1 ? 28 : a === 1 ? 22 : a < 1.5 ? 20 : 18) * sc;
    const step = (Math.PI * 2) / PER_RING;

    for (let i = 0; i < N; i++) {
      const ring = Math.floor(i / PER_RING);
      const k = i % PER_RING;

      const aspect = aspects[(i * 3) % aspects.length];
      const h = heightFor(aspect);
      const w = h * aspect;
      const pad = h * 0.6; // room around the tile for the glow halo
      const ow = w + pad * 2;
      const oh = h + pad * 2;

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: dummy },
          uOuter: { value: new THREE.Vector2(ow / h, oh / h) },
          uTilt: { value: new THREE.Vector2() },
          uReady: { value: 0 },
          uAlpha: { value: 0 },
          uHover: { value: 0 },
          uLook: { value: 0 },
          uTime: { value: 0 },
          uSpeed: { value: 0 },
          uAspect: { value: aspect },
          uVidAspect: { value: 16 / 9 },
          uSeed: { value: rand() * 10 },
          uPlain: { value: 0 },
          uSheen: { value: 5 },
        },
        vertexShader: TILE_VERT,
        fragmentShader: TILE_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(ow, oh, 1);

      const theta =
        (k + (ring % 2) * 0.5) * step + (rand() - 0.5) * step * 0.14;
      const radius = R_BASE + (rand() - 0.5) * (small ? 6 : 12);
      const zJit = (rand() - 0.5) * SPACING * 0.14;

      const px = Math.cos(theta) * radius;
      const py = Math.sin(theta) * radius;
      mesh.position.set(px, py, 0);
      mesh.lookAt(0, 0, TILT);

      const clipIndex = i % sources.length;
      mesh.userData = {
        base: mod(ring * SPACING + zJit, L),
        clipIndex,
        w,
        h,
        ow,
        oh,
        px,
        py,
        q0: mesh.quaternion.clone(),
        ph: rand() * 20, // sway phase (frozen while focused)
        rx: 0,
        ry: 0,
        d: 0,
        alpha: 0,
        plain: 0,
        hov: 0,
        ready: false,
        lockZ: null,
      };

      sources[clipIndex].tiles.push(mesh);
      tiles.push(mesh);
      scene.add(mesh);
    }

    /* video loading */
    let cancelled = false;
    let active = 0;
    let next = 0;
    let readyCount = 0;

    const attach = (src) => {
      const v = src.video;
      const va =
        v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
      src.tiles.forEach((t) => {
        t.material.uniforms.uMap.value = src.texture;
        t.material.uniforms.uVidAspect.value = va;
        t.userData.ready = true;
        gsap.to(t.material.uniforms.uReady, {
          value: 1,
          duration: 1.6,
          delay: Math.random() * 0.6,
          ease: "power2.out",
        });
      });
    };
    const load = (src) => {
      active++;
      const v = document.createElement("video");
      v.crossOrigin = "anonymous";
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = "auto";
      const settle = (ok) => {
        if (src.settled || cancelled) return;
        src.settled = true;
        active--;
        if (ok) {
          src.video = v;
          src.texture = new THREE.VideoTexture(v);
          attach(src);
          setReady(++readyCount);
        }
        pump();
      };
      v.addEventListener(
        "canplay",
        () => {
          v.play().catch(() => {});
          settle(true);
        },
        { once: true },
      );
      v.addEventListener("error", () => settle(false), { once: true });
      v.src = src.clip.src;
      v.load();
    };
    const pump = () => {
      while (!cancelled && active < CONCURRENCY && next < sources.length)
        load(sources[next++]);
    };
    pump();

    /* focus camera */
    const up = new THREE.Vector3(0, 1, 0);
    const fFrom = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    const fTo = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    const fCur = { p: new THREE.Vector3(), q: new THREE.Quaternion() };

    const poseFor = (t) => {
      const P = t.position.clone();
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(t.userData.q0);
      const th = Math.tan(
        THREE.MathUtils.degToRad(W.fovBase * 0.5 > 30 ? 30 : W.fovBase * 0.5),
      );
      const D = Math.max(
        t.userData.h / (0.72 * 2 * th),
        t.userData.w / (0.82 * 2 * th * camera.aspect),
      );
      const pos = P.clone().addScaledVector(n, D);
      const m = new THREE.Matrix4().lookAt(pos, P, up);
      return { p: pos, q: new THREE.Quaternion().setFromRotationMatrix(m) };
    };

    const playFocus = (src) => {
      if (W.fvid && W.fvid !== src.video) W.fvid.muted = true;
      W.fvid = src.video;
      W.lastSec = -1;
      src.video.currentTime = 0;
      src.video.muted = !W.sound;
      src.video.play().catch(() => {});
    };

    const focusTile = (t) => {
      const to = poseFor(t);
      const first = !W.focus;
      if (W.focus) W.focus.userData.lockZ = null;
      if (first) {
        fFrom.p.copy(to.p);
        fFrom.q.copy(to.q);
      } else {
        fFrom.p.copy(fCur.p);
        fFrom.q.copy(fCur.q);
      }
      fTo.p.copy(to.p);
      fTo.q.copy(to.q);
      W.focus = t;
      t.userData.lockZ = t.position.z;
      playFocus(sources[t.userData.clipIndex]);
      setFocus(t.userData.clipIndex);
      audio?.click();
      if (first) audio?.whoosh(0.07, true);
      pulse(first ? 0.8 : 0.45);
      gsap.killTweensOf(W, "F,S");
      if (first) {
        W.S = 1;
        gsap.to(W, { F: 1, duration: 1.9, ease: "power3.inOut" });
      } else {
        W.S = 0;
        gsap.to(W, { S: 1, duration: 1.7, ease: "power3.inOut" });
      }
    };

    const exitFocus = () => {
      if (!W.focus) return;
      W.focus.userData.lockZ = null;
      W.focus = null;
      if (W.fvid) {
        W.fvid.muted = true;
        W.fvid = null;
      }
      setFocus(null);
      audio?.whoosh(0.05, false);
      pulse(0.5);
      gsap.killTweensOf(W, "F,S");
      gsap.to(W, { F: 0, duration: 1.5, ease: "power3.inOut" });
    };

    const tileForClip = (ci) => {
      let best = null;
      for (const t of tiles) {
        const u = t.userData;
        if (u.clipIndex !== ci || !u.ready || u.d < 26 || u.d > L * 0.85)
          continue;
        if (!best || u.d < best.userData.d) best = t;
      }
      return best;
    };
    const focusClip = (from, dir = 1) => {
      for (let k = 0; k < sources.length; k++) {
        const ci = mod(from + k * dir, sources.length);
        const t = tileForClip(ci);
        if (t && t !== W.focus) return focusTile(t);
      }
    };
    const stepClip = (dir) => {
      const now = performance.now();
      if (!W.focus || now - W.lastNav < 1400) return;
      W.lastNav = now;
      focusClip(W.focus.userData.clipIndex + dir, dir);
    };

    /* input */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const mouse = { x: 0, y: 0 };
    const pickUV = new THREE.Vector2();
    const touch = () => {
      if (!W.touched && W.entered) {
        W.touched = true;
        setHint(false);
      }
    };

    const setPointer = (e) => {
      mouse.x = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      mouse.y = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      ndc.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
    };
    // only counts hits on the tile itself, not its glow padding
    const pick = () => {
      raycaster.setFromCamera(ndc, camera);
      for (const h of raycaster.intersectObjects(tiles, false)) {
        const u = h.object.userData;
        if (!(u.alpha > 0.4 && u.ready && h.uv)) continue;
        const lx = (h.uv.x - 0.5) * u.ow;
        const ly = (h.uv.y - 0.5) * u.oh;
        if (Math.abs(lx) <= u.w / 2 && Math.abs(ly) <= u.h / 2) {
          pickUV.set(lx / u.w + 0.5, ly / u.h + 0.5);
          return h.object;
        }
      }
      return null;
    };

    let ringOn = false;
    gsap.set(ring, { xPercent: -50, yPercent: -50, scale: 0.25, opacity: 0 });
    gsap.set(dot, { xPercent: -50, yPercent: -50, opacity: 0 });
    const qx = fine
      ? gsap.quickTo(ring, "x", { duration: 0.45, ease: "power3" })
      : null;
    const qy = fine
      ? gsap.quickTo(ring, "y", { duration: 0.45, ease: "power3" })
      : null;
    const dx = fine
      ? gsap.quickTo(dot, "x", { duration: 0.1, ease: "power3" })
      : null;
    const dy = fine
      ? gsap.quickTo(dot, "y", { duration: 0.1, ease: "power3" })
      : null;
    const setRing = (on, label) => {
      if (label && ringLabel.textContent !== label)
        ringLabel.textContent = label;
      if (ringOn === on) return;
      ringOn = on;
      gsap.to(ring, {
        scale: on ? 1 : 0.25,
        duration: 0.45,
        ease: "power3.out",
        overwrite: "auto",
      });
      gsap.to(ringLabel, { opacity: on ? 1 : 0, duration: 0.25 });
      // the dot gives way to the labelled ring
      gsap.to(dot, {
        scale: on ? 0 : 1,
        duration: 0.3,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onMove = (e) => {
      setPointer(e);
      W.overUI = !!e.target.closest?.("[data-ui]");
      if (fine) {
        const vis = W.overUI || !W.entered ? 0 : 1;
        gsap.to([ring, dot], { opacity: vis, duration: 0.2, overwrite: "auto" });
        qx(e.clientX);
        qy(e.clientY);
        dx(e.clientX);
        dy(e.clientY);
      }
      if (W.down) {
        const now = performance.now();
        const ddy = e.clientY - W.lastY;
        const dt = Math.max(8, now - W.lastT) / 1000;
        W.dragDist += Math.abs(e.movementX || 0) + Math.abs(ddy);
        if (!W.focus) {
          const dT = -ddy * 0.05;
          W.travel += dT;
          W.uv = THREE.MathUtils.clamp(dT / dt, -110, 110);
        } else {
          W.swipe += ddy;
          if (Math.abs(W.swipe) > 110) {
            stepClip(W.swipe < 0 ? 1 : -1);
            W.swipe = 0;
          }
        }
        W.lastY = e.clientY;
        W.lastT = now;
        if (W.dragDist > 8) touch();
      }
    };
    const onDown = (e) => {
      if (!W.entered) return;
      setPointer(e);
      W.down = true;
      W.dragDist = 0;
      W.swipe = 0;
      W.lastY = e.clientY;
      W.lastT = performance.now();
    };
    const onUp = () => {
      W.down = false;
    };
    const onClick = (e) => {
      if (!W.entered || W.dragDist > 8) return;
      setPointer(e);
      touch();
      if (W.focus) return exitFocus();
      const t = pick();
      if (t && t.userData.d >= 26) focusTile(t);
      else if (t) W.uv = 40;
    };
    const onWheel = (e) => {
      if (!W.entered || W.overUI) return;
      e.preventDefault();
      const dyW = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      if (W.focus) {
        if (Math.abs(dyW) > 20) stepClip(dyW > 0 ? 1 : -1);
        return;
      }
      W.uv = THREE.MathUtils.clamp(W.uv + dyW * 0.15, -110, 110);
      touch();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("click", onClick);
    root.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", resize);

    api.current = {
      enter() {
        if (W.entered) return;
        W.entered = true;
        W.cruise = reduce ? 1.8 : 3.5;
        W.uv = reduce ? 0 : 95;
        audio = makeAudio();
        audio?.setMaster(W.sound);
        audio?.whoosh(0.09, true);
        pulse(1);
        gsap.to(W, { reveal: 1, duration: 2.4, ease: "power2.out" });
        gsap.fromTo(
          W,
          { fovBase: 84 },
          { fovBase: 60, duration: 2.8, ease: "power3.out" },
        );
        if (!reduce) {
          gsap.fromTo(
            W,
            { flash: 0.5 },
            { flash: 0, duration: 2.8, ease: "power2.out" },
          );
        }
      },
      focusClip: (i, dir) => W.entered && focusClip(i, dir),
      exit: exitFocus,
      setSound(on) {
        W.sound = on;
        audio?.setMaster(on);
        if (W.fvid) W.fvid.muted = !on;
      },
      setPaused(p) {
        W.paused = p;
        p ? audio?.suspend() : audio?.resume();
        sources.forEach(
          (s) =>
            s.video && (p ? s.video.pause() : s.video.play().catch(() => {})),
        );
      },
      seek(f) {
        if (W.fvid && W.fvid.duration) W.fvid.currentTime = f * W.fvid.duration;
      },
      push(v) {
        if (W.entered && !W.focus) {
          W.uv = THREE.MathUtils.clamp(W.uv + v * 1.5, -110, 110);
          touch();
        }
      },
    };

    /* loop */
    const clock = new THREE.Clock();
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    const tiltE = new THREE.Euler();
    const tiltQ = new THREE.Quaternion();
    const baseQ = new THREE.Quaternion();
    const fwd = new THREE.Vector3();
    const tv = new THREE.Vector3();
    const prevCam = new THREE.Vector3();
    const cA = new THREE.Vector2();
    const cB = new THREE.Vector2();
    const slopeAt = (s) => {
      curveAt(s - 2, AMP, cA);
      curveAt(s + 2, AMP, cB);
      return [Math.atan((cB.x - cA.x) / 4), Math.atan((cB.y - cA.y) / 4)];
    };
    let hovered = null;
    let prevHovered = null;
    let raf;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (W.paused) {
        clock.getDelta();
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      const motion = reduce ? 0 : 1;

      W.uv *= Math.exp(-dt * 2.2);
      const speed = (W.cruise + W.uv) * (1 - W.F);
      W.travel += speed * dt;

      // look: mouse + path tangent + bank into turns
      W.tyaw = -mouse.x * 0.55 * motion * (W.entered ? 1 : 0.4);
      W.tpitch = -mouse.y * 0.35 * motion * (W.entered ? 1 : 0.4);
      const k = 1 - Math.exp(-dt * 3);
      W.yaw += (W.tyaw - W.yaw) * k;
      W.pitch += (W.tpitch - W.pitch) * k;
      const [ax, ay] = slopeAt(W.travel);
      const [ax2] = slopeAt(W.travel + 10);
      euler.set(
        W.pitch + ay,
        W.yaw - ax,
        (W.tyaw - W.yaw) * 0.35 * motion + (ax - ax2) * 7,
      );
      baseQ.setFromEuler(euler);

      curveAt(W.travel, AMP, cA);
      camera.position.set(
        cA.x,
        cA.y + Math.sin(time * 0.6) * 0.15 * motion * (1 - W.F),
        -W.travel,
      );
      camera.quaternion.copy(baseQ);
      if (W.focus) {
        fCur.p.lerpVectors(fFrom.p, fTo.p, W.S);
        fCur.q.copy(fFrom.q).slerp(fTo.q, W.S);
      }
      if (W.F > 0.0001) {
        camera.position.lerp(fCur.p, W.F);
        camera.quaternion.slerp(fCur.q, W.F);
        // a little parallax while watching
        camera.rotateY(-mouse.x * 0.03 * W.F * motion);
        camera.rotateX(-mouse.y * 0.02 * W.F * motion);
        // faint handheld drift, which settles once the video is playing clean
        const drift = W.F * (1 - W.plain) * motion;
        camera.rotateZ(Math.sin(time * 0.45) * 0.006 * drift);
        camera.rotateX(Math.sin(time * 0.31 + 2) * 0.004 * drift);
      }
      const camSpeed =
        camera.position.distanceTo(prevCam) / Math.max(dt, 0.001);
      prevCam.copy(camera.position);
      const fxT = motion
        ? THREE.MathUtils.clamp(
            Math.max(Math.abs(speed) / 70, camSpeed / 90),
            0,
            1,
          )
        : 0;
      W.fx += (fxT - W.fx) * (1 - Math.exp(-dt * 4));
      camera.fov = W.fovBase + W.fx * 6;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      camera.getWorldDirection(fwd);

      // the treatment fades out once the focused video is actually playing
      const fv = W.focus ? sources[W.focus.userData.clipIndex].video : null;
      const playing = !!fv && fv.currentTime > 0.05 && !fv.paused;
      W.plain += ((playing ? 1 : 0) - W.plain) * (1 - Math.exp(-dt * 3));

      // tiles: place along the curve, sway, tilt toward cursor
      const tk = 1 - Math.exp(-dt * 8);
      for (const t of tiles) {
        const u = t.userData;
        const isF = t === W.focus;
        u.d = mod(u.base - W.travel, L);
        const z = isF ? u.lockZ : -W.travel + 10 - u.d;
        if (!isF) u.ph += dt;
        curveAt(-z, AMP, cA);
        t.position.set(
          u.px + cA.x + Math.sin(u.ph * 0.4) * 0.9 * motion,
          u.py + cA.y + Math.cos(u.ph * 0.33 * 1.7) * 0.9 * motion,
          z,
        );

        const lit = t === hovered && W.F < 0.01;
        u.ry += ((lit ? (pickUV.x - 0.5) * 0.38 : 0) - u.ry) * tk;
        u.rx += ((lit ? -(pickUV.y - 0.5) * 0.3 : 0) - u.rx) * tk;
        tiltE.set(u.rx * motion, u.ry * motion, 0);
        tiltQ.setFromEuler(tiltE);
        t.quaternion.copy(u.q0).multiply(tiltQ);
        t.updateMatrixWorld();

        let target =
          sstep(6, 26, u.d) * (1 - sstep(L * 0.45, L * 0.85, u.d)) * W.reveal;
        target = isF ? 1 : target * (1 - 0.92 * W.F);
        u.alpha += (target - u.alpha) * (1 - Math.exp(-dt * 8));
      }

      hovered = W.entered && W.F < 0.01 && !W.overUI && !W.down ? pick() : null;
      if (hovered !== prevHovered) {
        if (hovered && hovered.userData.d >= 26) {
          audio?.tick();
          if (!reduce) {
            gsap.fromTo(
              hovered.material.uniforms.uSheen,
              { value: -1 },
              { value: 1, duration: 1.1, ease: "power2.inOut", overwrite: true },
            );
          }
        }
        prevHovered = hovered;
      }
      if (W.entered && fine) {
        if (W.focus && !W.overUI) setRing(true, "Close");
        else if (hovered && hovered.userData.d >= 26)
          setRing(
            true,
            `Watch\n${String(hovered.userData.clipIndex + 1).padStart(2, "0")}`,
          );
        else setRing(false);
      }

      let nearBest = -1;
      let nearD = Infinity;
      for (const t of tiles) {
        const u = t.userData;
        u.hov +=
          ((t === hovered || t === W.focus ? 1 : 0) - u.hov) *
          (1 - Math.exp(-dt * 10));
        tv.copy(t.position).sub(camera.position).normalize();
        const dv = tv.dot(fwd);
        const m = t.material.uniforms;
        u.plain = t === W.focus ? W.plain : u.plain * Math.exp(-dt * 6);
        m.uPlain.value = u.plain;
        m.uAlpha.value = u.alpha;
        m.uHover.value = u.hov;
        m.uLook.value = sstep(0.5, 0.97, dv);
        m.uTime.value = time;
        m.uSpeed.value = W.fx * (1 - u.plain);
        m.uTilt.value.set(u.ry, u.rx);
        if (u.ready && u.d >= 26 && dv > 0.9 && u.d < nearD) {
          nearD = u.d;
          nearBest = u.clipIndex;
        }
      }
      if (nearBest !== W.near) {
        W.near = nearBest;
        setNear(nearBest);
      }

      neb.position.copy(camera.position);
      nebMat.uniforms.uTime.value = time;

      if (moteMat) {
        const sign = speed >= 0 ? 1 : -1;
        moteMat.uniforms.uTravel.value = W.travel;
        moteMat.uniforms.uTime.value = time;
        moteMat.uniforms.uLen.value =
          sign * THREE.MathUtils.clamp(0.5 + Math.abs(speed) * 0.12, 0.5, 14);
        moteMat.uniforms.uFade.value = W.reveal * (1 - W.F);
      }

      const fxAll = W.fx + W.flash * 0.7;
      fin.uniforms.uTime.value = time;
      fin.uniforms.uFx.value = fxAll;
      fin.uniforms.uPlain.value = W.plain;
      fin.uniforms.uShock.value = W.shock;
      fin.uniforms.uShockAmp.value = W.shockAmp;
      bloom.strength = (0.42 + W.fx * 0.5 + W.flash * 0.8) * (1 - W.plain);
      bloom.enabled = W.plain < 0.98;

      if (W.fvid && barRef.current && W.fvid.duration) {
        const pr = W.fvid.currentTime / W.fvid.duration;
        barRef.current.style.transform = `scaleX(${pr})`;
        if (thumbRef.current) thumbRef.current.style.left = `${pr * 100}%`;
        const sec = Math.floor(W.fvid.currentTime);
        if (sec !== W.lastSec && timeRef.current) {
          W.lastSec = sec;
          timeRef.current.textContent = `${fmt(sec)} / ${fmt(W.fvid.duration)}`;
        }
      }

      composer.render();
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      gsap.killTweensOf(W);
      gsap.killTweensOf(ring);
      gsap.killTweensOf(ringLabel);
      gsap.killTweensOf(dot);
      audio?.close();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("click", onClick);
      root.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", resize);
      sources.forEach((s) => {
        if (s.video) {
          s.video.pause();
          s.video.removeAttribute("src");
          s.video.load();
        }
        s.texture?.dispose();
      });
      tiles.forEach((t) => {
        gsap.killTweensOf(t.material.uniforms.uReady);
        gsap.killTweensOf(t.material.uniforms.uSheen);
        t.material.dispose();
      });
      geo.dispose();
      nebGeo.dispose();
      nebMat.dispose();
      moteGeo?.dispose();
      moteMat?.dispose();
      dummy.dispose();
      bloom.dispose?.();
      composer.dispose?.();
      rt.dispose();
      renderer.dispose();
      mount.removeChild(canvas);
    };
  }, [clips, fine]);

  /* ---------------- React-side wiring ---------------- */
  useEffect(() => {
    api.current.setSound?.(sound);
  }, [sound]);
  useEffect(() => {
    api.current.setPaused?.(menuOpen);
  }, [menuOpen]);

  // replays the title reveal each time a clip is opened
  useEffect(() => {
    if (focus !== null) setFocusSeq((s) => s + 1);
  }, [focus]);

  // magnetic UI: buttons lean toward the cursor and snap back with a little spring
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!fine || reduce) return;
    const root = rootRef.current;
    let cur = null;
    const release = (el) =>
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.8,
        ease: "elastic.out(1, 0.35)",
        overwrite: "auto",
      });
    const onMove = (e) => {
      const el = e.target.closest?.("[data-magnet]");
      if (cur && cur !== el) {
        release(cur);
        cur = null;
      }
      if (!el) return;
      cur = el;
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * 0.3,
        y: (e.clientY - (r.top + r.height / 2)) * 0.4,
        duration: 0.4,
        ease: "power3.out",
        overwrite: "auto",
      });
    };
    const onLeave = () => {
      if (cur) release(cur);
      cur = null;
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      if (cur) gsap.set(cur, { clearProps: "transform" });
    };
  }, [fine]);

  // entry title drifts opposite the cursor, a cheap sense of depth
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const el = heroRef.current;
    if (!fine || reduce || !el) return;
    const qx = gsap.quickTo(el, "x", { duration: 1.2, ease: "power3" });
    const qy = gsap.quickTo(el, "y", { duration: 1.2, ease: "power3" });
    const onMove = (e) => {
      qx(-(e.clientX / window.innerWidth - 0.5) * 28);
      qy(-(e.clientY / window.innerHeight - 0.5) * 18);
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      gsap.killTweensOf(el);
    };
  }, [fine]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (menuOpen) setMenuOpen(false);
        else api.current.exit?.();
      }
      if (menuOpen) return;
      if (focus !== null && e.key === "ArrowRight")
        api.current.focusClip(focus + 1, 1);
      if (focus !== null && e.key === "ArrowLeft")
        api.current.focusClip(focus - 1, -1);
      if (focus === null && (e.key === "ArrowUp" || e.key === "w"))
        api.current.push?.(45);
      if (focus === null && (e.key === "ArrowDown" || e.key === "s"))
        api.current.push?.(-45);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, menuOpen]);

  const needed = Math.min(3, clips.length);
  const canEnter = ready >= needed || slow;
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const enter = () => {
    if (entered) return;
    setEntered(true);
    api.current.enter();

    // the title breaks apart and the hero pushes toward the camera as the world opens
    const hero = heroRef.current;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!hero || reduce) return;
    gsap.to(hero.querySelectorAll(".vg-ch"), {
      yPercent: -120,
      opacity: 0,
      filter: "blur(10px)",
      duration: 0.9,
      ease: "power3.in",
      stagger: { each: 0.035, from: "center" },
    });
    gsap.to(hero.querySelectorAll("[data-fade]"), {
      opacity: 0,
      y: -12,
      duration: 0.6,
      ease: "power2.in",
    });
    gsap.to(hero, { scale: 1.12, duration: 1.6, ease: "power2.in" });
  };
  if (focus !== null) lastFocus.current = focus;
  const shown = clips[lastFocus.current] ?? clips[0];
  const browsing = entered && focus === null;

  // transitions stay off `transform` so the magnetic pull isn't fought by CSS
  const ui =
    "pointer-events-auto rounded-full border border-[#efe6dc]/30 bg-[#0d0a10]/55 px-5 py-2 text-sm backdrop-blur transition-[background-color,color,opacity] hover:bg-[#efe6dc] hover:text-[#0d0a10] focus-visible:ring-2 focus-visible:ring-[#efe6dc] outline-none";

  return (
    <section
      ref={rootRef}
      className={`relative h-screen w-full select-none overflow-hidden bg-[#0d0a10] text-[#efe6dc] ${fine && entered ? "cursor-none" : ""}`}
      style={sans}
    >
      <style>{`
        @keyframes vg-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes vg-char{from{opacity:0;transform:translateY(105%) rotate(5deg);filter:blur(8px)}to{opacity:1;transform:none;filter:blur(0)}}
        @keyframes vg-pulse{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.55);opacity:0}}
        .vg-ch{animation:vg-char 1.1s cubic-bezier(.2,.85,.2,1) backwards}
        .vg-pulse{animation:vg-pulse 2.6s cubic-bezier(.2,.6,.3,1) infinite}
        @media (prefers-reduced-motion:reduce){.vg-ch,.vg-pulse{animation:none}}
      `}</style>

      <div ref={mountRef} className="absolute inset-0" />

      {/* legibility scrim for the UI (vignette + grain now live in the shader) */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0d0a10]/55 via-transparent to-[#0d0a10]/65 transition-opacity duration-1000 ${focus !== null ? "opacity-0" : "opacity-100"}`}
      />

      <div
        ref={ringRef}
        className="pointer-events-none fixed left-0 top-0 z-50 flex h-24 w-24 items-center justify-center rounded-full border border-[#efe6dc] mix-blend-difference"
      >
        <span
          ref={ringLabelRef}
          className="whitespace-pre text-center text-xs leading-tight text-[#efe6dc] opacity-0"
        />
      </div>
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 z-50 h-1.5 w-1.5 rounded-full bg-[#efe6dc] mix-blend-difference"
      />

      <header
        data-ui
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 md:px-8 md:py-6"
      >
        <a href={homeHref} data-magnet className={ui}>
          {homeLabel}
        </a>
        
      </header>

      {/* clip rail: shows which clip is ahead, click to fly to it */}
      {clips.length > 1 && (
        <nav
          data-ui
          aria-label="Edits"
          className={`absolute left-5 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 transition-opacity duration-700 md:left-8 md:flex ${browsing ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          {clips.map((c, i) => (
            <button
              key={i}
              onClick={() => api.current.focusClip(i, 1)}
              aria-label={`Watch ${c.title}`}
              className="group flex items-center gap-3 py-1 outline-none"
            >
              <span
                className={`h-px transition-all duration-500 ${near === i ? "w-9 bg-[#d98aa0]" : "w-4 bg-[#efe6dc]/40 group-hover:w-7 group-focus-visible:w-7"}`}
              />
              <span
                className={`text-xs transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100 ${near === i ? "translate-x-0 text-[#d98aa0] opacity-100" : "-translate-x-1 opacity-0"}`}
              >
                {c.title}
              </span>
            </button>
          ))}
        </nav>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-5 pb-5 md:px-8 md:pb-7">
        {/* what's ahead: the edit you're flying toward */}
        <div className="w-24 md:w-56" aria-hidden="true">
          {browsing && near >= 0 && (
            <div
              key={near}
              className="hidden md:block"
              style={{ animation: "vg-rise 0.7s both" }}
            >
              <p className="text-sm text-[#d98aa0]">
                {near + 1} of {clips.length}
              </p>
              <p
                className="text-3xl font-light italic leading-tight tracking-[-0.02em]"
                style={{ ...display, textShadow: "0 0 24px #0d0a10" }}
              >
                {clips[near].title}
              </p>
            </div>
          )}
        </div>
        <p
          className={`text-center text-sm text-[#efe6dc]/75 transition-opacity duration-700 ${browsing && hint ? "opacity-100" : "opacity-0"}`}
          style={{ textShadow: "0 0 18px #0d0a10" }}
        >
          {fine
            ? "Scroll to travel. Move to look around. Click an edit to watch."
            : "Swipe to travel. Tap an edit to watch."}
        </p>
        <button
          data-ui
          data-magnet
          onClick={() => api.current.focusClip(0, 1)}
          className={`${ui} transition-opacity duration-500 ${browsing ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          Watch reel
        </button>
      </div>

      {/* watching bar */}
      <div
        data-ui
        className={`absolute inset-x-0 bottom-0 z-30 px-5 pb-5 transition-opacity duration-500 md:px-8 md:pb-7 ${focus !== null ? "opacity-100" : "pointer-events-none opacity-0"}`}
        style={{ transitionDelay: focus !== null ? "1100ms" : "0ms" }}
      >
        <div
          className="group mb-3 flex h-5 cursor-pointer items-center"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            api.current.seek((e.clientX - r.left) / r.width);
          }}
        >
          <div className="relative h-px w-full bg-[#efe6dc]/25 transition-[height] duration-300 group-hover:h-[3px]">
            <div
              ref={barRef}
              className="h-full origin-left bg-[#d98aa0]"
              style={{ transform: "scaleX(0)" }}
            />
            <span
              ref={thumbRef}
              className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 scale-50 rounded-full bg-[#efe6dc] shadow-[0_0_14px_#d98aa0] transition-transform duration-300 group-hover:scale-100"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div key={focusSeq}>
            <p
              className="text-[clamp(1.75rem,4.5vw,3.25rem)] font-light italic leading-none tracking-[-0.02em]"
              style={{ ...display, textShadow: "0 0 24px #0d0a10" }}
            >
              <Split text={shown.title} delay={1.0} step={0.03} />
            </p>
            <p
              className="mt-2 text-sm text-[#efe6dc]/55"
              style={{
                animation: focus !== null ? "vg-rise 0.8s 1.3s both" : "none",
              }}
            >
              {lastFocus.current + 1} of {clips.length}
              {" · "}
              <span ref={timeRef} className="tabular-nums">
                0:00 / 0:00
              </span>
              {clips.length > 1 && fine && " · scroll for the next edit"}
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            {clips.length > 1 && (
              <>
                <button
                  data-magnet
                  className={ui}
                  onClick={() => api.current.focusClip(focus - 1, -1)}
                >
                  Previous
                </button>
                <button
                  data-magnet
                  className={ui}
                  onClick={() => api.current.focusClip(focus + 1, 1)}
                >
                  Next
                </button>
              </>
            )}
            <button
              data-magnet
              className={ui}
              onClick={() => setSound((s) => !s)}
              aria-pressed={sound}
            >
              {sound ? "Sound on" : "Sound off"}
            </button>
            <button
              data-magnet
              className={ui}
              onClick={() => api.current.exit()}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* entry */}
      <div
        data-ui
        onClick={canEnter && !entered ? enter : undefined}
        className={`absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0d0a10]/55 px-6 backdrop-blur-md transition-opacity duration-[1400ms] ${entered ? "pointer-events-none opacity-0" : "cursor-pointer opacity-100"}`}
      >
        <div
          ref={heroRef}
          className="flex flex-col items-center justify-center gap-7"
        >
          <h1
            className="text-center text-[clamp(2.75rem,10vw,7.5rem)] font-light italic leading-[0.95] tracking-[-0.035em]"
            style={display}
          >
            <Split text={title} delay={0.15} step={0.05} />
          </h1>
          <p
            data-fade
            className="-mt-3 text-center text-base text-[#efe6dc]/70"
            style={{ animation: "vg-rise 0.9s 0.9s both" }}
          >
            {subtitle}
          </p>
          {canEnter ? (
            <>
              <div data-fade className="relative">
                <span
                  aria-hidden="true"
                  className="vg-pulse pointer-events-none absolute inset-0 rounded-full border border-[#d98aa0]/60"
                />
                <button
                  autoFocus
                  data-magnet
                  onClick={enter}
                  className="group relative rounded-full bg-[#efe6dc] px-9 py-4 text-base font-medium text-[#0d0a10] transition-[background-color] hover:bg-white focus-visible:ring-2 focus-visible:ring-[#d98aa0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0a10]"
                >
                  Enter gallery
                </button>
              </div>
              <p data-fade className="text-sm text-[#efe6dc]/60">
                Best with sound on.
              </p>
            </>
          ) : (
            <div
              data-fade
              className="w-52 text-center text-sm text-[#efe6dc]/70"
              aria-live="polite"
            >
              <p className="tabular-nums">
                Loading edits, {ready} of {clips.length}
              </p>
              <div className="mt-3 h-px w-full bg-[#efe6dc]/15">
                <div
                  className="h-px bg-[#d98aa0] transition-[width] duration-500"
                  style={{ width: `${(ready / clips.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}