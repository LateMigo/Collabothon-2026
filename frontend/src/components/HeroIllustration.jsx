import { useEffect, useRef } from "react";

/*
 * Original low-resolution pixel-art scene (160 x 190 real pixels, scaled up without smoothing):
 * late at night in a small room, a green alien with a huge afro sits at his desk over stock
 * sheets and charts, rubbing a pen against his forehead while he thinks. Behind him, through
 * the window, snow falls on a dark city under a ringed planet. Muted palette, warm desk lamp,
 * cold night outside - drawn from scratch for CosmiCash.
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

// 4x4 ordered dithering for chunky gradients
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Tiny pixel font (3x5, a few wider glyphs).
const FONT = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  N: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#...#", "#...#", "#.#.#", "##.##", "#...#"],
  Z: ["###", "..#", ".#.", "#..", "###"],
  7: ["###", "..#", ".#.", ".#.", ".#."],
  "?": ["##.", "..#", ".#.", "...", ".#."],
  " ": ["..", "..", "..", "..", ".."],
};

function glyph(ch) {
  return FONT[ch] ?? FONT[" "];
}

// mask values: 0 = room, 1 = night sky seen through the window, 2 = city / planet behind the glass
const SKY = 1;
const VIEW = 2;

function createLayer() {
  const data = new Uint8ClampedArray(W * H * 4);
  const mask = new Uint8Array(W * H);

  const set = (x, y, color, m = 0) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const [r, g, b] = rgb(color);
    const i = (py * W + px) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
    mask[py * W + px] = m;
  };
  const blend = (x, y, color, alpha) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const [r, g, b] = rgb(color);
    const i = (y * W + x) * 4;
    data[i] += (r - data[i]) * alpha;
    data[i + 1] += (g - data[i + 1]) * alpha;
    data[i + 2] += (b - data[i + 2]) * alpha;
  };
  const rect = (x, y, w, h, color, m = 0) => {
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) set(x + i, y + j, color, m);
  };
  const frame = (x, y, w, h, color) => {
    rect(x, y, w, 1, color);
    rect(x, y + h - 1, w, 1, color);
    rect(x, y, 1, h, color);
    rect(x + w - 1, y, 1, h, color);
  };
  const disc = (cx, cy, r, color, m = 0) => {
    for (let dy = -r; dy <= r; dy += 1)
      for (let dx = -r; dx <= r; dx += 1) if (dx * dx + dy * dy <= r * r + r * 0.6) set(cx + dx, cy + dy, color, m);
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
  const text = (x, y, str, color, scale = 1) => {
    let cx = x;
    for (const ch of str) {
      const rows = glyph(ch);
      rows.forEach((row, j) => {
        [...row].forEach((cell, i) => {
          if (cell === "#") rect(cx + i * scale, y + j * scale, scale, scale, color);
        });
      });
      cx += (rows[0].length + 1) * scale;
    }
  };

  return { data, mask, set, blend, rect, frame, disc, ellipse, line, text };
}

/* ------------------------------------------------------------------ palette */

const SKIN = "#7d8f5a";
const SKIN_DARK = "#6a7a4b";
const SKIN_LINE = "#3a4428";
const KNIT = "#b5832e";
const KNIT_DARK = "#a2742a";
const KNIT_SHADE = "#8f6522";
const KNIT_LINE = "#5e4316";
const KNIT_RIB = "#7e5a1e";
const BRASS = "#b89a4a";
const BRASS_DARK = "#7a6230";
const RED = "#8c2a24";
const INK = "#0d0d0f";
const PAPER = "#d8ccaa";
const PAPER_EDGE = "#a89c7c";
const UP = "#3f7a3a";
const DOWN = "#9c2b23";

/* ------------------------------------------------------------------ the room and the view */

// window opening (the glass area) and the head's position
const WIN = { x0: 39, y0: 13, x1: 121, y1: 79 };

