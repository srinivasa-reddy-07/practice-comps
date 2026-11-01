// // npm install three gsap
// import React, { useEffect, useRef } from 'react';
// import * as THREE from 'three';
// import { gsap } from 'gsap';
// import { ScrollTrigger } from 'gsap/ScrollTrigger';

// gsap.registerPlugin(ScrollTrigger);

// export default function PosterScroll() {
//   const canvasRef = useRef(null);
//   const scrollRef = useRef(null);

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     const scrollContainer = scrollRef.current;
//     if (!canvas || !scrollContainer) return;

//     const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
//     renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
//     renderer.setClearColor(0xf2f2f4, 1);
    
//     const scene = new THREE.Scene();
//     const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
//     cam.position.z = 6.5;

//     function resize() {
//       renderer.setSize(window.innerWidth, window.innerHeight, false);
//       cam.aspect = window.innerWidth / window.innerHeight;
//       cam.updateProjectionMatrix();
//     }
//     window.addEventListener('resize', resize);
//     resize();

//     /* ---------- procedural poster textures ---------- */
//     const PW = 512, PH = 683;
//     function poster(k) {
//       const c = document.createElement('canvas');
//       c.width = PW; c.height = PH;
//       const x = c.getContext('2d');
//       const g = (a, b, s) => {
//         const q = x.createLinearGradient(0, 0, 0, PH);
//         q.addColorStop(0, a); q.addColorStop(1, b);
//         x.fillStyle = q; x.fillRect(0, 0, PW, PH);
//       };
//       const t = (s, px, py, sz, col, w = 800) => {
//         x.fillStyle = col;
//         x.font = `${w} ${sz}px Helvetica,Arial,sans-serif`;
//         x.fillText(s, px, py);
//       };
//       const fig = (cx, cy, s, col) => {
//         x.fillStyle = col; x.beginPath();
//         x.ellipse(cx, cy - 110 * s, 26 * s, 32 * s, 0, 0, 7); x.fill();
//         x.beginPath(); x.moveTo(cx - 90 * s, cy + 160 * s);
//         x.quadraticCurveTo(cx - 70 * s, cy - 70 * s, cx, cy - 70 * s);
//         x.quadraticCurveTo(cx + 70 * s, cy - 70 * s, cx + 90 * s, cy + 160 * s); x.fill();
//       };

//       if (k === 0) {
//         g('#7a1410', '#1a0504'); x.strokeStyle = '#e0452c'; x.lineWidth = 14;
//         for (let i = 0; i < 7; i++) { x.strokeRect(120 + i * 18, 120 + i * 30, 280 - i * 36, 300 - i * 50); }
//         t('Upward', 70, PH - 60, 92, '#fff');
//       } else if (k === 1) {
//         g('#1f6fb0', '#8fc4e6'); x.fillStyle = '#d9d2c4'; x.fillRect(0, 520, PW, 163); fig(256, 470, 1.1, '#161616');
//       } else if (k === 2) {
//         g('#d8d2c3', '#c9c2b1'); t('NØR', 36, 120, 120, '#111', 900); fig(330, 470, 1.9, '#1a1a1a');
//       } else if (k === 3) {
//         g('#0b0b0b', '#050505');
//         const q = x.createLinearGradient(40, 300, 512, 440);
//         q.addColorStop(0, 'rgba(255,60,20,0)'); q.addColorStop(0.6, '#ff4a1c'); q.addColorStop(1, 'rgba(255,60,20,0)');
//         x.fillStyle = q; x.save(); x.translate(0, 0); x.rotate(0.18); x.fillRect(0, 320, PW, 14); x.restore();
//         t('Signal', 40, PH - 50, 84, '#eee');
//       } else if (k === 4) {
//         g('#b9c9d4', '#dfe4e2'); x.fillStyle = '#d4241c'; x.beginPath();
//         x.moveTo(90, 230); x.lineTo(420, 170); x.lineTo(260, 300); x.closePath(); x.fill();
//         t('Paper', 46, 450, 110, '#111'); t('Takes', 46, 545, 110, '#111'); t('Flight', 46, 640, 110, '#111');
//       } else {
//         g('#e6dfd0', '#d6cfbe'); t('R', 20, 640, 760, '#c9261b', 900);
//         x.globalAlpha = 0.9; fig(380, 470, 1.5, '#7e8a90'); x.globalAlpha = 1;
//       }
//       const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4; return tx;
//     }
//     const tex = [0, 1, 2, 3, 4, 5].map(poster);

