// const TEAM_MEMBERS = [
//   { name: "Colin", img: "/mami1.jpg" },
//   { name: "Liam", img: "/mami2.jpg" },
//   { name: "Tabitha", img: "/mami3.jpg" },
//   { name: "Tyson", img: "/mami4.jpg" },
//   { name: "Max", img: "/mami5.jpg" },
//   { name: "Everest", img: "/mami6.jpg" },
//   { name: "Simon", img: "/mami7.jpg" },
//   { name: "Gideon", img: "/mami8.jpg" },
//   { name: "Benton", img: "/mami9.jpg" },
// ];

// const BG = "#0f0f0f";
// const BONE = "#e3e3db";
// const RED = "#f93535";

// const SHADOW_FLAT = `0 0 0 4px ${BG}, 0 0 0px 0px rgba(249,53,53,0)`;
// const SHADOW_LIT = `0 0 0 4px ${BG}, 0 0 38px 6px rgba(249,53,53,0.38)`;
// const IMG_DIM = "grayscale(1) brightness(0.45)";
// const IMG_LIT = "grayscale(0) brightness(1)";

// // Splits text into spans so each letter can be animated on its own
// const SplitTextChars = ({ text }) =>
//   text.split("").map((char, i) => (
//     <span
//       key={i}
//       aria-hidden="true"
//       className="letter inline-block relative will-change-[transform,filter,opacity]"
     
//     >
//       {char === " " ? "\u00A0" : char}
//     </span>
//   ));

// export default function InteractiveTeam() {
//   const sectionRef = useRef(null);
//   const containerRef = useRef(null);
//   const canvasRef = useRef(null);
//   const liveRef = useRef(null);
//   const slotRefs = useRef([]);
//   const avatarRefs = useRef([]);
//   const imgRefs = useRef([]);
//   const ringRefs = useRef([]);
//   const pulseRefs = useRef([]);
//   const groupRefs = useRef([]); // 0 = default title, 1..n = member names

//   // Make sure the display font is there
//   useEffect(() => {
//     if (document.getElementById("barlow-condensed-font")) return;
//     const link = document.createElement("link");
//     link.id = "barlow-condensed-font";
//     link.rel = "stylesheet";
//     link.href =
//       "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@900&display=swap";
//     document.head.appendChild(link);
//   }, []);

//   useEffect(() => {
//     const section = sectionRef.current;
//     const container = containerRef.current;
//     const canvas = canvasRef.current;
//     const c2d = canvas.getContext("2d");

//     const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
//     const T = reduce ? 0 : 1; // time multiplier; 0 = instant

//     const slots = slotRefs.current.filter(Boolean);
//     const avatars = avatarRefs.current.filter(Boolean);
//     const imgs = imgRefs.current.filter(Boolean);
//     const rings = ringRefs.current.filter(Boolean);
//     const pulses = pulseRefs.current.filter(Boolean);
//     const groups = groupRefs.current
//       .filter(Boolean)
//       .map((g) => Array.from(g.querySelectorAll(".letter")));

//     let ready = false;
//     let active = -1;
//     let nameKey = -1;

//     /* ---------- embers ---------- */
//     let particles = [];
//     let size = { w: 0, h: 0 };

//     const resize = () => {
//       const dpr = Math.min(window.devicePixelRatio || 1, 2);
//       const r = section.getBoundingClientRect();
//       size = { w: r.width, h: r.height };
//       canvas.width = r.width * dpr;
//       canvas.height = r.height * dpr;
//       c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
//     };
//     resize();
//     const ro = new ResizeObserver(resize);
//     ro.observe(section);

//     const spawn = (x, y, angle, burst = false) => {
//       if (particles.length > 180) return;
//       const speed = burst ? 0.8 + Math.random() * 2.2 : 0.4 + Math.random() * 0.9;
//       particles.push({
//         x,
//         y,
//         vx: Math.cos(angle) * speed * 0.6 + (Math.random() - 0.5) * 0.5,
//         vy: Math.sin(angle) * speed - (0.5 + Math.random() * 1.1),
//         life: 0,
//         max: 55 + Math.random() * 65,
//         s: 0.8 + Math.random() * 2.1,
//         c: Math.random() < 0.65 ? RED : BONE,
//         wob: Math.random() * Math.PI * 2,
//       });
//     };

//     const rim = () => {
//       const r = avatars[active].getBoundingClientRect();
//       const s = section.getBoundingClientRect();
//       return {
//         cx: r.left + r.width / 2 - s.left,
//         cy: r.top + r.height / 2 - s.top,
//         rad: r.width / 2,
//       };
//     };

//     const burst = (n) => {
//       if (reduce || active < 0) return;
//       const { cx, cy, rad } = rim();
//       for (let i = 0; i < n; i++) {
//         const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
//         spawn(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, a, true);
//       }
//     };

//     const tick = () => {
//       c2d.clearRect(0, 0, size.w, size.h);
//       if (reduce) return;