/** One tall glass tower in the city, with a plain dark crown and an antenna mast. */
function paintGlassTower(p) {
  const rand = seeded(91); // its own sequence, so the rest of the scene keeps its old random details
  const x0 = 103;
  const x1 = 117;
  const top = 36;
  // antenna mast in front of the ringed planet
  for (let by = top - 9; by < top - 2; by += 1) p.set(110, by, "#2a2c33", VIEW);
  p.rect(109, top - 3, 3, 3, "#191b23", VIEW);
  // glass shaft: lit side on the left, shadow side on the right, dark frame
  for (let by = top; by <= WIN.y1; by += 1)
    for (let bx = x0; bx <= x1; bx += 1) {
      let color = bx < 110 ? "#1d2232" : "#151925";
      if (bx === x0 || bx === x1) color = "#0b0c11";
      p.set(bx, by, color, VIEW);
    }
  // a plain dark crown band at the top
  p.rect(x0, top, x1 - x0 + 1, 3, "#0b0c11", VIEW);
  // the office works late: rows of warm windows
  for (let wy = top + 5; wy < WIN.y1 - 1; wy += 3)
    for (let wx = x0 + 2; wx < x1 - 1; wx += 2) {
      const roll = rand();
      if (roll > 0.45) p.set(wx, wy, roll > 0.8 ? "#d8b24a" : "#8a7536", VIEW);
    }
}

