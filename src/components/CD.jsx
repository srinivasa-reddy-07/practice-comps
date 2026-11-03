// App.jsx
import React, { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "@studio-freight/lenis";
import "./CD.css";

gsap.registerPlugin(ScrollTrigger);

const FILMS = [
  {
    id: 1,
    title: "Backrooms",
    director: "Kane Parsons",
    year: 2026,
    texture:
      "mami1.jpg",
  },
  {
    id: 2,
    title: "The Invite",
    director: "Olivia Wilde",
    year: 2026,
    texture:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1024",
  },
  {
    id: 3,
    title: "Tony",
    director: "Matt Johnson",
    year: 2026,
    texture:
      "https://images.unsplash.com/photo-1542204165-65bf26472b9b?q=80&w=1024",
  },
  {
    id: 4,
    title: "Marty Supreme",
    director: "Josh Safdie",
    year: 2025,
    texture:
      "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=1024",
  },
  {
    id: 5,
    title: "The Smashing Machine",
    director: "Benny Safdie",
    year: 2025,
    texture:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1024",
  },
];

const CD_RADIUS = 3;
const CD_HOLE = 0.45;
const CD_THICKNESS = 0.05;

function CompactDisc({ film, index, scrollProgress, totalFilms }) {
  const groupRef = useRef();

  const texture = useTexture(film.texture);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, CD_RADIUS, 0, Math.PI * 2, false);
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, CD_HOLE, 0, Math.PI * 2, true);
    shape.holes.push(holePath);
    return new THREE.ExtrudeGeometry(shape, {
      depth: CD_THICKNESS,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      curveSegments: 64,
    });
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;

    const normalizedIndex = index / (totalFilms - 1);
    const progressOffset =
      (normalizedIndex - scrollProgress) * (totalFilms - 1);

    // Smooth arcing trajectory
    const x = progressOffset * 8.5;
    const z = -Math.pow(progressOffset, 2) * 2.5;
    const y = -Math.abs(progressOffset) * 0.2;

    const scale = 1 - Math.min(Math.abs(progressOffset) * 0.15, 0.4);

    groupRef.current.position.lerp(new THREE.Vector3(x, y, z), 0.1);
    groupRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);

    // Dynamic rotation: Tilt backwards slightly, and angle inward toward the center
    const targetRotX = -0.15;
    const targetRotY = -progressOffset * 0.35;
    const targetRotZ = 0; // Removed constant spinning to keep artwork upright

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotX,
      0.1,
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotY,
      0.1,
    );
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      targetRotZ,
      0.1,
    );
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          map={texture}
          metalness={0.5}
          roughness={0.25}
          envMapIntensity={2.5}
        />
      </mesh>
    </group>
  );
}

function Scene({ scrollProgress }) {
  return (
    <>
      <Environment preset="city" />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />

      {FILMS.map((film, i) => (
        <CompactDisc
          key={film.id}
          film={film}
          index={i}
          totalFilms={FILMS.length}
          scrollProgress={scrollProgress}
        />
      ))}

      <ContactShadows
        position={[0, -4.5, 0]}
        opacity={0.4}
        scale={35}
        blur={2.5}
        far={6}
      />
    </>
  );
}

export default function App() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef();

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      direction: "vertical",
      smooth: true,
      mouseMultiplier: 1,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    ScrollTrigger.create({
      trigger: containerRef.current,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      onUpdate: (self) => {
        setScrollProgress(self.progress);
      },
    });

    return () => {
      lenis.destroy();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  const activeIndex = Math.min(
    Math.max(Math.round(scrollProgress * (FILMS.length - 1)), 0),
    FILMS.length - 1,
  );
  const activeFilm = FILMS[activeIndex];

  return (
    <div className="scroll-container" ref={containerRef}>
      <div className="canvas-wrapper">
        <Canvas camera={{ position: [0, 0, 16], fov: 35 }}>
          <Scene scrollProgress={scrollProgress} />
        </Canvas>
      </div>

      <div className="ui-overlay">
        <header className="header">
          <h1 className="logo">A24</h1>
          <nav className="nav-links">
            <span className="active">Films</span>
            <span>Television</span>
            <span>Index</span>
          </nav>
        </header>

        <main className="film-info">
          <div className="director-section">
            <div className="label">Director</div>
            <div className="value">{activeFilm?.director}</div>
          </div>

          <div className="title-section">
            <h2 className="title">{activeFilm?.title}</h2>
            <div className="actions">
              {FILMS.map((_, idx) => (
                <span
                  key={idx}
                  className={`dot-nav ${idx === activeIndex ? "active" : ""}`}
                ></span>
              ))}
            </div>
          </div>

          <div className="year-section">
            <div className="label">Year</div>
            <div className="value">{activeFilm?.year}</div>
          </div>
        </main>

        <footer className="footer-stats">
          <div className="quote">"SOMETHING FAR MORE HAUNTING"</div>
          <div className="quote">"CASTS A SURREALISTIC SPELL"</div>
        </footer>
      </div>
    </div>
  );
}
