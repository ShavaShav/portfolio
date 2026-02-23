import "./Crosshair.css";

type CrosshairProps = {
  /** Target label currently in the crosshair, if any */
  targetLabel?: string;
};

export function Crosshair({ targetLabel }: CrosshairProps) {
  const hasTarget = !!targetLabel;

  return (
    <div
      className={`crosshair ${hasTarget ? "crosshair--target" : ""}`}
      aria-hidden
    >
      <svg
        className="crosshair__svg"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top arm */}
        <line x1="20" y1="2" x2="20" y2="12" strokeLinecap="round" />
        {/* Bottom arm */}
        <line x1="20" y1="28" x2="20" y2="38" strokeLinecap="round" />
        {/* Left arm */}
        <line x1="2" y1="20" x2="12" y2="20" strokeLinecap="round" />
        {/* Right arm */}
        <line x1="28" y1="20" x2="38" y2="20" strokeLinecap="round" />
        {/* Center dot */}
        <circle cx="20" cy="20" r="1.5" />
        {/* Corner brackets when targeting */}
        {hasTarget && (
          <>
            <polyline points="5,13 5,5 13,5" />
            <polyline points="27,5 35,5 35,13" />
            <polyline points="35,27 35,35 27,35" />
            <polyline points="13,35 5,35 5,27" />
          </>
        )}
      </svg>
      {hasTarget && <div className="crosshair__label">{targetLabel}</div>}
    </div>
  );
}