//     /* ---------- shader: velocity RGB split + directional blur ---------- */
//     const vert = `
//       uniform float uBend,uTime;varying vec2 vUv;
//       void main(){vUv=uv;vec3 p=position;
//       p.z+=sin(uv.y*3.14159)*uBend*1.6;
//       p.z+=sin(uv.x*3.+uTime*1.2)*(.025+uBend*.35);
//       gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}
//     `;
//     const frag = `
//       uniform sampler2D uTex;uniform vec2 uVel;varying vec2 vUv;
//       float rr(vec2 u){vec2 q=abs(u-.5)-(.5-.035);float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.035;return 1.-smoothstep(-.004,.004,d);}
//       void main(){
//       vec3 acc=vec3(0.);float m=0.;float l=length(uVel);vec2 ca=l>1e-4?uVel/l*l*.28:vec2(0.);
//       for(int i=0;i<10;i++){float t=float(i)/9.-.5;vec2 o=uVel*t;vec2 u=vUv+o;float k=rr(u);
//         vec2 cu=clamp(u,0.,1.);
//         acc+=vec3(texture2D(uTex,clamp(cu+ca,0.,1.)).r,texture2D(uTex,cu).g,texture2D(uTex,clamp(cu-ca,0.,1.)).b)*k;m+=k;}
//       float a=m/10.;if(a<.003)discard;
//       gl_FragColor=vec4(acc/max(m,1e-3),a);}
//     `;

//     /* ---------- planes: sphere -> full-screen wall ---------- */
//     const COLS = 9, ROWS = 5, N = COLS * ROWS, W = 0.9, H = 1.2, PAD = 1.5, SR = 0.95, WS = 1.2;
//     const geo = new THREE.PlaneGeometry(W * PAD, H * PAD, 10, 10);
//     const uv = geo.attributes.uv;
//     for (let i = 0; i < uv.count; i++) {
//       uv.setXY(i, (uv.getX(i) - 0.5) * PAD + 0.5, (uv.getY(i) - 0.5) * PAD + 0.5);
//     }
//     const rnd = (a, b) => a + Math.random() * (b - a);
//     const E = THREE.Euler, Q = THREE.Quaternion, V = THREE.Vector3;
//     const qWall = new Q().setFromEuler(new E(-0.7, 0, 0)).multiply(new Q().setFromEuler(new E(0, 0, 0.5)));
//     const meshes = [];
    
//     for (let i = 0; i < N; i++) {
//       const mat = new THREE.ShaderMaterial({
//         vertexShader: vert, fragmentShader: frag, transparent: true, side: THREE.DoubleSide,
//         uniforms: { uTex: { value: tex[(i * 5 + Math.floor(i / COLS)) % 6] }, uVel: { value: new THREE.Vector2() }, uBend: { value: 0 }, uTime: { value: 0 } }
//       });
//       const m = new THREE.Mesh(geo, mat); const d = m.userData;
//       const row = Math.floor(i / COLS), col = i % COLS; d.row = row; d.ph = rnd(0, 6.28); d.sw = rnd(-1, 1);
      
//       const th = (i / N) * Math.PI * 2;
//       d.dir = new V(Math.sin(th), 0, Math.cos(th)); d.sR = SR; d.by = 0;
//       d.qS = new Q().setFromAxisAngle(new V(0, 1, 0), th + Math.PI / 2);
//       d.C = new V((col - (COLS - 1) / 2) * 0.95 * WS + rnd(-0.04, 0.04), (row - (ROWS - 1) / 2) * 1.22 * WS + rnd(-0.04, 0.04), rnd(-0.05, 0.1)).applyQuaternion(qWall).add(new V(0, 0, 0.5));
//       d.qC = qWall.clone().multiply(new Q().setFromEuler(new E(rnd(-0.05, 0.05), rnd(-0.05, 0.05), rnd(-0.08, 0.08))));
//       scene.add(m); meshes.push(m);
//     }

//     /* ---------- scroll ---------- */
//     const S = { p: 0 }; let P = 0;
//     const st = ScrollTrigger.create({
//       trigger: scrollContainer,
//       start: 'top top',
//       end: 'bottom bottom',
//       scrub: 1,
//       onUpdate: s => (S.p = s.progress)
//     });

//     const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
//     const a = new V(), dl = new V(), qa = new Q(), qs = new Q(), qi = new Q(), Y = new V(0, 1, 0);
//     let spin = 0, last = performance.now(), t0 = last;
//     const qT = new Q().setFromEuler(new E(0.32, 0, 0));
    
