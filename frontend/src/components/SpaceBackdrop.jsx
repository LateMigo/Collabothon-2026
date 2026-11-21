import { useEffect, useRef } from "react";

const PX = 3;

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeStars(w, h) {
  const rand = seeded(7);
  const layers = [
    { count: Math.round((w * h) / 260), speed: 0.02, size: 1, alpha: 0.45 },
    { count: Math.round((w * h) / 700), speed: 0.05, size: 1, alpha: 0.8 },
    { count: Math.round((w * h) / 2600), speed: 0.11, size: 2, alpha: 1 },
  ];
  const tints = ["255,246,220", "255,230,190", "200,215,255", "255,255,255"];
  return layers.flatMap((layer) =>
    Array.from({ length: layer.count }, () => ({
      x: rand() * w,
      y: rand() * h,
      speed: layer.speed,
      size: layer.size,
      alpha: layer.alpha * (0.6 + rand() * 0.4),
      tint: tints[Math.floor(rand() * tints.length)],
      phase: rand() * Math.PI * 2,
      twinkle: 0.02 + rand() * 0.05,
    })),
  );
}

function nebula(ctx, x, y, r, rgb, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function shadedDisc(ctx, x, y, r, light, dark) {
  const g = ctx.createRadialGradient(x - r * 0.45, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ringHalf(ctx, x, y, r, front) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.32);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.9, r * 0.42, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.strokeStyle = front ? "rgba(214,190,140,0.85)" : "rgba(150,130,96,0.6)";
  ctx.stroke();
  ctx.restore();
}

function drawGasGiant(ctx, x, y, r, t) {
  ringHalf(ctx, x, y, r, false);
  shadedDisc(ctx, x, y, r, "#c9a36a", "#3a2a1c");
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  for (let i = -3; i <= 3; i += 1) {
    const by = y + i * r * 0.27 + Math.sin(t * 0.0004 + i) * 1.2;
    ctx.fillStyle = i % 2 === 0 ? "rgba(90,60,36,0.35)" : "rgba(235,205,150,0.18)";
    ctx.fillRect(x - r, by, r * 2, Math.max(1, r * 0.1));
  }
  const shade = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  shade.addColorStop(0.45, "rgba(8,8,16,0)");
  shade.addColorStop(1, "rgba(8,8,16,0.75)");
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ringHalf(ctx, x, y, r, true);
}

function drawRedPlanet(ctx, x, y, r, t) {
  const angle = t * 0.00035;
  const moon = { x: x + Math.cos(angle) * r * 2.6, y: y + Math.sin(angle) * r * 0.9 };
  const moonBehind = Math.sin(angle) < 0;
  const drawMoon = () => shadedDisc(ctx, moon.x, moon.y, Math.max(1.5, r * 0.28), "#d8d4c8", "#4a4a55");
  if (moonBehind) drawMoon();
  shadedDisc(ctx, x, y, r, "#d0644a", "#3a1410");
  ctx.fillStyle = "rgba(60,18,12,0.45)";
  ctx.fillRect(Math.round(x - r * 0.35), Math.round(y - r * 0.2), 2, 2);
  ctx.fillRect(Math.round(x + r * 0.1), Math.round(y + r * 0.3), 2, 1);
  if (!moonBehind) drawMoon();
}

export default function SpaceBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return undefined;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let w = 0;
    let h = 0;
    let stars = [];
    let comet = null;
    let nextComet = 2500;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      w = Math.max(1, Math.ceil(canvas.clientWidth / PX));
      h = Math.max(1, Math.ceil(canvas.clientHeight / PX));
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = false;
      stars = makeStars(w, h);
    };

    const draw = (t, dt) => {
      ctx.fillStyle = "#0b0c18";
      ctx.fillRect(0, 0, w, h);

      const breathe = 0.5 + 0.5 * Math.sin(t * 0.0003);
      nebula(ctx, w * 0.82, h * 0.22, Math.max(w, h) * 0.38, "92,60,150", 0.16 + breathe * 0.05);
      nebula(ctx, w * 0.12, h * 0.85, Math.max(w, h) * 0.34, "40,110,130", 0.12 + (1 - breathe) * 0.05);
      nebula(ctx, w * 0.55, h * 0.6, Math.max(w, h) * 0.22, "150,70,90", 0.07);

      for (const s of stars) {
        s.x -= s.speed * dt * 0.06;
        if (s.x < -2) s.x += w + 4;
        const a = s.alpha * (0.65 + 0.35 * Math.sin(t * 0.001 * s.twinkle * 40 + s.phase));
        ctx.fillStyle = `rgba(${s.tint},${a.toFixed(3)})`;
        ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
      }

      const giantR = Math.max(14, Math.min(w, h) * 0.2);
      drawGasGiant(ctx, w * 0.86, h * 0.88 + Math.sin(t * 0.0002) * 2, giantR, t);
      drawRedPlanet(ctx, w * 0.9, h * 0.2, Math.max(5, giantR * 0.32), t);

      const satX = ((t * 0.004) % (w + 40)) - 20;
      const satY = h * 0.45 + Math.sin(t * 0.0005) * 6;
      ctx.fillStyle = "#8a8f9e";
      ctx.fillRect(Math.round(satX), Math.round(satY), 3, 2);
      ctx.fillStyle = "#4a6ea8";
      ctx.fillRect(Math.round(satX) - 3, Math.round(satY), 2, 2);
      ctx.fillRect(Math.round(satX) + 4, Math.round(satY), 2, 2);
      if (Math.floor(t / 600) % 2 === 0) {
        ctx.fillStyle = "#e0503a";
        ctx.fillRect(Math.round(satX) + 1, Math.round(satY) - 1, 1, 1);
      }

      nextComet -= dt;
      if (!comet && nextComet <= 0) {
        const r = Math.random();
        comet = { x: w * (0.3 + r * 0.6), y: h * (0.05 + Math.random() * 0.3), life: 0 };
      }
      if (comet) {
        comet.life += dt;
        comet.x -= dt * 0.09;
        comet.y += dt * 0.04;
        const fade = Math.max(0, 1 - comet.life / 1100);
        for (let i = 0; i < 14; i += 1) {
          ctx.fillStyle = `rgba(255,244,214,${(fade * (1 - i / 14)).toFixed(3)})`;
          ctx.fillRect(Math.round(comet.x + i * 2), Math.round(comet.y - i * 0.9), 1, 1);
        }
        if (fade <= 0) {
          comet = null;
          nextComet = 5000 + Math.random() * 7000;
        }
      }
    };

    const loop = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      draw(now, dt);
      raf = requestAnimationFrame(loop);
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(0, 0);
    });
    observer.observe(canvas);

    if (reduceMotion) draw(0, 0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="space-backdrop" aria-hidden="true" />;
}
