/**
 * CosmiCash emblem (original 32x32 pixel art): a green three-fingered alien claw reaching in from the
 * lower right and snatching a gold "$" coin - ivory talons hooked into the coin's rim. One character per pixel.
 */
const ROWS = [
  "................................",
  "................................",
  "................................",
  ".........KKKKKKKK...............",
  ".......KKyyyyyyyyKKKKKK.........",
  "......KyyYYYYYYYKCCCCCCK........",
  ".....KyyYWYLLYYKCccccCCKK.......",
  "....KyyWWLLLYYYKkKKKKcchgK......",
  "....KyYWLLLYDYYYKYyYoKhGgKKK....",
  "...KyYYLLLDDDDDYYYYyYKhCCCCCK...",
  "...KyYYLLDDYDYYYYYYyYKhCCcCCCKK.",
  "...KyYLLYDDYDYYYYYYYyKCccGccchgK",
  "...KyYLYYYDDDDYYYYYyyKksGgKKhGgK",
  "...KyYYYYYYDDDDYYYyyyKhGGgKKhGgK",
  "...KyYYYYYYYDYDDYyyyyKhGGgKhGGgK",
  "...KyYYYYYYYDYDDyyyyKhGGGgKhsGgK",
  "...KyYYYYYKDDDDyyyyyKhGGgKhGGGgK",
  "....KyYYYKkKDYyyyyyyKhGGGhGGGgK.",
  "....KyyYyKCKYyyyyyyKhGGGGGGGgK..",
  ".....KyyKCCKyyyyyyKhGGGGGGGgK...",
  "......KoKCCKyyyyyKhGGsGGGGGgK...",
  ".......KKCCKooooKKhGGGGGGGgKK...",
  "........KcCCKKKKhhGGGGGGsGGhgK..",
  ".........KcchhhhGGGGGGGGGGGGGgK.",
  "..........KhGGGsGGggGGsGGGGGGGgK",
  "..........KgggggggKKggGGGGGGsGGg",
  "...........KKKKKKK..KKhGGGGGGGGg",
  ".....................KhGsGsGGGGg",
  ".....................KgGGGGGGsGg",
  "......................KgGGGsGGGg",
  ".......................KgGGGGGGg",
  "........................Kggggggg",
];

const COLORS = {
  K: "#0b0c0a", // outline
  G: "#6fc23f", // alien skin
  g: "#3d7a24", // skin shadow
  h: "#b3ec78", // skin highlight
  s: "#2f6a1b", // scales and knuckles
  C: "#f4ecd2", // talons
  c: "#b9ad86", // talon shade
  k: "#5a5040", // talon tips
  Y: "#f4b23e", // gold
  y: "#c98a1d", // gold shade
  o: "#8a5a12", // rim shadow
  L: "#ffe39a", // gold light
  W: "#fff8e0", // shine
  D: "#4d2c06", // $ sign
};

const PIXELS = ROWS.flatMap((row, y) =>
  [...row].map((code, x) => ({ x, y, code })).filter((p) => COLORS[p.code]),
);

export default function BrandMark({ className = "brand__mark" }) {
  return (
    <svg className={className} viewBox="0 0 32 32" shapeRendering="crispEdges" aria-hidden="true">
      {PIXELS.map((p) => (
        <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width="1" height="1" fill={COLORS[p.code]} />
      ))}
    </svg>
  );
}