function paintRoom(p, rand) {
  // wallpaper with faint stripes, and a wooden wainscot
  for (let y = 0; y < 128; y += 1)
    for (let x = 0; x < W; x += 1) p.set(x, y, x % 8 === 0 ? "#35302a" : "#3b3630");
  for (let i = 0; i < 160; i += 1) p.set(Math.floor(rand() * W), Math.floor(rand() * 100), "#403a33");
  p.rect(0, 100, W, 28, "#4a3f33");
  for (let x = 0; x < W; x += 10) p.rect(x, 102, 1, 26, "#41372c");
  p.rect(0, 100, W, 1, "#5e5040");
  p.rect(0, 101, W, 1, "#2e2820");

  // the night outside: dithered sky, stars, a ringed planet and dark city blocks
  const tones = ["#0f1018", "#141622", "#1b1e2c", "#232737"];
  for (let y = WIN.y0; y <= WIN.y1; y += 1)
    for (let x = WIN.x0; x <= WIN.x1; x += 1) {
      const t = (y - WIN.y0) / (WIN.y1 - WIN.y0);
      p.set(x, y, tones[Math.min(3, Math.floor(t * 3.2 + BAYER[y % 4][x % 4] / 16))], SKY);
    }
  for (let i = 0; i < 18; i += 1) {
    const x = WIN.x0 + Math.floor(rand() * (WIN.x1 - WIN.x0));
    const y = WIN.y0 + Math.floor(rand() * 30);
    p.set(x, y, rand() > 0.6 ? "#c9c3a8" : "#6f6c60", SKY);
  }
  const [px, py] = [104, 28];
  const ring = (front, color) => {
    for (let a = 0; a < Math.PI * 2; a += 0.015) {
      if (Math.sin(a) >= 0 !== front) continue;
      p.set(px + Math.cos(a) * 13, py + Math.sin(a) * 3 - Math.cos(a) * 3, color, VIEW);
    }
  };
  ring(false, "#6e6349");
  for (let dy = -7; dy <= 7; dy += 1)
    for (let dx = -7; dx <= 7; dx += 1) {
      if (dx * dx + dy * dy > 52) continue;
      p.set(px + dx, py + dy, dx + dy < -4 ? "#a08c62" : dx + dy > 4 ? "#584a30" : "#7f6d47", VIEW);
    }
  p.set(px - 3, py - 3, "#665839", VIEW);
  p.set(px + 2, py + 2, "#665839", VIEW);
  ring(true, "#b3a37a");

  let x = WIN.x0;
  while (x <= WIN.x1) {
    const w = 5 + Math.floor(rand() * 8);
    const h = 8 + Math.floor(rand() * 20);
    for (let bx = x; bx < Math.min(x + w, WIN.x1 + 1); bx += 1)
      for (let by = WIN.y1 - h; by <= WIN.y1; by += 1) p.set(bx, by, "#14151b", VIEW);
    for (let wy = WIN.y1 - h + 2; wy < WIN.y1 - 1; wy += 3)
      for (let wx = x + 1; wx < Math.min(x + w - 1, WIN.x1); wx += 2)
        if (rand() > 0.84) p.set(wx, wy, rand() > 0.5 ? "#7a6a3a" : "#4f4830", VIEW);
    x += w + Math.floor(rand() * 3);
  }
  // a taller tower with an antenna (its light blinks)
  for (let by = 44; by <= WIN.y1; by += 1) for (let bx = 52; bx <= 58; bx += 1) p.set(bx, by, "#121318", VIEW);
  for (let by = 36; by <= 44; by += 1) p.set(55, by, "#24252a", VIEW);
  paintGlassTower(p);
  // snow piled on the outside of the window
  for (let sx = WIN.x0; sx <= WIN.x1; sx += 1) {
    p.set(sx, WIN.y1, "#bdb9ae", VIEW);
    if (rand() > 0.5) p.set(sx, WIN.y1 - 1, "#bdb9ae", VIEW);
  }

  // window frame, mullions and sill
  const wood = "#6b5a44";
  p.rect(36, 10, 89, 3, wood);
  p.rect(36, 80, 89, 3, wood);
  p.rect(36, 10, 3, 73, wood);
  p.rect(122, 10, 3, 73, wood);
  p.rect(79, WIN.y0, 2, WIN.y1 - WIN.y0 + 1, wood);
  p.rect(WIN.x0, 45, WIN.x1 - WIN.x0 + 1, 2, wood);
  p.rect(39, 13, 83, 1, "#3a3026");
  p.rect(36, 10, 89, 1, "#7a6750");
  p.rect(32, 83, 97, 2, "#7a6750");
  p.rect(32, 85, 97, 2, "#5a4a38");

  // poster with a rising PIZA chart
  p.rect(7, 18, 25, 31, "#2e2820");
  p.rect(8, 19, 23, 29, "#c9bd98");
  p.text(12, 21, "PIZA", DOWN);
  p.line(10, 44, 14, 40, UP);
  p.line(14, 40, 17, 42, UP);
  p.line(17, 42, 22, 34, UP);
  p.line(22, 34, 25, 36, UP);
  p.line(25, 36, 28, 29, UP);
  p.rect(9, 46, 21, 1, PAPER_EDGE);

  // calendar
  p.rect(129, 16, 25, 31, "#2e2820");
  p.rect(130, 17, 23, 29, PAPER);
  p.rect(130, 17, 23, 7, RED);
  p.text(133, 18, "WEEK", PAPER);
  p.text(138, 27, "7", INK, 2);
  for (let gx = 132; gx < 152; gx += 3) p.set(gx, 42, PAPER_EDGE);
  p.set(151, 17, "#cfccc2");
}

