import type { BicycleCategory, ItemType } from '../types/listing';

/**
 * Generated placeholder artwork (no real photo available). Drawn per category so cards stay
 * scannable. It is never presented as a photo of the actual bike.
 */
export function BikeIllustration({
  category,
  itemType,
  color = '#5f8665',
  className = '',
}: {
  category: BicycleCategory;
  itemType: ItemType;
  color?: string;
  className?: string;
}) {
  const road = category === 'vintage-road' || category === 'randonneur';
  const touring = category === 'touring' || category === 'randonneur' || category === 'utility' || category === 'city';
  const frameOnly = itemType === 'frame' || itemType === 'frameset';
  const parts = itemType === 'components';
  const tire = road ? 4 : 9;
  const r = road ? 54 : 50;

  const rear = { x: 78, y: 140 };
  const front = { x: 262, y: 140 };
  const bb = { x: 158, y: 142 };
  const seatTop = road ? { x: 140, y: 64 } : { x: 142, y: 74 };
  const headTop = road ? { x: 232, y: 66 } : { x: 228, y: 74 };
  const headBot = road ? { x: 238, y: 88 } : { x: 234, y: 96 };

  if (parts) {
    return (
      <svg viewBox="0 0 340 210" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
        <Backdrop />
        <g transform="translate(170 105)" fill="none" stroke={color} strokeWidth="3">
          <circle r="46" />
          <circle r="34" strokeDasharray="4 5" />
          <circle r="10" fill={color} fillOpacity="0.25" />
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={i} x1="0" y1="0" x2={Math.cos((i * 2 * Math.PI) / 5) * 34} y2={Math.sin((i * 2 * Math.PI) / 5) * 34} />
          ))}
          <path d="M40 10 L95 40" strokeWidth="7" strokeLinecap="round" />
          <circle cx="98" cy="42" r="8" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 340 210" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <Backdrop />
      {!frameOnly && (
        <g fill="none" stroke="#2c3031" strokeWidth={tire}>
          <circle cx={rear.x} cy={rear.y} r={r} />
          <circle cx={front.x} cy={front.y} r={r} />
        </g>
      )}
      {!frameOnly && (
        <g fill="none" stroke="#5a5f60" strokeWidth="1">
          <circle cx={rear.x} cy={rear.y} r={r - tire / 2 - 3} />
          <circle cx={front.x} cy={front.y} r={r - tire / 2 - 3} />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * Math.PI) / 6;
            return (
              <g key={i}>
                <line x1={rear.x} y1={rear.y} x2={rear.x + Math.cos(a) * (r - 8)} y2={rear.y + Math.sin(a) * (r - 8)} opacity="0.5" />
                <line x1={front.x} y1={front.y} x2={front.x + Math.cos(a) * (r - 8)} y2={front.y + Math.sin(a) * (r - 8)} opacity="0.5" />
              </g>
            );
          })}
        </g>
      )}
      {touring && !frameOnly && (
        <g fill="none" stroke="#6b706f" strokeWidth="2.5" strokeLinecap="round">
          <path d={`M${rear.x - r + 6} ${rear.y - 18} A ${r + 4} ${r + 4} 0 0 1 ${rear.x + 30} ${rear.y - r - 2}`} />
          <path d={`M${front.x - 34} ${front.y - r} A ${r + 4} ${r + 4} 0 0 1 ${front.x + r - 4} ${front.y - 14}`} />
          <path d={`M${seatTop.x - 4} ${seatTop.y + 12} L${rear.x - 6} ${rear.y - 44} L${rear.x + 34} ${rear.y - 44}`} />
        </g>
      )}
      {/* frame */}
      <g fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <line x1={bb.x} y1={bb.y} x2={seatTop.x} y2={seatTop.y} />
        <line x1={seatTop.x} y1={seatTop.y} x2={headTop.x} y2={headTop.y} />
        <line x1={bb.x} y1={bb.y} x2={headBot.x} y2={headBot.y} />
        <line x1={headTop.x} y1={headTop.y} x2={headBot.x} y2={headBot.y} strokeWidth="8" />
        <line x1={bb.x} y1={bb.y} x2={rear.x} y2={rear.y} strokeWidth="4.5" />
        <line x1={seatTop.x} y1={seatTop.y} x2={rear.x} y2={rear.y} strokeWidth="4.5" />
        <path d={`M${headBot.x} ${headBot.y} Q ${headBot.x + 10} ${front.y - 18} ${front.x} ${front.y}`} strokeWidth="4.5" />
      </g>
      {/* lugs */}
      <g fill="#d6d8d4" opacity="0.6">
        <circle cx={seatTop.x} cy={seatTop.y} r="2.5" />
        <circle cx={headTop.x} cy={headTop.y} r="2.5" />
        <circle cx={headBot.x} cy={headBot.y} r="2.5" />
      </g>
      {!frameOnly && (
        <g fill="none" stroke="#8a8f8e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1={seatTop.x} y1={seatTop.y} x2={seatTop.x - 5} y2={seatTop.y - 16} />
          <path d={`M${seatTop.x - 24} ${seatTop.y - 19} L${seatTop.x + 10} ${seatTop.y - 17}`} strokeWidth="6" stroke="#3a3e3f" />
          <line x1={headTop.x} y1={headTop.y} x2={headTop.x - 2} y2={headTop.y - 12} />
          {road ? (
            <path d={`M${headTop.x - 2} ${headTop.y - 12} L${headTop.x + 16} ${headTop.y - 12} Q ${headTop.x + 30} ${headTop.y - 6} ${headTop.x + 20} ${headTop.y + 12}`} />
          ) : (
            <line x1={headTop.x - 14} y1={headTop.y - 13} x2={headTop.x + 14} y2={headTop.y - 11} strokeWidth="4" />
          )}
          <circle cx={bb.x} cy={bb.y} r="13" strokeWidth="2.5" />
          <line x1={bb.x} y1={bb.y} x2={bb.x + 10} y2={bb.y + 20} strokeWidth="4" />
        </g>
      )}
    </svg>
  );
}

function Backdrop() {
  return (
    <>
      <defs>
        <pattern id="sh-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 L0 0 0 20" fill="none" stroke="#ffffff" strokeOpacity="0.035" strokeWidth="1" />
        </pattern>
        <radialGradient id="sh-glow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#26382a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#141516" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="340" height="210" fill="#161819" />
      <rect width="340" height="210" fill="url(#sh-grid)" />
      <rect width="340" height="210" fill="url(#sh-glow)" />
      <line x1="0" y1="196" x2="340" y2="196" stroke="#ffffff" strokeOpacity="0.06" />
    </>
  );
}
