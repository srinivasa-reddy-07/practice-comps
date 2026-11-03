import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const FILMS = [
  {
    year: "2017",
    title: "Midnight Bazaar",
    role: "Lead",
    image: "/mami5.jpg",
    tone: "#ff4f8b",
  },
  {
    year: "2019",
    title: "Salt & Silk",
    role: "Zoya",
    image: "/mami4.jpg",
    tone: "#8f7bff",
  },
  {
    year: "2021",
    title: "Paper Boats",
    role: "Dr. Rao",
    image: "/mami3.jpg",
    tone: "#ffc94d",
  },
  {
    year: "2023",
    title: "The Long Monsoon",
    role: "Anjali",
    image: "/mami2.jpg",
    tone: "#3ddc97",
  },
  {
    year: "2024",
    title: "Last Light",
    role: "Meera",
    image: "/mami1.jpg",
    tone: "#ff6b3d",
  },
];

const DEFAULT_THEME = { background: "#050505", ink: "#f1ede6" };
const DEV_FROM = "grayscale(1) brightness(0.3) contrast(1.6) blur(12px)";
const DEV_TO = "grayscale(0) brightness(1) contrast(1) blur(0px)";
const REVEAL_FROM = "inset(100% 0% 0% 0%)";
const REVEAL_TO = "inset(0% 0% 0% 0%)";

const FOCUS = 0.42; // a film becomes "current" when its dot passes 42% of the screen
const CARD_H = 0.36; // open card height as a share of the stage
const DOT = 14;
const TILT_MAX = 16;
const DRIFT_MAX = 22;
const SMOOTHING = 0.075;

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

const serif = { fontFamily: "'Fraunces', serif" };
const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function useMode() {
  const [mode, setMode] = useState("v");
  useEffect(() => {
    const q = window.matchMedia(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    );
    const sync = () => setMode(q.matches ? "h" : "v");
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }, []);
  return mode;
}

/* text split into masked characters (no SplitText needed) */
const Chars = ({ text, cls = "ch" }) => (
  <>
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">
      {[...text].map((c, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden align-top pb-[0.16em] -mb-[0.16em] px-[0.04em] -mx-[0.04em]"
        >
          <span className={`${cls} inline-block will-change-transform`}>
            {c === " " ? "\u00A0" : c}
          </span>
        </span>
      ))}
    </span>
  </>
);

