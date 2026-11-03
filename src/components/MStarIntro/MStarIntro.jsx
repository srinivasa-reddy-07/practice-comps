import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MStarEngine } from './engine/MStarEngine.js';
import { DEFAULT_ASSETS, DURATION, LOOK } from './config.js';

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
);
const RestartIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
  </svg>
);

/**
 * <MStarIntro />  — real-time Three.js cinematic: chrome star → metal M → star-particle portrait.
 *
 * Props
 *  colorSrc / monoSrc   portrait URLs (defaults to /assets/mstar/portrait-{color,mono}.png)
 *  autoPlay             start as soon as assets are ready (default true)
 *  controls             show play / pause / restart / scrub bar (default true)
 *  particleCount        number of stars (default 26000; try 14000 for low-end mobile)
 *  seed                 changes the particle layout; same seed => identical replay
 *  sampler              overrides for the portrait sampler (density, sizes, face focus…)
 *  onReady / onComplete callbacks
 *  onFrame(canvas)      called after every rendered frame (use with preserveDrawingBuffer to feed a CanvasTexture)
 *  preserveDrawingBuffer  set true when the canvas is used as a texture in another WebGL scene
 *  className            extra classes for the 1.43:1 frame
 *
 * Ref API: play(), pause(), toggle(), restart(), seek(seconds), getEngine()
 */
const MStarIntro = forwardRef(function MStarIntro(
  {
    colorSrc = DEFAULT_ASSETS.colorSrc,
    monoSrc = DEFAULT_ASSETS.monoSrc,
    autoPlay = true,
    controls = true,
    particleCount = LOOK.particleCount,
    seed = LOOK.seed,
    sampler,
    onReady,
    onComplete,
    onFrame,
    preserveDrawingBuffer = false,
    className = '',
  },
  ref
) {
  const hostRef = useRef(null);
  const engineRef = useRef(null);
  const barRef = useRef(null);
  const cbRef = useRef({ onReady, onComplete, onFrame });
  cbRef.current = { onReady, onComplete, onFrame };

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState({ playing: false, ended: false });

  const samplerKey = JSON.stringify(sampler || {});

  useEffect(() => {
    setLoading(true);
    setFailed(false);
    const engine = new MStarEngine({
      container: hostRef.current,
      colorSrc, monoSrc, particleCount, seed, autoPlay, preserveDrawingBuffer,
      onFrame: (canvas) => cbRef.current.onFrame?.(canvas),
      sampler: samplerKey ? JSON.parse(samplerKey) : {},
      onReady: () => { setLoading(false); cbRef.current.onReady?.(); },
      onComplete: () => cbRef.current.onComplete?.(),
      onStateChange: setState,
      onProgress: (p) => { if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`; },
      onError: () => { setFailed(true); setLoading(false); },
    });
    engineRef.current = engine;
    engine.init();
    return () => { engine.dispose(); engineRef.current = null; };
  }, [colorSrc, monoSrc, particleCount, seed, autoPlay, preserveDrawingBuffer, samplerKey]);

  useImperativeHandle(ref, () => ({
    play: () => engineRef.current?.play(),
    pause: () => engineRef.current?.pause(),
    toggle: () => engineRef.current?.toggle(),
    restart: () => engineRef.current?.restart(),
    seek: (s) => engineRef.current?.seek(s),
    getEngine: () => engineRef.current,
  }), []);

  const scrub = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    engineRef.current?.seek(((e.clientX - r.left) / r.width) * DURATION);
  }, []);

  const onKeyDown = (e) => {
    if (e.code === 'Space') { e.preventDefault(); engineRef.current?.toggle(); }
    if (e.key === 'r' || e.key === 'R') engineRef.current?.restart();
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={`group relative aspect-[1.43/1] w-full select-none overflow-hidden bg-black outline-none ${className}`}
      style={{ position: 'relative', width: '100%', aspectRatio: `${LOOK.aspect} / 1`, overflow: 'hidden', background: '#000' }}
      role="img"
      aria-label="Cinematic particle animation"
    >
      {/* Three.js mounts its canvas in here */}
      <div ref={hostRef} className="absolute inset-0" style={{ position: 'absolute', inset: 0 }} />

      {loading && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-slate-300/70" />
        </div>
      )}

      {controls && !loading && !failed && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover:opacity-100">
          <div className="h-1 w-full cursor-pointer overflow-hidden rounded-full bg-white/15" onClick={scrub}>
            <div ref={barRef} className="h-full origin-left bg-slate-200/80" style={{ transform: 'scaleX(0)' }} />
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <button
              type="button"
              onClick={() => engineRef.current?.toggle()}
              className="rounded-full p-2 transition hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-slate-300"
              aria-label={state.playing ? 'Pause' : 'Play'}
            >
              {state.playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.restart()}
              className="rounded-full p-2 transition hover:bg-white/10 focus-visible:ring-1 focus-visible:ring-slate-300"
              aria-label="Restart"
            >
              <RestartIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default MStarIntro;