function paintAlien(p) {
  // a chunky mustard sweater with a stock chart knitted across the chest
  for (let y = 103; y <= 127; y += 1) {
    const hw = y === 103 ? 11 : y === 104 ? 15 : y === 105 ? 17 : Math.round(18 + (y - 106) * 0.78);
    for (let x = 80 - hw; x <= 80 + hw; x += 1) {
      const edge = x - (80 - hw) < 1 || 80 + hw - x < 1;
      let color = x % 2 === 0 ? KNIT : KNIT_DARK; // knitted columns
      if (x > 80 + hw - 7) color = KNIT_SHADE;
      if (edge) color = KNIT_LINE;
      p.set(x, y, color);
    }
  }
  // knitted chart band
  for (let y = 110; y <= 116; y += 1)
    for (let x = 62; x <= 98; x += 1) {
      const bandHw = Math.round(18 + (y - 106) * 0.78);
      const edge = 80 + bandHw - x < 1 || x - (80 - bandHw) < 1;
      if (!edge) p.set(x, y, y === 110 || y === 116 ? KNIT_RIB : "#e6dcbf");
    }
  const knitChart = [
    [63, 115],
    [67, 113],
    [70, 114],
    [74, 112],
    [78, 113],
    [82, 111],
    [86, 112],
    [90, 111],
    [94, 114],
    [97, 115],
  ];
  knitChart.forEach(([kx, ky], i) => {
    if (i > 0) p.line(knitChart[i - 1][0], knitChart[i - 1][1], kx, ky, i >= knitChart.length - 2 ? DOWN : UP);
  });

  // upper sleeves: the left one goes down to the elbow on the desk, the right one to the desk
  p.line(62, 107, 52, 126, KNIT_LINE, 7);
  p.line(62, 107, 52, 126, KNIT, 5);
  p.line(98, 107, 118, 127, KNIT_LINE, 7);
  p.line(98, 107, 118, 127, KNIT_SHADE, 5);

  // neck and head
  p.rect(76, 97, 9, 7, "#56643c");
  // ribbed crew neck of the sweater
  for (let x = 73; x <= 87; x += 1) p.set(x, 103, x % 2 ? KNIT_RIB : KNIT_LINE);
  for (let x = 73; x <= 87; x += 1) if (Math.abs(x - 80) >= 4) p.set(x, 102, x % 2 ? KNIT_RIB : KNIT_LINE);
  for (let x = 74; x <= 86; x += 1) if (Math.abs(x - 80) >= 5) p.set(x, 101, x % 2 ? KNIT_RIB : KNIT_LINE);
  p.ellipse(80, 82, 11, 9, SKIN_LINE);
  p.ellipse(80, 89, 12, 11, SKIN_LINE);
  p.ellipse(80, 82, 10, 8, SKIN);
  p.ellipse(80, 89, 11, 10, SKIN);
  for (let y = 80; y <= 99; y += 1)
    for (let x = 87; x <= 91; x += 1) {
      const i = (y * W + x) * 4;
      if (x + (99 - y) * 0.1 > 88.5 && p.data[i] === 125 && p.data[i + 1] === 143) p.set(x, y, SKIN_DARK);
    }
  for (const [ex, ey] of [[68, 88], [67, 87], [66, 86], [68, 87], [67, 86]]) p.set(ex, ey, SKIN);
  for (const [ex, ey] of [[92, 88], [93, 87], [94, 86], [92, 87], [93, 86]]) p.set(ex, ey, SKIN_DARK);
  p.set(65, 85, SKIN_LINE);
  p.set(95, 85, SKIN_LINE);
  // nose, tusks, scar and tired eye bags (eyes, brows and mouth are animated)
  p.set(80, 90, SKIN_DARK);
  p.set(80, 91, SKIN_DARK);
  p.set(79, 92, SKIN_LINE);
  p.set(81, 92, SKIN_LINE);
  for (const [tx, ty] of [[76, 94], [76, 93], [84, 94], [84, 93]]) p.set(tx, ty, "#d8d4c0");
  for (const [sx, sy] of [[71, 90], [72, 91], [73, 92], [74, 93]]) p.set(sx, sy, "#4a3a2a");
  p.rect(73, 89, 4, 1, SKIN_DARK);
  p.rect(84, 89, 4, 1, SKIN_DARK);

  // the huge near-black afro (stops at a wavy hairline above the brows)
  const hairRand = seeded(31);
  const [afroX, afroY, afroRx, afroRy] = [80, 74, 20, 13];
  const bump = (a) => 0.97 + 0.11 * Math.abs(Math.sin(5 * a)) + 0.03 * Math.sin(13 * a + 1);
  const onFace = (x, y) => ((x - 80) / 12) ** 2 + ((y - 89) / 11) ** 2 <= 1;
  for (let y = afroY - afroRy - 2; y <= afroY + afroRy + 1; y += 1)
    for (let x = afroX - afroRx - 3; x <= afroX + afroRx + 3; x += 1) {
      const dx = (x - afroX) / afroRx;
      const dy = (y - afroY) / afroRy;
      const r = Math.hypot(dx, dy);
      const edge = bump(Math.atan2(dy, dx));
      if (r > edge) continue;
      if (y > 81 + (x % 4 === 0 ? 1 : 0) && onFace(x, y)) continue;
      let color = "#120d0a";
      const roll = hairRand();
      if (r > edge - 0.08) color = "#050302";
      else if (x - afroX + (y - afroY) * 1.6 < -14 && roll > 0.6) color = "#3a2b1f";
      else if (roll > 0.91) color = "#2a1f17";
      else if (roll < 0.08) color = "#080605";
      p.set(x, y, color);
    }
  // afro pick, a spare pencil and a lost coin
  p.line(69, 66, 65, 60, "#c0392b", 2);
  p.rect(63, 59, 4, 2, "#e0503a");
  for (const [tx, ty] of [[70, 68], [71, 67], [71, 69]]) p.set(tx, ty, "#d8d4c0");
  p.line(91, 70, 97, 64, "#e0b23a", 2);
  p.rect(98, 62, 2, 2, "#9aa0a6");
  p.rect(99, 60, 2, 2, "#d9808a");
  p.disc(85, 64, 2, "#8a6a2a");
  p.rect(84, 63, 2, 2, "#e0c060");
  p.set(86, 65, "#c9a54a");
}

