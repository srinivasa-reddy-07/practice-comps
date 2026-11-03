import React, { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------
   Filmography: "Contact Print" (black edition)

   DESKTOP
   - Titles are huge. Hover one: the letters roll over into that film's
     own colour, the title leans with your cursor speed, a hairline
     draws across the top of the row, and every other row dims.
   - A photo frame trails the cursor with a little 3D tilt. The picture
     "develops" (dark + blurred -> sharp) with a projector flash, film
     grain, and a parallax shift as you move.
   - A soft light in the film's colour follows the cursor behind
     everything, so the whole page picks up the mood of the film.
   TOUCH
   - No hover on phones, so it becomes a tap-to-open accordion.
   ACCESSIBILITY
   - Real buttons, keyboard focus gets the same reveal, and
     prefers-reduced-motion swaps heavy effects for simple fades.

   USE:   <Filmography films={FILMS} onSelect={(film) => ...} />
   NEEDS: npm i gsap   +   Tailwind
------------------------------------------------------------------- */

export const FILMS = [
  {
    year: "2024",
    title: "Premalu",
    role: "Meera",
    image: "/mami5.jpg",
    tone: "#ff6b3d",
  },
  {
    year: "2023",
    title: "Vishwanath and Sons",
    role: "Anjali",
    image: "/mami1.jpg",
    tone: "#3ddc97",
  },
  {
    year: "2021",
    title: "Bethlehem Kudumba Unit",
    role: "Dr. Rao",
    image: "/mami3.jpg",
    tone: "#ffc94d",
  },
  {
    year: "2019",
    title: "Salt & Silk",
    role: "Zoya",
    image: "/mami4.jpg",
    tone: "#8f7bff",
  },
  {
    year: "2017",
    title: "Midnight Bazaar",
    role: "Lead",
    image: "/mami6.jpg",
    tone: "#ff4f8b",
  },
];

const DEFAULT_THEME = { background: "#050505", ink: "#f1ede6" };

const FINE = "(hover: hover) and (pointer: fine)";
const DEVELOP_FROM = "grayscale(1) brightness(0.3) contrast(1.6) blur(12px)";
const DEVELOP_TO = "grayscale(0) brightness(1) contrast(1) blur(0px)";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

/* Two stacked copies of each letter; hover slides the coloured one in */
const RollingTitle = ({ text }) => (
  <span aria-hidden="true" className="flex flex-wrap">
    {[...text].map((ch, i) => {
      const c = ch === " " ? "\u00A0" : ch;
      return (
        <span
          key={i}
          className="relative block overflow-hidden leading-[1.3] px-[0.1em] -mx-[0.1em]"
        >
          <span className="roll-a block will-change-transform">{c}</span>
          <span
            className="roll-b absolute left-[0.1em] top-full block italic will-change-transform"
            style={{ color: "var(--tone)" }}
          >
            {c}
          </span>
        </span>
      );
    })}
  </span>
);

export default function Filmography({
  films = FILMS,
  theme = {},
  heading = "Filmography",
  onSelect,
}) {
  const t = { ...DEFAULT_THEME, ...theme };
  const [open, setOpen] = useState(-1); // touch accordion
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const frameRef = useRef(null);
  const layerRef = useRef(null);
  const grainRef = useRef(null);
  const flashRef = useRef(null);
  const glowRef = useRef(null);
  const capTitleRef = useRef(null);
  const capYearRef = useRef(null);
  const panelRefs = useRef([]);

  /* ---------- entrance on scroll ---------- */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.set(".title-in", { opacity: 0, y: 60 });
      ScrollTrigger.batch(".title-in", {
        start: "top 92%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 1.1,
            ease: "power4.out",
            stagger: 0.09,
            overwrite: "auto",
            clearProps: "transform,opacity", // leave no leftover offset behind
          }),
      });
    }, rootRef);
    return () => ctx.revert();
  }, [films]);

  /* ---------- desktop: everything that follows the cursor ---------- */
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      { fine: FINE, reduce: "(prefers-reduced-motion: reduce)" },
      (ctx) => {
        const { fine, reduce } = ctx.conditions;
        if (!fine) return;

        const root = rootRef.current;
        const list = listRef.current;
        const frame = frameRef.current;
        const glow = glowRef.current;
        const rows = gsap.utils.toArray(".row", root);
        const titles = gsap.utils.toArray(".title-wrap", root);
        const hairs = gsap.utils.toArray(".hair", root);
        const imgs = gsap.utils.toArray("[data-img]", frame);
        const letters = rows.map((r) => r.querySelectorAll(".roll-a, .roll-b"));

        gsap.set(frame, {
          xPercent: 12,
          yPercent: -50,
          scale: 0.85,
          opacity: 0,
          x: 0,
          y: 0,
          transformPerspective: 900,
        });
        gsap.set(glow, {
          xPercent: -50,
          yPercent: -50,
          opacity: 0,
          x: 0,
          y: 0,
        });
        gsap.set(imgs, { opacity: 0 });
        gsap.set(hairs, { scaleX: 0 });
        gsap.set(titles, { transformOrigin: "0% 100%" });

        const xTo = gsap.quickTo(frame, "x", { duration: 0.6, ease: "power3" });
        const yTo = gsap.quickTo(frame, "y", { duration: 0.6, ease: "power3" });
        const rotTo = gsap.quickTo(frame, "rotation", {
          duration: 0.9,
          ease: "power3",
        });
        const rotYTo = gsap.quickTo(frame, "rotationY", {
          duration: 0.9,
          ease: "power3",
        });
        const layerXTo = gsap.quickTo(layerRef.current, "x", {
          duration: 0.9,
          ease: "power3",
        });
        const gxTo = gsap.quickTo(glow, "x", { duration: 1.1, ease: "power3" });
        const gyTo = gsap.quickTo(glow, "y", { duration: 1.1, ease: "power3" });
        const skewTos = titles.map((el) =>
          gsap.quickTo(el, "skewX", { duration: 0.6, ease: "power3" }),
        );

        if (!reduce) {
          gsap.to(grainRef.current, {
            x: "random(-24, 24)",
            y: "random(-24, 24)",
            duration: 0.12,
            repeat: -1,
            repeatRefresh: true,
            ease: "steps(1)",
          });
        }

        let active = -1;
        let lastX = 0;
        let idle;
        let z = 1;

        const settle = () => {
          rotTo(0);
          rotYTo(0);
          layerXTo(0);
          if (active > -1) skewTos[active](0);
        };

        const move = (e) => {
          const dx = e.clientX - lastX;
          lastX = e.clientX;
          xTo(e.clientX);
          yTo(e.clientY);
          gxTo(e.clientX);
          gyTo(e.clientY);
          if (!reduce) {
            rotTo(clamp(dx * 0.35, -12, 12));
            rotYTo(clamp(dx * 0.6, -20, 20));
            layerXTo(clamp(-dx * 1.2, -18, 18));
            if (active > -1) skewTos[active](clamp(-dx * 0.25, -8, 8));
          }
          clearTimeout(idle);
          idle = setTimeout(settle, 90);
        };

        /* roll the letters + hairline back for one row */
        const rollOut = (i) => {
          skewTos[i](0);
          gsap.set(hairs[i], { transformOrigin: "right center" });
          gsap.to(hairs[i], {
            scaleX: 0,
            duration: 0.45,
            ease: "power3.inOut",
            overwrite: true,
          });
          if (!reduce) {
            gsap.to(letters[i], {
              yPercent: 0,
              duration: 0.45,
              ease: "power3.inOut",
              stagger: 0.01,
              overwrite: true,
            });
          }
        };

        const activate = (i) => {
          if (active === i) return;
          if (active > -1) rollOut(active);
          active = i;
          const film = films[i];

          gsap.to(frame, {
            backgroundColor: film.tone,
            duration: 0.4,
            overwrite: "auto",
          });
          gsap.to(glow, {
            "--glow": film.tone,
            opacity: 0.32,
            duration: 0.7,
            overwrite: "auto",
          });
          gsap.to(rows, {
            opacity: (idx) => (idx === i ? 1 : 0.2),
            duration: 0.35,
            overwrite: "auto",
          });

          gsap.set(hairs[i], { transformOrigin: "left center" });
          gsap.to(hairs[i], {
            scaleX: 1,
            duration: 0.7,
            ease: "power3.out",
            overwrite: true,
          });

          if (!reduce) {
            gsap.to(letters[i], {
              yPercent: -100,
              duration: 0.55,
              ease: "power3.out",
              stagger: 0.018,
              overwrite: true,
            });
          }

          // the "development"
          const img = imgs[i];
          img.style.zIndex = ++z;
          if (reduce) {
            gsap.fromTo(img, { opacity: 0 }, { opacity: 1, duration: 0.25 });
          } else {
            gsap.fromTo(
              img,
              {
                opacity: 1,
                clipPath: "inset(100% 0% 0% 0%)",
                filter: DEVELOP_FROM,
              },
              {
                clipPath: "inset(0% 0% 0% 0%)",
                filter: DEVELOP_TO,
                duration: 1.1,
                ease: "power3.out",
                overwrite: true,
              },
            );
            gsap.fromTo(
              flashRef.current,
              { opacity: 0.45 },
              { opacity: 0, duration: 0.6, ease: "power2.out" },
            );
          }

          capTitleRef.current.textContent = film.title;
          capYearRef.current.textContent = film.year;
          gsap.fromTo(
            [capTitleRef.current, capYearRef.current],
            { y: 8, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.5,
              delay: 0.15,
              ease: "power3.out",
              overwrite: true,
            },
          );
        };

        const deactivate = () => {
          if (active > -1) rollOut(active);
          active = -1;
          gsap.to(frame, {
            opacity: 0,
            scale: 0.85,
            duration: 0.35,
            ease: "power2.in",
            overwrite: "auto",
          });
          gsap.to(glow, { opacity: 0, duration: 0.6, overwrite: "auto" });
          gsap.to(rows, { opacity: 1, duration: 0.4, overwrite: "auto" });
          gsap.to(imgs, {
            opacity: 0,
            duration: 0.3,
            delay: 0.15,
            overwrite: "auto",
          });
          settle();
        };

        const enterList = (e) => {
          // snap to the cursor first so nothing flies in from the corner
          gsap.set([frame, glow], { x: e.clientX, y: e.clientY });
          lastX = e.clientX;
          gsap.to(frame, {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: "power3.out",
            overwrite: "auto",
          });
        };

        const listeners = rows.map((row, i) => {
          const h = {
            enter: () => activate(i),
            // leaving a row without entering another (e.g. over a border) just rolls it back
            leave: () => {
              if (active === i) {
                rollOut(i);
                active = -1;
              }
            },
            // only keyboard focus triggers the reveal, never a mouse click
            focus: () => {
              if (!row.matches(":focus-visible")) return;
              const r = row.getBoundingClientRect();
              gsap.set([frame, glow], {
                x: r.right - r.width * 0.3,
                y: r.top + r.height / 2,
              });
              gsap.to(frame, {
                opacity: 1,
                scale: 1,
                duration: 0.4,
                overwrite: "auto",
              });
              activate(i);
            },
            blur: () => deactivate(),
          };
          row.addEventListener("pointerenter", h.enter);
          row.addEventListener("pointerleave", h.leave);
          row.addEventListener("focus", h.focus);
          row.addEventListener("blur", h.blur);
          return h;
        });

        list.addEventListener("pointerenter", enterList);
        list.addEventListener("pointerleave", deactivate);
        list.addEventListener("pointermove", move);

        return () => {
          clearTimeout(idle);
          list.removeEventListener("pointerenter", enterList);
          list.removeEventListener("pointerleave", deactivate);
          list.removeEventListener("pointermove", move);
          rows.forEach((row, i) => {
            row.removeEventListener("pointerenter", listeners[i].enter);
            row.removeEventListener("pointerleave", listeners[i].leave);
            row.removeEventListener("focus", listeners[i].focus);
            row.removeEventListener("blur", listeners[i].blur);
          });
        };
      },
    );

    return () => mm.revert();
  }, [films]);

  /* ---------- touch: accordion ---------- */
  useEffect(() => {
    panelRefs.current.forEach((panel, i) => {
      if (!panel) return;
      gsap.to(panel, {
        height: open === i ? "auto" : 0,
        duration: 0.55,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });
  }, [open]);

  const handleClick = (film, i) => {
    if (window.matchMedia(FINE).matches) onSelect?.(film);
    else setOpen((o) => (o === i ? -1 : i));
  };

  const line = "rgba(255,255,255,0.12)";

  return (
    <>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,300&family=Instrument+Sans:wght@400;500&display=swap");
      `}</style>

      <section
        ref={rootRef}
        className="relative isolate w-full px-5 sm:px-10 py-20 sm:py-32 overflow-x-clip"
        style={{
          background: t.background,
          color: t.ink,
          fontFamily: "'Instrument Sans', system-ui, sans-serif",
        }}
      >
        {/* light that follows the cursor, tinted by the film */}
        <div
          ref={glowRef}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 -z-10 hidden [@media(hover:hover)_and_(pointer:fine)]:block w-[70vmax] h-[70vmax] opacity-0"
          style={{
            "--glow": films[0]?.tone,
            background:
              "radial-gradient(closest-side, var(--glow), transparent)",
          }}
        />

        <header className="relative mb-12 sm:mb-20 flex items-baseline justify-between gap-6">
          <h2
            className="text-3xl sm:text-4xl italic font-light"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {heading}
            <sup className="ml-2 text-sm not-italic opacity-50 tabular-nums">
              {String(films.length).padStart(2, "0")}
            </sup>
          </h2>
          <p className="text-sm opacity-50 hidden [@media(hover:hover)_and_(pointer:fine)]:block">
            Move over a title
          </p>
          <p className="text-sm opacity-50 [@media(hover:hover)_and_(pointer:fine)]:hidden">
            Tap a title
          </p>
        </header>

        <ul ref={listRef} className="relative z-10">
          {films.map((film, i) => (
            <li
              key={film.title}
              className="relative border-t"
              style={{ borderColor: line }}
            >
              <span
                className="hair pointer-events-none absolute left-0 right-0 -top-px h-px hidden [@media(hover:hover)_and_(pointer:fine)]:block"
                style={{ background: film.tone, transform: "scaleX(0)" }}
              />
              <button
                type="button"
                className="row w-full grid grid-cols-[3.5rem_1fr] sm:grid-cols-[6rem_1fr_auto] items-center gap-x-4 py-3 sm:py-4 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4"
                style={{ "--tone": film.tone, outlineColor: film.tone }}
                aria-expanded={open === i}
                aria-label={`${film.title}, ${film.year}${film.role ? `, as ${film.role}` : ""}`}
                onClick={() => handleClick(film, i)}
              >
                <span className="text-sm sm:text-base leading-none opacity-60 tabular-nums">
                  {film.year}
                </span>
                <span
                  className="title-wrap block origin-bottom-left text-[clamp(2.4rem,7.5vw,7rem)] leading-[1.3] font-light tracking-[-0.02em]"
                  style={{ fontFamily: "'Fraunces', serif" }}
                >
                  <span className="title-in block">
                    <RollingTitle text={film.title} />
                  </span>
                </span>
                <span className="hidden sm:block text-base leading-none opacity-60">
                  {film.role}
                </span>
              </button>

              {/* touch-only panel */}
              <div
                ref={(el) => (panelRefs.current[i] = el)}
                className="overflow-hidden [@media(hover:hover)_and_(pointer:fine)]:hidden"
                style={{ height: 0 }}
              >
                <div className="pb-6 pl-[4.5rem]">
                  <div
                    className="aspect-[4/5] max-w-xs overflow-hidden"
                    style={{ background: film.tone }}
                  >
                    <img
                      src={film.image}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {film.role && (
                    <p className="mt-3 text-sm opacity-60">as {film.role}</p>
                  )}
                </div>
              </div>
            </li>
          ))}
          <li
            className="border-t"
            style={{ borderColor: line }}
            aria-hidden="true"
          />
        </ul>

        {/* trailing photo frame (desktop only, driven by GSAP) */}
        <div
          ref={frameRef}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 z-50 hidden [@media(hover:hover)_and_(pointer:fine)]:block w-[min(22rem,28vw)] aspect-[4/5] overflow-hidden rounded-[2px] ring-1 ring-white/15 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)] will-change-transform"
          style={{ background: films[0]?.tone }}
        >
          <div
            ref={layerRef}
            className="absolute -inset-6 will-change-transform"
          >
            {films.map((film) => (
              <img
                key={film.title}
                data-img
                src={film.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-0"
              />
            ))}
          </div>
          <div
            ref={grainRef}
            className="absolute -inset-10 opacity-[0.28] mix-blend-overlay"
            style={{ backgroundImage: GRAIN }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />
          <div ref={flashRef} className="absolute inset-0 bg-white opacity-0" />
          <div className="absolute left-3 right-3 bottom-3 flex items-end justify-between gap-3 text-[0.68rem] uppercase tracking-[0.18em] text-white/90">
            <span ref={capTitleRef} />
            <span ref={capYearRef} className="tabular-nums" />
          </div>
        </div>
      </section>
    </>
  );
}
