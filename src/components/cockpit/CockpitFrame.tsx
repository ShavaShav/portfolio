import { useEffect, useRef, useState } from "react";
import { AudioToggle } from "../ui/AudioToggle";
import { SocialLinks } from "../ui/SocialLinks";

const BOOT_LINES = [
  "NAV SYSTEMS... ONLINE",
  "COMMS... ONLINE",
  "SENSORS... ONLINE",
  "PROPULSION... STANDBY",
  "DIGITAL COSMOS v2.0 READY",
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
  const hasBootedRef = useRef(false);

  useEffect(() => {
    if (!booted || hasBootedRef.current) return;
    hasBootedRef.current = true;

    let i = 0;
    const show = () => {
      if (i < BOOT_LINES.length) {
        setBootText(BOOT_LINES[i]);
        i++;
        window.setTimeout(show, 420);
      } else {
        // Fade out after last line
        window.setTimeout(() => setBootText(null), 900);
      }
    };
    show();
  }, [booted]);

  return (
    <header className={`cockpit-frame ${booted ? "is-booted" : ""}`}>
      <div className="cockpit-frame__identity">
        <strong>ZACH SHAVER</strong>
        <span>Software Engineer - Digital Cosmos</span>
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
          >
            RESET
          </button>
        ) : null}
        <AudioToggle enabled={audioEnabled} onToggle={onToggleAudio} />
        <SocialLinks />
      </div>
    </header>
  );
}
