import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

/* ------------------------------------------------------------------ */
/*  SETTINGS                                                           */
/* ------------------------------------------------------------------ */

// Lens coordinates live in the PNG's own pixel space. If you swap in a
// higher-res export of the same artwork, keep this at 1254.
const IMG_SIZE = 1254;

const settings = {
  characterURL: "/cool_maddy.png", // put cool_maddy.png in /public as maddy.png
  lensImageURL: "/mami8.jpg", // optional photo; the built-in sky/hill scene shows if it's missing
  lensColor: "#eb5e55", // flat lens colour (hides the baked-in glare stripe)
  glaresPerLens: 2,
  zoomLens: 0, // which lens the camera dives into (index in LENSES)
  lensPad: 1, // px grown past the red so the old PNG lens edge is covered
  zoomCoverFactor: 1.04, // >1 = zoom a little past "just covers the screen"

  // scroll timeline (0 -> 1 across the pinned section)
  glareEnd: 0.55, // glare bands finish sweeping
  zoomEnd: 0.6, // lens now fills the whole screen
  fadeStart: 0.42, // scene starts fading into the lens
  fadeEnd: 0.62, // ...fully visible
  headlineStart: 0.62, // headline words start revealing
  headlineEnd: 0.8,
  extrasStart: 0.78, // sub-text + button fade in
  extrasEnd: 0.92, // then it holds until the section unpins
};

// Ellipses fitted to the two red lenses in cool_maddy.png.
const LENSES = [
  { cx: 523.6, cy: 185.1, rx: 37.9, ry: 44.6, rot: 58.2 }, // upper-right lens
  { cx: 422.0, cy: 256.3, rx: 36.7, ry: 41.3, rot: 57.1 }, // lower-left lens
];

const lensGeo = LENSES.map((l, i) => {
  const rx = l.rx + settings.lensPad;
  const ry = l.ry + settings.lensPad;
  const t = (l.rot * Math.PI) / 180;
  const hw = Math.hypot(rx * Math.cos(t), ry * Math.sin(t));
  const hh = Math.hypot(rx * Math.sin(t), ry * Math.cos(t));
  const bounds = { x: l.cx - hw, y: l.cy - hh, width: hw * 2, height: hh * 2 };

  const bandWidth = bounds.width * 0.22;
  const sweepDistance = bounds.width + bandWidth * 2;
  const spacing = sweepDistance / settings.glaresPerLens;
  const bands = Array.from({ length: settings.glaresPerLens }, (_, b) => ({
    x: bounds.x + bounds.width * 0.3 - b * spacing,
    y: bounds.y - bounds.height * 0.25,
    width: bandWidth,
    height: bounds.height * 1.5,
  }));

  return { ...l, rx, ry, id: `lens-clip-${i}`, bounds, sweepDistance, bands };
});

