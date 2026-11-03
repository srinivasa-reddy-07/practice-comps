import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";

// Import your new MStarIntro component
import MStarIntro from "./MStarIntro";

/* ------------------------------------------------------------------ */
/*  Shader: flat IMAX projection (cover-fit, blue grade, grain)         */
/* ------------------------------------------------------------------ */
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D map;
  uniform float imageAspect, planeAspect, glitchIntensity, time;
  uniform vec2 iResolution;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  vec2 coverUV(vec2 uv) {
    if (planeAspect > imageAspect) {
      float s = imageAspect / planeAspect;
      uv.y = uv.y * s + (1.0 - s) * 0.5;
    } else {
      float s = planeAspect / imageAspect;
      uv.x = uv.x * s + (1.0 - s) * 0.5;
    }
    return uv;
  }

  void main() {
    vec2 uv = vUv;
    float gi = glitchIntensity;

    uv.x += (hash(floor(uv.y * 20.0 + time * 80.0) + time * 7.0) - 0.5) * 2.0 * gi * 0.15;
    uv.y += (hash(floor(time * 50.0)) - 0.5) * gi * 0.06;

    float rs = 0.0008 + gi * 0.025;
    vec3 col;
    col.r = texture2D(map, coverUV(vec2(uv.x + rs, uv.y + rs))).r;
    col.g = texture2D(map, coverUV(vec2(uv.x, uv.y - rs * 2.0))).g;
    col.b = texture2D(map, coverUV(vec2(uv.x - rs * 2.0, uv.y))).b;

    col = clamp(col, 0.0, 1.0);
    col = mix(col, col * col * (3.0 - 2.0 * col), 0.45);
    col = mix(col, col * vec3(0.82, 0.94, 1.18), 0.35);
    col += vec3(0.0, 0.01, 0.035) * (1.0 - col);

    float vig = pow(16.0 * vUv.x * vUv.y * (1.0 - vUv.x) * (1.0 - vUv.y), 0.09);
    col *= vig;

    float grain = hash(vUv.x * iResolution.x + vUv.y * iResolution.y * 7.0 + time * 60.0);
    col += (grain - 0.5) * 0.035;

    col += vec3(hash(uv.x * 100.0 + uv.y * 1000.0 + time * 300.0) * gi * 0.3);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
export default function CinemaDisplay() {
  const containerRef = useRef(null);
  
  // Refs to bridge React state/callbacks with the Three.js loop
  const setDisplayImageRef = useRef(null);
  const setIntroFrameRef = useRef(null);
  const onIntroCompleteRef = useRef(null);
  
  const [isIntroPlaying, setIsIntroPlaying] = useState(true);

  const projects = [
    { name: "Project 1", img: "/mami1.jpg" },
    { name: "Project 2", img: "/mami2.jpg" },
    { name: "Project 3", img: "/mami3.jpg" },
    { name: "Project 4", img: "/mami4.jpg" },
  ];

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const IMAX_RATIO = 1.43;
    const SCREEN_W = 2.0;
    const SCREEN_H = SCREEN_W / IMAX_RATIO;
    const ROOM_W = SCREEN_W;
    const ROOM_H = SCREEN_H + 0.04;
    const ROOM_D = 5;
    const Z_BACK = -0.05;
    const ROOM_ZC = Z_BACK + ROOM_D / 2;
    const FLOOR_Y = -ROOM_H / 2;
    const CEIL_Y = ROOM_H / 2;
    const BLUE = 0x2f6bff;

    /* ---------- Scene / camera / renderer ---------- */
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02040a, 0.18);

    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
    const fitCamera = () => {
      const aspect = window.innerWidth / window.innerHeight;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(17.5));
      const distH = (ROOM_H + 0.1) / (2 * tanHalf);
      const distW = (ROOM_W + 0.1) / (2 * tanHalf * aspect);
      const dist = Math.max(distH, distW);
      camera.aspect = aspect;
      camera.position.set(0, -0.2, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    fitCamera();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    /* ---------- Room ---------- */
    const room = new THREE.Group();
    scene.add(room);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W, ROOM_D),
      new THREE.MeshBasicMaterial({ color: 0x03050c })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_Y, ROOM_ZC);
    room.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W, ROOM_D),
      new THREE.MeshBasicMaterial({ color: 0x02040a })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, CEIL_Y, ROOM_ZC);
    room.add(ceiling);

    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W, ROOM_H),
      new THREE.MeshBasicMaterial({ color: 0x010206 })
    );
    backWall.position.set(0, 0, Z_BACK);
    room.add(backWall);

    const stripGeo = new THREE.BoxGeometry(0.006, 0.006, ROOM_D);
    const STRIPS = 8;
    [-1, 1].forEach((side) => {
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(ROOM_D, ROOM_H),
        new THREE.MeshBasicMaterial({ color: 0x030610 })
      );
      wall.rotation.y = -side * Math.PI / 2;
      wall.position.set(side * (ROOM_W / 2), 0, ROOM_ZC);
      room.add(wall);

      for (let i = 0; i < STRIPS; i++) {
        const y = FLOOR_Y + 0.12 + i * ((ROOM_H - 0.24) / (STRIPS - 1));
        const mat = new THREE.MeshBasicMaterial({
          color: BLUE,
          transparent: true,
          opacity: 0.35 + (i % 3) * 0.2,
        });
        const strip = new THREE.Mesh(stripGeo, mat);
        strip.position.set(side * (ROOM_W / 2 - 0.004), y, ROOM_ZC);
        room.add(strip);
      }
    });

    const starCount = 260;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * (ROOM_W - 0.1);
      starPos[i * 3 + 1] = CEIL_Y - 0.01;
      starPos[i * 3 + 2] = Math.random() * ROOM_D;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0x8fb8ff,
        size: 0.012,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        fog: false,
      })
    );
    room.add(stars);

    const SEAT_SCALE = 2.0;
    const seatMat = new THREE.MeshBasicMaterial({ color: 0x070b16 });
    const seatBase = new THREE.BoxGeometry(0.085, 0.04, 0.07);
    const seatBack = new THREE.BoxGeometry(0.085, 0.11, 0.025);
    const tierMat = new THREE.MeshBasicMaterial({ color: 0x050812 });
    const ROWS = [
      { radius: 1.0, tier: 0.0 },
      { radius: 1.34, tier: 0.07 },
      { radius: 1.68, tier: 0.14 },
    ];
    const SEATS_PER_SIDE = 6;
    const AISLE_ANGLE = 0.1;
    const SEAT_ANGLE = 0.2;
    const MAX_X = ROOM_W / 2 - 0.1;

    ROWS.forEach(({ radius, tier }) => {
      const thetas = [];
      for (let k = 0; k < SEATS_PER_SIDE; k++) {
        const t = AISLE_ANGLE + k * SEAT_ANGLE;
        if (radius * Math.sin(t) <= MAX_X) thetas.push(t);
      }
      const maxTheta = thetas[thetas.length - 1] ?? AISLE_ANGLE;

      if (tier > 0) {
        const outer = radius + 0.17;
        const inner = radius - 0.17;
        const half = Math.min(maxTheta + 0.1, Math.asin(Math.min(0.99 / outer, 1)) + 0.0001 > 0 ? maxTheta + 0.1 : maxTheta);
        const a0 = -Math.PI / 2 - half;
        const a1 = -Math.PI / 2 + half;
        const shape = new THREE.Shape();
        shape.absarc(0, 0, outer, a0, a1, false);
        shape.absarc(0, 0, inner, a1, a0, true);
        shape.closePath();
        const tierMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: tier, bevelEnabled: false }), tierMat);
        tierMesh.rotation.x = -Math.PI / 2;
        tierMesh.position.y = FLOOR_Y;
        room.add(tierMesh);
      }

      [-1, 1].forEach((side) => {
        thetas.forEach((t) => {
          const theta = side * t;
          const seat = new THREE.Group();
          const base = new THREE.Mesh(seatBase, seatMat);
          const back = new THREE.Mesh(seatBack, seatMat);
          back.position.set(0, 0.07, 0.035);
          seat.add(base, back);
          seat.scale.setScalar(SEAT_SCALE);
          seat.position.set(
            radius * Math.sin(theta),
            FLOOR_Y + 0.02 * SEAT_SCALE + tier,
            radius * Math.cos(theta)
          );
          seat.rotation.y = theta; 
          room.add(seat);
        });
      });
    });

    const screenGroup = new THREE.Group();
    room.add(screenGroup);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(SCREEN_W, ROOM_H, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x010206 })
    );
    frame.position.z = -0.007;
    screenGroup.add(frame);

    /* ---------- Display Material Setup ---------- */
    const defaultDisplayImg = "/cinema.jpg";
    let isIntroActive = true;
    let canvasTex = null; // Will hold the CanvasTexture derived from MStarIntro

    const textureLoader = new THREE.TextureLoader();
    const textureCache = {};

    function loadTexture(src) {
      if (textureCache[src]) return textureCache[src];
      const texture = textureLoader.load(src, (tex) => {
        tex.userData.aspect = tex.image.width / tex.image.height;
        if (displayMaterial.uniforms.map.value === tex) {
          displayMaterial.uniforms.imageAspect.value = tex.userData.aspect;
        }
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      textureCache[src] = texture;
      return texture;
    }

    // Initialize with a blank texture, will be instantly replaced by the MStarIntro canvas
    const emptyCanvas = document.createElement("canvas");
    emptyCanvas.width = 1; emptyCanvas.height = 1;
    const initialMap = new THREE.CanvasTexture(emptyCanvas);

    const displayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: initialMap },
        imageAspect: { value: 1.43 },
        planeAspect: { value: IMAX_RATIO },
        iResolution: { value: new THREE.Vector2(1024, 716) },
        glitchIntensity: { value: 0.0 },
        time: { value: 0.0 },
      },
      vertexShader,
      fragmentShader,
    });

    const displayPlane = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), displayMaterial);
    displayPlane.position.set(0, 0, 0);
    screenGroup.add(displayPlane);

    /* ---------- MStarIntro Canvas Integration ---------- */
    
    // 1. Update the texture on every frame MStarIntro renders
    setIntroFrameRef.current = (sourceCanvas) => {
      if (!isIntroActive) return;
      
      if (!canvasTex) {
        canvasTex = new THREE.CanvasTexture(sourceCanvas);
        canvasTex.colorSpace = THREE.SRGBColorSpace;
        canvasTex.minFilter = THREE.LinearFilter;
        canvasTex.magFilter = THREE.LinearFilter;
        canvasTex.userData.aspect = sourceCanvas.width / sourceCanvas.height;
        
        displayMaterial.uniforms.map.value = canvasTex;
        displayMaterial.uniforms.imageAspect.value = canvasTex.userData.aspect;
      }
      
      // Tell Three.js the canvas has fresh pixels
      canvasTex.needsUpdate = true;
    };

    // 2. Trigger the end transition once MStarIntro finishes
    onIntroCompleteRef.current = () => {
      isIntroActive = false;
      setIsIntroPlaying(false); // Unlocks the UI
      setDisplayImageRef.current(null); // Triggers the glitch to default image
    };


    /* ---------- Interaction ---------- */
    const mouse = { x: 0, y: 0 };
    const lerpedMouse = { x: 0, y: 0 };
    const clock = new THREE.Clock();
    let animationFrameId;

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      displayMaterial.uniforms.time.value = t;

      lerpedMouse.x = gsap.utils.interpolate(lerpedMouse.x, mouse.x, 0.05);
      lerpedMouse.y = gsap.utils.interpolate(lerpedMouse.y, mouse.y, 0.05);
      
      room.rotation.x = lerpedMouse.y * 0.06;
      room.rotation.y = lerpedMouse.x * 0.14;

      renderer.render(scene, camera);
    }
    animate();

    const handleMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2; 
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      fitCamera();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("resize", handleResize);

    const glitchState = { intensity: 0 };
    let glitchAnimation = null;

    setDisplayImageRef.current = (src) => {
      let texture;

      if (src) {
        texture = loadTexture(src);
      } else {
        if (isIntroActive && canvasTex) {
          texture = canvasTex;
        } else {
          texture = loadTexture(defaultDisplayImg);
        }
      }

      if (displayMaterial.uniforms.map.value === texture) return;

      displayMaterial.uniforms.map.value = texture;
      if (texture.userData.aspect) {
        displayMaterial.uniforms.imageAspect.value = texture.userData.aspect;
      }

      if (glitchAnimation) glitchAnimation.kill();
      glitchState.intensity = 1.0;

      glitchAnimation = gsap.to(glitchState, {
        intensity: 0,
        duration: 0.75,
        ease: "power3.out",
        onUpdate() {
          displayMaterial.uniforms.glitchIntensity.value = glitchState.intensity;
        },
      });
    };

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (glitchAnimation) glitchAnimation.kill();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      
      if (canvasTex) canvasTex.dispose();

      container.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      Object.values(textureCache).forEach((t) => t.dispose());
      renderer.dispose();
    };
  }, []);

  return (
    <section
      className="relative w-full h-[100svh] overflow-hidden bg-[#02040a]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 50% 42%, #0b1d52 0%, #050c24 38%, #02040a 72%)",
      }}
    >
      {/* 
        MStarIntro is mounted but positioned completely off-screen.
        It renders to a canvas we capture and apply as a texture above.
      */}
      <MStarIntro
        preserveDrawingBuffer={true}
        controls={false}
        autoPlay={true}
        onFrame={(canvas) => setIntroFrameRef.current?.(canvas)}
        onComplete={() => onIntroCompleteRef.current?.()}
        className="pointer-events-none fixed -left-[9999px] top-0 w-[1430px]" 
      />

      <div ref={containerRef} className="absolute inset-0 z-0" />

      <ul
        className={`absolute left-1/2 bottom-16 -translate-x-1/2 w-full flex flex-wrap justify-center gap-2 px-16 list-none z-10 max-[1000px]:px-16 transition-all duration-[1200ms] ease-out ${
          isIntroPlaying 
            ? "opacity-0 translate-y-6 pointer-events-none" 
            : "opacity-100 translate-y-0 pointer-events-auto"
        }`}
        onMouseLeave={() => setDisplayImageRef.current?.(null)}
      >
        {projects.map((project, idx) => (
          <li
            key={idx}
            onMouseEnter={() => setDisplayImageRef.current?.(project.img)}
            className="uppercase font-mono text-[0.7rem] font-[450] text-sky-100 w-max px-4 py-2 bg-[#050b1f]/80 backdrop-blur-sm border border-[#2f6bff] shadow-[0_0_18px_-2px_rgba(47,107,255,0.6)] cursor-pointer hover:text-white hover:bg-[#2f6bff] hover:shadow-[0_0_28px_0_rgba(47,107,255,0.9)] transition-all"
          >
            {project.name}
          </li>
        ))}
      </ul>
    </section>
  );
}