//     let reqId;
//     function tick(now) {
//       const t = now / 1000;
//       last = now;
//       P += (S.p - P) * 0.09;
//       const intro = sm((now - t0) / 1900);
//       spin = P * 13;
//       qs.setFromAxisAngle(Y, spin).premultiply(qT);
      
//       meshes.forEach(m => {
//         const d = m.userData;
//         const e = sm((P - 0.1 - d.row / (ROWS - 1) * 0.45) / 0.3);
//         const R = d.sR * (0.15 + 0.85 * intro);
        
//         a.copy(d.dir).multiplyScalar(R); a.y += d.by * (0.3 + 0.7 * intro); a.applyQuaternion(qs);
//         a.y += Math.sin(e * Math.PI) * d.sw * 0.8; a.x += Math.sin(e * Math.PI) * d.sw * 0.6;
//         a.lerp(d.C, e);
        
//         qa.copy(qs).multiply(d.qS); qa.slerp(d.qC, e);
//         const sc = (1.1 + 0.3 * e) * (0.2 + 0.8 * intro) * (1 + 0.06 * e);
//         dl.copy(a).sub(m.position).applyQuaternion(qi.copy(m.quaternion).invert());
        
//         const u = m.material.uniforms, k = 4.2;
//         u.uVel.value.x += (Math.max(-0.55, Math.min(0.55, dl.x / W * k / sc)) - u.uVel.value.x) * 0.3;
//         u.uVel.value.y += (Math.max(-0.55, Math.min(0.55, dl.y / H * k / sc)) - u.uVel.value.y) * 0.3;
//         u.uBend.value = Math.min(0.3, u.uVel.value.length() * 0.6) + 0.01; u.uTime.value = t;
        
//         m.position.copy(a); m.quaternion.copy(qa); m.scale.setScalar(sc);
//       });
      
//       renderer.render(scene, cam);
//       reqId = requestAnimationFrame(tick);
//     }
//     reqId = requestAnimationFrame(tick);

//     /* ---------- cleanup ---------- */
//     return () => {
//       window.removeEventListener('resize', resize);
//       cancelAnimationFrame(reqId);
//       st.kill();
//       renderer.dispose();
//       geo.dispose();
//       meshes.forEach(m => m.material.dispose());
//       tex.forEach(t => t.dispose());
//     };
//   }, []);

//   return (
//     <div className="relative w-full bg-[#f2f2f4] dark:bg-[#f2f2f4]">
//       <div ref={scrollRef} className="h-[900vh] w-full"></div>
//       <canvas ref={canvasRef} className="fixed inset-0 w-screen h-screen block pointer-events-none"></canvas>
//     </div>
//   );
// }

