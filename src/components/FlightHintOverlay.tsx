import "./FlightHintOverlay.css";

type HintKey = {
  keys: string[];
  label: string;
};

const FREE_FLIGHT_HINTS: HintKey[] = [
  { keys: ["Click"], label: "Aim / Lock mouse" },
  { keys: ["W", "S"], label: "Forward / Back" },
  { keys: ["A", "D"], label: "Strafe L / R" },
  { keys: ["Shift", "Ctrl"], label: "Up / Down" },
  { keys: ["Q", "E"], label: "Roll" },
  { keys: ["Esc"], label: "Release mouse" },
];

const LOCKED_ON_HINTS: HintKey[] = [
  { keys: ["Click space"], label: "Disengage" },
  { keys: ["Any flight key"], label: "Disengage" },
  { keys: ["← Return"], label: "System overview" },
];

type FlightHintOverlayProps = {
  lockedOn?: boolean;
  planetLabel?: string;
};

export function FlightHintOverlay({ lockedOn = false, planetLabel }: FlightHintOverlayProps) {
  const hints = lockedOn ? LOCKED_ON_HINTS : FREE_FLIGHT_HINTS;

  return (
    <div className={`flight-hint-overlay ${lockedOn ? "flight-hint-overlay--locked" : ""}`}>
      {lockedOn && planetLabel ? (
        <div className="flight-hint-overlay__title">
          LOCKED: {planetLabel.toUpperCase()}
        </div>
      ) : (
        <div className="flight-hint-overlay__title">FLIGHT CONTROLS</div>
      )}
      <ul className="flight-hint-overlay__list">
        {hints.map((hint) => (
          <li className="flight-hint-overlay__row" key={hint.label + hint.keys.join()}>
            <span className="flight-hint-overlay__keys">
              {hint.keys.map((k, i) => (
                <span key={k}>
                  <kbd className="flight-hint-overlay__kbd">{k}</kbd>
                  {i < hint.keys.length - 1 && (
                    <span className="flight-hint-overlay__sep">/</span>
                  )}
                </span>
              ))}
            </span>
            <span className="flight-hint-overlay__desc">{hint.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