//       if (active >= 0 && ready) {
//         const { cx, cy, rad } = rim();
//         for (let i = 0; i < 2; i++) {
//           const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
//           spawn(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, a);
//         }
//       }

//       c2d.globalCompositeOperation = "lighter";
//       particles = particles.filter((p) => p.life < p.max);
//       for (const p of particles) {
//         p.life++;
//         p.x += p.vx + Math.sin(p.life * 0.08 + p.wob) * 0.25;
//         p.y += p.vy;
//         p.vy *= 0.992;
//         const t = p.life / p.max;
//         c2d.globalAlpha = (1 - t) * (1 - t) * 0.95;
//         c2d.fillStyle = p.c;
//         c2d.beginPath();
//         c2d.arc(p.x, p.y, p.s * (1 - t * 0.5), 0, Math.PI * 2);
//         c2d.fill();
//       }
//       c2d.globalAlpha = 1;
//       c2d.globalCompositeOperation = "source-over";
//     };

//     /* ---------- the rest, inside a gsap context for clean teardown ---------- */
//     const ctx = gsap.context(() => {
//       gsap.set(groups.flat(), { opacity: 0 });
//       gsap.set(imgs, { filter: IMG_LIT });
//       gsap.set(rings, { opacity: 0, scale: 0.92 });
//       gsap.set(pulses, { opacity: 0 });
//       gsap.set(avatars, { boxShadow: SHADOW_FLAT });

//       const qScale = avatars.map((a) =>
//         gsap.quickTo(a, "scale", { duration: 0.55 * T + 0.001, ease: "power3.out" })
//       );
//       const qY = avatars.map((a) =>
//         gsap.quickTo(a, "y", { duration: 0.55 * T + 0.001, ease: "power3.out" })
//       );

//       /* ---------- text: "conjure" ----------
//          Letters are summoned from nowhere: each one starts huge, blurred and
//          scattered, flies in at its own random moment, snaps into place and
//          cools from a hot colour to its final one, spitting a spark as it
//          lands. Leaving is a quick dissolve upward. Only one name is ever
//          allowed to be on its way out, and swaps wait for a brief dwell, so
//          fast scrubbing can't pile names on top of each other. */
//       const rand = gsap.utils.random;
//       const finalColor = (k) => (k === 0 ? BONE : RED);
//       const hotColor = (k) => (k === 0 ? RED : BONE);
//       const enterTw = {};
//       const exitTw = {};

//       const letterSpark = (el) => {
//         if (reduce || !el.textContent.trim()) return;
//         const r = el.getBoundingClientRect();
//         const s = section.getBoundingClientRect();
//         for (let i = 0; i < 2; i++) {
//           spawn(
//             r.left + r.width * (0.2 + Math.random() * 0.6) - s.left,
//             r.top + r.height * 0.28 - s.top,
//             -Math.PI / 2 + (Math.random() - 0.5) * 0.8,
//             true
//           );
//         }
//       };

//       const showName = (k) => {
//         const letters = groups[k];
//         enterTw[k]?.kill();
//         exitTw[k]?.kill();
//         if (reduce) {
//           gsap.set(letters, {
//             opacity: 1, xPercent: 0, yPercent: 0, rotation: 0, scale: 1,
//             filter: "blur(0px)", color: finalColor(k),
//           });
//           return;
//         }
//         const tl = gsap.timeline({ delay: 0.1 });
//         const order = gsap.utils.shuffle(letters.map((_, i) => i));
//         letters.forEach((el, i) => {
//           const at = (order.indexOf(i) / Math.max(letters.length, 1)) * 0.35;
//           tl.fromTo(
//             el,
//             {
//               xPercent: rand(-160, 160),
//               yPercent: rand(-140, 140),
//               rotation: rand(-50, 50),
//               scale: rand(1.8, 3),
//               filter: `blur(${rand(16, 28)}px)`,
//               color: hotColor(k),
//             },
//             {
//               xPercent: 0,
//               yPercent: 0,
//               rotation: 0,
//               scale: 1,
//               filter: "blur(0px)",
//               color: finalColor(k),
//               duration: rand(0.75, 1.1),
//               ease: "expo.out",
//               onComplete: () => nameKey === k && letterSpark(el),
//             },
//             at
//           );
//           tl.fromTo(
//             el,
//             { opacity: 0 },
//             { opacity: 1, duration: 0.3, ease: "power1.out" },
//             at
//           );
//         });
//         enterTw[k] = tl;
//       };

//       const hideName = (k) => {
//         enterTw[k]?.kill();
//         if (reduce) {
//           gsap.set(groups[k], { opacity: 0 });
//           return;
//         }
//         exitTw[k] = gsap.to(groups[k], {
//           yPercent: -45,
//           scale: 1.25,
//           rotation: () => rand(-14, 14),
//           filter: "blur(18px)",
//           opacity: 0,
//           duration: 0.26,
//           ease: "power2.in",
//           stagger: { each: 0.012, from: "random" },
//           overwrite: true,
//         });
//       };

