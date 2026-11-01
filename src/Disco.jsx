import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, CustomEase);
if (!CustomEase.get("hop")) {
  CustomEase.create("hop", "0.35, 0.75, 0, 1");
}

const itemsData = [
  "Drawn And Dressed",
  "Sketch The Look",
  "Palette Of Style",
  "Muse In Ink",
  "Runway Reimagined",
  "Bold Brushstroke",
  "Style On Paper",
  "Fashion Meets Frame",
  "Illustrated Muse",
  "Color Coded Style",
];

const cardsData = [
  { id: 1, rot: -10, classes: "top-[7.5%] left-[7.5%]" },
  { id: 2, rot: 10, classes: "top-[5%] right-[7.5%]" },
  { id: 3, rot: 8, classes: "bottom-[12.5%] left-[12.5%]" },
  { id: 4, rot: -8, classes: "bottom-[15%] right-[12.5%]" },
];

export default function App() {
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const itemsRef = useRef([]);
  const cardsRef = useRef([]);

  useEffect(() => {
    const lenis = new Lenis();
    lenis.on("scroll", ScrollTrigger.update);
    const tickerUpdate = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(tickerUpdate);
    gsap.ticker.lagSmoothing(0);

    const spotlightItems = itemsRef.current;
    const previewCards = cardsRef.current;
    const spotlightList = listRef.current;

    const HEIGHT_HEADROOM = 10;
    const HOVER_GROWTH = 50;
    const CARD_FOLLOW_STRENGTH = 0.75;
    const CARD_X_RANGE = 100;
    const CARD_Y_JITTER = 50;
    const CARD_ROTATION_JITTER = 20;

    let baseItemHeight = 0;

    const calculateBaseItemHeight = () => {
      spotlightItems.forEach((item) => {
        if (item) item.style.height = "";
      });
      baseItemHeight = Math.round(
        Math.max(...spotlightItems.map((item) => item?.offsetHeight || 0)) + HEIGHT_HEADROOM
      );
      gsap.set(spotlightItems, { height: baseItemHeight });
    };

    calculateBaseItemHeight();
    window.addEventListener("resize", calculateBaseItemHeight);

    const animateLabelText = (label, { opacity, scaleX, scaleY, blur }) => {
      gsap.to(label, { opacity, duration: 0.1, delay: 0.025, ease: "hop", overwrite: "auto" });
      gsap.to(label, { scaleX, scaleY, duration: 0.25, ease: "back.out(1.75)", overwrite: "auto" });
      gsap.to(label, { filter: `blur(${blur}px)`, duration: 0.25, ease: "hop", overwrite: "auto" });
    };

    previewCards.forEach((card, cardIndex) => {
      if (!card) return;
      card.baseRotation = parseFloat(card.dataset.rotation || 0);
      card.src = `/disco/item_1_card_${cardIndex + 1}.jpg`;
      gsap.set(card, { rotation: card.baseRotation, scale: 0 });
    });

    const positionPreviewCards = (hoveredItem, itemNumber) => {
      const listRect = spotlightList.getBoundingClientRect();
      const itemRect = hoveredItem.getBoundingClientRect();
      const followY = (itemRect.top + itemRect.height / 2 - listRect.top - listRect.height / 2) * CARD_FOLLOW_STRENGTH;

      previewCards.forEach((card, cardIndex) => {
        card.src = `/disco/item_${itemNumber}_card_${cardIndex + 1}.jpg`;
        gsap.to(card, {
          x: gsap.utils.random(-CARD_X_RANGE, CARD_X_RANGE),
          y: followY + gsap.utils.random(-CARD_Y_JITTER, CARD_Y_JITTER),
          rotation: card.baseRotation + gsap.utils.random(-CARD_ROTATION_JITTER, CARD_ROTATION_JITTER),
          duration: 1,
          ease: "elastic.out(1, 0.5)",
          overwrite: "auto",
        });
      });
    };

    const handleListMouseEnter = () => {
      gsap.to(previewCards, { scale: 1, duration: 0.75, ease: "elastic.out(1, 0.6)", overwrite: "scale" });
    };

    const handleListMouseLeave = () => {
      gsap.to(previewCards, { scale: 0, duration: 0.5, ease: "power3.out", overwrite: "scale" });
      gsap.to(spotlightItems, { height: baseItemHeight, duration: 0.35, ease: "power3.out", overwrite: "auto" });
    };

    spotlightList.addEventListener("mouseenter", handleListMouseEnter);
    spotlightList.addEventListener("mouseleave", handleListMouseLeave);

    const itemListeners = spotlightItems.map((item, itemIndex) => {
      if (!item) return null;
      const defaultLabel = item.querySelector(".label-default");
      const altLabel = item.querySelector(".label-alt");

      const onEnter = () => {
        animateLabelText(defaultLabel, { opacity: 0, scaleX: 0.75, scaleY: 1.25, blur: 1 });
        animateLabelText(altLabel, { opacity: 1, scaleX: 1, scaleY: 1, blur: 0 });
        positionPreviewCards(item, itemIndex + 1);

        const proximityWeights = spotlightItems.map((_, i) => (i === itemIndex ? 0 : 1 / Math.abs(i - itemIndex)));
        const totalWeight = proximityWeights.reduce((sum, w) => sum + w, 0);

        spotlightItems.forEach((otherItem, i) => {
          const targetHeight =
            i === itemIndex
              ? baseItemHeight + HOVER_GROWTH
              : Math.round(baseItemHeight - (HOVER_GROWTH * proximityWeights[i]) / totalWeight);

          gsap.to(otherItem, { height: targetHeight, duration: 0.5, ease: "power2.out", overwrite: "auto" });
        });
      };

      const onLeave = () => {
        animateLabelText(defaultLabel, { opacity: 1, scaleX: 1, scaleY: 1, blur: 0 });
        animateLabelText(altLabel, { opacity: 0, scaleX: 0.75, scaleY: 1.25, blur: 1 });
      };

      item.addEventListener("mouseenter", onEnter);
      item.addEventListener("mouseleave", onLeave);

      return { item, onEnter, onLeave };
    });

    return () => {
      lenis.destroy();
      gsap.ticker.remove(tickerUpdate);
      window.removeEventListener("resize", calculateBaseItemHeight);
      
      if (spotlightList) {
        spotlightList.removeEventListener("mouseenter", handleListMouseEnter);
        spotlightList.removeEventListener("mouseleave", handleListMouseLeave);
      }
      
      itemListeners.forEach((listener) => {
        if (listener) {
          listener.item.removeEventListener("mouseenter", listener.onEnter);
          listener.item.removeEventListener("mouseleave", listener.onLeave);
        }
      });
      
      gsap.killTweensOf(previewCards);
      gsap.killTweensOf(spotlightItems);
    };
  }, []);

  return (
    <div className="w-full text-black">
      <section className="relative w-full min-h-screen py-8 overflow-hidden flex justify-center items-center">
        <h1 className="font-['Gasoek_One'] font-light tracking-[-0.01em] leading-none text-[clamp(2rem,8vw,12rem)]">
          The Sketchbook
        </h1>
      </section>

      <section className="relative w-full min-h-screen py-8 overflow-hidden flex flex-col">
        <div
          ref={containerRef}
          className="relative w-full flex-1 rounded-[9rem] bg-[#ff30ff] text-black flex flex-col justify-center items-center text-center gap-8 overflow-hidden py-40 px-8"
        >
          <p className="font-['Host_Grotesk'] text-xl font-medium">Explore the collection</p>

          <div className="relative w-full flex justify-center items-center">
            <div className="absolute inset-0 z-[2] pointer-events-none">
              {cardsData.map((card, i) => (
                <img
                  key={card.id}
                  ref={(el) => (cardsRef.current[i] = el)}
                  className={`card absolute w-[clamp(75px,15vw,200px)] aspect-[2/3] border-[0.25rem] border-black rounded-2xl object-cover scale-0 will-change-transform ${card.classes}`}
                  data-rotation={card.rot}
                  alt=""
                />
              ))}
            </div>

            <div
              ref={listRef}
              className="spotlight-list relative z-[1] flex flex-col justify-center items-center"
            >
              {itemsData.map((text, i) => (
                <div
                  key={i}
                  ref={(el) => (itemsRef.current[i] = el)}
                  className="spotlight-item relative w-full flex justify-center items-center will-change-[height]"
                >
                  <span className="label relative grid place-items-center">
                    <h3 className="label-default col-start-1 row-start-1 will-change-[transform,opacity,filter] font-['Gasoek_One'] font-light tracking-[-0.01em] leading-none text-[clamp(1.5rem,6vw,10rem)]">
                      {text}
                    </h3>
                    <h3 className="label-alt col-start-1 row-start-1 will-change-[transform,opacity,filter] font-['Nanum_Pen_Script'] text-[clamp(2rem,8vw,12rem)] leading-[0.65] translate-y-[15%] tracking-[-0.04em] opacity-0">
                      {text}
                    </h3>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative w-full min-h-screen py-8 overflow-hidden flex justify-center items-center">
        <h1 className="font-['Gasoek_One'] font-light tracking-[-0.01em] leading-none text-[clamp(2rem,8vw,12rem)]">
          Stay Iconic
        </h1>
      </section>
    </div>
  );
}