// cinnamon roll seen from above at an angle: golden top with the dark cinnamon spiral, baked edge below
const CINNAMON_ROLL = [
  "...ooooooo...",
  ".oohhhhhhhoo.",
  "ohhhcccccgggo",
  "ohhcgggggcggo",
  "ohcggccccgcgo",
  "ogcgcghgggcgo",
  "ogcggcccggcgo",
  "oggcgggggggco",
  "osggcccccggso",
  "ossggggggggso",
  "osssssssssdso",
  ".odddddddddo.",
  "..ooooooooo..",
];
const CINNAMON_COLORS = {
  o: "#3e200e",
  h: "#e8b870",
  g: "#d39a52",
  c: "#5c2c10",
  s: "#9a5a28",
  d: "#6e3c18",
};

function paintDesk(p, rand) {
  // a banker's desk: walnut frame, green leather writing surface with gold tooling, brass trim
  const walnut = "#4a2c1a";
  p.rect(0, 128, W, 24, walnut);
  p.rect(0, 128, W, 1, "#6b4a2e");
  p.rect(5, 131, 150, 18, "#2f5a3e");
  for (let i = 0; i < 140; i += 1) {
    p.set(5 + Math.floor(rand() * 150), 131 + Math.floor(rand() * 18), rand() > 0.5 ? "#2a5238" : "#356446");
  }
  for (let x = 7; x <= 152; x += 1) {
    if (x % 2 === 0) {
      p.set(x, 133, BRASS);
      p.set(x, 147, BRASS);
    }
  }
  for (let y = 133; y <= 147; y += 1) {
    if (y % 2 === 1) {
      p.set(7, y, BRASS);
      p.set(152, y, BRASS);
    }
  }
  p.rect(0, 150, W, 2, BRASS);
  p.rect(0, 151, W, 1, BRASS_DARK);
  p.rect(0, 152, W, 1, "#1e120a");

  // carved front panels and a brass nameplate
  p.rect(0, 153, W, 37, "#3e2416");
  for (let i = 0; i < 90; i += 1) p.set(Math.floor(rand() * W), 154 + Math.floor(rand() * 35), "#35200f");
  for (const px of [6, 100]) {
    p.frame(px, 158, 54, 26, "#24150b");
    p.frame(px + 1, 159, 52, 24, "#56351f");
    p.frame(px + 4, 162, 46, 18, "#24150b");
  }
  p.rect(62, 160, 36, 12, BRASS_DARK);
  p.rect(63, 161, 34, 10, BRASS);
  p.rect(63, 161, 34, 1, "#e0c878");
  p.text(64, 164, "INVESTOR", "#3e2a10");

  // green banker's lamp
  p.rect(12, 141, 18, 5, BRASS_DARK);
  p.rect(13, 141, 16, 1, "#e0c878");
  p.rect(20, 110, 2, 31, BRASS);
  p.rect(22, 110, 1, 31, BRASS_DARK);
  p.rect(6, 100, 30, 9, "#1f5a36");
  p.rect(7, 99, 28, 1, "#2f7a4a");
  p.rect(7, 101, 28, 1, "#5fae6a");
  p.rect(6, 108, 30, 1, BRASS);
  p.rect(8, 109, 26, 1, "#ffe9a0");
  p.rect(28, 106, 1, 6, BRASS_DARK);
  p.set(28, 112, BRASS);

  // a small pocket calculator
  p.rect(31, 139, 10, 11, "#2e2e2c");
  p.rect(32, 140, 8, 3, "#9cb070");
  p.rect(36, 141, 1, 1, "#3d4a2a");
  p.rect(38, 141, 1, 1, "#3d4a2a");
  for (let by = 144; by <= 148; by += 2) for (let bx = 32; bx <= 38; bx += 3) p.rect(bx, by, 2, 1, "#8a8a84");

  // a cinnamon roll on a little plate: the late-night snack
  p.ellipse(49, 148, 8, 1, "#8f8a7c");
  p.rect(42, 147, 15, 1, "#d8d4c8");
  CINNAMON_ROLL.forEach((row, j) =>
    [...row].forEach((cell, i) => {
      if (CINNAMON_COLORS[cell]) p.set(43 + i, 135 + j, CINNAMON_COLORS[cell]);
    }),
  );

  // stock sheet: three tickers with arrows
  p.rect(57, 130, 25, 22, PAPER_EDGE);
  p.rect(58, 131, 23, 20, PAPER);
  const rows = [
    ["PIZA", UP, true],
    ["KRMZ", DOWN, false],
    ["KBAB", UP, true],
  ];
  rows.forEach(([ticker, color, up], i) => {
    const y = 133 + i * 6;
    p.text(60, y, ticker, "#3a352c");
    if (up) {
      p.set(77, y + 1, color);
      p.rect(76, y + 2, 3, 1, color);
    } else {
      p.rect(76, y + 1, 3, 1, color);
      p.set(77, y + 2, color);
    }
    p.rect(60, y + 5, 19, 1, "#c9bd98");
  });

  // chart sheet: up, up... and down
  p.rect(84, 129, 25, 21, PAPER_EDGE);
  p.rect(85, 130, 23, 19, PAPER);
  p.rect(87, 132, 1, 15, "#6b6450");
  p.rect(87, 146, 19, 1, "#6b6450");
  const chart = [
    [88, 144],
    [91, 141],
    [94, 142],
    [97, 137],
    [100, 138],
    [103, 133],
    [106, 141],
  ];
  chart.forEach(([cx, cy], i) => {
    if (i > 0) p.line(chart[i - 1][0], chart[i - 1][1], cx, cy, i === chart.length - 1 ? DOWN : UP);
  });

  // sticky note with a question mark
  p.rect(110, 140, 11, 10, "#d9c95a");
  p.rect(110, 140, 11, 1, "#e8dc78");
  p.text(114, 142, "?", DOWN);

  // coffee mug (the steam is animated)
  p.rect(129, 136, 9, 10, "#2e2820");
  p.rect(130, 137, 7, 8, "#d8d4c0");
  p.rect(130, 137, 7, 1, "#5a3a22");
  p.frame(138, 139, 3, 4, "#d8d4c0");
  p.rect(131, 141, 5, 2, RED);

  // right forearm resting on the chart sheet, sweater sleeve pushed up
  p.rect(115, 126, 8, 6, KNIT_SHADE);
  for (let x = 115; x < 123; x += 2) p.rect(x, 126, 1, 6, KNIT_RIB);
  p.rect(115, 131, 8, 1, KNIT_LINE);
  p.line(118, 132, 106, 145, SKIN_LINE, 6);
  p.line(118, 132, 106, 145, SKIN, 4);
  p.rect(102, 143, 6, 5, SKIN);
  p.rect(102, 147, 6, 1, SKIN_LINE);
  p.set(103, 145, SKIN_DARK);
  p.set(105, 145, SKIN_DARK);
}

