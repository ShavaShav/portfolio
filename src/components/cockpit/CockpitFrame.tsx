import { useEffect, useState } from "react";
import { AudioToggle } from "../ui/AudioToggle";
import { SocialLinks } from "../ui/SocialLinks";

const BOOT_LINES = [
  "NAV SYSTEMS... ONLINE",
  "COMMS... ONLINE",
  "SENSORS... ONLINE",
  "PROPULSION... STANDBY",
  "SHAVERVERSE / OBSERVATORY READY",
];

type CockpitFrameProps = {
  audioEnabled: boolean;
  onToggleAudio: () => void;
  booted: boolean;
  onResetLayout?: () => void;
};

export function CockpitFrame({
  audioEnabled,
  onToggleAudio,
  booted,
  onResetLayout,
}: CockpitFrameProps) {
  const [bootText, setBootText] = useState<string | null>(null);

  useEffect(() => {
    if (!booted) return;

    let i = 0;
    let timer: number;
    const show = () => {
      if (i < BOOT_LINES.length) {
        setBootText(BOOT_LINES[i]);
        i++;
        timer = window.setTimeout(show, 420);
      } else {
        // Fade out after last line
        timer = window.setTimeout(() => setBootText(null), 900);
      }
    };
    show();
    return () => window.clearTimeout(timer);
  }, [booted]);

  return (
    <header className={`cockpit-frame ${booted ? "is-booted" : ""}`}>
      <div className="cockpit-frame__identity">
        <div className="cockpit-frame__monogram" aria-hidden="true">
          ZS<span>.</span>
        </div>
        <div>
          <strong>ZACH SHAVER</strong>
          <span>SOFTWARE ENGINEER / SHAVERVERSE</span>
        </div>
      </div>

      <div className="cockpit-frame__designation" aria-hidden="true">
        <span>OBSERVATORY</span>
        <small>SYSTEM 001 / EXPLORATION MODE</small>
      </div>

      {bootText ? (
        <div className="cockpit-frame__boot-status">{bootText}</div>
      ) : null}

      <div className="cockpit-frame__controls">
        {onResetLayout ? (
          <button
            className="cockpit-frame__reset"
            onClick={onResetLayout}
            type="button"
            title="Restore the default panel arrangement"
          >
            RESET LAYOUT
          </button>
        ) : null}
        <AudioToggle enabled={audioEnabled} onToggle={onToggleAudio} />
        <SocialLinks />
      </div>
    </header>
  );
}
