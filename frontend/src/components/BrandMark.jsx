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
  K: "#0b0c0a",
  G: "#6fc23f",
  g: "#3d7a24",
  h: "#b3ec78",
  s: "#2f6a1b",
  C: "#f4ecd2",
  c: "#b9ad86",
  k: "#5a5040",
  Y: "#f4b23e",
  y: "#c98a1d",
  o: "#8a5a12",
  L: "#ffe39a",
  W: "#fff8e0",
  D: "#4d2c06",
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
