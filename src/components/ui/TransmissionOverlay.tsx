import { useEffect, useState } from "react";
import { audioManager } from "../../audio/AudioManager";
import "./TransmissionOverlay.css";

type TransmissionOverlayProps = {
  active: boolean;
  onComplete: () => void;
};

export function TransmissionOverlay({
  active,
  onComplete,
}: TransmissionOverlayProps) {
  const [phase, setPhase] = useState<"hidden" | "flicker" | "text" | "fade">(
    "hidden",
  );

  useEffect(() => {
    if (!active) {
      setPhase("hidden");
      return;
    }

    setPhase("flicker");
    audioManager.playCommBeep();

    const textTimer = window.setTimeout(() => setPhase("text"), 300);
    const fadeTimer = window.setTimeout(() => setPhase("fade"), 1500);
    const doneTimer = window.setTimeout(() => {
      setPhase("hidden");
      onComplete();
    }, 2000);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [active, onComplete]);

  if (phase === "hidden") {
    return null;
  }

  return (
    <div className={`transmission-overlay transmission-overlay--${phase}`}>
      <div className="transmission-overlay__scanline" />
      {phase === "text" || phase === "fade" ? (
        <div className="transmission-overlay__text">INCOMING TRANSMISSION</div>
      ) : null}
    </div>
  );
}
