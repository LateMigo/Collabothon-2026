const INK = "#1B1A17";

/** Original flat illustration: two generations cheering a rising chart together. */
export default function HeroIllustration() {
  return (
    <svg
      className="hero-art"
      viewBox="0 0 640 760"
      preserveAspectRatio="xMidYMax slice"
      role="img"
      aria-label="A grandmother holding a coin and a teenager holding a 100 dollar bill, smiling in front of a rising chart"
    >
      <defs>
        <pattern id="hero-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="2" fill="rgba(255,255,255,0.22)" />
        </pattern>
      </defs>
      <rect width="640" height="760" fill="#5AA2DD" />
      <rect width="640" height="760" fill="url(#hero-dots)" />

      {/* sun */}
      <circle cx="350" cy="350" r="255" fill="#F6D33C" stroke={INK} strokeWidth="7" />

      {/* rising chart arrow */}
      <polyline
        points="70,500 180,410 250,450 360,300 440,340 545,190"
        fill="none"
        stroke={INK}
        strokeWidth="27"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points="70,500 180,410 250,450 360,300 440,340 545,190"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="13"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polygon points="586,128 575,212 514,170" fill="#FFFFFF" stroke={INK} strokeWidth="7" strokeLinejoin="round" />

      {/* sparkles */}
      <path
        transform="translate(104 248)"
        d="M0 -18 L5 -5 L18 0 L5 5 L0 18 L-5 5 L-18 0 L-5 -5 Z"
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth="4"
      />
      <path
        transform="translate(598 300) scale(0.7)"
        d="M0 -18 L5 -5 L18 0 L5 5 L0 18 L-5 5 L-18 0 L-5 -5 Z"
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth="5"
      />

      {/* "for all ages" sticker */}
      <g transform="translate(56 92) rotate(-7)">
        <rect x="8" y="8" width="214" height="60" fill={INK} />
        <rect x="0" y="0" width="214" height="60" fill="#FFFFFF" stroke={INK} strokeWidth="6" />
        <text
          x="107"
          y="41"
          textAnchor="middle"
          fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="30"
          fill={INK}
        >
          FOR ALL AGES
        </text>
      </g>

      {/* ---------------- teenager (behind) ---------------- */}
      <rect x="432" y="484" width="40" height="40" fill="#B97A50" stroke={INK} strokeWidth="6" />
      <path d="M318 760 L318 612 Q318 522 410 508 L492 508 Q584 522 584 612 L584 760 Z" fill="#E8483A" stroke={INK} strokeWidth="7" />
      <path d="M396 512 Q452 566 508 512" fill="none" stroke={INK} strokeWidth="6" />
      <line x1="434" y1="542" x2="430" y2="592" stroke={INK} strokeWidth="5" />
      <line x1="470" y1="542" x2="474" y2="592" stroke={INK} strokeWidth="5" />
      <circle cx="430" cy="596" r="6" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
      <circle cx="474" cy="596" r="6" fill="#FFFFFF" stroke={INK} strokeWidth="4" />
      <path d="M392 690 L512 690 L524 760 L380 760 Z" fill="#C9372B" stroke={INK} strokeWidth="6" />

      <circle cx="451" cy="420" r="78" fill="#B97A50" stroke={INK} strokeWidth="7" />
      {/* curly hair */}
      <g fill="#2B211C" stroke={INK} strokeWidth="6">
        <circle cx="384" cy="404" r="20" />
        <circle cx="396" cy="376" r="27" />
        <circle cx="428" cy="354" r="30" />
        <circle cx="468" cy="350" r="31" />
        <circle cx="503" cy="370" r="27" />
        <circle cx="518" cy="400" r="19" />
      </g>
      <path d="M412 408 L434 402" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M468 402 L490 408" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="424" cy="432" rx="6.5" ry="8.5" fill={INK} />
      <ellipse cx="478" cy="432" rx="6.5" ry="8.5" fill={INK} />
      <path d="M420 460 Q451 502 482 460 Z" fill="#FFFFFF" stroke={INK} strokeWidth="6" strokeLinejoin="round" />

      {/* the $100 bill */}
      <g transform="translate(440 592) rotate(-10)">
        <rect x="7" y="7" width="136" height="74" fill={INK} />
        <rect x="0" y="0" width="136" height="74" fill="#97D88E" stroke={INK} strokeWidth="6" />
        <rect x="10" y="10" width="116" height="54" fill="none" stroke={INK} strokeWidth="3" />
        <text
          x="68"
          y="49"
          textAnchor="middle"
          fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="34"
          fill={INK}
        >
          $100
        </text>
      </g>
      <path d="M552 566 Q584 650 496 690 L478 658 Q532 632 520 590 Z" fill="#E8483A" stroke={INK} strokeWidth="7" strokeLinejoin="round" />
      <circle cx="478" cy="668" r="22" fill="#B97A50" stroke={INK} strokeWidth="6" />

      {/* ---------------- grandmother (front) ---------------- */}
      <rect x="182" y="514" width="36" height="40" fill="#F1C39B" stroke={INK} strokeWidth="6" />
      <path d="M78 760 L78 642 Q78 560 168 548 L232 548 Q322 560 322 642 L322 760 Z" fill="#2FA58F" stroke={INK} strokeWidth="7" />
      <path d="M174 548 L200 604 L226 548" fill="#FFFFFF" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      <line x1="200" y1="604" x2="200" y2="760" stroke={INK} strokeWidth="6" />
      <circle cx="216" cy="646" r="7" fill="#F4C430" stroke={INK} strokeWidth="4" />
      <circle cx="216" cy="696" r="7" fill="#F4C430" stroke={INK} strokeWidth="4" />

      <circle cx="200" cy="360" r="30" fill="#D9D6CF" stroke={INK} strokeWidth="7" />
      <circle cx="200" cy="455" r="74" fill="#F1C39B" stroke={INK} strokeWidth="7" />
      <path
        d="M127 454 Q121 372 200 368 Q279 372 273 454 Q262 408 234 404 Q212 424 168 410 Q140 418 127 454 Z"
        fill="#D9D6CF"
        stroke={INK}
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <line x1="152" y1="458" x2="128" y2="452" stroke={INK} strokeWidth="5" />
      <line x1="248" y1="458" x2="272" y2="452" stroke={INK} strokeWidth="5" />
      <circle cx="172" cy="462" r="20" fill="rgba(255,255,255,0.45)" stroke={INK} strokeWidth="6" />
      <circle cx="228" cy="462" r="20" fill="rgba(255,255,255,0.45)" stroke={INK} strokeWidth="6" />
      <path d="M192 462 Q200 454 208 462" fill="none" stroke={INK} strokeWidth="5" />
      <circle cx="172" cy="464" r="5.5" fill={INK} />
      <circle cx="228" cy="464" r="5.5" fill={INK} />
      <ellipse cx="156" cy="494" rx="12" ry="7" fill="#E8837A" opacity="0.6" />
      <ellipse cx="244" cy="494" rx="12" ry="7" fill="#E8837A" opacity="0.6" />
      <path d="M176 500 Q200 524 224 500" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />

      {/* coin */}
      <circle cx="318" cy="588" r="34" fill="#F4C430" stroke={INK} strokeWidth="7" />
      <text
        x="318"
        y="602"
        textAnchor="middle"
        fontFamily="'Barlow Condensed', 'Arial Narrow', sans-serif"
        fontWeight="900"
        fontSize="42"
        fill={INK}
      >
        $
      </text>
      <circle cx="296" cy="618" r="20" fill="#F1C39B" stroke={INK} strokeWidth="6" />
    </svg>
  );
}
