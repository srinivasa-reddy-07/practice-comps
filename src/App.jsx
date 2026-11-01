import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { gsap } from "gsap";
import ExpandedView from "./ExpandedView"

const COLS = 8;
const ROWS = 6;
const ITEM_W = 320;
const ITEM_H = 460;
const GAP = 120;
const NUM_LOCAL_IMAGES = 12;

const TOTAL_W = COLS * (ITEM_W + GAP);
const TOTAL_H = ROWS * (ITEM_H + GAP);

const IMG_SCALE = 1.2; // images are slightly oversized so parallax never shows edges
const MAX_PARALLAX = 30;
const FRAME_OFFSET = 12; // how far the ghost frame sits behind a card

/* -------------------------------------------------------------------
   Titles + dates shown when a card is opened.
   Index 0 = /mami1.jpg, index 1 = /mami2.jpg ... index 10 = /mami11.jpg
   The first two come from your recording; the rest are placeholders,
   so edit them to match your real images.
------------------------------------------------------------------- */
const PROJECTS = [
  { title: "THE RED DOOR", date: "2021.11" },
  { title: "BOA.HANCOCK", date: "2021.6" },
  { title: "INCEPTION", date: "2020.7" },
  { title: "KILL BILL", date: "2020.3" },
  { title: "WE ARE FREE", date: "2021.2" },
  { title: "PUPPY ICE CREAM", date: "2021.8" },
  { title: "THE CRYING ANGEL", date: "BETHLEHEM KUDUMBA UNIT (2026)" },
  { title: "UNTITLED 08", date: "2021.4" },
  { title: "UNTITLED 09", date: "2021.5" },
  { title: "UNTITLED 10", date: "2021.9" },
  { title: "UNTITLED 11", date: "2021.12" },
  { title: "UNTITLED 12", date: "2021.12" },
];

const images = Array.from({ length: COLS * ROWS }, (_, i) => {
  const index = (i % NUM_LOCAL_IMAGES) + 1;
  return `/mami${index}.jpg`;
});

// last known pointer position, shared so nothing flies in from (0,0)
const pointer = { x: 0, y: 0 };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const MarqueeContent = ({ text }) => (
  <div className="flex items-center whitespace-nowrap text-3xl font-black tracking-widest uppercase">
    {Array.from({ length: 15 }).map((_, i) => (
      <React.Fragment key={i}>
        <span
          className="mx-6"
          style={
            i % 2
              ? { color: "transparent", WebkitTextStroke: "1.5px #000" }
              : undefined
          }
        >
          {text}
        </span>
        <span className="mx-2 text-2xl">✦</span>
      </React.Fragment>
    ))}
  </div>
);