//       const commit = (next) => {
//         if (next === nameKey) return;
//         // finish any older exit instantly: at most one name is ever leaving
//         Object.values(exitTw).forEach((tw) => tw?.isActive() && tw.progress(1));
//         const prev = nameKey;
//         nameKey = next;
//         if (prev >= 0) hideName(prev);
//         showName(next);
//         if (liveRef.current) {
//           liveRef.current.textContent = next > 0 ? TEAM_MEMBERS[next - 1].name : "";
//         }
//       };

//       // short dwell so a fast sweep across the row doesn't summon every name
//       let intent;
//       const swapName = (next) => {
//         clearTimeout(intent);
//         intent = setTimeout(() => commit(next), next === 0 ? 160 : 40);
//       };

//       const setActive = (i) => {
//         if (i === active) return;
//         active = i;

//         avatars.forEach((a, j) => {
//           const on = j === i;
//           const dim = i >= 0 && !on;
//           gsap.to(imgs[j], {
//             filter: dim ? IMG_DIM : IMG_LIT,
//             duration: 0.4 * T,
//             overwrite: "auto",
//           });
//           gsap.to(rings[j], {
//             opacity: on ? 1 : 0,
//             scale: on ? 1 : 0.92,
//             duration: 0.35 * T,
//             ease: "power3.out",
//             overwrite: "auto",
//           });
//           gsap.to(a, {
//             boxShadow: on ? SHADOW_LIT : SHADOW_FLAT,
//             duration: 0.45 * T,
//             overwrite: "auto",
//           });
//         });

//         if (i >= 0) {
//           gsap.fromTo(
//             pulses[i],
//             { scale: 1, opacity: 0.75 },
//             { scale: 1.75, opacity: 0, duration: 0.9 * T, ease: "power2.out" }
//           );
//           burst(22);
//         }
//         swapName(i >= 0 ? i + 1 : 0);
//       };

//       // x/y in viewport coords, or null to relax everything
//       const update = (x, y) => {
//         let best = -1;
//         let bestD = Infinity;
//         let width = 1;

//         const dists = slots.map((s, i) => {
//           const r = s.getBoundingClientRect();
//           width = r.width;
//           if (x === null) return Infinity;
//           const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
//           if (d < bestD) {
//             bestD = d;
//             best = i;
//           }
//           return d;
//         });

//         const sigma = width * 0.8;
//         slots.forEach((s, i) => {
//           const f = x === null ? 0 : Math.exp(-(dists[i] * dists[i]) / (2 * sigma * sigma));
//           qScale[i](1 + 0.9 * f);
//           qY[i](-24 * f);
//           s.style.zIndex = String(Math.round(f * 100) + 1);
//         });

//         setActive(x !== null && bestD < width * 0.75 ? best : -1);
//       };

//       /* ---------- input ---------- */
//       const onMove = (e) => ready && update(e.clientX, e.clientY);
//       const onLeave = () => ready && update(null);
//       const onFocusIn = (e) => {
//         const el = e.target.closest("[data-i]");
//         if (!ready || !el) return;
//         const r = slots[Number(el.dataset.i)].getBoundingClientRect();
//         update(r.left + r.width / 2, r.top + r.height / 2);
//       };
//       const onFocusOut = () => ready && update(null);

//       container.addEventListener("pointermove", onMove);
//       container.addEventListener("pointerdown", onMove);
//       container.addEventListener("pointerleave", onLeave);
//       container.addEventListener("pointercancel", onLeave);
//       container.addEventListener("focusin", onFocusIn);
//       container.addEventListener("focusout", onFocusOut);

//       /* ---------- intro: one orchestrated moment ---------- */
//       gsap.fromTo(
//         slots,
//         { scale: 0, y: 50, opacity: 0 },
//         {
//           scale: 1,
//           y: 0,
//           opacity: 1,
//           duration: 0.9 * T,
//           ease: "back.out(1.7)",
//           stagger: { each: 0.07 * T, from: "center" },
//           onComplete: () => {
//             ready = true;
//           },
//         }
//       );
//       gsap.delayedCall(0.45 * T, () => commit(0));

//       gsap.ticker.add(tick);

//       return () => {
//         clearTimeout(intent);
//         gsap.ticker.remove(tick);
//         container.removeEventListener("pointermove", onMove);
//         container.removeEventListener("pointerdown", onMove);
//         container.removeEventListener("pointerleave", onLeave);
//         container.removeEventListener("pointercancel", onLeave);
//         container.removeEventListener("focusin", onFocusIn);
//         container.removeEventListener("focusout", onFocusOut);
//       };
//     }, section);

//     return () => {
//       ro.disconnect();
//       ctx.revert();
//     };
//   }, []);

//   const fontSize = "clamp(4.5rem, 14vw, 15rem)";

