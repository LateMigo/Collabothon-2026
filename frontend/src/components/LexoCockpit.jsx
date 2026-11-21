import { useEffect, useRef } from "react";

const W = 128;
const H = 96;
const FRAME_MS = 110;
const FINE = 2;

const SKIN = "#86a08c";
const SKIN_SHADE = "#62806c";
const SKIN_LINE = "#24342a";
const BEARD = "#dcdcd2";
const BEARD_SHADE = "#a9aaa0";
const GLASSES = "#c9ced8";
const SHIRT = "#24272f";
const SHIRT_SHADE = "#1a1c22";
const STEEL = "#4a505a";
const STEEL_DARK = "#2c3038";
const STEEL_LIGHT = "#6d7480";
const GOLD = "#e0b23a";
const BANK_YELLOW = "#ffcc00";
const BANK_FOLD = "#c99600";

const BANK_LOGO = ["....YYYYYYY", "...YYyyyyYY", "..Yyy...YY.", ".Yyy...YY..", "YYYYYYYYy..", "yyyyyyyy..."];

const WORDMARK_FONT = {
  C: ["###", "#..", "#..", "#..", "###"],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  E: ["###", "#..", "##.", "#..", "###"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  Z: ["###", "..#", ".#.", "#..", "###"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  K: ["#.#", "##.", "#..", "##.", "#.#"],
};

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function painter(ctx) {
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  };
  const rect = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const disc = (cx, cy, r, c) => {
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) if (dx * dx + dy * dy <= r * r + r * 0.6) set(cx + dx, cy + dy, c);
  };
  const ellipse = (cx, cy, rx, ry, c) => {
    for (let dy = -ry; dy <= ry; dy += 1)
      for (let dx = -rx; dx <= rx; dx += 1)
        if ((dx * dx) / (rx * rx + rx * 0.5) + (dy * dy) / (ry * ry + ry * 0.5) <= 1) set(cx + dx, cy + dy, c);
  };
  const line = (x0, y0, x1, y1, c) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i += 1)
      set(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), c);
  };
  return { set, rect, disc, ellipse, line };
}

function makeStars() {
  const rand = seeded(42);
  return Array.from({ length: 46 }, () => ({
    x: rand() * W,
    y: 4 + rand() * 64,
    speed: 0.4 + rand() * 1.6,
    bright: rand() > 0.6,
  }));
}

