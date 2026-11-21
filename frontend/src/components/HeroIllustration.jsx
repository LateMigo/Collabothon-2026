import { useEffect, useRef } from "react";

/*
 * Original low-resolution pixel-art scene (160 x 190 real pixels, scaled up without smoothing):
 * a grim night shift at Booth 7 of the Galactic Exchange. A stern alien official sits behind
 * the glass with a rubber stamp; paperwork waits on the counter; snow falls, a guard with a
 * laser dzida stands by and a searchlight sweeps the sky. Muted, bureaucratic-dystopia mood - drawn from scratch for CosmiCash.
 */

const W = 160;
const H = 190;
const FRAME_MS = 125;

const colorCache = new Map();
function rgb(hex) {
  let color = colorCache.get(hex);
  if (!color) {
    color = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    colorCache.set(hex, color);
  }
  return color;
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// 4x4 ordered dithering, for the chunky sky and ground gradients
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Tiny pixel font (3x5, a few wider glyphs). "$" is 7 rows tall and starts one row higher.
const FONT = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  0: ["###", "#.#", "#.#", "#.#", "###"],
  1: [".#.", "##.", ".#.", ".#.", "###"],
  7: ["###", "..#", ".#.", ".#.", ".#."],
  $: { dy: -1, rows: [".#.", ".##", "#..", ".#.", "..#", "##.", ".#."] },
  " ": ["..", "..", "..", "..", ".."],
};

function glyph(ch) {
  const g = FONT[ch] ?? FONT[" "];
  return Array.isArray(g) ? { dy: 0, rows: g } : g;
}

function createLayer() {
  const data = new Uint8ClampedArray(W * H * 4);
  const sky = new Uint8Array(W * H);

  const set = (x, y, color, isSky = 0) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const [r, g, b] = rgb(color);
    const i = (py * W + px) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
    sky[py * W + px] = isSky;
  };
  const blend = (x, y, color, alpha) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const [r, g, b] = rgb(color);
    const i = (y * W + x) * 4;
    data[i] += (r - data[i]) * alpha;
    data[i + 1] += (g - data[i + 1]) * alpha;
    data[i + 2] += (b - data[i + 2]) * alpha;
  };
  const copy = (fromX, fromY, toX, toY) => {
    const a = (fromY * W + fromX) * 4;
    const b = (toY * W + toX) * 4;
    data[b] = data[a];
    data[b + 1] = data[a + 1];
    data[b + 2] = data[a + 2];
  };
  const rect = (x, y, w, h, color) => {
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) set(x + i, y + j, color);
  };
  const frame = (x, y, w, h, color) => {
    rect(x, y, w, 1, color);
    rect(x, y + h - 1, w, 1, color);
    rect(x, y, 1, h, color);
    rect(x + w - 1, y, 1, h, color);
  };
  const disc = (cx, cy, r, color) => {
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) if (dx * dx + dy * dy <= r * r + r * 0.6) set(cx + dx, cy + dy, color);
  };
  const ellipse = (cx, cy, rx, ry, color) => {
    for (let dy = -ry; dy <= ry; dy += 1)
      for (let dx = -rx; dx <= rx; dx += 1)
        if ((dx * dx) / (rx * rx + rx * 0.5) + (dy * dy) / (ry * ry + ry * 0.5) <= 1) set(cx + dx, cy + dy, color);
  };
  const line = (x0, y0, x1, y1, color, thickness = 1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s += 1) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      if (thickness === 1) set(x, y, color);
      else rect(x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), thickness, thickness, color);
    }
  };
  const textWidth = (str) =>
    [...str].reduce((sum, ch, i) => sum + glyph(ch).rows[0].length + (i > 0 ? 1 : 0), 0);
  const text = (x, y, str, color) => {
    let cx = x;
    for (const ch of str) {
      const g = glyph(ch);
      g.rows.forEach((row, j) => {
        [...row].forEach((cell, i) => {
          if (cell === "#") set(cx + i, y + g.dy + j, color);
        });
      });
      cx += g.rows[0].length + 1;
    }
  };

  return { data, sky, set, blend, copy, rect, frame, disc, ellipse, line, text, textWidth };
}

/* ------------------------------------------------------------------ the static scene */

