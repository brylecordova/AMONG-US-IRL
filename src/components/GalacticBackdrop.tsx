import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface StarParticle {
  x: number;
  y: number;
  radius: number;
  layer: 0 | 1 | 2;
  color: string;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  flare: boolean;
}

interface GalaxyDot {
  angle: number;
  dist: number;
  size: number;
  alpha: number;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  life: number;
  maxLife: number;
}

function createSeededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_PALETTE = [
  '#E0F2FE', // Cool blue-white
  '#F8FAFC', // Pure starlight
  '#BAE6FD', // Pale cyan giant
  '#DDD6FE', // Soft indigo tint
  '#FEF3C7', // Warm pale gold
];

export const GalacticBackdrop: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: StarParticle[] = [];
    let galaxyDots: GalaxyDot[] = [];
    let shootingStars: ShootingStar[] = [];
    let nextMeteorAt = 2400;
    let rafId = 0;
    let lastTime = performance.now();
    let elapsedMs = 0;

    const buildScene = () => {
      const rand = createSeededRandom(42077);
      const area = Math.max(width * height, 1);
      const starCount = Math.min(280, Math.max(130, Math.floor(area / 6200)));

      stars = Array.from({ length: starCount }, (_, idx) => {
        const layerRoll = rand();
        const layer: 0 | 1 | 2 = layerRoll < 0.56 ? 0 : layerRoll < 0.88 ? 1 : 2;
        const radius =
          layer === 0
            ? 0.55 + rand() * 0.55
            : layer === 1
              ? 0.95 + rand() * 0.75
              : 1.5 + rand() * 1.1;

        return {
          x: rand() * width,
          y: rand() * height,
          radius,
          layer,
          color: STAR_PALETTE[idx % STAR_PALETTE.length],
          baseAlpha: layer === 0 ? 0.3 + rand() * 0.35 : layer === 1 ? 0.5 + rand() * 0.4 : 0.72 + rand() * 0.28,
          twinkleSpeed: 0.0008 + rand() * 0.0022,
          twinklePhase: rand() * Math.PI * 2,
          flare: layer === 2 && rand() > 0.58,
        };
      });

      const dotCount = 240;
      galaxyDots = Array.from({ length: dotCount }, (_, i) => {
        const arm = i % 2;
        const t = Math.pow(rand(), 0.75);
        const dist = 6 + t * 145;
        const spiralAngle = arm * Math.PI + t * 3.4 + (rand() - 0.5) * (0.55 + (1 - t) * 0.45);
        return {
          angle: spiralAngle,
          dist,
          size: 0.7 + (1 - t) * 1.3 + rand() * 0.5,
          alpha: (1 - t * 0.78) * (0.28 + rand() * 0.45),
          color: t < 0.28 ? '#FDE68A' : i % 3 === 0 ? '#C7D2FE' : '#BAE6FD',
        };
      });
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildScene();
    };

    const drawFrame = (now: number) => {
      const rawDt = now - lastTime;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0), 64);

      if (!prefersReducedMotion) {
        elapsedMs += dt;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Distant spiral galaxy cluster in upper-left/mid deep field
      const gx = width * 0.22;
      const gy = height * 0.24;
      const coreRadius = Math.min(width, height) * 0.22;
      const coreGlow = ctx.createRadialGradient(gx, gy, 0, gx, gy, coreRadius);
      coreGlow.addColorStop(0, 'rgba(224, 242, 254, 0.16)');
      coreGlow.addColorStop(0.22, 'rgba(129, 140, 248, 0.11)');
      coreGlow.addColorStop(0.55, 'rgba(56, 189, 248, 0.04)');
      coreGlow.addColorStop(1, 'rgba(4, 7, 18, 0)');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(gx, gy, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      const galaxySpin = prefersReducedMotion ? 0 : elapsedMs * 0.000018;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(-0.42);
      ctx.scale(1.35, 0.52);
      for (const dot of galaxyDots) {
        const a = dot.angle + galaxySpin;
        const px = Math.cos(a) * dot.dist;
        const py = Math.sin(a) * dot.dist;
        ctx.globalAlpha = dot.alpha;
        ctx.fillStyle = dot.color;
        ctx.beginPath();
        ctx.arc(px, py, dot.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      // 2. Multi-parallax drifting & twinkling stars
      const driftSpeeds = [0.0045, 0.011, 0.022];
      for (const star of stars) {
        if (!prefersReducedMotion) {
          star.x -= driftSpeeds[star.layer] * dt;
          if (star.x < -8) {
            star.x = width + 8;
          }
        }

        const twinkle = prefersReducedMotion
          ? 0.85
          : 0.55 + 0.45 * Math.sin(elapsedMs * star.twinkleSpeed + star.twinklePhase);
        const alpha = star.baseAlpha * twinkle;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();

        if (star.flare) {
          const arm = star.radius * 3.6;
          ctx.globalAlpha = alpha * 0.55;
          ctx.strokeStyle = star.color;
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.moveTo(star.x - arm, star.y);
          ctx.lineTo(star.x + arm, star.y);
          ctx.moveTo(star.x, star.y - arm);
          ctx.lineTo(star.x, star.y + arm);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // 3. Occasional shooting stars gliding across the Skeld horizon
      if (!prefersReducedMotion) {
        if (elapsedMs >= nextMeteorAt) {
          nextMeteorAt = elapsedMs + 4200 + Math.random() * 4800;
          const startX = width * (0.32 + Math.random() * 0.62);
          const startY = height * (0.04 + Math.random() * 0.34);
          const speed = 0.58 + Math.random() * 0.35;
          shootingStars.push({
            x: startX,
            y: startY,
            vx: -speed * 1.15,
            vy: speed * 0.46,
            length: 85 + Math.random() * 65,
            life: 0,
            maxLife: 680 + Math.random() * 340,
          });
        }

        shootingStars = shootingStars.filter((m) => {
          m.life += dt;
          if (m.life >= m.maxLife) return false;
          m.x += m.vx * dt;
          m.y += m.vy * dt;

          const progress = m.life / m.maxLife;
          const fade = Math.sin(progress * Math.PI);
          const speedMag = Math.hypot(m.vx, m.vy) || 1;
          const tailX = m.x - (m.vx / speedMag) * m.length;
          const tailY = m.y - (m.vy / speedMag) * m.length;

          const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
          grad.addColorStop(0, `rgba(224, 242, 254, ${0.85 * fade})`);
          grad.addColorStop(0.35, `rgba(125, 211, 252, ${0.42 * fade})`);
          grad.addColorStop(1, 'rgba(56, 189, 248, 0)');

          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();

          ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * fade})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, 1.35, 0, Math.PI * 2);
          ctx.fill();

          return true;
        });
      }

      if (!prefersReducedMotion && !document.hidden) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    };

    const startLoop = () => {
      window.cancelAnimationFrame(rafId);
      lastTime = performance.now();
      drawFrame(lastTime);
    };

    const onMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      startLoop();
    };

    const onVisibilityChange = () => {
      if (!document.hidden && !prefersReducedMotion) {
        startLoop();
      } else {
        window.cancelAnimationFrame(rafId);
      }
    };

    const onResize = () => {
      resize();
      if (prefersReducedMotion) {
        drawFrame(performance.now());
      }
    };

    resize();
    startLoop();

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    motionQuery.addEventListener('change', onMotionChange);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      motionQuery.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="no-print pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#040712]"
    >
      {/* Deep cosmic horizon & stellar nebula clouds */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_18%_18%,rgba(56,189,248,0.16)_0%,transparent_65%),radial-gradient(ellipse_70%_60%_at_84%_24%,rgba(99,102,241,0.18)_0%,transparent_62%),radial-gradient(ellipse_80%_55%_at_55%_88%,rgba(30,58,138,0.24)_0%,transparent_68%)]" />

      {/* Diagonal Milky Way galactic lane */}
      <motion.div
        animate={{ opacity: [0.55, 0.8, 0.55], scale: [1, 1.03, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -inset-x-[25%] top-[12%] h-[42vh] -rotate-[22deg] blur-3xl bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(125,211,252,0.13)_0%,rgba(99,102,241,0.1)_42%,rgba(15,23,42,0)_76%)]"
      />

      {/* Soft drifting interstellar nebula cloud */}
      <motion.div
        animate={{ x: [0, 32, 0], y: [0, -18, 0], opacity: [0.35, 0.54, 0.35] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-24 -left-20 w-[52vw] max-w-[680px] aspect-square rounded-full blur-3xl bg-[radial-gradient(circle_at_45%_45%,rgba(14,165,233,0.15)_0%,rgba(79,70,229,0.09)_45%,transparent_72%)]"
      />

      {/* Distant ringed planet silhouette in the upper-right orbital vista */}
      <div className="hidden md:block absolute top-20 right-[6%] w-40 h-40 opacity-40">
        <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_32%_30%,rgba(186,230,253,0.45)_0%,rgba(59,130,246,0.22)_38%,rgba(15,23,42,0.9)_78%)] shadow-[inset_-10px_-12px_24px_rgba(2,6,23,0.9),0_0_36px_rgba(56,189,248,0.14)]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-12 rounded-full border border-cyan-200/30 -rotate-[18deg] shadow-[0_0_12px_rgba(125,211,252,0.14)]" />
      </div>

      {/* Interactive DPI-scaled canvas starfield, spiral galaxy & shooting stars */}
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Gentle vignette keeping foreground HUD cards effortlessly legible */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_85%_at_50%_45%,transparent_55%,rgba(2,5,14,0.62)_100%)]" />
    </div>
  );
};
