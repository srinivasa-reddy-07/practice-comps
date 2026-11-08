import * as THREE from "three";
import { gsap } from "gsap";
import { BurstStars } from "./burstStars.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { LOOK, DURATION } from "../config.js";
import { loadPortraitPixels, samplePortrait } from "./portraitSampler.js";
import { ParticleSystem } from "./particleSystem.js";
import { FloorStars } from "./floorStars.js";
import { HeroObjects } from "./heroObjects.js";
import { createState, buildTimeline } from "./timeline.js";

/**
 * Framework-agnostic engine. The React component is a thin wrapper around this class.
 *   const e = new MStarEngine({ container, colorSrc, monoSrc }); await e.init(); e.play();
 *   e.dispose() releases every GL resource and kills the GSAP timeline.
 */
export class MStarEngine {
  constructor({
    container,
    colorSrc,
    monoSrc,
    particleCount = LOOK.particleCount,
    seed = LOOK.seed,
    sampler = {},
    autoPlay = true,
    idleShimmer = false,
    preserveDrawingBuffer = false,
    onReady,
    onFrame,
    onComplete,
    onProgress,
    onStateChange,
    onError,
  }) {
    Object.assign(this, {
      container,
      colorSrc,
      monoSrc,
      particleCount,
      seed,
      sampler,
      autoPlay,
      idleShimmer,
      preserveDrawingBuffer,
      onReady,
      onFrame,
      onComplete,
      onProgress,
      onStateChange,
      onError,
    });
    this.S = createState();
    this.disposed = false;
    this.idle = 0;
    this.dirty = true;
    this.ready = false;
    this._last = 0;
    this._tick = this._tick.bind(this);
  }

