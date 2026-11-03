import { useRef, useEffect, useLayoutEffect } from "react";
import { gsap } from "gsap";

export default function ExpandedView({ item, info, onClose, onCloseStart }) {
  const ITEM_W = 320;
  const ITEM_H = 460;

  const IMG_SCALE = 1.2; // images are slightly oversized so parallax never shows edges
  const FRAME_OFFSET = 12; 

  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const ghostRef = useRef(null);
  const infoRef = useRef(null);
  const subRef = useRef(null);
  const charsRef = useRef([]);
  const enterTl = useRef(null);
  const closingRef = useRef(false);
  const closeFnRef = useRef(() => {});

  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$@";
  const applyScramble = (chars, text, p) => {
    const n = p * (text.length + 3);
    for (let i = 0; i < chars.length; i++) {
      const el = chars[i];
      const ch = text[i];
      if (!el || ch === " ") continue;
      if (i < n - 3) {
        el.textContent = ch;
        el.style.opacity = 1;
      } else if (i < n) {
        el.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        el.style.opacity = 1;
      } else {
        el.textContent = ch;
        el.style.opacity = 0;
      }
    }
  };

  useLayoutEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // final size/position: image sits slightly above centre to leave room for the title
    const scale = Math.min(1.2, (vh * 0.5) / ITEM_H, (vw * 0.8) / ITEM_W);
    const w = ITEM_W * scale;
    const h = ITEM_H * scale;
    const cx = vw / 2;
    const cy = vh / 2 - 30;

    const chars = charsRef.current;

    // freeze each letter's width so the scramble never makes the title jitter
    chars.forEach((el) => {
      if (el) el.style.width = el.offsetWidth + "px";
    });

    gsap.set(wrapRef.current, {
      position: "fixed",
      top: item.rect.top,
      left: item.rect.left,
      width: item.rect.width,
      height: item.rect.height,
      xPercent: 0,
      yPercent: 0,
      zIndex: 100,
      borderRadius: "16px",
      overflow: "hidden",
    });
    gsap.set(ghostRef.current, {
      position: "fixed",
      left: item.rect.left - FRAME_OFFSET,
      top: item.rect.top - FRAME_OFFSET,
      width: item.rect.width,
      height: item.rect.height,
      opacity: 1,
    });
    gsap.set(infoRef.current, { top: cy + h / 2 + 28 });
    gsap.set(imgRef.current, { scale: IMG_SCALE });
    gsap.set(subRef.current, { opacity: 0, y: 10 });
    applyScramble(chars, info.title, 0);

    const state = { p: 0 };
    const tl = gsap.timeline();
    enterTl.current = tl;

    // 1. the card glides to the centre
    tl.to(
      wrapRef.current,
      {
        top: cy,
        left: cx,
        xPercent: -50,
        yPercent: -50,
        width: w,
        height: h,
        duration: 0.95,
        ease: "expo.inOut",
      },
      0,
    );
    // 2. the image settles as it lands
    tl.to(imgRef.current, { scale: 1, duration: 1.3, ease: "expo.out" }, 0.1);
    // 3. the thin frame trails behind, then fades
    tl.to(
      ghostRef.current,
      {
        left: cx - w / 2 - FRAME_OFFSET,
        top: cy - h / 2 - FRAME_OFFSET,
        width: w,
        height: h,
        duration: 1.1,
        ease: "expo.inOut",
      },
      0.1,
    );
    tl.to(ghostRef.current, { opacity: 0, duration: 0.5, ease: "power2.out" }, 0.9);
    // 4. title scrambles in, then the date
    tl.to(
      state,
      {
        p: 1,
        duration: 0.9,
        ease: "power2.inOut",
        onUpdate: () => applyScramble(chars, info.title, state.p),
      },
      0.55,
    );
    tl.to(
      subRef.current,
      { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" },
      1.0,
    );

    return () => tl.kill();
  }, [item, info]);

  const handleClose = () => {
    if (closingRef.current) return; // ignore double clicks
    closingRef.current = true;

    if (enterTl.current) enterTl.current.kill();
    onCloseStart();

    const origEl = document.getElementById(`gallery-item-${item.index}`);
    const endRect = origEl ? origEl.getBoundingClientRect() : item.rect;

    const chars = charsRef.current;
    const state = { p: 1 };
    const tl = gsap.timeline({ onComplete: onClose });

    // title glitches away, date fades
    tl.to(
      state,
      {
        p: 0,
        duration: 0.5,
        ease: "power2.in",
        onUpdate: () => applyScramble(chars, info.title, state.p),
      },
      0,
    );
    tl.to(subRef.current, { opacity: 0, y: -6, duration: 0.3, ease: "power2.in" }, 0);
    tl.to(ghostRef.current, { opacity: 0, duration: 0.2 }, 0);

    // card flies back to its slot in the grid
    tl.to(
      wrapRef.current,
      {
        top: endRect.top,
        left: endRect.left,
        xPercent: 0,
        yPercent: 0,
        width: endRect.width,
        height: endRect.height,
        borderRadius: "16px",
        duration: 0.95,
        ease: "expo.inOut",
      },
      0.1,
    );
    tl.to(
      imgRef.current,
      { scale: IMG_SCALE, duration: 0.95, ease: "expo.inOut" },
      0.1,
    );
  };

  closeFnRef.current = handleClose;

  // ESC closes too
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeFnRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-auto cursor-none"
      onClick={handleClose}
    >
      {/* thin frame that trails behind the card */}
      <div
        ref={ghostRef}
        className="pointer-events-none rounded-2xl border border-white/40 z-[99]"
      />

      <div ref={wrapRef} className="absolute shadow-[0_30px_120px_rgba(0,255,0,0.12)]">
        <img
          ref={imgRef}
          src={item.src}
          alt={info.title}
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>

      {/* title + date */}
      <div
        ref={infoRef}
        className="fixed left-0 w-full text-center pointer-events-none z-[101]"
      >
        <h2 className="m-0 text-[26px] leading-none font-black italic uppercase tracking-wide text-[#00FF00] whitespace-nowrap">
          {Array.from(info.title).map((ch, i) => (
            <span
              key={i}
              ref={(el) => (charsRef.current[i] = el)}
              className="inline-block text-center"
            >
              {ch === " " ? "\u00A0" : ch}
            </span>
          ))}
        </h2>
        <p
          ref={subRef}
          className="mt-3 text-[11px] font-bold tracking-[0.3em] text-[#00FF00]/70"
        >
          • {info.date} •
        </p>
      </div>
    </div>
  );
}