const ROWS = [
  "KKKK....................",
  "KgbbKK..................",
  "KbgbbbKK................",
  ".KBBgbbbKK..............",
  ".KBdBBgbbbKK............",
  "..KBBdBBBgbbKK..........",
  "..KBdBBdBBBBgbKK........",
  "...KBBdBBdBBBBgbKK......",
  "...KBBBdBBdBBBBBgbKK....",
  "....KBBBdBBdBBBBBBBbKK..",
  "....KBBBBdBBBBBBBBBBBbK.",
  ".....KBBBBBBBBBBBBBBBBBK",
  ".....KBBBBBBBKKKKKKKKKKK",
  "......KBBBBBKTKTKTKTKTK.",
  "......KBBBBKMMMMMSMMMMK.",
  ".......KBBBKTKTKTKTKSK..",
  ".......KBBBBKBBBBBBKS...",
  "........KBBBBKKKKKKK....",
  "........KBdBK.......S...",
  ".....KKBBdBdBBKK........",
  "...KKbBBdBBBdBBbKK......",
  "..KbgBdBBdBdBBdBgbK.....",
  ".KbBBdBBdBBBdBBdBBbK....",
  "KBBdBBdBBdBdBBdBBdBBK...",
];

const COLORS = {
  K: "#07090a",
  B: "#262c31",
  b: "#46525a",
  g: "#8fa0a8",
  d: "#121619",
  T: "#e6e0c6",
  M: "#4a1010",
  S: "#9bd14a",
};

const PIXELS = ROWS.flatMap((row, y) =>
  [...row].map((code, x) => ({ x, y, code })).filter((p) => COLORS[p.code]),
);

export default function InvestorAvatar({ size = 72, className = "" }) {
  return (
    <svg
      className={`investor-avatar ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Agent Vorr, an eyeless black alien advisor with a long ribbed skull"
    >
      {PIXELS.map((p) => (
        <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width="1" height="1" fill={COLORS[p.code]} />
      ))}
    </svg>
  );
}
