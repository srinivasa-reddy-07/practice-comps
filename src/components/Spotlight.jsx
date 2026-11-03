import React, { useRef, useEffect } from "react";
import gsap from "gsap";

const DESKTOP_MIN = 1000;
const TILT_MAX = 20;
const DRIFT_MAX = 25;
const SMOOTHING = 0.075;

const CARD_OPEN = { width: "18rem", height: "14rem", borderRadius: "0.4rem" };
const CARD_DOT = { width: "0.4em", height: "0.4em", borderRadius: "0.04em" };

const CARD_CENTERED = {
  x: 0,
  y: 0,
  rotateX: 0,
  rotateY: 0,
  xPercent: -50,
  yPercent: -50,
};

const isDesktop = () => typeof window !== "undefined" && window.innerWidth >= DESKTOP_MIN;

const Spot = ({ imageSrc }) => {
  const spotRef = useRef(null);
  const cardRef = useRef(null);
  const imageRef = useRef(null);
  const stateRef = useRef({
    live: { x: 0, y: 0, tiltX: 0, tiltY: 0 },
    aim: { x: 0, y: 0, tiltX: 0, tiltY: 0 },
    isHovering: false,
    frame: null,
  });

  const stopTracking = () => {
    const state = stateRef.current;
    if (state.frame) {
      gsap.ticker.remove(state.frame);
      state.frame = null;
    }
  };

  useEffect(() => {
    return () => stopTracking();
  }, []);

  const startTracking = () => {
    const state = stateRef.current;
    state.frame = () => {
      state.live.x += (state.aim.x - state.live.x) * SMOOTHING;
      state.live.y += (state.aim.y - state.live.y) * SMOOTHING;
      state.live.tiltX += (state.aim.tiltX - state.live.tiltX) * SMOOTHING;
      state.live.tiltY += (state.aim.tiltY - state.live.tiltY) * SMOOTHING;

      if (cardRef.current) {
        gsap.set(cardRef.current, {
          x: state.live.x,
          y: state.live.y,
          rotateX: state.live.tiltX,
          rotateY: state.live.tiltY,
        });
      }

      if (imageRef.current) {
        gsap.set(imageRef.current, { x: -state.live.x, y: -state.live.y });
      }
    };

    gsap.ticker.add(state.frame);
  };

  const handleMouseEnter = () => {
    if (!isDesktop()) return;

    const state = stateRef.current;
    state.isHovering = true;

    Object.assign(state.live, { x: 0, y: 0, tiltX: 0, tiltY: 0 });
    Object.assign(state.aim, { x: 0, y: 0, tiltX: 0, tiltY: 0 });

    gsap.set(cardRef.current, CARD_CENTERED);
    gsap.set(imageRef.current, { x: 0, y: 0 });

    startTracking();

    gsap.to(cardRef.current, {
      ...CARD_OPEN,
      duration: 0.75,
      ease: "power3.out",
      overwrite: "auto",
    });

    gsap.to(imageRef.current, {
      opacity: 1,
      duration: 0.5,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseMove = (event) => {
    const state = stateRef.current;
    if (!state.isHovering || !isDesktop() || !spotRef.current || !cardRef.current) return;

    const bounds = spotRef.current.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;

    let offsetX = event.clientX - centerX;
    let offsetY = event.clientY - centerY;

    const distance = Math.hypot(offsetX, offsetY);

    if (distance > DRIFT_MAX) {
      const scale = DRIFT_MAX / distance;
      offsetX *= scale;
      offsetY *= scale;
    }

    state.aim.x = offsetX;
    state.aim.y = offsetY;

    const cardBounds = cardRef.current.getBoundingClientRect();
    const ratioX = (event.clientX - centerX) / (cardBounds.width / 2);
    const ratioY = (event.clientY - centerY) / (cardBounds.height / 2);

    const clamp = (value) => Math.max(-1, Math.min(1, value));

    state.aim.tiltY = clamp(ratioX) * -TILT_MAX;
    state.aim.tiltX = clamp(ratioY) * TILT_MAX;
  };

  const handleMouseLeave = () => {
    if (!isDesktop()) return;

    const state = stateRef.current;
    state.isHovering = false;
    state.aim.tiltX = 0;
    state.aim.tiltY = 0;

    stopTracking();

    gsap.to(cardRef.current, {
      ...CARD_DOT,
      x: 0,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      duration: 0.5,
      ease: "power3.out",
      overwrite: "auto",
      onComplete: () => {
        if (state.isHovering) return;

        gsap.set(cardRef.current, {
          clearProps: "width,height,borderRadius",
          ...CARD_CENTERED,
        });

        gsap.set(imageRef.current, { x: 0, y: 0 });
      },
    });

    gsap.to(imageRef.current, {
      opacity: 0,
      duration: 0.25,
      ease: "power2.in",
      overwrite: "auto",
    });
  };

  return (
    <span
      ref={spotRef}
      className="relative shrink-0 w-[0.4em] h-[0.4em] mx-[0.2em] translate-y-[0.05em] [perspective:800px] cursor-pointer max-[999px]:cursor-default max-[999px]:pointer-events-none"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <span
        ref={cardRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[0.4em] h-[0.4em] border-2 border-black rounded-[0.04em] bg-black overflow-hidden will-change-transform"
      >
        <img
          ref={imageRef}
          src={imageSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none scale-150 will-change-transform opacity-0"
        />
      </span>
    </span>
  );
};

export default function Spotlight() {
  return (
    <>
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap");
      `}</style>
      <section className="relative w-full h-[100svh] bg-[#def2e7] flex items-center justify-center overflow-hidden">
        <h2 className="uppercase font-['Barlow_Condensed',sans-serif] text-[clamp(3rem,9vw,8.5rem)] leading-[0.8] tracking-[-0.02em] font-black">
          <span className="flex items-center justify-center whitespace-nowrap">
            <span>She doesn't play</span>
            <Spot imageSrc="/mami1.jpg" />
            <span>Characters</span>
          </span>

          <span className="flex items-center justify-center whitespace-nowrap">
            She lets them
          </span>

          <span className="flex items-center justify-center whitespace-nowrap">
            <span>borrow her</span>
            <Spot imageSrc="/mami4.jpg" />
            <span>face</span>
          </span>

          <span className="flex items-center justify-center whitespace-nowrap">
            <span>For</span>
            <Spot imageSrc="/mami5.jpg" />
            <span>Two hours</span>
          </span>
        </h2>
      </section>
    </>
  );
}