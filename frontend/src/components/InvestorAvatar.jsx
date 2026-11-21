/**
 * Original 24x24 pixel-art investor, side profile: an eyeless, glossy black
 * biomechanical alien with a long ribbed skull, a mouthful of teeth and a drop of
 * acid-green drool, on a ribbed carapace torso.
 * One character per pixel; "." is transparent.
 */
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
  K: "#07090a", // outline
  B: "#262c31", // carapace
  b: "#46525a", // carapace sheen
  g: "#8fa0a8", // gloss highlight
  d: "#121619", // ribs
  T: "#e6e0c6", // teeth
  M: "#4a1010", // mouth
  S: "#9bd14a", // acid drool
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