const focus = LENSES[settings.zoomLens];
const zoomOrigin = `${(focus.cx / IMG_SIZE) * 100}% ${(focus.cy / IMG_SIZE) * 100}%`;

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function GlassScroll() {
  const containerRef = useRef(null);
  const spotlightRef = useRef(null);
  const zoomRef = useRef(null);
  const svgRef = useRef(null);
  const headerRef = useRef(null);
  const extrasRef = useRef(null);

  useEffect(() => {
    const lenis = new Lenis();
    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    let headerSplit = null;

    const ctx = gsap.context(() => {
      const clamp01 = gsap.utils.clamp(0, 1);
      const range = (p, a, b) => clamp01((p - a) / (b - a));
      const easeShift = gsap.parseEase("power2.inOut");

      const glareBands = gsap.utils
        .toArray(".glare-band", svgRef.current)
        .map((band) => ({ band, sweepDistance: parseFloat(band.dataset.sweep) }));
      const lensReveals = gsap.utils.toArray(".lens-reveal", svgRef.current);

      headerSplit = new SplitText(headerRef.current, {
        type: "words",
        wordsClass: "spotlight-word",
      });
      gsap.set(headerSplit.words, { opacity: 0 });
      gsap.set(extrasRef.current.children, { opacity: 0, y: 24 });
      gsap.set(lensReveals, { opacity: 0 });
      gsap.set(zoomRef.current, { transformOrigin: zoomOrigin });

      // --- measured from the real layout, re-run on every resize/refresh ---
      const m = { maxScale: 30, dx: 0, dy: 0 };
      const measure = () => {
        const sec = spotlightRef.current;
        const W = sec.clientWidth;
        const H = sec.clientHeight;
        const wrapW = zoomRef.current.offsetWidth; // image is square: height == width
        const k = wrapW / IMG_SIZE; // image px -> css px at scale 1

        // lens centre on screen at scale 1 (image is bottom-centred)
        const lensX = (W - wrapW) / 2 + focus.cx * k;
        const lensY = H - wrapW + focus.cy * k;

        // scale at which the lens's inscribed circle covers the viewport corners
        const rMin = Math.min(focus.rx, focus.ry) * k;
        m.maxScale = (Math.hypot(W, H) / 2 / rMin) * settings.zoomCoverFactor;

        // slide the lens centre to the middle of the screen as we zoom
        m.dx = W / 2 - lensX;
        m.dy = H / 2 - lensY;
      };

      ScrollTrigger.create({
        trigger: spotlightRef.current,
        start: "top top",
        end: () => "+=" + window.innerHeight * 3,
        pin: true,
        pinSpacing: true,
        scrub: true,
        onRefresh: measure,
        onUpdate: (self) => {
          const p = self.progress;

          // 1. glare bands sweep across the lenses
          const glareT = range(p, 0, settings.glareEnd);
          glareBands.forEach(({ band, sweepDistance }) => {
            gsap.set(band, { x: glareT * sweepDistance });
          });

          // 2. dive in: exponential scale (steady-feeling zoom) while the lens
          //    glides to screen centre. Finishes at zoomEnd, then holds.
          const zoomT = range(p, 0, settings.zoomEnd);
          const shiftT = easeShift(zoomT);
          gsap.set(zoomRef.current, {
            scale: Math.pow(m.maxScale, zoomT),
            x: m.dx * shiftT,
            y: m.dy * shiftT,
            force3D: false, // 2D transform so the bitmap re-rasterises per scale
          });

          // 3. scene inside the lens fades in as it fills the screen
          const fade = range(p, settings.fadeStart, settings.fadeEnd);
          gsap.set(lensReveals, { opacity: fade });

          // 4. headline reveals word by word
          const textT = range(p, settings.headlineStart, settings.headlineEnd);
          const words = headerSplit.words;
          words.forEach((word, i) => {
            gsap.set(word, { opacity: textT > 0 && textT >= i / words.length ? 1 : 0 });
          });

          // 5. sub-text + button stagger in, then hold
          const extrasT = range(p, settings.extrasStart, settings.extrasEnd);
          const extras = extrasRef.current.children;
          Array.from(extras).forEach((el, i) => {
            const t = clamp01(extrasT * (extras.length + 1) - i);
            gsap.set(el, { opacity: t, y: (1 - t) * 24 });
          });
        },
      });
    }, containerRef);

    return () => {
      headerSplit?.revert();
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return (
    <div ref={containerRef} className="font-['Barlow_Condensed',sans-serif] bg-[#252627]">
      <section className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden bg-[#252627] text-center text-white">
        <h1 className="w-3/4 text-[clamp(3rem,5vw,7rem)] font-black uppercase leading-[0.9] lg:w-auto">
          Scrolling May Cause Joy
        </h1>
      </section>

      <section
        ref={spotlightRef}
        className="relative h-[100svh] w-full overflow-hidden bg-[#eb5e55] text-white"
      >
        {/* bg-[#eb5e55] */}
        {/* character, bottom-centred; the inner div is what gets scaled */}
        <div className="absolute inset-0 flex items-end justify-center">
          <div ref={zoomRef} className="w-1/2 min-w-[700px] shrink-0">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${IMG_SIZE} ${IMG_SIZE}`}
              className="block h-auto w-full"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="lens-sky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f6dede" />
                  <stop offset="0.55" stopColor="#c3cbe8" />
                  <stop offset="1" stopColor="#b3c4ee" />
                </linearGradient>
                {lensGeo.map((l) => (
                  <clipPath id={l.id} key={l.id}>
                    <ellipse
                      cx={l.cx}
                      cy={l.cy}
                      rx={l.rx}
                      ry={l.ry}
                      transform={`rotate(${l.rot} ${l.cx} ${l.cy})`}
                    />
                  </clipPath>
                ))}
              </defs>

              {/* the PNG: rims, face, hair, hoodie, everything */}
              <image href={settings.characterURL} x="0" y="0" width={IMG_SIZE} height={IMG_SIZE} />

              {lensGeo.map((l) => (
                <g key={l.id} clipPath={`url(#${l.id})`}>
                  {/* flat tint covers the stripe baked into the PNG */}
                  <rect
                    x={l.bounds.x}
                    y={l.bounds.y}
                    width={l.bounds.width}
                    height={l.bounds.height}
                    fill={settings.lensColor}
                  />

                  {/* what lives inside the lens: built-in scene, with your photo on top */}
                  <g className="lens-reveal" opacity="0">
                    <rect
                      x={l.bounds.x}
                      y={l.bounds.y}
                      width={l.bounds.width}
                      height={l.bounds.height}
                      fill="url(#lens-sky)"
                    />
                    <ellipse
                      cx={l.bounds.x + l.bounds.width * 0.5}
                      cy={l.bounds.y + l.bounds.height * 1.08}
                      rx={l.bounds.width * 0.75}
                      ry={l.bounds.height * 0.38}
                      fill="#6f9a3a"
                    />
                    <image
                      href={settings.lensImageURL}
                      x={l.bounds.x}
                      y={l.bounds.y}
                      width={l.bounds.width}
                      height={l.bounds.height}
                      preserveAspectRatio="xMidYMid slice"
                    />
                    {/* soft dim so the headline stays readable */}
                    <rect
                      x={l.bounds.x}
                      y={l.bounds.y}
                      width={l.bounds.width}
                      height={l.bounds.height}
                      fill="#000"
                      opacity="0.22"
                    />
                  </g>

                  {l.bands.map((b, i) => (
                    <rect
                      key={i}
                      className="glare-band"
                      data-sweep={l.sweepDistance}
                      x={b.x}
                      y={b.y}
                      width={b.width}
                      height={b.height}
                      fill="#ffffff"
                      opacity="0.6"
                    />
                  ))}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* content shown inside the lens once it fills the screen */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-[90%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center lg:w-[45%]">
          <h1
            ref={headerRef}
            className="text-[clamp(3rem,5vw,7rem)] font-black uppercase leading-[0.9] [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]"
          >
            Insert Something Wildly Impressive Right Here
          </h1>
          <div ref={extrasRef} className="mt-6 flex flex-col items-center gap-5">
            <p className="max-w-md text-[clamp(1.1rem,1.6vw,1.6rem)] font-medium uppercase tracking-wide [text-shadow:0_2px_16px_rgba(0,0,0,0.4)]">
              A line of supporting copy lives here, right inside the lens.
            </p>
            <a
              href="#contact"
              className="pointer-events-auto rounded-full bg-white px-8 py-3 text-lg font-bold uppercase tracking-wider text-[#252627] transition-transform hover:scale-105"
            >
              Let&apos;s Talk
            </a>
          </div>
        </div>
      </section>

      <section className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden bg-[#252627] text-center text-white">
        <h1 className="w-3/4 text-[clamp(3rem,5vw,7rem)] font-black uppercase leading-[0.9] lg:w-auto">
          Thanks For Scrolling
        </h1>
      </section>
    </div>
  );
}