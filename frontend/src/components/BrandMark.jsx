/**
 * CosmiCash emblem (original 32x32 pixel art): an alien claw rising from below and
 * crushing a banknote, talons hooked into the paper. One character per pixel.
 */
const ROWS = [
  "................................",
  "...KKKK..................KKKK...",
  "..KLLLLKKK............KKKLLLLK..",
  "...KLNnLLLKKKKKnsKKKKKLLLnNLK...",
  "....KLNnNNLLLnnssssLLLNNnNLK....",
  ".....KLNnNNNNnsmsmnNNNNnNLK.....",
  ".....KLNNnNNnmmsssmnNNnNNLK.....",
  "....KLNNKKNNnmmmsmsnNNKKNNLK....",
  "...KLNNKWWKNNnssssnNNKWWKNNLK...",
  "..KLLNKWKKwKNnnKKnnNKwKKWKNLLK..",
  "...KKLKWKNKNNNKWwKNNNKNKWKLKK...",
  ".....KKKKKNNNNKWKNNNNNKKKKK.....",
  "....KKKgBKnnnKKKKKKnnnKgBK......",
  "...KWwBBKnnnnKgBBBKnnnnKBBK.....",
  "..KWKKbBKnnnnKbBBBKnnnnKbBK.....",
  "..KWKKBdKnnnnKBddBKnnnnKddK.....",
  "..KKKBbBKnnnnKbBBBKnnnnKbBK.....",
  ".KgBBBbBKnnnnKbBBBKnnnnKbBK.....",
  ".KbBBBBBKKKKKKBBBBKKKKKKBBK.....",
  ".KBddBBBBKKKKBBBBBBKKKKBBBBK....",
  ".KbBBBBBBBBBBBBBBBBBBBBBBBBK....",
  ".KBBBBBBBBBBBBBBBBBBBBBBBBBK....",
  ".KKKBBBBBdBBBBBBdBBBBBdBBBBK....",
  "....KBBBBBBBBBBBBBBBBBBBBBBK....",
  "....KKKKKKBbBBBBBBBBBBKKKKKK....",
  "..........KbdddBdddBdK..........",
  "..........KbBBBBBBBBBK..........",
  "..........KddBdddBdddK..........",
  "..........KbBBBBBBBBBK..........",
  "..........KbdddBdddBdK..........",
  "..........KbBBBBBBBBBK..........",
  "..........KKKKKKKKKKKK..........",
];

const COLORS = {
  K: "#07090a", // outline
  B: "#262c31", // carapace
  b: "#46525a", // sheen
  g: "#8fa0a8", // gloss
  d: "#121619", // ribs / joints
  W: "#e6e0c6", // talons
  w: "#a89f80", // talon tips
  N: "#7cb563", // banknote
  n: "#3f6e34", // folds / shadow
  L: "#c9e6a8", // paper edge
  m: "#d6ecbd", // medallion
  s: "#1f3a1b", // $ sign
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