const SKIN = "#7d8f5a";
const SKIN_DARK = "#6a7a4b";
const SKIN_LINE = "#3a4428";
const UNIFORM = "#4a4a3c";
const UNIFORM_DARK = "#2e2e25";
const GOLD = "#b89a4a";
const RED = "#8c2a24";
const INK = "#0d0d0f";

function paintSky(p, rand) {
  const tones = ["#111219", "#171923", "#1e202c", "#262938"];
  for (let y = 0; y < 72; y += 1)
    for (let x = 0; x < W; x += 1) {
      const level = Math.min(3, Math.floor((y / 72) * 3.2 + BAYER[y % 4][x % 4] / 16));
      p.set(x, y, tones[level], 1);
    }
  for (let i = 0; i < 28; i += 1) {
    p.set(Math.floor(rand() * W), Math.floor(rand() * 44), rand() > 0.7 ? "#c9c3a8" : "#6f6c60", 1);
  }

  // a dull ringed planet
  const ring = (front, color) => {
    for (let a = 0; a < Math.PI * 2; a += 0.015) {
      if (Math.sin(a) >= 0 !== front) continue;
      p.set(138 + Math.cos(a) * 17, 16 + Math.sin(a) * 3 - Math.cos(a) * 3, color);
    }
  };
  ring(false, "#6e6349");
  for (let dy = -9; dy <= 9; dy += 1)
    for (let dx = -9; dx <= 9; dx += 1) {
      if (dx * dx + dy * dy > 86) continue;
      const shade = dx + dy < -6 ? "#a08c62" : dx + dy > 5 ? "#584a30" : "#7f6d47";
      p.set(138 + dx, 16 + dy, shade);
    }
  p.set(134, 12, "#665839");
  p.set(135, 12, "#665839");
  p.set(141, 19, "#665839");
  ring(true, "#b3a37a");

  // grim city blocks on the horizon
  let x = 0;
  while (x < W) {
    const w = 6 + Math.floor(rand() * 9);
    const h = 8 + Math.floor(rand() * 20);
    p.rect(x, 72 - h, w, h, "#14151b");
    for (let wy = 72 - h + 2; wy < 70; wy += 3)
      for (let wx = x + 1; wx < x + w - 1; wx += 2) if (rand() > 0.86) p.set(wx, wy, rand() > 0.5 ? "#7a6a3a" : "#4f4830");
    x += w + Math.floor(rand() * 3);
  }
}

function paintYard(p, rand) {
  const yard = ["#211f1b", "#272520", "#2e2c26"];
  for (let y = 72; y < 160; y += 1)
    for (let x = 0; x < W; x += 1) {
      const level = Math.min(2, Math.floor(((y - 72) / 88) * 2.4 + BAYER[y % 4][x % 4] / 16));
      p.set(x, y, yard[level]);
    }
  // pavement slabs
  for (let y = 160; y < H; y += 1) {
    const row = Math.floor((y - 160) / 11);
    for (let x = 0; x < W; x += 1) {
      const joint = y === 160 || (y - 160) % 11 === 0 || (x + (row % 2) * 8) % 16 === 0;
      p.set(x, y, joint ? "#33312b" : "#44423a");
    }
  }
  for (let i = 0; i < 110; i += 1) {
    p.set(Math.floor(rand() * W), 148 + Math.floor(rand() * 42), rand() > 0.5 ? "#bdb9ae" : "#8f8c83");
  }

  // barbed-wire fence
  for (let fx = 2; fx < W; fx += 9) p.rect(fx, 63, 1, 16, "#2a2a28");
  for (const wy of [66, 70, 74]) {
    for (let fx = 0; fx < W; fx += 1) {
      p.set(fx, wy, "#46463f");
      if (fx % 4 === 0) {
        p.set(fx, wy - 1, "#5a5a52");
        p.set(fx, wy + 1, "#5a5a52");
      }
    }
  }

  // watchtower (the searchlight is animated)
  const steel = "#24252a";
  p.line(6, 28, 4, 104, steel, 2);
  p.line(20, 28, 22, 104, steel, 2);
  for (let ty = 36; ty < 100; ty += 16) {
    p.line(6, ty, 21, ty + 14, steel);
    p.line(21, ty, 6, ty + 14, steel);
  }
  p.rect(2, 16, 22, 12, "#30313a");
  p.rect(4, 19, 18, 3, "#121318");
  p.rect(1, 13, 24, 3, steel);
  p.rect(10, 10, 6, 3, steel);
  p.rect(1, 27, 24, 1, steel);
  p.rect(22, 18, 3, 4, "#1a1b20");
}