  async init() {
    try {
      const px = await loadPortraitPixels(this.colorSrc, this.monoSrc);
      if (this.disposed) return;
      this.portrait = samplePortrait(px, this.particleCount, {
        ...this.sampler,
        seed: this.seed,
      });
      this._build();
      this.ready = true;
      this.onReady?.();
      if (this.autoPlay) this.play();
      else {
        this.timeline.pause(0);
        this.dirty = true;
        this._emit();
      }
    } catch (err) {
      if (!this.disposed) {
        console.error(err);
        this.onError?.(err);
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  _build() {
    const el = this.container;
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: this.preserveDrawingBuffer,
    });
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = LOOK.exposure;
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;";
    el.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(LOOK.fov, LOOK.aspect, 0.1, 120);

    // procedural studio environment => chrome reflections without shipping an HDR file
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envTex = this.pmrem.fromScene(
      new RoomEnvironment(renderer),
      0.04,
    ).texture;

    this.hero = new HeroObjects(this.envTex);
    this.particles = new ParticleSystem(this.portrait, this.seed);
    this.floorStars = new FloorStars(
      this.portrait.bounds,
      this.envTex,
      this.seed,
    );
    // this.scene.add(this.hero.group, this.particles.mesh, this.floorStars.mesh);

    this.burstStars = new BurstStars(
      this.portrait.bounds,
      this.envTex,
      this.seed,
    );
    this.scene.add(
      this.hero.group,
      this.particles.mesh,
      this.floorStars.mesh,
      this.burstStars.mesh,
    );

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(256, 256),
      LOOK.bloom.base,
      LOOK.bloom.radius,
      LOOK.bloom.threshold,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.timeline = buildTimeline(this.S, {
      onComplete: () => {
        this.dirty = true;
        this._emit();
        this.onComplete?.();
      },
    });

    this.timeline.timeScale(1);

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(el);
    this.resize();

    renderer.setAnimationLoop(this._tick);
  }

  resize() {
    if (!this.renderer) return;
    const w = Math.max(2, this.container.clientWidth),
      h = Math.max(2, this.container.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.setSize(w * dpr * 0.5, h * dpr * 0.5);
    this.camera.aspect = w / h;
    // narrower than the native 1.43:1 => pull back so the whole portrait stays inside the frame
    this._fit = Math.max(1, LOOK.aspect / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  // _tick() {
  //   if (this.disposed || !this.ready) return;
  //   const now = performance.now();
  //   const dt = Math.min((now - (this._last || now)) / 1000, 0.1);
  //   this._last = now;
  //   const tl = this.timeline;
  //   const playing = !tl.paused();
  //   const ended = tl.progress() >= 1;
  //   if (playing && ended && this.idleShimmer) this.idle += dt;
  //   const animating = playing && !(ended && !this.idleShimmer);
  //   if (!animating && !this.dirty) return;
  //   this.dirty = false;

  //   const S = this.S;
  //   const t = tl.time() + this.idle;
  //   this.hero.update(S);
  //   this.particles.update(S, t);
  //   this.floorStars.update(S, t);
  //   this.burstStars.update(S, t);
  //   this.bloom.strength = S.bloom;

  //   const dist = LOOK.baseDistance * this._fit + S.dolly;
  //   this.camera.position.set(
  //     Math.sin(S.orbit) * dist,
  //     0,
  //     Math.cos(S.orbit) * dist,
  //   );
  //   this.camera.lookAt(0, 0, 0);

  //   this.composer.render();
  //   this.onFrame?.(this.renderer.domElement);
  //   // this.onProgress?.(tl.time() / DURATION);
  //   this.onProgress?.(tl.time() / tl.duration());

  // }

    _tick() {
    if (this.disposed || !this.ready) return;
    const now = performance.now();
    const dt = Math.min((now - (this._last || now)) / 1000, 0.1);
    this._last = now;
    const tl = this.timeline;
    const playing = !tl.paused();
    const ended = tl.progress() >= 1;
    if (playing && ended && this.idleShimmer) this.idle += dt;
    const animating = playing && !(ended && !this.idleShimmer);
    if (!animating && !this.dirty) return;
    this.dirty = false;

    const S = this.S;
    const t = tl.time() + this.idle;

    // camera distance is needed first: the hero uses it so the MB can fly out through the camera
    const dist = LOOK.baseDistance * this._fit + S.dolly;

    this.hero.update(S, dist);
    this.particles.update(S, t);
    this.floorStars.update(S, t);
    this.burstStars.update(S, t);
    this.bloom.strength = S.bloom;

    this.camera.position.set(
      Math.sin(S.orbit) * dist,
      0,
      Math.cos(S.orbit) * dist,
    );
    this.camera.lookAt(0, 0, 0);

    this.composer.render();
    this.onFrame?.(this.renderer.domElement);
    this.onProgress?.(tl.time() / Math.max(tl.duration(), 1e-6));
  }

  _emit() {
    this.onStateChange?.({
      playing: !this.timeline.paused() && this.timeline.progress() < 1,
      ended: this.timeline.progress() >= 1,
    });
  }

  // ---------------------------------------------------------------------------------------------
  play() {
    if (!this.ready) return;
    if (this.timeline.progress() >= 1) return this.restart();
    this.timeline.play();
    this._emit();
  }
  pause() {
    if (!this.ready) return;
    this.timeline.pause();
    this.dirty = true;
    this._emit();
  }
  toggle() {
    this.timeline.paused() || this.timeline.progress() >= 1
      ? this.play()
      : this.pause();
  }
  restart() {
    if (!this.ready) return;
    this.idle = 0;
    this.timeline.restart();
    this.dirty = true;
    this._emit();
  }
  seek(seconds) {
    if (!this.ready) return;
    this.idle = 0;
    // this.timeline.seek(Math.min(Math.max(seconds, 0), DURATION), false);
    this.timeline.seek(Math.min(Math.max(seconds, 0), this.timeline.duration()), false);
    this.dirty = true;
    this._emit();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._ro?.disconnect();
    this.renderer?.setAnimationLoop(null);
    if (this.timeline) {
      this.timeline.kill();
    }
    gsap.killTweensOf(this.S);
    this.particles?.dispose();
    this.floorStars?.dispose();
    this.burstStars?.dispose();
    this.hero?.dispose();
    this.composer?.passes.forEach((p) => p.dispose?.());
    this.composer?.dispose?.();
    this.envTex?.dispose();
    this.pmrem?.dispose();
    this.scene?.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
    this.renderer = this.scene = this.camera = this.composer = null;
  }
}