//   return (
//     <section
//       ref={sectionRef}
//       className="relative w-full h-[100svh] bg-[#0f0f0f] text-[#e3e3db] flex flex-col justify-center items-center gap-4 md:gap-8 overflow-hidden max-md:flex-col-reverse"
//     >
//       {/* Embers */}
//       <canvas
//         ref={canvasRef}
//         aria-hidden="true"
//         className="pointer-events-none absolute inset-0 z-30 w-full h-full"
//       />
//       <p ref={liveRef} className="sr-only" aria-live="polite" />

//       {/* Overlapping circular avatars */}
//       <div
//         ref={containerRef}
//         className="relative z-20 flex justify-center items-center px-10 py-20 select-none cursor-pointer"
//         style={{ touchAction: "pan-y" }}
//       >
//         {TEAM_MEMBERS.map((member, i) => {
//           const Tag = member.href ? "a" : "div";
//           const linkProps = member.href
//             ? { href: member.href, target: "_blank", rel: "noreferrer noopener" }
//             : { tabIndex: 0, role: "img" };
//           return (
//             <div
//               key={member.name}
//               ref={(el) => (slotRefs.current[i] = el)}
//               className={`relative w-[52px] h-[52px] md:w-[88px] md:h-[88px] ${
//                 i === 0 ? "" : "-ml-[18px] md:-ml-[22px]"
//               }`}
//               style={{ zIndex: i + 1 }}
//             >
//               <Tag
//                 {...linkProps}
//                 data-i={i}
//                 aria-label={member.name}
//                 ref={(el) => (avatarRefs.current[i] = el)}
//                 className="absolute inset-0 block rounded-full outline-none will-change-transform"
//               >
//                 <img
//                   ref={(el) => (imgRefs.current[i] = el)}
//                   src={member.img}
//                   alt=""
//                   draggable={false}
//                   className="w-full h-full object-cover rounded-full"
//                 />
//                 {/* solid red ring, shown on focus */}
//                 <span
//                   ref={(el) => (ringRefs.current[i] = el)}
//                   aria-hidden="true"
//                   className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-[#f93535]"
//                 />
//                 {/* one-shot ripple on wake */}
//                 <span
//                   ref={(el) => (pulseRefs.current[i] = el)}
//                   aria-hidden="true"
//                   className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#f93535]"
//                 />
//               </Tag>
//             </div>
//           );
//         })}
//       </div>

//       {/* Names */}
//       <div
//         className="relative w-full"
//         style={{ height: fontSize }}
//       >
//         <div
//           ref={(el) => (groupRefs.current[0] = el)}
//           className="absolute left-0 top-0 w-full text-[#e3e3db]"
//         >
//           <h1
//             aria-label="The Squad"
//             className="w-full text-center uppercase font-['Barlow_Condensed'] font-black tracking-[-0.2rem] leading-none select-none max-md:tracking-normal"
//             style={{ fontSize }}
//           >
//             <SplitTextChars text="The Squad" />
//           </h1>
//         </div>

//         {TEAM_MEMBERS.map((member, i) => (
//           <div
//             key={member.name}
//             ref={(el) => (groupRefs.current[i + 1] = el)}
//             aria-hidden="true"
//             className="absolute left-0 top-0 w-full text-[#f93535]"
//           >
//             <h2
//               className="w-full text-center uppercase font-['Barlow_Condensed'] font-black tracking-[-0.2rem] leading-none select-none max-md:tracking-normal"
//               style={{ fontSize }}
//             >
//               <SplitTextChars text={member.name} />
//             </h2>
//           </div>
//         ))}
//       </div>
//     </section>
//   );
// }


import React, { useEffect, useRef } from "react";
import gsap from "gsap";

/*
  The Squad — spellbound edition

  Same bones as before: near-black stage, bone-white title, red names, giant
  type. What's new:
    • circular avatars that overlap like a stack of coins, with a cut-out edge
    • dock-style proximity: the whole row swells toward your cursor / finger
    • non-focused faces dim to grayscale so the one you're on lights up
    • a red ring + one ripple when a face wakes up
    • embers lift off the focused avatar (canvas, no gradients anywhere)
    • names are conjured: letters fly in from nowhere, blurred and scattered, and cool into place
    • one intro moment: the row pops in from the middle, then the title appears
    • works with touch (drag across the row), keyboard focus, and reduced motion

  Type: "Dela Gothic One" (Google Fonts) — fat, flat-topped letters that leave
  plenty of room for a fill. It's injected below if missing, but you can also
  add it to index.html.

  Letter fill (no gradients): each member's name is a window onto their own
  photo, stretched continuously across the whole word and rendered as a red
  duotone. "THE SQUAD" gives every letter a different member's face in
  black & white. Letters arrive as the opposite treatment (colour <-> mono)
  and cool into their final one, and the photo drifts slowly behind the name.

  Twitter/X profile pics: set `img` to e.g. `https://unavatar.io/x/<handle>`
  (or download them into /public). `href` is optional and makes a face clickable.
*/