function paintBooth(p, rand) {
  // shadow, side face and concrete wall
  p.rect(30, 158, 108, 3, "#1a1915");
  p.rect(130, 34, 5, 125, "#3c3d37");
  for (let y = 34; y < 160; y += 1)
    for (let x = 30; x < 130; x += 1) p.set(x, y, (y - 34) % 14 === 0 ? "#4a4b44" : "#5b5c54");
  for (let i = 0; i < 280; i += 1) {
    p.set(30 + Math.floor(rand() * 100), 34 + Math.floor(rand() * 126), rand() > 0.5 ? "#666760" : "#4f504a");
  }
  p.rect(30, 34, 2, 126, "#4a4b44");
  p.rect(128, 34, 2, 126, "#4a4b44");

  // roof slab with snow
  p.rect(26, 28, 111, 6, "#3f403a");
  p.rect(26, 28, 111, 1, "#6e6f66");
  p.rect(26, 33, 111, 1, "#2b2c27");
  for (let x = 26; x < 137; x += 1) {
    p.set(x, 27, "#cfccc2");
    if (rand() > 0.6) p.set(x, 26, "#cfccc2");
  }

  // grime streaks under the sign
  for (let i = 0; i < 14; i += 1) {
    const gx = 34 + Math.floor(rand() * 92);
    const len = 2 + Math.floor(rand() * 7);
    for (let j = 0; j < len; j += 1) p.set(gx, 47 + j, "#4b4c45");
  }

  // sign
  p.rect(36, 36, 89, 11, "#1c1d18");
  p.rect(37, 37, 87, 9, "#26271f");
  const sign = "EXCHANGE BOOTH 7";
  p.text(80 - Math.floor(p.textWidth(sign) / 2), 39, sign, GOLD);
  for (const [bx, by] of [[38, 38], [122, 38], [38, 44], [122, 44]]) p.set(bx, by, "#4a4b44");

  // "NEXT" lamp housing (the light itself is animated)
  p.rect(69, 48, 23, 8, "#1c1d18");

  // speaker grille
  for (let gy = 84; gy <= 98; gy += 2) for (let gx = 123; gx <= 127; gx += 2) p.set(gx, gy, "#2b2c27");

  // window frame and the room behind the glass
  p.rect(40, 57, 81, 69, "#34352f");
  for (let y = 59; y < 124; y += 1)
    for (let x = 42; x < 119; x += 1) p.set(x, y, x % 6 === 0 ? "#33342d" : y > 112 ? "#303129" : "#383931");
  // propaganda poster
  p.rect(46, 64, 13, 19, "#6b6450");
  p.rect(47, 65, 11, 17, "#a89c7c");
  p.rect(49, 67, 7, 6, RED);
  p.rect(51, 69, 3, 2, GOLD);
  for (const py of [75, 77, 79]) p.rect(48, py, 9, 1, "#5c5546");
  // clock
  p.disc(108, 70, 5, "#26271f");
  p.disc(108, 70, 4, "#c9c3a8");
  p.line(108, 70, 108, 67, INK);
  p.line(108, 70, 110, 71, INK);
}

