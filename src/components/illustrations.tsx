import { cx } from "@/lib/format";

const line = { stroke: "var(--color-ink)", strokeWidth: 1.5, fill: "none", strokeLinecap: "round" as const };
const thin = { stroke: "var(--color-ink)", strokeWidth: 0.75, fill: "none", opacity: 0.55 };

/** Dimension line with end ticks and a label, like on an architect's drawing. */
function Measure({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  const horizontal = y1 === y2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} {...thin} />
      {horizontal ? (
        <>
          <line x1={x1} y1={y1 - 4} x2={x1} y2={y1 + 4} {...thin} />
          <line x1={x2} y1={y2 - 4} x2={x2} y2={y2 + 4} {...thin} />
          <text x={(x1 + x2) / 2} y={y1 - 6} textAnchor="middle" fontSize="8" letterSpacing="1" fill="var(--color-ink-soft)">
            {label}
          </text>
        </>
      ) : (
        <>
          <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} {...thin} />
          <line x1={x2 - 4} y1={y2} x2={x2 + 4} y2={y2} {...thin} />
          <text
            x={x1 - 7}
            y={(y1 + y2) / 2}
            textAnchor="middle"
            fontSize="8"
            letterSpacing="1"
            fill="var(--color-ink-soft)"
            transform={`rotate(-90 ${x1 - 7} ${(y1 + y2) / 2})`}
          >
            {label}
          </text>
        </>
      )}
    </g>
  );
}

/**
 * A two-bedroom flat in plan. `highlight` tints one room, used to say
 * "this one is yours" without words.
 */
export function FloorPlan({
  className,
  highlight = "none",
  measures = true,
}: {
  className?: string;
  highlight?: "none" | "left" | "right" | "both";
  measures?: boolean;
}) {
  return (
    <svg viewBox="0 0 320 240" className={className} role="img" aria-label="Line drawing of a two-bedroom flat seen from above">
      {(highlight === "left" || highlight === "both") && <rect x="40" y="40" width="110" height="90" fill="var(--color-terracotta)" opacity="0.85" />}
      {(highlight === "right" || highlight === "both") && <rect x="190" y="40" width="100" height="90" fill="var(--color-sage)" />}
      {/* outer walls */}
      <path d="M40 40h250v170H40z" {...line} strokeWidth={2.25} />
      {/* bedroom walls, with door gaps */}
      <path d="M150 40v58M150 122v8M40 130h60M124 130h26M190 40v58M190 122v8M190 130h26M240 130h50" {...line} />
      {/* door swings */}
      <path d="M150 98a24 24 0 0 1 24 24" {...thin} strokeDasharray="2 3" />
      <path d="M190 98a24 24 0 0 0-24 24" {...thin} strokeDasharray="2 3" />
      <path d="M100 130a24 24 0 0 1 24 24" {...thin} strokeDasharray="2 3" />
      {/* beds */}
      <rect x="52" y="52" width="44" height="58" rx="2" {...thin} />
      <rect x="57" y="56" width="34" height="12" rx="2" {...thin} />
      <rect x="236" y="52" width="44" height="58" rx="2" {...thin} />
      <rect x="241" y="56" width="34" height="12" rx="2" {...thin} />
      {/* sofa + table */}
      <rect x="56" y="176" width="70" height="22" rx="4" {...thin} />
      <circle cx="91" cy="158" r="9" {...thin} />
      {/* kitchen counter */}
      <path d="M232 210v-28h58" {...thin} />
      <circle cx="262" cy="196" r="4" {...thin} />
      <circle cx="276" cy="196" r="4" {...thin} />
      {/* windows */}
      <path d="M70 40h50M210 40h50M40 150v40" stroke="var(--color-ivory)" strokeWidth="3" />
      <path d="M70 40h50M210 40h50M40 150v40" {...thin} opacity={1} strokeWidth={1} />
      {measures && (
        <>
          <Measure x1={40} y1={26} x2={290} y2={26} label="9.6 M" />
          <Measure x1={24} y1={40} x2={24} y2={210} label="6.4 M" />
        </>
      )}
    </svg>
  );
}

/** One room, one door, nobody home yet. For empty states. */
export function EmptyRoom({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden="true">
      <rect x="1" y="1" width="198" height="148" fill="none" />
      <path d="M30 30h140v95H30z" {...line} strokeWidth={2} />
      <path d="M30 80v24" stroke="var(--color-ivory)" strokeWidth="4" />
      <path d="M30 80a24 24 0 0 1 24 24" {...thin} strokeDasharray="2 3" />
      <path d="M30 104h24" {...line} strokeWidth={1.25} />
      <path d="M90 30h44" stroke="var(--color-ivory)" strokeWidth="4" />
      <path d="M90 30h44" {...thin} opacity={1} />
      <rect x="118" y="78" width="38" height="34" rx="2" fill="var(--color-terracotta)" opacity="0.8" />
      <path d="M100 60l8 8M108 60l-8 8" {...thin} />
      <Measure x1={30} y1={18} x2={170} y2={18} label="ROOM FOR ONE MORE" />
    </svg>
  );
}

/** Two plans sliding together. Used where two people or spaces meet. */
export function TwoRooms({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden="true">
      <rect x="30" y="35" width="100" height="85" fill="var(--color-sage)" />
      <rect x="110" y="35" width="100" height="85" fill="var(--color-terracotta)" opacity="0.8" />
      <rect x="110" y="35" width="20" height="85" fill="var(--color-olive)" opacity="0.55" />
      <path d="M30 35h100v85H30zM110 35h100v85H110z" {...line} />
      <path d="M110 64v26" stroke="var(--color-ivory)" strokeWidth="4" />
      <path d="M130 64v26" stroke="var(--color-ivory)" strokeWidth="4" />
      <Measure x1={30} y1={22} x2={210} y2={22} label="SHARED WALL" />
    </svg>
  );
}

export function PlanTile({ className, seed = 0 }: { className?: string; seed?: number }) {
  const variants: ("left" | "right" | "both")[] = ["left", "right", "both"];
  return (
    <div className={cx("draft-grid flex items-center justify-center bg-sand", className)}>
      <FloorPlan highlight={variants[seed % 3]} measures={false} className="h-[70%] w-[70%]" />
    </div>
  );
}