const TEAM_MEMBERS = [
  { name: "Nani", img: "https://unavatar.io/x/srinivasrishi17" },
  { name: "MAMITHIAN", img: "https://unavatar.io/x/Krejuhh_1" },
  { name: "Bava", img: "https://unavatar.io/x/Sandeep_K_77" },
  { name: ".M. Fandom", img: "https://unavatar.io/x/mamithafandom" },
  { name: "Professor", img: "https://unavatar.io/x/iamprofessor095" },
  { name: "New Soul", img: "https://unavatar.io/x/Gen_Movie_buff" },
  { name: "NTR FAN", img: "https://unavatar.io/x/NTR_fan__9999" },
  { name: "Januu", img: "https://unavatar.io/x/Iam_Janudi" },
  { name: "chintu", img: "https://unavatar.io/x/fanofmamitha" },
];

const BG = "#0f0f0f";
const BONE = "#e3e3db";
const RED = "#f93535";

const SHADOW_FLAT = `0 0 0 4px ${BG}, 0 0 0px 0px rgba(249,53,53,0)`;
const SHADOW_LIT = `0 0 0 4px ${BG}, 0 0 38px 6px rgba(249,53,53,0.38)`;
const IMG_DIM = "grayscale(1) brightness(0.45)";
const IMG_LIT = "grayscale(0) brightness(1)";

// Splits text into spans so each letter can be animated on its own
const SplitTextChars = ({ text }) =>
  text.split("").map((char, i) => (
    <span
      key={i}
      aria-hidden="true"
      className="letter inline-block relative will-change-[transform,filter,opacity]"
     
    >
      {char === " " ? "\u00A0" : char}
    </span>
  ));