const STATIC = (() => {
  const p = createLayer();
  const rand = seeded(7);
  paintRoom(p, rand);
  paintAlien(p);
  paintDesk(p, rand);
  return p;
})();

/* ------------------------------------------------------------------ animation */

const LOOP = 64; // frames: 48 of rubbing the pen on the forehead, then 16 of staring at the sheets
const RUB = [0, 1, 2, 3, 4, 3, 2, 1];

function makeFlakes() {
  const rand = seeded(23);
  return Array.from({ length: 45 }, () => ({
    x: WIN.x0 + rand() * (WIN.x1 - WIN.x0),
    y: rand() * H,
    speed: 0.4 + rand() * 0.8,
    phase: rand() * 10,
    near: rand() > 0.5,
  }));
}

function paintFace(target, thinking, blink) {
  const brow = "#1e1a14";
  if (blink) {
    target.rect(73, 88, 4, 1, SKIN_LINE);
    target.rect(84, 88, 4, 1, SKIN_LINE);
  } else {
    target.rect(73, 87, 4, 2, "#d8d4c0");
    target.rect(84, 87, 4, 2, "#d8d4c0");
    if (thinking) {
      // eyes rolled up and to the side, one brow raised
      target.set(73, 87, INK);
      target.set(84, 87, INK);
    } else {
      // reading the sheets
      target.set(75, 88, INK);
      target.set(86, 88, INK);
    }
  }
  if (thinking) {
    target.rect(72, 84, 5, 1, brow);
    target.set(71, 85, brow);
    for (const [bx, by] of [[83, 86], [84, 85], [85, 85], [86, 85], [87, 84]]) target.set(bx, by, brow);
    for (const [mx, my] of [[76, 95], [77, 96], [78, 96], [79, 95], [80, 95], [81, 96], [82, 96], [83, 95]])
      target.set(mx, my, "#2a1a14");
  } else {
    target.rect(72, 85, 5, 1, brow);
    target.rect(83, 85, 5, 1, brow);
    target.rect(77, 95, 7, 1, "#2a1a14");
  }
}