function paintOfficial(p) {
  // torso in a grey-green uniform
  for (let y = 103; y <= 123; y += 1) {
    const hw = y === 103 ? 15 : y === 104 ? 17 : Math.round(18 + (y - 105) * 0.75);
    for (let x = 80 - hw; x <= 80 + hw; x += 1) {
      if (x < 42 || x > 118) continue;
      const edge = x - (80 - hw) < 2 || 80 + hw - x < 2;
      p.set(x, y, edge ? UNIFORM_DARK : x > 80 + hw - 6 ? "#3e3e32" : UNIFORM);
    }
  }
  // shirt, tie and lapels
  for (let y = 103; y <= 109; y += 1) {
    const half = Math.floor((109 - y) / 1.5);
    for (let x = 80 - half; x <= 80 + half; x += 1) p.set(x, y, "#8a8670");
    p.set(80 - half - 1, y, UNIFORM_DARK);
    p.set(80 + half + 1, y, UNIFORM_DARK);
  }
  p.rect(79, 104, 2, 13, RED);
  p.rect(79, 104, 2, 2, "#6b1f1a");
  p.rect(62, 104, 8, 2, GOLD);
  p.rect(91, 104, 8, 2, GOLD);
  p.rect(68, 110, 3, 3, GOLD);
  p.set(69, 111, RED);
  for (const by of [111, 115, 119]) p.set(85, by, GOLD);

  // neck and head
  p.rect(76, 97, 9, 7, "#56643c");
  p.ellipse(80, 89, 12, 11, SKIN_LINE);
  p.ellipse(80, 89, 11, 10, SKIN);
  for (let y = 80; y <= 99; y += 1) for (let x = 87; x <= 91; x += 1) if (x + (99 - y) * 0.1 > 88.5) {
    const i = (y * W + x) * 4;
    if (p.data[i] === 125 && p.data[i + 1] === 143) p.set(x, y, SKIN_DARK); // shade the right cheek
  }
  // pointed ears
  for (const [ex, ey] of [[68, 88], [67, 87], [66, 86], [68, 87], [67, 86]]) p.set(ex, ey, SKIN);
  for (const [ex, ey] of [[92, 88], [93, 87], [94, 86], [92, 87], [93, 86]]) p.set(ex, ey, SKIN_DARK);
  p.set(65, 85, SKIN_LINE);
  p.set(95, 85, SKIN_LINE);

  // peaked cap with the exchange emblem
  p.rect(66, 72, 29, 3, "#454839");
  p.rect(66, 72, 29, 1, "#55594a");
  p.rect(68, 75, 25, 5, "#3d4034");
  p.rect(68, 80, 25, 2, "#2a2c24");
  p.rect(69, 82, 23, 2, "#17181a");
  p.rect(78, 75, 5, 4, GOLD);
  p.rect(79, 76, 3, 2, RED);

  // stern face: heavy brows, narrow eyes, small tusks, a scar
  for (const [bx, by] of [[72, 85], [73, 85], [74, 85], [75, 86], [76, 86], [77, 87]]) p.set(bx, by, "#2a2c24");
  for (const [bx, by] of [[83, 87], [84, 86], [85, 86], [86, 85], [87, 85], [88, 85]]) p.set(bx, by, "#2a2c24");
  p.rect(73, 88, 4, 1, "#d8d4c0");
  p.rect(84, 88, 4, 1, "#d8d4c0");
  p.set(75, 88, INK);
  p.set(85, 88, INK);
  p.rect(73, 89, 4, 1, SKIN_DARK);
  p.rect(84, 89, 4, 1, SKIN_DARK);
  p.set(80, 90, SKIN_DARK);
  p.set(80, 91, SKIN_DARK);
  p.set(79, 92, SKIN_LINE);
  p.set(81, 92, SKIN_LINE);
  p.rect(76, 95, 9, 1, "#2a1a14");
  p.set(75, 96, "#2a1a14");
  p.set(85, 96, "#2a1a14");
  for (const [tx, ty] of [[76, 94], [76, 93], [84, 94], [84, 93]]) p.set(tx, ty, "#d8d4c0");
  for (const [sx, sy] of [[71, 90], [72, 91], [73, 92], [74, 93]]) p.set(sx, sy, "#4a3a2a");

  // raised arm holding the rubber stamp (green ink: APPROVED)
  p.line(64, 108, 54, 95, "#45453a", 3);
  p.rect(47, 88, 5, 2, "#4a3020");
  p.rect(48, 90, 3, 9, "#6b4a2a");
  p.rect(45, 99, 9, 3, "#2a2a26");
  p.rect(46, 102, 7, 1, "#3f7a3a");
  p.rect(47, 93, 6, 4, SKIN);
  p.set(52, 94, SKIN_DARK);
  p.set(52, 95, SKIN_DARK);
}