export default function InteractiveTeam() {
  const sectionRef = useRef(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const liveRef = useRef(null);
  const slotRefs = useRef([]);
  const avatarRefs = useRef([]);
  const imgRefs = useRef([]);
  const ringRefs = useRef([]);
  const pulseRefs = useRef([]);
  const groupRefs = useRef([]); // 0 = default title, 1..n = member names

  // Make sure the display font is there
  useEffect(() => {
    if (document.getElementById("squad-display-font")) return;
    const link = document.createElement("link");
    link.id = "squad-display-font";
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const c2d = canvas.getContext("2d");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const T = reduce ? 0 : 1; // time multiplier; 0 = instant

    const slots = slotRefs.current.filter(Boolean);
    const avatars = avatarRefs.current.filter(Boolean);
    const imgs = imgRefs.current.filter(Boolean);
    const rings = ringRefs.current.filter(Boolean);
    const pulses = pulseRefs.current.filter(Boolean);
    const groups = groupRefs.current
      .filter(Boolean)
      .map((g) => Array.from(g.querySelectorAll(".letter")));

    let ready = false;
    let active = -1;
    let nameKey = -1;

    /* ---------- embers ---------- */
    let particles = [];
    let size = { w: 0, h: 0 };

    let layoutHook = () => {};

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = section.getBoundingClientRect();
      size = { w: r.width, h: r.height };
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      layoutHook();
    });
    ro.observe(section);

    const spawn = (x, y, angle, burst = false) => {
      if (particles.length > 180) return;
      const speed = burst ? 0.8 + Math.random() * 2.2 : 0.4 + Math.random() * 0.9;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed * 0.6 + (Math.random() - 0.5) * 0.5,
        vy: Math.sin(angle) * speed - (0.5 + Math.random() * 1.1),
        life: 0,
        max: 55 + Math.random() * 65,
        s: 0.8 + Math.random() * 2.1,
        c: Math.random() < 0.65 ? RED : BONE,
        wob: Math.random() * Math.PI * 2,
      });
    };

    const rim = () => {
      const r = avatars[active].getBoundingClientRect();
      const s = section.getBoundingClientRect();
      return {
        cx: r.left + r.width / 2 - s.left,
        cy: r.top + r.height / 2 - s.top,
        rad: r.width / 2,
      };
    };

    const burst = (n) => {
      if (reduce || active < 0) return;
      const { cx, cy, rad } = rim();
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
        spawn(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, a, true);
      }
    };

    const tick = () => {
      c2d.clearRect(0, 0, size.w, size.h);
      if (reduce) return;

      if (active >= 0 && ready) {
        const { cx, cy, rad } = rim();
        for (let i = 0; i < 2; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
          spawn(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, a);
        }
      }

      c2d.globalCompositeOperation = "lighter";
      particles = particles.filter((p) => p.life < p.max);
      for (const p of particles) {
        p.life++;
        p.x += p.vx + Math.sin(p.life * 0.08 + p.wob) * 0.25;
        p.y += p.vy;
        p.vy *= 0.992;
        const t = p.life / p.max;
        c2d.globalAlpha = (1 - t) * (1 - t) * 0.95;
        c2d.fillStyle = p.c;
        c2d.beginPath();
        c2d.arc(p.x, p.y, p.s * (1 - t * 0.5), 0, Math.PI * 2);
        c2d.fill();
      }
      c2d.globalAlpha = 1;
      c2d.globalCompositeOperation = "source-over";
    };

    /* ---------- letter fill: photos inside the type ---------- */
    let loaded = [];
    let cancelled = false;
    const groupEls = groupRefs.current.filter(Boolean);

    const paint = (el, im, left, boxW, boxH, zoom, focusY, base) => {
      const sc = Math.max(boxW / im.naturalWidth, boxH / im.naturalHeight) * zoom;
      const bw = im.naturalWidth * sc;
      const bh = im.naturalHeight * sc;
      const x = -(el.offsetLeft - left) + (boxW - bw) / 2;
      const y = (boxH - bh) * focusY;
      const st = el.style;
      el.dataset.photo = "1";
      st.backgroundImage = `url("${im.src}")`;
      st.backgroundRepeat = "no-repeat";
      st.backgroundBlendMode = "luminosity";
      st.backgroundSize = `${bw}px ${bh}px`;
      st.backgroundPosition = `${x}px calc(${y}px + var(--dy, 0px))`;
      st.webkitBackgroundClip = "text";
      st.backgroundClip = "text";
      st.webkitTextFillColor = "transparent";
      st.webkitTextStroke = `0.02em ${base}`;
      if (!st.backgroundColor) st.backgroundColor = base;
    };

    const layoutPhotos = () => {
      if (!loaded.length) return;
      // The squad: a different face in every letter, in black & white
      const faces = loaded.filter(Boolean);
      if (faces.length) {
        let n = 0;
        groups[0].forEach((el) => {
          if (!el.textContent.trim()) return;
          const im = faces[n++ % faces.length];
          paint(el, im, el.offsetLeft, el.offsetWidth, el.offsetHeight, 1, 0.3, BONE);
        });
      }
      // Each name: one photo stretched across the whole word, red duotone
      groups.forEach((letters, k) => {
        const im = loaded[k - 1];
        if (k === 0 || !im || !letters.length) return;
        const first = letters[0];
        const last = letters[letters.length - 1];
        const left = first.offsetLeft;
        const boxW = last.offsetLeft + last.offsetWidth - left;
        letters.forEach((el) =>
          paint(el, im, left, boxW, first.offsetHeight, 1.25, 0.28, RED)
        );
      });
    };
    layoutHook = layoutPhotos;

    const fontReady = (document.fonts?.load('1em "Dela Gothic One"') || Promise.resolve()).catch(
      () => {}
    );
    const photosReady = Promise.all(
      TEAM_MEMBERS.map(
        (m) =>
          new Promise((res) => {
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => res(null);
            im.src = m.img;
          })
      )
    );
    const assetsReady = Promise.all([fontReady, photosReady]).then(([, imgs]) => {
      loaded = imgs;
      if (!cancelled) layoutPhotos();
    });
    // fonts that finish later change the letter widths, so measure again
    document.fonts?.addEventListener?.("loadingdone", layoutPhotos);

    /* ---------- the rest, inside a gsap context for clean teardown ---------- */
    const ctx = gsap.context(() => {
      gsap.set(groups.flat(), { opacity: 0 });
      gsap.set(imgs, { filter: IMG_LIT });
      gsap.set(rings, { opacity: 0, scale: 0.92 });
      gsap.set(pulses, { opacity: 0 });
      gsap.set(avatars, { boxShadow: SHADOW_FLAT });

      const qScale = avatars.map((a) =>
        gsap.quickTo(a, "scale", { duration: 0.55 * T + 0.001, ease: "power3.out" })
      );
      const qY = avatars.map((a) =>
        gsap.quickTo(a, "y", { duration: 0.55 * T + 0.001, ease: "power3.out" })
      );

      /* ---------- text: "conjure" ----------
         Letters are summoned from nowhere: each one starts huge, blurred and
         scattered, flies in at its own random moment, snaps into place and
         cools from a hot colour to its final one, spitting a spark as it
         lands. Leaving is a quick dissolve upward. Only one name is ever
         allowed to be on its way out, and swaps wait for a brief dwell, so
         fast scrubbing can't pile names on top of each other. */
      const rand = gsap.utils.random;
      const finalColor = (k) => (k === 0 ? BONE : RED);
      const hotColor = (k) => (k === 0 ? RED : BONE);
      const enterTw = {};
      const exitTw = {};
      const drift = {};

      const letterSpark = (el) => {
        if (reduce || !el.textContent.trim()) return;
        const r = el.getBoundingClientRect();
        const s = section.getBoundingClientRect();
        for (let i = 0; i < 2; i++) {
          spawn(
            r.left + r.width * (0.2 + Math.random() * 0.6) - s.left,
            r.top + r.height * 0.28 - s.top,
            -Math.PI / 2 + (Math.random() - 0.5) * 0.8,
            true
          );
        }
      };

      const showName = (k) => {
        const letters = groups[k];
        enterTw[k]?.kill();
        exitTw[k]?.kill();
        if (reduce) {
          letters.forEach((el) =>
            gsap.set(el, {
              opacity: 1, xPercent: 0, yPercent: 0, rotation: 0, scale: 1,
              filter: "blur(0px)",
              ...(el.dataset.photo === "1"
                ? { backgroundColor: finalColor(k) }
                : { color: finalColor(k) }),
            })
          );
          return;
        }
        const tl = gsap.timeline({ delay: 0.1 });
        const order = gsap.utils.shuffle(letters.map((_, i) => i));
        letters.forEach((el, i) => {
          const at = (order.indexOf(i) / Math.max(letters.length, 1)) * 0.35;
          tl.fromTo(
            el,
            {
              xPercent: rand(-160, 160),
              yPercent: rand(-140, 140),
              rotation: rand(-50, 50),
              scale: rand(1.8, 3),
              filter: `blur(${rand(16, 28)}px)`,
              ...(el.dataset.photo === "1"
                ? { backgroundColor: hotColor(k) }
                : { color: hotColor(k) }),
            },
            {
              xPercent: 0,
              yPercent: 0,
              rotation: 0,
              scale: 1,
              filter: "blur(0px)",
              ...(el.dataset.photo === "1"
                ? { backgroundColor: finalColor(k) }
                : { color: finalColor(k) }),
              duration: rand(0.75, 1.1),
              ease: "expo.out",
              onComplete: () => nameKey === k && letterSpark(el),
            },
            at
          );
          tl.fromTo(
            el,
            { opacity: 0 },
            { opacity: 1, duration: 0.3, ease: "power1.out" },
            at
          );
        });
        enterTw[k] = tl;
        if (k > 0) {
          drift[k]?.kill();
          drift[k] = gsap.fromTo(
            groupEls[k],
            { "--dy": "-14px" },
            { "--dy": "14px", duration: 5, ease: "sine.inOut", repeat: -1, yoyo: true }
          );
        }
      };

      const hideName = (k) => {
        enterTw[k]?.kill();
        drift[k]?.kill();
        if (reduce) {
          gsap.set(groups[k], { opacity: 0 });
          return;
        }
        exitTw[k] = gsap.to(groups[k], {
          yPercent: -45,
          scale: 1.25,
          rotation: () => rand(-14, 14),
          filter: "blur(18px)",
          opacity: 0,
          duration: 0.26,
          ease: "power2.in",
          stagger: { each: 0.012, from: "random" },
          overwrite: true,
        });
      };

      const commit = (next) => {
        if (next === nameKey) return;
        // finish any older exit instantly: at most one name is ever leaving
        Object.values(exitTw).forEach((tw) => tw?.isActive() && tw.progress(1));
        const prev = nameKey;
        nameKey = next;
        if (prev >= 0) hideName(prev);
        showName(next);
        if (liveRef.current) {
          liveRef.current.textContent = next > 0 ? TEAM_MEMBERS[next - 1].name : "";
        }
      };

      // short dwell so a fast sweep across the row doesn't summon every name
      let intent;
      let introTimer;
      const swapName = (next) => {
        clearTimeout(intent);
        intent = setTimeout(() => commit(next), next === 0 ? 160 : 40);
      };

      const setActive = (i) => {
        if (i === active) return;
        active = i;

        avatars.forEach((a, j) => {
          const on = j === i;
          const dim = i >= 0 && !on;
          gsap.to(imgs[j], {
            filter: dim ? IMG_DIM : IMG_LIT,
            duration: 0.4 * T,
            overwrite: "auto",
          });
          gsap.to(rings[j], {
            opacity: on ? 1 : 0,
            scale: on ? 1 : 0.92,
            duration: 0.35 * T,
            ease: "power3.out",
            overwrite: "auto",
          });
          gsap.to(a, {
            boxShadow: on ? SHADOW_LIT : SHADOW_FLAT,
            duration: 0.45 * T,
            overwrite: "auto",
          });
        });

        if (i >= 0) {
          gsap.fromTo(
            pulses[i],
            { scale: 1, opacity: 0.75 },
            { scale: 1.75, opacity: 0, duration: 0.9 * T, ease: "power2.out" }
          );
          burst(22);
        }
        swapName(i >= 0 ? i + 1 : 0);
      };

      // x/y in viewport coords, or null to relax everything
      const update = (x, y) => {
        let best = -1;
        let bestD = Infinity;
        let width = 1;

        const dists = slots.map((s, i) => {
          const r = s.getBoundingClientRect();
          width = r.width;
          if (x === null) return Infinity;
          const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
          if (d < bestD) {
            bestD = d;
            best = i;
          }
          return d;
        });

        const sigma = width * 0.8;
        slots.forEach((s, i) => {
          const f = x === null ? 0 : Math.exp(-(dists[i] * dists[i]) / (2 * sigma * sigma));
          qScale[i](1 + 0.9 * f);
          qY[i](-24 * f);
          s.style.zIndex = String(Math.round(f * 100) + 1);
        });

        setActive(x !== null && bestD < width * 0.75 ? best : -1);
      };

      /* ---------- input ---------- */
      const onMove = (e) => ready && update(e.clientX, e.clientY);
      const onLeave = () => ready && update(null);
      const onFocusIn = (e) => {
        const el = e.target.closest("[data-i]");
        if (!ready || !el) return;
        const r = slots[Number(el.dataset.i)].getBoundingClientRect();
        update(r.left + r.width / 2, r.top + r.height / 2);
      };
      const onFocusOut = () => ready && update(null);

      container.addEventListener("pointermove", onMove);
      container.addEventListener("pointerdown", onMove);
      container.addEventListener("pointerleave", onLeave);
      container.addEventListener("pointercancel", onLeave);
      container.addEventListener("focusin", onFocusIn);
      container.addEventListener("focusout", onFocusOut);

      /* ---------- intro: one orchestrated moment ---------- */
      gsap.fromTo(
        slots,
        { scale: 0, y: 50, opacity: 0 },
        {
          scale: 1,
          y: 0,
          opacity: 1,
          duration: 0.9 * T,
          ease: "back.out(1.7)",
          stagger: { each: 0.07 * T, from: "center" },
          onComplete: () => {
            ready = true;
          },
        }
      );
      Promise.race([assetsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
        if (!cancelled) introTimer = setTimeout(() => commit(0), 450 * T);
      });

      gsap.ticker.add(tick);

      return () => {
        clearTimeout(intent);
        clearTimeout(introTimer);
        gsap.ticker.remove(tick);
        container.removeEventListener("pointermove", onMove);
        container.removeEventListener("pointerdown", onMove);
        container.removeEventListener("pointerleave", onLeave);
        container.removeEventListener("pointercancel", onLeave);
        container.removeEventListener("focusin", onFocusIn);
        container.removeEventListener("focusout", onFocusOut);
      };
    }, section);

    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.("loadingdone", layoutPhotos);
      ro.disconnect();
      ctx.revert();
    };
  }, []);

  const fontSize = "clamp(2.2rem, 10.5vw, 11rem)";

  return (
    <section
      ref={sectionRef}
      className="relative w-full h-[100svh] bg-[#0f0f0f] text-[#e3e3db] flex flex-col justify-center items-center gap-4 md:gap-8 overflow-hidden max-md:flex-col-reverse"
    >
      {/* Embers */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-30 w-full h-full"
      />
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Overlapping circular avatars */}
      <div
        ref={containerRef}
        className="relative z-20 flex justify-center items-center px-10 py-20 select-none cursor-pointer"
        style={{ touchAction: "pan-y" }}
      >
        {TEAM_MEMBERS.map((member, i) => {
          const Tag = member.href ? "a" : "div";
          const linkProps = member.href
            ? { href: member.href, target: "_blank", rel: "noreferrer noopener" }
            : { tabIndex: 0, role: "img" };
          return (
            <div
              key={member.name}
              ref={(el) => (slotRefs.current[i] = el)}
              className={`relative w-[52px] h-[52px] md:w-[88px] md:h-[88px] ${
                i === 0 ? "" : "-ml-[18px] md:-ml-[22px]"
              }`}
              style={{ zIndex: i + 1 }}
            >
              <Tag
                {...linkProps}
                data-i={i}
                aria-label={member.name}
                ref={(el) => (avatarRefs.current[i] = el)}
                className="absolute inset-0 block rounded-full outline-none will-change-transform"
              >
                <img
                  ref={(el) => (imgRefs.current[i] = el)}
                  src={member.img}
                  alt=""
                  draggable={false}
                  className="w-full h-full object-cover rounded-full"
                />
                {/* solid red ring, shown on focus */}
                <span
                  ref={(el) => (ringRefs.current[i] = el)}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-[#f93535]"
                />
                {/* one-shot ripple on wake */}
                <span
                  ref={(el) => (pulseRefs.current[i] = el)}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#f93535]"
                />
              </Tag>
            </div>
          );
        })}
      </div>

      {/* Names */}
      <div
        className="relative w-full"
        style={{ height: `calc(${fontSize} * 1.05)` }}
      >
        <div
          ref={(el) => (groupRefs.current[0] = el)}
          className="absolute left-0 top-0 w-full text-[#e3e3db]"
        >
          <h1
            aria-label="The Squad"
            className="w-full text-center uppercase font-['Dela_Gothic_One'] tracking-[-0.02em] leading-[1.05] select-none"
            style={{ fontSize }}
          >
            <SplitTextChars text="The  FANDOM" />
          </h1>
        </div>

        {TEAM_MEMBERS.map((member, i) => (
          <div
            key={member.name}
            ref={(el) => (groupRefs.current[i + 1] = el)}
            aria-hidden="true"
            className="absolute left-0 top-0 w-full text-[#f93535]"
          >
            <h2
              className="w-full text-center uppercase font-['Dela_Gothic_One'] tracking-[-0.02em] leading-[1.05] select-none"
              style={{ fontSize }}
            >
              <SplitTextChars text={member.name} />
            </h2>
          </div>
        ))}
      </div>
    </section>
  );
}