/* =================================================================
   DETAIL OVERLAY: circle-wipes out from wherever you clicked
================================================================= */
function Detail({ films, detail, onClose, onStep }) {
  const rootRef = useRef(null);
  const tlRef = useRef(null);
  const wasOpen = useRef(false);
  const film = films[detail.i];
  const prev = films[(detail.i - 1 + films.length) % films.length];
  const next = films[(detail.i + 1) % films.length];

  useIso(() => {
    const el = rootRef.current;
    if (!el) return;
    tlRef.current?.kill();
    const q = gsap.utils.selector(el);
    const at = `${detail.x}px ${detail.y}px`;

    if (detail.open) {
      const fresh = !wasOpen.current;
      document.documentElement.style.overflow = "hidden";
      gsap.set(el, { visibility: "visible" });
      gsap.set(q(".d-photo"), { scale: 1.12 });
      const tl = gsap.timeline();
      if (fresh) {
        tl.fromTo(
          el,
          { clipPath: `circle(0px at ${at})` },
          {
            clipPath: `circle(150vmax at ${at})`,
            duration: 1.1,
            ease: "expo.inOut",
          },
        );
      }
      tl.fromTo(
        q(".d-img"),
        { clipPath: REVEAL_FROM, filter: DEV_FROM },
        {
          clipPath: REVEAL_TO,
          filter: DEV_TO,
          duration: 1.3,
          ease: "expo.out",
        },
        fresh ? 0.5 : 0,
      )
        .fromTo(
          q(".d-ch"),
          { yPercent: 115, rotate: 5 },
          {
            yPercent: 0,
            rotate: 0,
            duration: 1,
            stagger: 0.03,
            ease: "expo.out",
          },
          fresh ? 0.7 : 0.1,
        )
        .fromTo(
          q(".d-fade"),
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.07,
            ease: "power3.out",
          },
          fresh ? 0.9 : 0.2,
        );
      tlRef.current = tl;
    } else if (wasOpen.current) {
      document.documentElement.style.overflow = "";
      tlRef.current = gsap
        .timeline()
        .to(el, {
          clipPath: `circle(0px at ${at})`,
          duration: 0.9,
          ease: "expo.inOut",
        })
        .set(el, { visibility: "hidden" });
    }
    wasOpen.current = detail.open;
  }, [detail.open, detail.i, detail.x, detail.y]);

  useEffect(() => {
    if (!detail.open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail.open, onClose, onStep]);

  useEffect(
    () => () => {
      document.documentElement.style.overflow = "";
    },
    [],
  );

  const onMove = (e) => {
    gsap.to(rootRef.current.querySelectorAll(".d-photo"), {
      x: (e.clientX / window.innerWidth - 0.5) * -28,
      y: (e.clientY / window.innerHeight - 0.5) * -28,
      duration: 0.9,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={film.title}
      aria-hidden={!detail.open}
      onMouseMove={onMove}
      className="fixed inset-0 z-[100] grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] overflow-hidden"
      style={{
        visibility: "hidden",
        background: "#050505",
        color: "#f1ede6",
        fontFamily: "'Instrument Sans', system-ui, sans-serif",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(ellipse at 78% 40%, ${film.tone}66, transparent 60%)`,
        }}
      />
      <div className="relative h-[44svh] lg:h-full p-5 lg:p-10">
        <div
          className="d-img relative h-full w-full overflow-hidden"
          style={{ background: film.tone }}
        >
          <img
            src={film.image}
            alt={`${film.title}, ${film.year}`}
            className="d-photo h-full w-full object-cover"
          />
        </div>
      </div>
      <div className="relative flex flex-col justify-between p-6 lg:p-14">
        <div className="d-fade flex items-baseline justify-between text-sm">
          <p className="tabular-nums opacity-70">
            {detail.i + 1} of {films.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-1 py-1 opacity-80 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Close
          </button>
        </div>
        <div className="py-8">
          <p
            className="d-fade text-[clamp(3rem,8vw,8rem)] leading-none italic font-light tracking-[-0.02em]"
            style={{
              ...serif,
              WebkitTextStroke: `1px ${film.tone}`,
              color: "transparent",
            }}
          >
            {film.year}
          </p>
          <h2
            className="mt-4 text-[clamp(2.4rem,5vw,5rem)] leading-[1.05] italic font-light tracking-[-0.02em]"
            style={serif}
          >
            <Chars text={film.title} cls="d-ch" />
          </h2>
          <p className="d-fade mt-5 text-lg italic opacity-80 flex items-center gap-3">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: film.tone }}
            />
            as {film.role}
          </p>
        </div>
        <div className="d-fade flex items-end justify-between gap-6 text-sm">
          <button
            type="button"
            onClick={() => onStep(-1)}
            className="text-left opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Previous
            <span className="block text-base italic" style={serif}>
              {prev.title}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            className="text-right opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            Next
            <span className="block text-base italic" style={serif}>
              {next.title}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================================================================
   MAIN
================================================================= */
export default function FilmTimeline({
  films = FILMS,
  theme = {},
  heading = "The reel",
}) {
  const t = { ...DEFAULT_THEME, ...theme };
  const mode = useMode();

  const [detail, setDetail] = useState({ open: false, i: 0, x: 0, y: 0 });
  const detailOpenRef = useRef(false);
  detailOpenRef.current = detail.open;
  const openDetail = useCallback(
    (i, x, y) => setDetail({ open: true, i, x, y }),
    [],
  );
  const closeDetail = useCallback(
    () => setDetail((d) => ({ ...d, open: false })),
    [],
  );
  const stepDetail = useCallback(
    (dir) =>
      setDetail((d) => ({
        ...d,
        i: (d.i + dir + films.length) % films.length,
      })),
    [films.length],
  );

  const outerRef = useRef(null);
  const stageRef = useRef(null);
  const trackRef = useRef(null);
  const glowRef = useRef(null);
  const grainRef = useRef(null);
  const barRef = useRef(null);
  const hintRef = useRef(null);
  const counterRef = useRef(null);
  const cursorRef = useRef(null);
  const goRef = useRef(() => {});

  const yearDigits = films[0]?.year.length || 4;

  /* ================= desktop: sticky horizontal journey ================= */
  useEffect(() => {
    if (mode !== "h") return;
    const stage = stageRef.current;
    const outer = outerRef.current;
    const track = trackRef.current;
    const cleanups = [];

    const ctx = gsap.context(() => {
      const glow = glowRef.current;
      const items = gsap.utils.toArray(".film", track);
      const inners = items.map((el) => el.querySelector(".film-inner"));
      const cols = gsap.utils.toArray(".odo-col", stage);
      const rail = gsap.utils.toArray(".rail-btn", stage);
      const n = items.length;

      /* ---------- measuring ---------- */
      let lefts = [];
      const getDist = () => Math.max(0, track.scrollWidth - stage.clientWidth);
      const cardSize = () => {
        const h = Math.round(stage.clientHeight * CARD_H);
        return { h, w: Math.round(h * 0.8) };
      };
      const measure = () => {
        outer.style.height = `${getDist() + stage.clientHeight}px`;
        lefts = items.map((el) => el.offsetLeft);
        const s = cardSize();
        stage.style.setProperty("--cw", `${s.w}px`);
        stage.style.setProperty("--ch", `${s.h}px`);
      };
      measure();
      ScrollTrigger.addEventListener("refreshInit", measure);
      cleanups.push(() =>
        ScrollTrigger.removeEventListener("refreshInit", measure),
      );

      /* ---------- ambient life ---------- */
      gsap.set(glow, { xPercent: -50, yPercent: -50 });
      gsap.to(glow, {
        xPercent: -42,
        yPercent: -56,
        duration: 7,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
      gsap.to(grainRef.current, {
        x: "random(-24, 24)",
        y: "random(-24, 24)",
        duration: 0.12,
        repeat: -1,
        repeatRefresh: true,
        ease: "steps(1)",
      });
      gsap.fromTo(
        ".ping",
        { scale: 1, opacity: 0.7 },
        {
          scale: 3.2,
          opacity: 0,
          duration: 2.4,
          repeat: -1,
          ease: "power2.out",
          stagger: 0.4,
        },
      );

      /* ---------- odometer year ---------- */
      const setYear = (yr, instant) => {
        String(yr)
          .split("")
          .forEach((d, k) => {
            if (!cols[k]) return;
            gsap.to(cols[k], {
              yPercent: -Number(d) * 10,
              duration: instant ? 0 : 1.3,
              delay: instant ? 0 : k * 0.06,
              ease: "expo.inOut",
              overwrite: "auto",
            });
          });
      };
      setYear(films[0].year, true);

      /* ---------- one controller per film ---------- */
      const ctrls = items.map((el, i) => {
        const tone = films[i].tone;
        const spot = el.querySelector(".spot");
        const card = el.querySelector(".card");
        const clip = el.querySelector(".clip");
        const drift = el.querySelector(".drift");
        const img = el.querySelector(".pimg");
        const flash = el.querySelector(".flash");
        const tag = el.querySelector(".tag");
        const pingw = el.querySelector(".pingwrap");

        const st = {
          active: false,
          hover: false,
          opened: false,
          frame: null,
          live: { x: 0, y: 0, tx: 0, ty: 0 },
          aim: { x: 0, y: 0, tx: 0, ty: 0 },
        };

        gsap.set(card, { xPercent: -50, yPercent: -50 });
        gsap.set(clip, { clipPath: REVEAL_FROM, filter: DEV_FROM });
        gsap.set(img, { scale: 1.4 });

        /* title / role / rule, played by "active" */
        const text = gsap.timeline({
          paused: true,
          defaults: { ease: "expo.out" },
        });
        text
          .fromTo(
            el.querySelectorAll(".ch"),
            { yPercent: 115, rotate: 5 },
            { yPercent: 0, rotate: 0, duration: 1, stagger: 0.03 },
            0,
          )
          .fromTo(
            el.querySelector(".rule"),
            { scaleX: 0 },
            { scaleX: 1, duration: 1, ease: "expo.inOut" },
            0.1,
          )
          .fromTo(
            el.querySelector(".role"),
            { opacity: 0, x: -16 },
            { opacity: 0.8, x: 0, duration: 0.8 },
            0.35,
          );

        /* dot <-> card, same idea as Spotlight's CARD_DOT / CARD_OPEN */
        const sync = () => {
          const want = st.active || st.hover;
          if (want === st.opened) return;
          st.opened = want;
          const { w, h } = cardSize();
          if (want) {
            gsap.to(card, {
              width: w,
              height: h,
              borderRadius: "0.5rem",
              boxShadow: `0 40px 90px -30px ${tone}`,
              duration: 0.95,
              ease: "expo.out",
              overwrite: "auto",
            });
            gsap.to(clip, {
              clipPath: REVEAL_TO,
              filter: DEV_TO,
              duration: 1.1,
              ease: "expo.out",
              overwrite: "auto",
              delay: 0.12,
            });
            gsap.fromTo(
              flash,
              { opacity: 0.45 },
              { opacity: 0, duration: 0.6, delay: 0.4, overwrite: "auto" },
            );
            gsap.to([tag, pingw], {
              opacity: 0,
              duration: 0.3,
              overwrite: "auto",
            });
          } else {
            gsap.to(card, {
              width: DOT,
              height: DOT,
              borderRadius: 2,
              boxShadow: `0 0 26px 5px ${tone}`,
              duration: 0.6,
              ease: "expo.inOut",
              overwrite: "auto",
            });
            gsap.to(clip, {
              clipPath: REVEAL_FROM,
              filter: DEV_FROM,
              duration: 0.5,
              ease: "power3.in",
              overwrite: "auto",
            });
            gsap.to(tag, {
              opacity: 0.6,
              duration: 0.5,
              delay: 0.3,
              overwrite: "auto",
            });
            gsap.to(pingw, {
              opacity: 1,
              duration: 0.5,
              delay: 0.3,
              overwrite: "auto",
            });
          }
        };

        /* tilt + counter-drift (lifted from Spotlight) */
        const startTracking = () => {
          if (st.frame) return;
          st.frame = () => {
            const { live, aim } = st;
            live.x += (aim.x - live.x) * SMOOTHING;
            live.y += (aim.y - live.y) * SMOOTHING;
            live.tx += (aim.tx - live.tx) * SMOOTHING;
            live.ty += (aim.ty - live.ty) * SMOOTHING;
            gsap.set(card, {
              x: live.x,
              y: live.y,
              rotateX: live.tx,
              rotateY: live.ty,
            });
            gsap.set(drift, { x: -live.x, y: -live.y });
          };
          gsap.ticker.add(st.frame);
        };
        const stopTracking = () => {
          if (st.frame) gsap.ticker.remove(st.frame);
          st.frame = null;
        };
        cleanups.push(stopTracking);

        const enter = () => {
          st.hover = true;
          Object.assign(st.live, { x: 0, y: 0, tx: 0, ty: 0 });
          Object.assign(st.aim, { x: 0, y: 0, tx: 0, ty: 0 });
          gsap.killTweensOf([card, drift], "x,y,rotateX,rotateY");
          sync();
          startTracking();
        };
        const move = (e) => {
          if (!st.hover) return;
          const b = spot.getBoundingClientRect();
          const cx = b.left + b.width / 2;
          const cy = b.top + b.height / 2;
          let ox = e.clientX - cx;
          let oy = e.clientY - cy;
          const d = Math.hypot(ox, oy);
          if (d > DRIFT_MAX) {
            ox *= DRIFT_MAX / d;
            oy *= DRIFT_MAX / d;
          }
          st.aim.x = ox;
          st.aim.y = oy;
          const cb = card.getBoundingClientRect();
          const clamp = (v) => Math.max(-1, Math.min(1, v));
          st.aim.ty = clamp((e.clientX - cx) / (cb.width / 2)) * -TILT_MAX;
          st.aim.tx = clamp((e.clientY - cy) / (cb.height / 2)) * TILT_MAX;
        };
        const leave = () => {
          st.hover = false;
          stopTracking();
          gsap.to(card, {
            x: 0,
            y: 0,
            rotateX: 0,
            rotateY: 0,
            duration: 0.7,
            ease: "power3.out",
          });
          gsap.to(drift, { x: 0, y: 0, duration: 0.7, ease: "power3.out" });
          sync();
        };
        spot.addEventListener("mouseenter", enter);
        spot.addEventListener("mousemove", move);
        spot.addEventListener("mouseleave", leave);
        spot.addEventListener("focus", enter);
        spot.addEventListener("blur", leave);

        return {
          setActive(a) {
            st.active = a;
            if (a) text.timeScale(1).play();
            else text.timeScale(1.8).reverse();
            sync();
          },
        };
      });

      /* ---------- the camera move ---------- */
      let moveTween;
      let current = -1;
      let ready = false;

      const activate = (i) => {
        if (current === i) return;
        const prev = current;
        current = i;
        if (prev > -1) ctrls[prev].setActive(false);
        ctrls[i].setActive(true);
        const tone = films[i].tone;
        gsap.to(stage, { "--tone": tone, duration: 0.9, overwrite: "auto" });
        gsap.to(inners, {
          opacity: (idx) => (idx === i ? 1 : 0.4),
          duration: 0.5,
          overwrite: "auto",
        });
        setYear(films[i].year, prev === -1);
        if (counterRef.current)
          counterRef.current.textContent = String(i + 1).padStart(2, "0");
        rail.forEach((b, j) => {
          gsap.to(b.querySelector(".rail-dot"), {
            scale: j === i ? 1.7 : 1,
            backgroundColor: j === i ? tone : "rgba(255,255,255,0.3)",
            duration: 0.5,
          });
          b.setAttribute("aria-current", j === i ? "true" : "false");
        });
      };

      const pick = () => {
        if (!ready) return;
        const x = gsap.getProperty(track, "x");
        const f = stage.clientWidth * FOCUS;
        let idx = 0;
        for (let k = 0; k < lefts.length; k++) if (lefts[k] + x <= f) idx = k;
        activate(idx);
      };

      moveTween = gsap.to(track, {
        x: () => -getDist(),
        ease: "none",
        onUpdate: pick,
        scrollTrigger: {
          trigger: outer,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.8,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            gsap.set(barRef.current, { scaleX: self.progress });
            gsap.set(hintRef.current, {
              opacity: self.progress > 0.02 ? 0 : 1,
            });
          },
        },
      });

      /* photos drift slower than the line (needs the camera tween as containerAnimation) */
      items.forEach((el) => {
        const img = el.querySelector(".pimg");
        gsap.fromTo(
          img,
          { xPercent: -6 },
          {
            xPercent: 6,
            ease: "none",
            scrollTrigger: {
              trigger: el,
              containerAnimation: moveTween,
              start: "left right",
              end: "right left",
              scrub: true,
            },
          },
        );
      });

      /* ---------- velocity skew: the line leans into the move ---------- */
      let lastX = 0;
      let sk = 0;
      const skewTick = () => {
        const x = gsap.getProperty(track, "x");
        const vel = x - lastX;
        lastX = x;
        const target = gsap.utils.clamp(-9, 9, vel * 0.45);
        sk += (target - sk) * 0.12;
        if (Math.abs(sk) > 0.01) gsap.set(inners, { skewX: sk });
        else if (sk !== 0) {
          sk = 0;
          gsap.set(inners, { skewX: 0 });
        }
      };
      gsap.ticker.add(skewTick);
      cleanups.push(() => gsap.ticker.remove(skewTick));

      /* ---------- travel (rail clicks + arrow keys) ---------- */
      let travel;
      const goTo = (i) => {
        const d = getDist();
        if (!d) return;
        const x = gsap.utils.clamp(0, d, lefts[i] - stage.clientWidth * 0.3);
        const s = moveTween.scrollTrigger;
        const target = s.start + (x / d) * (s.end - s.start);
        const o = { y: window.scrollY };
        travel?.kill();
        travel = gsap.to(o, {
          y: target,
          duration: 1.6,
          ease: "power3.inOut",
          onUpdate: () => window.scrollTo(0, o.y),
        });
      };
      goRef.current = goTo;
      cleanups.push(() => travel?.kill());

      const onKey = (e) => {
        if (detailOpenRef.current || current < 0) return;
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const r = outer.getBoundingClientRect();
        if (r.top > 0 || r.bottom < window.innerHeight) return;
        e.preventDefault();
        goTo(
          gsap.utils.clamp(
            0,
            n - 1,
            current + (e.key === "ArrowRight" ? 1 : -1),
          ),
        );
      };
      window.addEventListener("keydown", onKey);
      cleanups.push(() => window.removeEventListener("keydown", onKey));

      /* ---------- cursor ---------- */
      const cur = cursorRef.current;
      const lab = cur.querySelector(".cur-label");
      gsap.set(cur, { xPercent: -50, yPercent: -50, scale: 0.15 });
      const cx = gsap.quickTo(cur, "x", { duration: 0.45, ease: "power3" });
      const cy = gsap.quickTo(cur, "y", { duration: 0.45, ease: "power3" });
      const onMove = (e) => {
        cx(e.clientX);
        cy(e.clientY);
      };
      const onOver = (e) => {
        const hit = e.target.closest?.("[data-cursor]");
        if (hit) lab.textContent = hit.dataset.cursor;
        gsap.to(cur, {
          scale: hit ? 1 : 0.15,
          duration: 0.5,
          ease: "expo.out",
          overwrite: "auto",
        });
        gsap.to(lab, {
          opacity: hit ? 1 : 0,
          duration: 0.25,
          overwrite: "auto",
        });
      };
      const onEnter = () => gsap.to(cur, { opacity: 1, duration: 0.3 });
      const onLeave = () => gsap.to(cur, { opacity: 0, duration: 0.3 });
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerover", onOver);
      stage.addEventListener("pointerenter", onEnter);
      stage.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        stage.removeEventListener("pointermove", onMove);
        stage.removeEventListener("pointerover", onOver);
        stage.removeEventListener("pointerenter", onEnter);
        stage.removeEventListener("pointerleave", onLeave);
      });

      /* ---------- intro: the one orchestrated moment ---------- */
      gsap.set(".axis", { scaleX: 0, transformOrigin: "0% 50%" });
      gsap.set(".h-ch", { yPercent: 115 });
      gsap.set(".chrome", { opacity: 0 });
      gsap.set(inners, { opacity: 0 });
      ScrollTrigger.create({
        trigger: outer,
        start: "top 60%",
        once: true,
        onEnter: () => {
          gsap
            .timeline()
            .to(".axis", { scaleX: 1, duration: 1.6, ease: "expo.inOut" })
            .to(
              ".h-ch",
              { yPercent: 0, duration: 1, stagger: 0.04, ease: "expo.out" },
              0.3,
            )
            .to(".chrome", { opacity: 1, duration: 0.8, stagger: 0.1 }, 0.9)
            .add(() => {
              ready = true;
              pick();
            }, 0.7);
        },
      });
    }, outerRef);

    return () => {
      cleanups.forEach((fn) => fn());
      ctx.revert();
    };
  }, [mode, films]);

  /* ================= mobile / reduced motion: vertical rail ================= */
  useEffect(() => {
    if (mode !== "v") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray(".vfilm").forEach((li) => {
        const q = gsap.utils.selector(li);
        gsap.set(q(".pimg"), { scale: 1.2 });
        gsap.fromTo(
          q(".pimg"),
          { yPercent: -6 },
          {
            yPercent: 6,
            ease: "none",
            scrollTrigger: {
              trigger: li,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          },
        );
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: li,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
          defaults: { ease: "expo.out" },
        });
        tl.fromTo(
          q(".node"),
          { scale: 0 },
          { scale: 1, duration: 0.5, ease: "back.out(3)" },
          0,
        )
          .fromTo(
            q(".vcard"),
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 0.8 },
            0.1,
          )
          .fromTo(
            q(".clip"),
            { clipPath: REVEAL_FROM, filter: DEV_FROM },
            { clipPath: REVEAL_TO, filter: DEV_TO, duration: 1.2 },
            0.15,
          )
          .fromTo(
            q(".flash"),
            { opacity: 0.45 },
            { opacity: 0, duration: 0.6 },
            0.5,
          )
          .fromTo(
            q(".ch"),
            { yPercent: 115, rotate: 5 },
            { yPercent: 0, rotate: 0, duration: 1, stagger: 0.03 },
            0.3,
          )
          .fromTo(
            q(".role"),
            { opacity: 0, x: -14 },
            { opacity: 0.8, x: 0, duration: 0.7 },
            0.6,
          )
          .fromTo(
            q(".vglow"),
            { opacity: 0 },
            { opacity: 0.28, duration: 1 },
            0,
          );
      });
    }, outerRef);
    return () => ctx.revert();
  }, [mode, films]);

  const rootStyle = {
    background: t.background,
    color: t.ink,
    fontFamily: "'Instrument Sans', system-ui, sans-serif",
  };
  const fonts = `@import url("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,300&family=Instrument+Sans:wght@400;500&display=swap");`;

  const overlay = (
    <Detail
      films={films}
      detail={detail}
      onClose={closeDetail}
      onStep={stepDetail}
    />
  );

  /* ---------------------------- vertical ---------------------------- */
  if (mode === "v") {
    return (
      <>
        <style>{fonts}</style>
        <section
          ref={outerRef}
          className="relative isolate w-full px-5 py-20 overflow-x-clip"
          style={rootStyle}
        >
          <h2 className="text-3xl italic font-light" style={serif}>
            {heading}
          </h2>
          <ol
            className="relative mt-14 ml-2 pl-8 border-l space-y-24"
            style={{ borderColor: "rgba(255,255,255,0.15)" }}
          >
            {films.map((film, i) => (
              <li key={film.title} className="vfilm relative">
                <div
                  className="vglow pointer-events-none absolute -inset-x-10 -inset-y-12 -z-10 opacity-0"
                  style={{
                    background: `radial-gradient(ellipse at 30% 30%, ${film.tone}, transparent 65%)`,
                  }}
                />
                <span
                  className="node absolute -left-[2.3rem] top-3 w-3 h-3 rounded-full"
                  style={{
                    background: film.tone,
                    boxShadow: `0 0 20px 3px ${film.tone}`,
                  }}
                />
                <button
                  type="button"
                  aria-label={`Open ${film.title}`}
                  onClick={(e) => openDetail(i, e.clientX, e.clientY)}
                  className="vcard relative block overflow-hidden aspect-[4/5] w-[min(16rem,70vw)] mb-6 ring-1 ring-white/10"
                  style={{ background: film.tone }}
                >
                  <span className="clip absolute inset-0 block">
                    <img
                      src={film.image}
                      alt=""
                      loading="lazy"
                      className="pimg w-full h-full object-cover"
                    />
                  </span>
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                  <span className="flash pointer-events-none absolute inset-0 bg-white opacity-0" />
                </button>
                <p className="text-sm tabular-nums opacity-60">{film.year}</p>
                <h3
                  className="mt-1 text-[clamp(2rem,9vw,3rem)] leading-[1.1] italic font-light tracking-[-0.02em]"
                  style={serif}
                >
                  <Chars text={film.title} />
                </h3>
                <p className="role mt-3 flex items-center gap-2 text-sm italic opacity-80">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: film.tone }}
                  />
                  as {film.role}
                </p>
              </li>
            ))}
          </ol>
        </section>
        {overlay}
      </>
    );
  }

  /* --------------------------- horizontal --------------------------- */
  return (
    <>
      <style>{fonts}</style>
      <section ref={outerRef} className="relative w-full" style={rootStyle}>
        <div
          ref={stageRef}
          className="sticky top-0 h-[100svh] isolate overflow-hidden cursor-none"
          style={{ "--tone": films[0]?.tone, "--cw": "220px", "--ch": "275px" }}
        >
          {/* light that takes the current film's colour */}
          <div
            ref={glowRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[80vmax] h-[80vmax] opacity-30"
            style={{
              background:
                "radial-gradient(closest-side, var(--tone), transparent)",
            }}
          />
          <div
            ref={grainRef}
            aria-hidden="true"
            className="pointer-events-none absolute -inset-10 opacity-[0.1] mix-blend-overlay"
            style={{ backgroundImage: GRAIN }}
          />

          {/* year odometer */}
          <div
            aria-hidden="true"
            className="pointer-events-none select-none absolute right-[3vw] bottom-[-0.08em] z-0 flex text-[clamp(8rem,22vw,22rem)] leading-none italic font-light"
            style={{
              ...serif,
              color: "transparent",
              WebkitTextStroke: "1.5px var(--tone)",
              opacity: 0.35,
            }}
          >
            {Array.from({ length: yearDigits }).map((_, k) => (
              <span
                key={k}
                className="block h-[1em] overflow-hidden px-[0.02em]"
              >
                <span className="odo-col block">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <span key={d} className="block h-[1em] leading-none">
                      {d}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </div>

          {/* the line itself */}
          <div className="axis pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-white/20" />

          <header className="absolute top-8 left-10 right-10 z-30 flex items-baseline justify-between">
            <h2
              className="text-3xl sm:text-4xl italic font-light"
              style={serif}
            >
              <Chars text={heading} cls="h-ch" />
            </h2>
            <p className="chrome text-sm tabular-nums opacity-70">
              <span ref={counterRef}>01</span> /{" "}
              {String(films.length).padStart(2, "0")}
            </p>
          </header>

          <div
            ref={trackRef}
            className="absolute inset-y-0 left-0 z-10 flex will-change-transform"
            style={{
              "--fw": "min(44vw, 38rem)",
              paddingLeft: "12vw",
              paddingRight: "calc(70vw - var(--fw))",
            }}
          >
            {/* sprocket rails: the line is a strip of film */}
            {[-11, 11].map((o) => (
              <div
                key={o}
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 top-1/2 h-[5px]"
                style={{
                  marginTop: o - 2,
                  backgroundImage:
                    "repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 9px, transparent 9px 21px)",
                }}
              />
            ))}

            {films.map((film, i) => {
              const up = i % 2 === 0; // title above the line, or below
              const off = "calc(50% + var(--ch) / 2 + 2.2rem)";
              return (
                <article
                  key={film.title}
                  className="film relative shrink-0 h-full"
                  style={{ width: "var(--fw)" }}
                  aria-label={`${film.title}, ${film.year}, as ${film.role}`}
                >
                  <div className="film-inner absolute inset-0">
                    {/* the spot: a dot that opens into the photo */}
                    <button
                      type="button"
                      aria-label={`Open ${film.title}`}
                      data-cursor="Open"
                      onClick={(e) =>
                        openDetail(
                          i,
                          e.clientX ||
                            e.currentTarget.getBoundingClientRect().left,
                          e.clientY || window.innerHeight / 2,
                        )
                      }
                      className="spot absolute left-0 top-1/2 -ml-12 -mt-12 w-24 h-24 cursor-none [perspective:800px]"
                    >
                      <span className="pingwrap absolute left-1/2 top-1/2 block w-[14px] h-[14px] -ml-[7px] -mt-[7px]">
                        <span
                          className="ping block w-full h-full rounded-full"
                          style={{ border: `1px solid ${film.tone}` }}
                        />
                      </span>
                      <span
                        className="card absolute left-1/2 top-1/2 block overflow-hidden will-change-transform"
                        style={{
                          width: DOT,
                          height: DOT,
                          borderRadius: 2,
                          background: film.tone,
                          boxShadow: `0 0 26px 5px ${film.tone}`,
                        }}
                      >
                        <span className="clip absolute inset-0 block">
                          <span className="drift absolute inset-0 block">
                            <img
                              src={film.image}
                              alt=""
                              loading="lazy"
                              className="pimg w-full h-full object-cover"
                            />
                          </span>
                        </span>
                        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
                        <span className="flash pointer-events-none absolute inset-0 bg-white opacity-0" />
                      </span>
                    </button>

                    <span className="tag pointer-events-none absolute left-0 top-1/2 mt-5 -translate-x-1/2 text-xs tabular-nums opacity-60">
                      {film.year}
                    </span>

                    <div
                      className="txt absolute whitespace-nowrap"
                      data-cursor="Open"
                      onClick={(e) => openDetail(i, e.clientX, e.clientY)}
                      style={{
                        left: "calc(var(--cw) / -2)",
                        ...(up ? { bottom: off } : { top: off }),
                      }}
                    >
                      <h3
                        className="text-[clamp(2.4rem,4.6vw,4.6rem)] leading-[1.05] italic font-light tracking-[-0.02em]"
                        style={serif}
                      >
                        <Chars text={film.title} />
                      </h3>
                      <div className="mt-4 flex items-center gap-4">
                        <span
                          className="rule block h-px w-16 origin-left"
                          style={{ background: film.tone }}
                        />
                        <p className="role text-sm sm:text-base italic">
                          as {film.role}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* bottom: rail to travel + hint + progress */}
          <div className="chrome absolute bottom-7 left-10 right-10 z-30 flex items-end justify-between">
            <nav aria-label="Films" className="flex items-center gap-7">
              {films.map((film, i) => (
                <button
                  key={film.title}
                  type="button"
                  data-cursor="Go"
                  onClick={() => goRef.current(i)}
                  className="rail-btn group flex items-center gap-2 text-xs tabular-nums cursor-none opacity-70 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4"
                >
                  <span
                    className="rail-dot block w-1.5 h-1.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.3)" }}
                  />
                  {film.year}
                  <span
                    className="max-w-0 overflow-hidden whitespace-nowrap italic transition-[max-width] duration-500 ease-out group-hover:max-w-[12rem] group-focus-visible:max-w-[12rem]"
                    style={serif}
                  >
                    {film.title}
                  </span>
                </button>
              ))}
            </nav>
            <p ref={hintRef} className="text-sm opacity-60">
              Scroll, or use the arrow keys
            </p>
          </div>
          <div
            ref={barRef}
            className="absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0"
            style={{ background: "var(--tone)" }}
          />

          {/* cursor */}
          <div
            ref={cursorRef}
            aria-hidden="true"
            className="pointer-events-none fixed left-0 top-0 z-[60] grid place-items-center w-20 h-20 rounded-full text-sm opacity-0"
            style={{ background: t.ink, color: "#000" }}
          >
            <span className="cur-label opacity-0">Open</span>
          </div>
        </div>
      </section>
      {overlay}
    </>
  );
}