function paintGlassAndCounter(p) {
  // greenish glass tint with diagonal reflections
  for (let y = 59; y < 124; y += 1)
    for (let x = 42; x < 119; x += 1) {
      p.blend(x, y, "#2f4a52", 0.16);
      const s = x - 42 + (123 - y) * 0.55;
      if (s % 46 < 3) p.blend(x, y, "#d8e4e6", 0.12);
      else if ((s + 9) % 46 < 1) p.blend(x, y, "#d8e4e6", 0.08);
    }

  // metal counter shelf
  p.rect(36, 124, 89, 4, "#7c8288");
  p.rect(36, 124, 89, 1, "#9aa0a6");
  p.rect(36, 128, 89, 4, "#50555b");
  p.rect(38, 132, 85, 1, "#2c2d29");
  for (let x = 36; x < 125; x += 1) if (x % 3 !== 0) p.set(x, 123, "#cfccc2");

  // investor permit
  p.rect(44, 116, 15, 10, "#3e1814");
  p.rect(45, 117, 13, 8, "#6b2a24");
  p.rect(50, 118, 3, 3, GOLD);
  p.set(51, 119, RED);
  for (let x = 47; x < 56; x += 2) p.set(x, 123, GOLD);
  // $100 bill
  p.rect(62, 119, 20, 8, "#5d7a46");
  p.rect(63, 120, 18, 6, "#8fae6a");
  p.text(65, 121, "$100", "#3d5230");
  // stamped form
  p.rect(84, 109, 38, 18, "#a89c7c");
  p.rect(85, 110, 36, 16, "#d8ccaa");
  p.rect(87, 112, 22, 1, "#a89c7c");
  p.rect(87, 114, 16, 1, "#a89c7c");
  p.frame(85, 117, 35, 9, "#3f7a3a");
  p.text(87, 119, "APPROVED", "#3f7a3a");

  // notice on the lower wall
  p.rect(58, 139, 44, 13, "#8a8068");
  p.rect(59, 140, 42, 11, "#c9bd98");
  for (const [tx, ty] of [[58, 139], [59, 139], [100, 139], [101, 139]]) p.set(tx, ty, "#a8a08a");
  const notice = "NO REFUNDS";
  p.text(80 - Math.floor(p.textWidth(notice) / 2), 143, notice, "#9c2b23");
}

// The guard stands left of the booth; GUARD_X shifts the whole figure (and its animated dzida tip).
const GUARD_X = -6;

function paintGuard(p) {
  const o = GUARD_X;
  p.rect(13 + o, 131, 15, 23, "#1c1d18");
  p.rect(14 + o, 132, 13, 21, "#4a4d3c");
  p.rect(14 + o, 142, 13, 1, "#2a2b22");
  p.rect(19 + o, 142, 2, 1, GOLD);
  p.rect(20 + o, 143, 1, 10, "#3a3c2f");
  p.set(19 + o, 135, GOLD);
  p.set(19 + o, 138, GOLD);
  p.rect(15 + o, 154, 4, 3, "#2e2f27");
  p.rect(22 + o, 154, 4, 3, "#2e2f27");
  p.rect(14 + o, 157, 5, 3, "#141414");
  p.rect(22 + o, 157, 5, 3, "#141414");
  p.rect(19 + o, 129, 3, 3, "#56643c");
  p.disc(20 + o, 125, 5, "#1c1d18");
  p.disc(20 + o, 125, 4, SKIN);
  for (let y = 119; y <= 124; y += 1)
    for (let x = 15; x <= 25; x += 1) if ((x - 20) ** 2 + (y - 125) ** 2 <= 28) p.set(x + o, y, "#3d4034");
  p.rect(14 + o, 124, 13, 1, "#2a2c24");
  p.set(18 + o, 126, INK);
  p.set(22 + o, 126, INK);
  p.rect(19 + o, 128, 3, 1, "#2a1a14");
  p.rect(26 + o, 134, 3, 3, "#4a4d3c");
  p.rect(29 + o, 102, 1, 57, "#7c8288");
  p.rect(30 + o, 102, 1, 57, "#50555b");
  p.rect(28 + o, 134, 2, 3, SKIN);
}

