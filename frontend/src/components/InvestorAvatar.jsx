/**
 * Original 24x24 pixel-art investor: a blue three-spiked alien with black goggles,
 * a toothy grin and the Galactic Exchange paper collar + red tie.
 * Each row lists the left half; the right half is its mirror image.
 */
const LEFT_HALF = [
  "......K....K",
  "......KK..KL",
  "......KBK.KB",
  ".....KBBBKBB",
  "....KBBLLBBB",
  "...KBBLLBBBB",
  "...KBLBBBBBB",
  "..KBBBBBBBBB",
  "..KBKKKKKKKB",
  "..KKVVVVVVVK",
  "..KVWWVVVVVK",
  "..KVWVVVVVVK",
  "..KKVVVVVVVK",
  "..KBKKKKKKKB",
  "..KBBBBBBBBB",
  "..KBBKKKKKKK",
  "..KBBKWKWKWK",
  "...KBBKKKKKK",
  "....KDBBBBBB",
  ".....KKDDDDD",
  "........KBBB",
  "........KDBB",
  "......KKCCCT",
  ".....KCCCCCT",
];

const COLORS = {
  K: "#111111", // outline
  B: "#4f7bb0", // skin
  L: "#9cc6ec", // highlight
  D: "#335a86", // shadow
  V: "#0a0a08", // goggles
  W: "#f4f1e6", // glint / teeth
  C: "#efe7d0", // paper collar
  T: "#b5302a", // tie
};

const PIXELS = LEFT_HALF.flatMap((half, y) => {
  const row = half + [...half].reverse().join("");
  return [...row].map((code, x) => ({ x, y, code })).filter((p) => COLORS[p.code]);
});

export default function InvestorAvatar({ size = 72, className = "" }) {
  return (
    <svg
      className={`investor-avatar ${className}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Agent Gloop, a blue alien advisor with black goggles"
    >
      {PIXELS.map((p) => (
        <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width="1" height="1" fill={COLORS[p.code]} />
      ))}
    </svg>
  );
}