function drawScene(ctx, frame, stars, mode) {
  ctx.setTransform(FINE, 0, 0, FINE, 0, 0);
  const p = painter(ctx);

  p.rect(0, 0, W, H, "#0b0d1a");
  for (let y = 0; y < 70; y += 1) if (y % 6 === 0) p.rect(0, y, W, 1, "#0e1120");
  for (const s of stars) {
    s.x -= s.speed;
    if (s.x < 0) s.x += W;
    p.set(Math.round(s.x), Math.round(s.y), s.bright ? "#e8e4d4" : "#6f6c78");
    if (s.speed > 1.4) p.set(Math.round(s.x) + 1, Math.round(s.y), "#3a3848");
  }
  const px = 108 - ((frame * 0.05) % 160) + 40;
  p.ellipse(px, 20, 13, 2, "#8a6f4a");
  p.disc(px, 20, 8, "#c9874a");
  p.disc(px - 2, 18, 4, "#e0a060");
  p.rect(px - 13, 20, 27, 1, "#d8b27a");

  const talking = mode === "talking";
  p.ellipse(64, 74, 24, 12, SHIRT_SHADE);
  p.ellipse(64, 75, 23, 11, SHIRT);
  p.rect(41, 72, 46, 14, SHIRT);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const fine = (x, y, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, 1);
  };
  const RIBBON_SCALE = 1.5;
  const ribbonW = Math.round(11 * RIBBON_SCALE);
  const ribbonH = Math.round(6 * RIBBON_SCALE);
  const ribbonX = 64 * FINE - Math.floor(ribbonW / 2);
  const ribbonY = 130;
  for (let v = 0; v < ribbonH; v += 1)
    for (let u = 0; u < ribbonW; u += 1) {
      const cell = BANK_LOGO[Math.floor(v / RIBBON_SCALE)][Math.floor(u / RIBBON_SCALE)];
      if (cell === "Y") fine(ribbonX + u, ribbonY + v, BANK_YELLOW);
      else if (cell === "y") fine(ribbonX + u, ribbonY + v, BANK_FOLD);
    }
  const TEXT_SCALE = 1.5;
  const textW = [..."COMMERZBANK"].reduce((w, ch) => w + Math.round(WORDMARK_FONT[ch][0].length * TEXT_SCALE) + 1, -1);
  let tx = 64 * FINE - Math.floor(textW / 2);
  const textY = ribbonY + ribbonH + 3;
  const textH = Math.round(5 * TEXT_SCALE);
  for (const ch of "COMMERZBANK") {
    const rows = WORDMARK_FONT[ch];
    const cw = Math.round(rows[0].length * TEXT_SCALE);
    for (let v = 0; v < textH; v += 1)
      for (let u = 0; u < cw; u += 1) {
        if (rows[Math.floor((v * 5) / textH)][Math.floor((u * rows[0].length) / cw)] === "#") fine(tx + u, textY + v, "#f2f2ee");
      }
    tx += cw + 1;
  }
  ctx.setTransform(FINE, 0, 0, FINE, 0, 0);
  p.rect(60, 55, 8, 6, SKIN_SHADE);
  p.rect(58, 60, 12, 2, SHIRT_SHADE);

  p.ellipse(64, 34, 16, 21, SKIN_LINE);
  p.ellipse(64, 34, 15, 20, SKIN);
  p.ellipse(64, 48, 11, 9, SKIN_LINE);
  p.ellipse(64, 48, 10, 8, SKIN);
  for (let y = 30; y < 54; y += 1) p.set(50 + Math.floor((y - 30) / 6), y, SKIN_SHADE);
  for (const [x0, y0, x1, y1] of [
    [56, 18, 60, 15],
    [60, 15, 66, 16],
    [66, 16, 71, 19],
    [54, 24, 58, 21],
    [63, 21, 68, 23],
    [70, 24, 74, 22],
    [58, 27, 62, 26],
  ])
    p.line(x0, y0, x1, y1, SKIN_SHADE);
  p.line(48, 37, 44, 33, SKIN_LINE);
  p.line(44, 33, 48, 43, SKIN_LINE);
  p.line(47, 38, 46, 36, SKIN_SHADE);
  p.line(80, 37, 84, 33, SKIN_LINE);
  p.line(84, 33, 80, 43, SKIN_LINE);
  p.line(81, 38, 82, 36, SKIN_SHADE);

  p.line(64, 14, 64, 7, SKIN_LINE);
  const pulse = (Math.sin(frame * 0.15) + 1) / 2;
  p.disc(64, 6, 1, pulse > 0.5 ? "#9fd8ff" : "#4a7aa8");
  if (pulse > 0.8) {
    p.set(62, 6, "rgba(159,216,255,0.5)");
    p.set(66, 6, "rgba(159,216,255,0.5)");
    p.set(64, 4, "rgba(159,216,255,0.5)");
  }

  const thinking = mode === "thinking";
  const blink = frame % 55 === 0 || frame % 55 === 1;
  for (const ex of [57, 71]) {
    if (blink) {
      p.rect(ex - 3, 41, 7, 1, SKIN_LINE);
      continue;
    }
    p.rect(ex - 3, 40, 7, 3, "#0f1612");
    p.rect(ex - 2, 39, 5, 1, "#0f1612");
    p.rect(ex - 3, 39, 7, 1, SKIN_SHADE);
    p.rect(ex - 3, 38, 7, 1, SKIN_LINE);
    p.set(ex + (thinking ? 0 : 1), thinking ? 40 : 41, "#d8f0e0");
  }
  for (const ex of [57, 71]) {
    for (let a = 0; a < Math.PI * 2; a += 0.3) p.set(Math.round(ex + Math.cos(a) * 5), Math.round(41 + Math.sin(a) * 4), GLASSES);
  }
  p.line(62, 40, 66, 40, GLASSES);
  p.line(52, 40, 47, 38, GLASSES);
  p.line(76, 40, 81, 38, GLASSES);
  if (frame % 60 < 4 || thinking) {
    p.line(54, 39, 55, 38, "#ffffff");
    p.line(68, 39, 69, 38, "#ffffff");
  }
  p.line(54, 35, 59, 36, SKIN_LINE);
  p.line(69, 36, 74, 35, SKIN_LINE);

  p.set(63, 46, SKIN_LINE);
  p.set(65, 46, SKIN_LINE);
  const open = talking && Math.floor(frame / 2) % 3 !== 0;
  if (open) {
    p.rect(61, 50, 6, 2, "#1a1414");
  } else {
    p.line(60, 50, 68, 50, SKIN_LINE);
  }

  for (let y = 52; y < 63; y += 1) {
    const half = Math.max(1, Math.round(5 - (y - 52) * 0.45));
    p.rect(64 - half, y, half * 2, 1, y % 3 === 0 ? BEARD_SHADE : BEARD);
  }
  p.line(58, 51, 61, 52, BEARD);
  p.line(70, 51, 67, 52, BEARD);

  p.rect(47, 38, 3, 6, "#1b1d24");
  p.line(49, 44, 57, 51, "#1b1d24");
  p.rect(56, 51, 3, 2, "#3b3f4a");

  p.line(86, 74, 92, 79, SKIN_LINE);
  p.line(87, 74, 93, 79, SKIN);

  p.rect(0, 80, W, 16, STEEL_DARK);
  p.rect(0, 80, W, 1, STEEL_LIGHT);
  p.rect(0, 81, W, 1, STEEL);
  p.rect(18, 70, 9, 10, "#e8e2d0");
  p.rect(18, 70, 9, 1, "#5a3a22");
  p.rect(27, 73, 2, 4, "#e8e2d0");
  p.rect(20, 74, 5, 1, "#b5302a");
  for (let i = 0; i < 2; i += 1)
    for (let y = 63; y < 69; y += 1) p.set(20 + i * 3 + Math.round(Math.sin((y + frame) * 0.8 + i) * 0.8), y, "#5c5a66");
  const lights = ["#e0503a", "#f4b23e", "#5fae6a", "#4a8ad8", "#e0503a", "#5fae6a"];
  lights.forEach((c, i) => {
    const on = mode === "thinking" ? Math.floor(frame / 2) % lights.length === i : (frame + i * 7) % 23 > 6;
    p.rect(40 + i * 8, 86, 4, 3, on ? c : "#1c1f25");
  });
  p.rect(96, 84, 20, 9, "#0f1a12");
  p.rect(97, 85, 18, 7, mode === "thinking" ? "#1f3a22" : "#14261a");
  p.set(101, 86, "#7fd08a");
  p.line(102, 90, 106, 86, "#7fd08a");
  p.set(107, 90, "#7fd08a");
  p.rect(4, 83, 9, 8, "#d9c95a");
  p.rect(6, 85, 5, 1, "#7a6a2a");
  p.rect(6, 87, 4, 1, "#7a6a2a");

  p.rect(0, 0, W, 3, STEEL);
  p.rect(0, 0, 3, 80, STEEL);
  p.rect(W - 3, 0, 3, 80, STEEL);
  p.rect(0, 3, W, 1, STEEL_DARK);
  for (let x = 6; x < W - 4; x += 12) p.set(x, 1, STEEL_LIGHT);
  for (let y = 8; y < 78; y += 12) {
    p.set(1, y, STEEL_LIGHT);
    p.set(W - 2, y, STEEL_LIGHT);
  }
  for (let i = 0; i < 6; i += 1) {
    p.rect(3, 3 + i, 6 - i, 1, STEEL);
    p.rect(W - 9 + i, 3 + i, 6 - i, 1, STEEL);
  }
  p.line(3, 60, 14, 80, STEEL);
  p.line(4, 60, 15, 80, STEEL_DARK);
  p.line(W - 4, 60, W - 15, 80, STEEL);
  p.line(W - 5, 60, W - 16, 80, STEEL_DARK);
  p.line(10, 10, 20, 5, "rgba(255,255,255,0.10)");
  p.line(10, 13, 25, 5, "rgba(255,255,255,0.06)");
}

export default function LexoCockpit({ mode = "idle" }) {
  const canvasRef = useRef(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return undefined;
    const stars = makeStars();
    let frame = 0;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const draw = () => {
      drawScene(ctx, frame, stars, modeRef.current);
      frame += 1;
    };
    draw();
    if (reduceMotion) return undefined;
    const timer = window.setInterval(draw, FRAME_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="lexo__art"
      width={W * FINE}
      height={H * FINE}
      role="img"
      aria-label="Berg, a wise grey-green alien with a tall cranium, calm almond eyes behind round wire spectacles, pointed ear fins, a single glowing antenna and a neat grey goatee, wearing a T-shirt with the yellow Commerzbank ribbon logo and a headset, sits in a spaceship cockpit with a mug on the console."
    />
  );
}