function paintThinkingArm(target, offset) {
  // elbow on the desk, the hand at the temple, the pen's end rubbing the forehead
  const hx = 60 + offset;
  const hy = 88;
  target.rect(48, 121, 9, 6, KNIT_SHADE);
  for (let x = 48; x < 57; x += 2) target.rect(x, 121, 1, 6, KNIT_RIB);
  target.rect(48, 126, 9, 1, KNIT_LINE);
  target.line(52, 125, hx - 1, hy + 3, SKIN_LINE, 6);
  target.line(52, 125, hx - 1, hy + 3, SKIN, 4);
  // a cream pen with a blue cap: the cap end rubs the forehead
  target.line(hx + 1, hy - 1, hx + 12, hy - 5, "#2a2620", 3);
  target.line(hx + 1, hy - 1, hx + 12, hy - 5, "#ece6d2", 2);
  target.rect(hx + 10, hy - 6, 3, 2, "#3a5aa8");
  target.set(hx + 2, hy - 1, "#2a2620");
  target.rect(hx - 3, hy - 2, 6, 6, SKIN_LINE);
  target.rect(hx - 2, hy - 1, 4, 4, SKIN);
  target.set(hx + 1, hy, SKIN_DARK);
  target.set(hx + 1, hy + 2, SKIN_DARK);
}