export default function App() {
  const containerRef = useRef(null);
  const gridWrapperRef = useRef(null);
  const itemsRef = useRef([]);

  const topBorderRef = useRef(null);
  const bottomBorderRef = useRef(null);
  const leftBorderRef = useRef(null);
  const rightBorderRef = useRef(null);

  // cursor pieces
  const mainCursorRef = useRef(null);
  const cursorArrowRef = useRef(null); // rotates toward drag direction
  const cursorSpinRef = useRef(null); // spins during the arrows -> X morph
  const lineBRef = useRef(null); // second diagonal that turns arrows into an X
  const headARef = useRef(null);
  const headBRef = useRef(null);
  const hintRef = useRef(null);

  const velocity = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const isZoomedOut = useRef(false);
  const isHovering = useRef(false);
  const hintHidden = useRef(false);
  const dragDistance = useRef(0);

  // marquee tweens + their smoothed speeds
  const marqueeTweens = useRef({});
  const marqueeSpeed = useRef({ top: 1, bottom: 1, left: 1, right: 1 });
  const parallax = useRef({ x: 0, y: 0 });

  const currentOffset = useRef({
    x: -TOTAL_W / 2 + 500,
    y: -TOTAL_H / 2 + 300,
  });
  const targetOffset = useRef({ x: -TOTAL_W / 2 + 500, y: -TOTAL_H / 2 + 300 });

  const [focusedItem, setFocusedItem] = useState(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    isFocusedRef.current = !!focusedItem;
  }, [focusedItem]);

  /* ---------------- cursor ---------------- */
  useEffect(() => {
    const cursor = mainCursorRef.current;
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.18, ease: "power3.out" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.18, ease: "power3.out" });
    let first = true;

    const moveGlobalCursor = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (first) {
        // appear exactly under the pointer instead of sliding in from the corner
        first = false;
        gsap.set(cursor, { x: e.clientX, y: e.clientY });
        gsap.to(cursor, { opacity: 1, duration: 0.4 });
        return;
      }
      xTo(e.clientX);
      yTo(e.clientY);
    };
    window.addEventListener("mousemove", moveGlobalCursor);
    return () => window.removeEventListener("mousemove", moveGlobalCursor);
  }, []);

  /*
    Cursor modes
      default : diagonal expand arrows
      view    : slightly bigger while over a card
      drag    : slightly smaller while dragging
      close   : arrows morph into an X (used while a card is open)
    The morph: the second diagonal grows from the centre, the arrowheads
    fade out, and the whole icon spins a quarter turn. Going back reverses it.
  */
  const setCursorMode = (mode) => {
    const toX = mode === "close";
    const scale = { default: 1, view: 1.15, drag: 0.9, close: 1.1 }[mode];

    gsap.to(mainCursorRef.current, {
      scale,
      duration: 0.5,
      ease: "power3.out",
      overwrite: "auto",
    });
    gsap.to(lineBRef.current, {
      scale: toX ? 1 : 0,
      svgOrigin: "12 12",
      duration: 0.5,
      ease: toX ? "back.out(1.6)" : "power3.inOut",
      overwrite: "auto",
    });
    gsap.to([headARef.current, headBRef.current], {
      opacity: toX ? 0 : 1,
      duration: toX ? 0.25 : 0.4,
      delay: toX ? 0 : 0.15,
      overwrite: "auto",
    });
    gsap.to(cursorSpinRef.current, {
      rotation: toX ? 90 : 0,
      duration: 0.6,
      ease: "expo.inOut",
      overwrite: "auto",
    });
    if (mode !== "drag") {
      gsap.to(cursorArrowRef.current, {
        rotation: "0_short",
        duration: 0.5,
        ease: "power3.out",
        overwrite: "auto",
      });
    }
  };

  /* ---------------- green wipe over the other cards ---------------- */
  // hide = true  : cards get swept away (sweep travels upward)
  // hide = false : cards come back     (sweep travels downward)
  const wipeOthers = (index, hide) => {
    const items = itemsRef.current;
    const focusEl = items[index];
    if (!focusEl) return;
    const fr = focusEl.getBoundingClientRect();
    const fx = fr.left + fr.width / 2;
    const fy = fr.top + fr.height / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    items.forEach((el, i) => {
      if (!el || i === index) return;
      const inner = el.querySelector(".gallery-inner");
      const wipe = el.querySelector(".gallery-wipe");
      gsap.killTweensOf([inner, wipe]);

      const r = el.getBoundingClientRect();
      const onScreen = r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh;
      if (!onScreen) {
        // nobody can see these, so skip the animation
        gsap.set(inner, { opacity: hide ? 0 : 1 });
        return;
      }

      // ripple outward from the clicked card
      const dist = Math.hypot(r.left + r.width / 2 - fx, r.top + r.height / 2 - fy);
      const delay = Math.min(dist / vw, 1) * 0.35;

      const tl = gsap.timeline({ delay });
      if (hide) {
        tl.fromTo(
          wipe,
          { clipPath: "inset(100% 0% 0% 0%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.4, ease: "expo.inOut" },
        )
          .set(inner, { opacity: 0 })
          .fromTo(
            wipe,
            { clipPath: "inset(0% 0% 0% 0%)" },
            { clipPath: "inset(0% 0% 100% 0%)", duration: 0.5, ease: "expo.inOut" },
          );
      } else {
        tl.fromTo(
          wipe,
          { clipPath: "inset(0% 0% 100% 0%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.4, ease: "expo.inOut" },
        )
          .set(inner, { opacity: 1 })
          .fromTo(
            wipe,
            { clipPath: "inset(0% 0% 0% 0%)" },
            { clipPath: "inset(100% 0% 0% 0%)", duration: 0.5, ease: "expo.inOut" },
          );
      }
    });
  };

  /* ---------------- main render loop ---------------- */
  useLayoutEffect(() => {
    const wrapX = gsap.utils.wrap(-ITEM_W, TOTAL_W - ITEM_W);
    const wrapY = gsap.utils.wrap(-ITEM_H, TOTAL_H - ITEM_H);

    // precompute everything that never changes + fast setters (no gsap.set per frame)
    const cells = itemsRef.current.map((el, i) => {
      if (!el) return null;
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const staggerOffset = col % 2 !== 0 ? (ITEM_H + GAP) / 2 : 0;
      const img = el.querySelector("img");
      gsap.set(img, { scale: IMG_SCALE });
      return {
        initialX: col * (ITEM_W + GAP),
        initialY: row * (ITEM_H + GAP) + staggerOffset,
        setX: gsap.quickSetter(el, "x", "px"),
        setY: gsap.quickSetter(el, "y", "px"),
        setImgX: gsap.quickSetter(img, "x", "px"),
        setImgY: gsap.quickSetter(img, "y", "px"),
      };
    });

    // borders start hidden
    gsap.set(topBorderRef.current, { yPercent: -100 });
    gsap.set(bottomBorderRef.current, { yPercent: 100 });
    gsap.set(leftBorderRef.current, { xPercent: -100 });
    gsap.set(rightBorderRef.current, { xPercent: 100 });

    // cursor starts as arrows, hidden until the first mouse move
    gsap.set(mainCursorRef.current, { opacity: 0 });
    gsap.set(lineBRef.current, { scale: 0, svgOrigin: "12 12" });

    const tick = (_time, deltaTime) => {
      // frame-rate independent: behaves the same on 60Hz and 144Hz screens
      const f = Math.min(deltaTime, 50) / 16.667;
      let dx = 0;
      let dy = 0;

      if (!isFocusedRef.current) {
        if (!isDragging.current) {
          targetOffset.current.x += velocity.current.x * f;
          targetOffset.current.y += velocity.current.y * f;
          const friction = Math.pow(0.95, f);
          velocity.current.x *= friction;
          velocity.current.y *= friction;
        }

        const k = 1 - Math.pow(0.85, f);
        const prevX = currentOffset.current.x;
        const prevY = currentOffset.current.y;
        currentOffset.current.x += (targetOffset.current.x - prevX) * k;
        currentOffset.current.y += (targetOffset.current.y - prevY) * k;
        dx = currentOffset.current.x - prevX;
        dy = currentOffset.current.y - prevY;

        // images drift against the motion for a bit of depth
        const pk = 1 - Math.pow(0.9, f);
        parallax.current.x +=
          (clamp(-dx * 1.6, -MAX_PARALLAX, MAX_PARALLAX) - parallax.current.x) * pk;
        parallax.current.y +=
          (clamp(-dy * 1.6, -MAX_PARALLAX, MAX_PARALLAX) - parallax.current.y) * pk;

        for (let i = 0; i < cells.length; i++) {
          const c = cells[i];
          if (!c) continue;
          c.setX(wrapX(c.initialX + currentOffset.current.x));
          c.setY(wrapY(c.initialY + currentOffset.current.y));
          c.setImgX(parallax.current.x);
          c.setImgY(parallax.current.y);
        }
      }

      // border marquees speed up / reverse with the drag direction
      const t = marqueeTweens.current;
      if (t.top) {
        const s = marqueeSpeed.current;
        const targets = {
          top: 1 - dx * 0.12,
          bottom: 1 + dx * 0.12,
          left: 1 + dy * 0.12,
          right: 1 - dy * 0.12,
        };
        const mk = 1 - Math.pow(0.9, f);
        for (const key of ["top", "bottom", "left", "right"]) {
          s[key] += (clamp(targets[key], -16, 16) - s[key]) * mk;
          t[key].timeScale(s[key]);
        }
      }
    };

    tick(0, 16.667); // place everything before first paint
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  /* ---------------- marquees + intro ---------------- */
  useEffect(() => {
    const ctx = gsap.context(() => {
      marqueeTweens.current = {
        top: gsap.to(".marquee-top-text", {
          xPercent: -50,
          repeat: -1,
          duration: 8,
          ease: "none",
        }),
        bottom: gsap.fromTo(
          ".marquee-bottom-text",
          { xPercent: -50 },
          { xPercent: 0, repeat: -1, duration: 8, ease: "none" },
        ),
        left: gsap.to(".marquee-left-text", {
          xPercent: -50,
          repeat: -1,
          duration: 8,
          ease: "none",
        }),
        right: gsap.to(".marquee-right-text", {
          xPercent: -50,
          repeat: -1,
          duration: 8,
          ease: "none",
        }),
      };

      // one-time intro: cards bloom outward from the centre
      gsap.from(".gallery-inner", {
        opacity: 0,
        scale: 0.6,
        y: 40,
        duration: 1.4,
        ease: "expo.out",
        stagger: { amount: 0.9, from: "center" },
      });

      gsap.from(hintRef.current, {
        opacity: 0,
        y: 12,
        duration: 0.8,
        delay: 1.2,
        ease: "power3.out",
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  /* ---------------- borders ---------------- */
  const toggleBorders = (show) => {
    const bars = [
      { ref: topBorderRef, prop: "yPercent", hidden: -100 },
      { ref: rightBorderRef, prop: "xPercent", hidden: 100 },
      { ref: bottomBorderRef, prop: "yPercent", hidden: 100 },
      { ref: leftBorderRef, prop: "xPercent", hidden: -100 },
    ];
    // bars slide in one after another, and leave in the same order
    bars.forEach(({ ref, prop, hidden }, i) => {
      gsap.to(ref.current, {
        [prop]: show ? 0 : hidden,
        duration: show ? 1.1 : 0.9,
        delay: i * (show ? 0.05 : 0.03),
        ease: show ? "expo.out" : "expo.inOut",
        overwrite: "auto",
      });
    });
  };

  /* ---------------- pointer handlers ---------------- */
  const handlePointerDown = () => {
    if (focusedItem) return;
    isDragging.current = true;
    dragDistance.current = 0;
    velocity.current = { x: 0, y: 0 };
    setCursorMode("drag");
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current || focusedItem) return;

    dragDistance.current += Math.abs(e.movementX) + Math.abs(e.movementY);

    if (dragDistance.current > 5 && !isZoomedOut.current) {
      isZoomedOut.current = true;
      gsap.to(gridWrapperRef.current, {
        scale: 0.85,
        duration: 1.4,
        ease: "expo.out",
      });
      toggleBorders(true);

      if (!hintHidden.current) {
        hintHidden.current = true;
        gsap.to(hintRef.current, { opacity: 0, y: 12, duration: 0.5 });
      }
    }

    velocity.current = {
      x: clamp(e.movementX * 2.75, -90, 90),
      y: clamp(e.movementY * 2.75, -90, 90),
    };

    targetOffset.current.x += velocity.current.x;
    targetOffset.current.y += velocity.current.y;

    // the cursor's diagonal line points along the drag direction
    if (Math.abs(e.movementX) > 1 || Math.abs(e.movementY) > 1) {
      const angle = Math.atan2(e.movementY, e.movementX) * (180 / Math.PI);
      gsap.to(cursorArrowRef.current, {
        rotation: angle + 45 + "_short",
        duration: 0.25,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setCursorMode(isHovering.current ? "view" : "default");

    if (isZoomedOut.current) {
      isZoomedOut.current = false;
      gsap.to(gridWrapperRef.current, {
        scale: 1,
        duration: 1.4,
        ease: "expo.out",
      });
      toggleBorders(false);
    }
  };

  const handleItemEnter = () => {
    isHovering.current = true;
    if (!isDragging.current && !focusedItem) setCursorMode("view");
  };

  const handleItemLeave = () => {
    isHovering.current = false;
    if (!isDragging.current && !focusedItem) setCursorMode("default");
  };

  const handleItemClick = (e, index, src) => {
    if (dragDistance.current > 5) return;

    const rect = e.currentTarget.getBoundingClientRect();

    setCursorMode("close"); // arrows -> X
    wipeOthers(index, true); // green sweep over everything else
    setFocusedItem({ index, rect, src });
  };

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen bg-[#111111] overflow-hidden relative select-none touch-none cursor-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* custom cursor: stays above everything, including the open card */}
      <div
        ref={mainCursorRef}
        className="fixed top-0 left-0 w-12 h-12 -ml-6 -mt-6 bg-[#00FF00] text-black rounded-full pointer-events-none flex items-center justify-center z-[120]"
      >
        <div ref={cursorArrowRef}>
          <div ref={cursorSpinRef}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="19" x2="19" y2="5" />
              <line ref={lineBRef} x1="5" y1="5" x2="19" y2="19" />
              <polyline ref={headARef} points="13 5 19 5 19 11" />
              <polyline ref={headBRef} points="11 19 5 19 5 13" />
            </svg>
          </div>
        </div>
      </div>

      {/* soft vignette so the cards feel lit from the centre */}
      <div className="pointer-events-none fixed inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />

      {/* bottom hint, fades away on first drag */}
      <div
        ref={hintRef}
        className="pointer-events-none fixed bottom-8 left-1/2 -translate-x-1/2 z-30 text-[11px] font-bold tracking-[0.4em] uppercase text-white/50"
      >
        Drag to explore
      </div>

      {/* animated borders */}
      <div ref={topBorderRef} className="fixed top-0 left-0 w-full h-16 bg-[#00FF00] text-black z-40 flex items-center overflow-hidden pointer-events-none shadow-[0_0_60px_rgba(0,255,0,0.35)]">
        <div className="marquee-top-text flex">
          <MarqueeContent text="DRAG ←" />
          <MarqueeContent text="DRAG ←" />
        </div>
      </div>

      <div ref={bottomBorderRef} className="fixed bottom-0 left-0 w-full h-16 bg-[#00FF00] text-black z-40 flex items-center overflow-hidden pointer-events-none shadow-[0_0_60px_rgba(0,255,0,0.35)]">
        <div className="marquee-bottom-text flex">
          <MarqueeContent text="DRAG ➔" />
          <MarqueeContent text="DRAG ➔" />
        </div>
      </div>

      <div ref={leftBorderRef} className="fixed top-0 left-0 w-16 h-full bg-[#00FF00] text-black z-40 flex items-center justify-center overflow-hidden pointer-events-none shadow-[0_0_60px_rgba(0,255,0,0.35)]">
        <div className="w-[100vh] h-16 flex items-center justify-center -rotate-90">
          <div className="marquee-left-text flex">
            <MarqueeContent text="DRAG ←" />
            <MarqueeContent text="DRAG ←" />
          </div>
        </div>
      </div>

      <div ref={rightBorderRef} className="fixed top-0 right-0 w-16 h-full bg-[#00FF00] text-black z-40 flex items-center justify-center overflow-hidden pointer-events-none shadow-[0_0_60px_rgba(0,255,0,0.35)]">
        <div className="w-[100vh] h-16 flex items-center justify-center rotate-90">
          <div className="marquee-right-text flex">
            <MarqueeContent text="DRAG ➔" />
            <MarqueeContent text="DRAG ➔" />
          </div>
        </div>
      </div>

      {/* grid */}
      <div ref={gridWrapperRef} className="absolute inset-0 w-full h-full origin-center pointer-events-none">
        {images.map((src, i) => {
          const isHidden = focusedItem && focusedItem.index === i;
          return (
            <div
              key={i}
              id={`gallery-item-${i}`}
              ref={(el) => (itemsRef.current[i] = el)}
              className="group absolute top-0 left-0 pointer-events-auto hover:z-10"
              style={{
                width: ITEM_W,
                height: ITEM_H,
                opacity: isHidden ? 0 : 1,
                willChange: "transform",
              }}
              onClick={(e) => handleItemClick(e, i, src)}
              onPointerEnter={handleItemEnter}
              onPointerLeave={handleItemLeave}
            >
              {/* thin frame that appears behind the card on hover */}
              <div
                className="absolute w-full h-full rounded-2xl border border-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ left: -FRAME_OFFSET, top: -FRAME_OFFSET }}
              />

              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <div className="gallery-inner absolute inset-0">
                  <img
                    src={src}
                    alt={`Gallery item ${i}`}
                    className="w-full h-full object-cover pointer-events-none select-none"
                    draggable={false}
                    loading="lazy"
                  />
                </div>
                {/* green wipe layer (invisible until a card is opened) */}
                <div
                  className="gallery-wipe absolute inset-0 bg-[#00FF00] pointer-events-none"
                  style={{ clipPath: "inset(100% 0% 0% 0%)" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {focusedItem && (
        <ExpandedView
          item={focusedItem}
          info={PROJECTS[focusedItem.index % NUM_LOCAL_IMAGES]}
          onCloseStart={() => {
            setCursorMode("default"); // X -> arrows
            wipeOthers(focusedItem.index, false); // cards sweep back in
          }}
          onClose={() => setFocusedItem(null)}
        />
      )}
    </div>
  );
}