const STATIC = (() => {
  const p = createLayer();
  const rand = seeded(7);
  paintSky(p, rand);
  paintYard(p, rand);
  paintBooth(p, rand);
  paintOfficial(p);
  paintGlassAndCounter(p);
  paintGuard(p);
  return p;
})();

/* ------------------------------------------------------------------ animation */

function makeFlakes() {
  const rand = seeded(23);
  return Array.from({ length: 70 }, () => ({
    x: rand() * W,
    y: rand() * H,
    speed: 0.5 + rand() * 0.9,
    phase: rand() * 10,
    near: rand() > 0.55,
  }));
}

function paintFrame(target, frame, flakes, moving) {
  target.data.set(STATIC.data);

  // searchlight sweeping the sky from the watchtower (only lights up the sky, not the buildings)
  const theta = -0.34 + 0.24 * Math.sin(frame * 0.045);
  const halfWidth = 0.075;
  for (let y = 0; y < 80; y += 1)
    for (let x = 26; x < W; x += 1) {
      if (!STATIC.sky[y * W + x]) continue;
      const d = Math.abs(Math.atan2(y - 20, x - 25) - theta);
      if (d < halfWidth) target.blend(x, y, "#d8d2b8", 0.05 + 0.16 * (1 - d / halfWidth));
    }
  target.rect(23, 19, 2, 2, Math.floor(frame / 4) % 2 === 0 ? "#e0503a" : "#4a1d17");
  target.rect(25, 19, 1, 2, "#d8d2b8");

  // the NEXT lamp buzzes
  const lit = frame % 24 < 17 || frame % 24 === 19;
  target.rect(70, 49, 21, 6, lit ? "#4a3214" : "#2a2416");
  target.text(72, 49, "NEXT", lit ? "#f0b54a" : "#6a5a3a");
  if (lit) {
    for (let y = 45; y <= 58; y += 1)
      for (let x = 66; x <= 94; x += 1) if (x < 69 || x > 91 || y < 48 || y > 55) target.blend(x, y, "#f0b54a", 0.07);
  }

  // the official blinks now and then
  if (frame % 36 === 0 || frame % 36 === 1) {
    for (let x = 73; x <= 76; x += 1) target.copy(x, 89, x, 88);
    for (let x = 84; x <= 87; x += 1) target.copy(x, 89, x, 88);
  }

  // the laser dzida crackles
  const hot = frame % 3 !== 0;
  const tip = 29 + GUARD_X;
  for (let y = 96; y <= 101; y += 1) target.set(tip, y, hot ? "#ffd6f0" : "#e86fc0");
  for (let y = 98; y <= 101; y += 1) {
    target.set(tip - 1, y, hot ? "#e86fc0" : "#b0387f");
    target.set(tip + 1, y, hot ? "#e86fc0" : "#b0387f");
  }
  if (hot) for (const [sx, sy] of [[tip - 2, 95], [tip + 2, 97], [tip - 3, 99]]) target.set(sx, sy, "#f6d9ee");

  // snow
  for (const flake of flakes) {
    if (moving) {
      flake.y += flake.speed;
      flake.x += Math.sin((flake.y + flake.phase) * 0.12) * 0.25;
      if (flake.y >= H) {
        flake.y = 0;
        flake.x = (flake.x + 37) % W;
      }
    }
    target.set(flake.x, flake.y, flake.near ? "#d9d6cc" : "#8f8c83");
  }
}

export default function HeroIllustration() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return undefined;
    const target = createLayer();
    const image = ctx.createImageData(W, H);
    const flakes = makeFlakes();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;

    const draw = (moving) => {
      paintFrame(target, frame, flakes, moving);
      image.data.set(target.data);
      ctx.putImageData(image, 0, 0);
      frame += 1;
    };

    draw(false);
    if (reduceMotion) return undefined;
    const timer = window.setInterval(() => draw(true), FRAME_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="hero-art hero-art--pixel"
      width={W}
      height={H}
      role="img"
      aria-label="Pixel-art night scene at the Galactic Exchange: a stern alien official in a peaked cap sits behind the glass of Booth 7 holding a rubber stamp. An investor permit, a 100 dollar bill and an approved form lie on the counter under a 'No refunds' notice. Snow falls, a guard with a laser spear stands by and a searchlight sweeps the sky from a watchtower."
    />
  );
}