// npm install three gsap
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function PosterScroll() {
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scrollContainer = scrollRef.current;
    if (!canvas || !scrollContainer) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setClearColor(0xf2f2f4, 1);
    
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    cam.position.z = 7.5;

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    /* ---------- procedural poster textures ---------- */
    const PW = 512, PH = 683;
    function poster(k) {
      const c = document.createElement('canvas');
      c.width = PW; c.height = PH;
      const x = c.getContext('2d');
      const g = (a, b, s) => {
        const q = x.createLinearGradient(0, 0, 0, PH);
        q.addColorStop(0, a); q.addColorStop(1, b);
        x.fillStyle = q; x.fillRect(0, 0, PW, PH);
      };
      const t = (s, px, py, sz, col, w = 800) => {
        x.fillStyle = col;
        x.font = `${w} ${sz}px Helvetica,Arial,sans-serif`;
        x.fillText(s, px, py);
      };
      const fig = (cx, cy, s, col) => {
        x.fillStyle = col; x.beginPath();
        x.ellipse(cx, cy - 110 * s, 26 * s, 32 * s, 0, 0, 7); x.fill();
        x.beginPath(); x.moveTo(cx - 90 * s, cy + 160 * s);
        x.quadraticCurveTo(cx - 70 * s, cy - 70 * s, cx, cy - 70 * s);
        x.quadraticCurveTo(cx + 70 * s, cy - 70 * s, cx + 90 * s, cy + 160 * s); x.fill();
      };

      if (k === 0) {
        g('#7a1410', '#1a0504'); x.strokeStyle = '#e0452c'; x.lineWidth = 14;
        for (let i = 0; i < 7; i++) { x.strokeRect(120 + i * 18, 120 + i * 30, 280 - i * 36, 300 - i * 50); }
        t('Upward', 70, PH - 60, 92, '#fff');
      } else if (k === 1) {
        g('#1f6fb0', '#8fc4e6'); x.fillStyle = '#d9d2c4'; x.fillRect(0, 520, PW, 163); fig(256, 470, 1.1, '#161616');
      } else if (k === 2) {
        g('#d8d2c3', '#c9c2b1'); t('NØR', 36, 120, 120, '#111', 900); fig(330, 470, 1.9, '#1a1a1a');
      } else if (k === 3) {
        g('#0b0b0b', '#050505');
        const q = x.createLinearGradient(40, 300, 512, 440);
        q.addColorStop(0, 'rgba(255,60,20,0)'); q.addColorStop(0.6, '#ff4a1c'); q.addColorStop(1, 'rgba(255,60,20,0)');
        x.fillStyle = q; x.save(); x.translate(0, 0); x.rotate(0.18); x.fillRect(0, 320, PW, 14); x.restore();
        t('Signal', 40, PH - 50, 84, '#eee');
      } else if (k === 4) {
        g('#b9c9d4', '#dfe4e2'); x.fillStyle = '#d4241c'; x.beginPath();
        x.moveTo(90, 230); x.lineTo(420, 170); x.lineTo(260, 300); x.closePath(); x.fill();
        t('Paper', 46, 450, 110, '#111'); t('Takes', 46, 545, 110, '#111'); t('Flight', 46, 640, 110, '#111');
      } else {
        g('#e6dfd0', '#d6cfbe'); t('R', 20, 640, 760, '#c9261b', 900);
        x.globalAlpha = 0.9; fig(380, 470, 1.5, '#7e8a90'); x.globalAlpha = 1;
      }
      const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4; return tx;
    }
    const tex = [0, 1, 2, 3, 4, 5].map(poster);

    /* ---------- shader: velocity RGB split + directional blur ---------- */
    const vert = `
      uniform float uBend,uTime;varying vec2 vUv;
      void main(){vUv=uv;vec3 p=position;
      p.z+=sin(uv.y*3.14159)*uBend*1.6;
      p.z+=sin(uv.x*3.+uTime*1.2)*(.025+uBend*.35);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}
    `;
    const frag = `
      uniform sampler2D uTex;uniform vec2 uVel;varying vec2 vUv;
      float rr(vec2 u){vec2 q=abs(u-.5)-(.5-.035);float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.035;return 1.-smoothstep(-.004,.004,d);}
      void main(){
      vec3 acc=vec3(0.);float m=0.;float l=length(uVel);vec2 ca=l>1e-4?uVel/l*l*.28:vec2(0.);
      for(int i=0;i<10;i++){float t=float(i)/9.-.5;vec2 o=uVel*t;vec2 u=vUv+o;float k=rr(u);
        vec2 cu=clamp(u,0.,1.);
        acc+=vec3(texture2D(uTex,clamp(cu+ca,0.,1.)).r,texture2D(uTex,cu).g,texture2D(uTex,clamp(cu-ca,0.,1.)).b)*k;m+=k;}
      float a=m/10.;if(a<.003)discard;
      gl_FragColor=vec4(acc/max(m,1e-3),a);}
    `;

    /* ---------- planes: sphere -> exact flat grid mapping ---------- */
    const COLS = 7, ROWS = 10, N = COLS * ROWS, W = 1.0, H = 1.35, PAD = 1.1, SR = 1.3;
    const geo = new THREE.PlaneGeometry(W * PAD, H * PAD, 10, 10);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (uv.getX(i) - 0.5) * PAD + 0.5, (uv.getY(i) - 0.5) * PAD + 0.5);
    }
    
    const rnd = (a, b) => a + Math.random() * (b - a);
    const E = THREE.Euler, Q = THREE.Quaternion, V = THREE.Vector3;
    const qWall = new Q().setFromEuler(new E(-0.6, 0, 0.45));
    const meshes = [];
    
    for (let i = 0; i < N; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: vert, fragmentShader: frag, transparent: true, side: THREE.DoubleSide,
        uniforms: { 
            uTex: { value: tex[(i * 5 + Math.floor(i / COLS)) % 6] }, 
            uVel: { value: new THREE.Vector2() }, 
            uBend: { value: 0 }, 
            uTime: { value: 0 } 
        }
      });
      const m = new THREE.Mesh(geo, mat); 
      const d = m.userData;
      
      const row = Math.floor(i / COLS), col = i % COLS; 
      d.row = row; d.col = col; 
      d.ph = rnd(0, 6.28); d.sw = rnd(-1, 1);
      
      // Ring origin values
      const th = (i / N) * Math.PI * 2;
      d.dir = new V(Math.sin(th), 0, Math.cos(th)); 
      d.sR = SR; 
      d.by = 0;
      d.qS = new Q().setFromAxisAngle(new V(0, 1, 0), th + Math.PI / 2);
      
      // Target rigid grid coordinates (No random positioning applied here)
      const gridX = (col - (COLS - 1) / 2) * (W * 1.05);
      const gridY = -(row - (ROWS - 1) / 2) * (H * 1.05);
      d.CBase = new V(gridX, gridY, 0);
      d.qC = qWall.clone();
      
      scene.add(m); 
      meshes.push(m);
    }

    /* ---------- scroll logic ---------- */
    const S = { p: 0 }; let P = 0;
    const st = ScrollTrigger.create({
      trigger: scrollContainer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      onUpdate: s => (S.p = s.progress)
    });

    const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
    const a = new V(), dl = new V(), qa = new Q(), qs = new Q(), qi = new Q(), Y = new V(0, 1, 0);
    let spin = 0, last = performance.now(), t0 = last;
    const qT = new Q().setFromEuler(new E(0.32, 0, 0));
    
    let reqId;
    function tick(now) {
      const t = now / 1000;
      last = now;
      P += (S.p - P) * 0.09;
      const intro = sm((now - t0) / 1900);
      
      // Ring spin rotation
      spin = P * 13;
      qs.setFromAxisAngle(Y, spin).premultiply(qT);
      
      // Grid dimensions and continuous scroll calculation
      const gridHeight = ROWS * (H * 1.05);
      const scrollOffset = P * gridHeight * 0.65;
      
      meshes.forEach(m => {
        const d = m.userData;
        
        // Transition lerp factor smoothly interpolating out of the ring
        const e = sm((P - 0.1 - d.row / (ROWS - 1) * 0.45) / 0.3);
        const R = d.sR * (0.15 + 0.85 * intro);
        
        // 1. Initial State: Ring positioning
        a.copy(d.dir).multiplyScalar(R); 
        a.y += d.by * (0.3 + 0.7 * intro); 
        a.applyQuaternion(qs);
        
        // Dynamic swooping effect during transition only
        a.y += Math.sin(e * Math.PI) * d.sw * 0.8; 
        a.x += Math.sin(e * Math.PI) * d.sw * 0.6;
        
        // 2. Final State: Rigid Grid positioning with continuous scroll
        const targetPos = d.CBase.clone();
        targetPos.y += scrollOffset - (gridHeight * 0.15); 
        targetPos.applyQuaternion(qWall).add(new V(0, 0, 0.5));
        
        // Lerp position & rotation from Ring -> Grid based on scroll state
        a.lerp(targetPos, e);
        qa.copy(qs).multiply(d.qS); 
        qa.slerp(d.qC, e);
        
        // Scale adjustment for depth effect
        const sc = (1.1 + 0.3 * e) * (0.2 + 0.8 * intro) * (1 + 0.06 * e);
        dl.copy(a).sub(m.position).applyQuaternion(qi.copy(m.quaternion).invert());
        
        // Shader velocity injection based on movement delta
        const u = m.material.uniforms, k = 4.2;
        u.uVel.value.x += (Math.max(-0.55, Math.min(0.55, dl.x / W * k / sc)) - u.uVel.value.x) * 0.3;
        u.uVel.value.y += (Math.max(-0.55, Math.min(0.55, dl.y / H * k / sc)) - u.uVel.value.y) * 0.3;
        u.uBend.value = Math.min(0.3, u.uVel.value.length() * 0.6) + 0.01; 
        u.uTime.value = t;
        
        m.position.copy(a); 
        m.quaternion.copy(qa); 
        m.scale.setScalar(sc);
      });
      
      renderer.render(scene, cam);
      reqId = requestAnimationFrame(tick);
    }
    reqId = requestAnimationFrame(tick);

    /* ---------- cleanup ---------- */
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(reqId);
      st.kill();
      renderer.dispose();
      geo.dispose();
      meshes.forEach(m => m.material.dispose());
      tex.forEach(t => t.dispose());
    };
  }, []);

  return (
    <div className="relative w-full bg-[#f2f2f4] dark:bg-[#f2f2f4]">
      <div ref={scrollRef} className="h-[900vh] w-full"></div>
      <canvas ref={canvasRef} className="fixed inset-0 w-screen h-screen block pointer-events-none"></canvas>
    </div>
  );
}