const INK = "#111";

// Deterministic "random" starfield so the picture is identical on every load.
const STARS = (() => {
  let seed = 11;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: 70 }, () => ({
    x: rand() * 640,
    y: rand() * 540,
    r: 0.8 + rand() * 2.2,
    o: 0.35 + rand() * 0.65,
  }));
})();

/**
 * Original, deliberately crude doodle: Booth 7 of the Galactic Exchange.
 * A three-eyed clerk with a rubber stamp serves a grandma astronaut holding $100.
 * The wobble filter makes every line look hand-drawn with a mouse.
 */
export default function HeroIllustration() {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 640 760"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label="A three-eyed alien clerk with a rubber stamp greets a grandmother astronaut holding a 100 dollar bill at a space-station exchange booth."
    >
      <defs>
        <filter id="hero-wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="7" />
        </filter>
      </defs>

      <rect width="640" height="760" fill="#0e1020" />
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff6dc" opacity={s.o} />
      ))}

      <g className="crude" filter="url(#hero-wobble)">
        {/* planet with a ring */}
        <circle cx="510" cy="200" r="105" fill="#e046c8" stroke={INK} strokeWidth="6" />
        <ellipse cx="470" cy="170" rx="22" ry="14" fill="#b8329f" />
        <ellipse cx="545" cy="240" rx="16" ry="10" fill="#b8329f" />
        <ellipse cx="500" cy="262" rx="10" ry="7" fill="#b8329f" />
        <ellipse
          cx="510"
          cy="205"
          rx="175"
          ry="36"
          transform="rotate(-14 510 205)"
          fill="none"
          stroke={INK}
          strokeWidth="20"
        />
        <ellipse
          cx="510"
          cy="205"
          rx="175"
          ry="36"
          transform="rotate(-14 510 205)"
          fill="none"
          stroke="#7bd34a"
          strokeWidth="10"
        />

        {/* grumpy moon */}
        <circle cx="330" cy="92" r="36" fill="#f4b23e" stroke={INK} strokeWidth="5" />
        <circle cx="348" cy="112" r="6" fill="#d8962a" />
        <circle cx="312" cy="72" r="4" fill="#d8962a" />
        <path d="M314 84 L327 89" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M336 89 L349 84" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <circle cx="321" cy="95" r="3.5" fill={INK} />
        <circle cx="343" cy="95" r="3.5" fill={INK} />
        <path d="M318 110 L343 106" stroke={INK} strokeWidth="4" strokeLinecap="round" />

        {/* rocket */}
        <g transform="translate(108 128) rotate(38)">
          <path d="M-12 42 L-6 72 L0 52 L6 78 L12 42 Z" fill="#f4b23e" stroke={INK} strokeWidth="4" />
          <polygon points="-18,18 -36,48 -18,42" fill="#b5302a" stroke={INK} strokeWidth="4" />
          <polygon points="18,18 36,48 18,42" fill="#b5302a" stroke={INK} strokeWidth="4" />
          <path d="M0 -52 Q24 -20 18 42 L-18 42 Q-24 -20 0 -52 Z" fill="#e8e2d0" stroke={INK} strokeWidth="5" />
          <path d="M0 -52 Q13 -36 14 -24 L-14 -24 Q-13 -36 0 -52 Z" fill="#b5302a" stroke={INK} strokeWidth="4" />
          <circle cx="0" cy="-2" r="9" fill="#5aa2dd" stroke={INK} strokeWidth="4" />
        </g>

        {/* ---------- the clerk ---------- */}
        <path d="M150 560 L160 470 Q166 440 230 436 Q294 440 300 470 L310 560 Z" fill="#4a6a9e" stroke={INK} strokeWidth="6" />
        <polygon points="220,440 240,440 237,500 230,514 223,500" fill="#b5302a" stroke={INK} strokeWidth="4" />
        <ellipse cx="230" cy="382" rx="70" ry="60" fill="#7bd34a" stroke={INK} strokeWidth="6" />
        <path d="M164 354 Q170 300 232 296 Q296 300 300 354 Z" fill="#24305a" stroke={INK} strokeWidth="6" />
        <path d="M150 352 L314 352 L300 370 L164 370 Z" fill="#1a223f" stroke={INK} strokeWidth="5" />
        <circle cx="232" cy="324" r="12" fill="#f4b23e" stroke={INK} strokeWidth="3" />
        <circle cx="200" cy="386" r="15" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="232" cy="376" r="17" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="264" cy="386" r="14" fill="#fff" stroke={INK} strokeWidth="4" />
        <circle cx="206" cy="388" r="6" fill={INK} />
        <circle cx="239" cy="378" r="7" fill={INK} />
        <circle cx="270" cy="388" r="5.5" fill={INK} />
        <path d="M204 420 Q232 434 262 414" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <rect x="226" y="424" width="10" height="9" fill="#fff" stroke={INK} strokeWidth="3" />

        {/* arm raising the rubber stamp */}
        <path d="M290 474 Q338 446 352 366" fill="none" stroke={INK} strokeWidth="34" strokeLinecap="round" />
        <path d="M290 474 Q338 446 352 366" fill="none" stroke="#4a6a9e" strokeWidth="22" strokeLinecap="round" />
        <rect x="340" y="318" width="24" height="64" rx="8" fill="#8a5a2b" stroke={INK} strokeWidth="5" />
        <circle cx="352" cy="314" r="16" fill="#6b3f1c" stroke={INK} strokeWidth="5" />
        <rect x="320" y="380" width="64" height="20" fill="#3a3a3a" stroke={INK} strokeWidth="5" />
        <circle cx="352" cy="360" r="16" fill="#7bd34a" stroke={INK} strokeWidth="5" />

        {/* booth counter */}
        <rect x="-10" y="556" width="660" height="220" fill="#3b3a30" stroke={INK} strokeWidth="6" />
        <rect x="-10" y="546" width="660" height="20" fill="#57553f" stroke={INK} strokeWidth="6" />

        {/* stamped document pinned to the counter */}
        <g transform="translate(36 600) rotate(-5)">
          <rect width="180" height="118" fill="#e6dcbf" stroke={INK} strokeWidth="5" />
          <rect x="16" y="18" width="110" height="7" fill="#b9ad86" />
          <rect x="16" y="34" width="140" height="7" fill="#b9ad86" />
          <rect x="16" y="50" width="90" height="7" fill="#b9ad86" />
          <circle cx="90" cy="-2" r="7" fill="#b5302a" stroke={INK} strokeWidth="3" />
        </g>

        {/* "BOOTH 7" plate */}
        <rect x="232" y="608" width="112" height="44" fill="#e6dcbf" stroke={INK} strokeWidth="5" />

        {/* ---------- grandma astronaut ---------- */}
        <circle cx="480" cy="414" r="24" fill="#d9d6cf" stroke={INK} strokeWidth="5" />
        <path d="M358 760 L364 642 Q372 584 480 574 Q588 584 596 642 L602 760 Z" fill="#e8e2d0" stroke={INK} strokeWidth="6" />
        <rect x="440" y="640" width="80" height="52" fill="#b5302a" stroke={INK} strokeWidth="4" />
        <circle cx="460" cy="666" r="8" fill="#f4b23e" stroke={INK} strokeWidth="3" />
        <circle cx="500" cy="666" r="8" fill="#7bd34a" stroke={INK} strokeWidth="3" />
        <ellipse cx="480" cy="574" rx="84" ry="18" fill="#8d8f94" stroke={INK} strokeWidth="5" />
        <circle cx="480" cy="488" r="62" fill="#f1c39b" stroke={INK} strokeWidth="5" />
        <path
          d="M420 488 Q414 428 480 424 Q546 428 540 488 Q530 452 505 450 Q486 466 452 454 Q430 460 420 488 Z"
          fill="#d9d6cf"
          stroke={INK}
          strokeWidth="5"
        />
        <circle cx="458" cy="494" r="15" fill="rgba(255,255,255,0.45)" stroke={INK} strokeWidth="4" />
        <circle cx="502" cy="494" r="15" fill="rgba(255,255,255,0.45)" stroke={INK} strokeWidth="4" />
        <path d="M473 494 L487 494" stroke={INK} strokeWidth="4" />
        <circle cx="458" cy="496" r="4.5" fill={INK} />
        <circle cx="502" cy="496" r="4.5" fill={INK} />
        <ellipse cx="444" cy="520" rx="9" ry="5" fill="#e8837a" opacity="0.7" />
        <ellipse cx="516" cy="520" rx="9" ry="5" fill="#e8837a" opacity="0.7" />
        <path d="M462 526 Q480 542 498 526" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <circle cx="480" cy="482" r="98" fill="rgba(156,195,240,0.28)" stroke={INK} strokeWidth="6" />
        <path d="M418 436 Q436 404 472 396" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.75" />

        {/* the $100 bill and the glove holding it */}
        <path d="M384 646 Q366 612 404 594" fill="none" stroke={INK} strokeWidth="32" strokeLinecap="round" />
        <path d="M384 646 Q366 612 404 594" fill="none" stroke="#e8e2d0" strokeWidth="21" strokeLinecap="round" />
        <g transform="translate(292 556) rotate(-10)">
          <rect width="124" height="62" fill="#97d88e" stroke={INK} strokeWidth="5" />
          <rect x="8" y="8" width="108" height="46" fill="none" stroke={INK} strokeWidth="2.5" />
        </g>
        <circle cx="408" cy="590" r="16" fill="#fff" stroke={INK} strokeWidth="5" />
      </g>

      {/* text stays crisp (no wobble) so it remains readable */}
      <g fontFamily="'Pixelify Sans', 'Courier Prime', monospace" fontWeight="700" fill={INK}>
        <text x="288" y="638" textAnchor="middle" fontSize="22">
          BOOTH 7
        </text>
        <g transform="translate(292 556) rotate(-10)">
          <text x="62" y="41" textAnchor="middle" fontSize="26">
            $100
          </text>
        </g>
        <g transform="translate(126 668) rotate(-19)">
          <rect x="-66" y="-22" width="132" height="40" fill="none" stroke="#b5302a" strokeWidth="4" />
          <text x="0" y="9" textAnchor="middle" fontSize="22" fill="#b5302a" fontFamily="'Black Ops One', Impact, sans-serif" fontWeight="400">
            APPROVED
          </text>
        </g>
      </g>

      {/* speech bubble */}
      <g>
        <path d="M40 206 Q40 190 58 190 L246 190 Q262 190 262 206 L262 268 Q262 284 246 284 L206 284 L216 316 L176 284 L58 284 Q40 284 40 268 Z" fill="#fff6dc" stroke={INK} strokeWidth="5" />
        <text x="151" y="230" textAnchor="middle" fontFamily="'Pixelify Sans', 'Courier Prime', monospace" fontWeight="700" fontSize="27" fill={INK}>
          NEXT INVESTOR,
        </text>
        <text x="151" y="264" textAnchor="middle" fontFamily="'Pixelify Sans', 'Courier Prime', monospace" fontWeight="700" fontSize="27" fill={INK}>
          PLEASE!
        </text>
      </g>
    </svg>
  );
}