function paintThought(target) {
  const cloud = "#e6e0cc";
  target.disc(103, 62, 1, cloud);
  target.disc(105, 59, 1, cloud);
  target.ellipse(110, 52, 6, 5, "#2e2820");
  target.ellipse(110, 52, 5, 4, cloud);
  target.text(109, 50, "?", DOWN);
}

function paintLampLight(target) {
  // warm cone from the banker's lamp onto the desk
  for (let y = 109; y < 160; y += 1) {
    const center = 21 + (y - 109) * 1.0;
    const half = 5 + (y - 109) * 0.8;
    for (let x = Math.floor(center - half); x <= center + half; x += 1) {
      if (x < 0 || x >= W) continue;
      const fall = 1 - Math.abs(x - center) / half;
      const onDesk = y >= 128 ? 1 : 0.55;
      target.blend(x, y, "#f2c46a", (0.06 + 0.14 * fall) * onDesk);
    }
  }
}

function paintFrame(target, frame, flakes, moving) {
  target.data.set(STATIC.data);
  const t = frame % LOOP;
  const thinking = t < 48;

  // a faint searchlight sweeping the sky outside
  const theta = -0.78 + 0.22 * Math.sin(frame * 0.04);
  for (let y = WIN.y0; y <= WIN.y1; y += 1)
    for (let x = WIN.x0; x <= WIN.x1; x += 1) {
      if (STATIC.mask[y * W + x] !== SKY) continue;
      const d = Math.abs(Math.atan2(y - 110, x + 30) - theta);
      if (d < 0.06) target.blend(x, y, "#d8d2b8", 0.04 + 0.1 * (1 - d / 0.06));
    }
  // blinking antenna light
  target.set(55, 35, Math.floor(frame / 5) % 2 === 0 ? "#e0503a" : "#4a1d17");

  // the alien: thinking with the pen, or staring at the sheets. The face goes first so the hand and the pen
  // rubbing the forehead stay in front of the raised eyebrow (the brow used to be drawn over the pen).
  paintFace(target, thinking, t === 52 || t === 53);
  paintThinkingArm(target, thinking ? RUB[t % RUB.length] : 2);
  if (thinking && t >= 12 && Math.floor(t / 6) % 4 !== 3) paintThought(target);

  paintLampLight(target);

  // steam from the coffee
  for (let i = 0; i < 2; i += 1)
    for (let y = 124; y < 136; y += 1) {
      const x = 131 + i * 4 + Math.round(Math.sin((y + frame) * 0.7 + i * 2) * 1.2);
      target.blend(x, y, "#d8d4c8", 0.12 + ((y - 124) / 12) * 0.3);
    }

  // snow, only where the window shows the night
  for (const flake of flakes) {
    if (moving) {
      flake.y += flake.speed;
      flake.x += Math.sin((flake.y + flake.phase) * 0.12) * 0.25;
      if (flake.y >= WIN.y1 + 1) {
        flake.y = WIN.y0;
        flake.x = WIN.x0 + ((flake.x - WIN.x0 + 29) % (WIN.x1 - WIN.x0));
      }
    }
    const fx = Math.round(flake.x);
    const fy = Math.round(flake.y);
    if (fx < 0 || fy < 0 || fx >= W || fy >= H || !STATIC.mask[fy * W + fx]) continue;
    target.set(fx, fy, flake.near ? "#d9d6cc" : "#8f8c83");
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
      aria-label="Pixel-art night scene: in a small room, a green alien with a huge afro, in a mustard sweater with a stock chart knitted on it, sits at a green-leather banker's desk covered in stock sheets and charts, rubbing a pen against his forehead while he thinks. A green banker's lamp, a small calculator, a cinnamon roll on a plate, a sticky note with a question mark and a steaming coffee mug sit on the desk; through the window, snow falls on a dark city under a ringed planet, where a tall glass tower glows with rows of lit office windows."
    />
  );
}
