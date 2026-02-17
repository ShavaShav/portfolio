import { useEffect, useState, type ReactNode } from "react";
import { CockpitScreen } from "./CockpitScreen";

type DataScreenProps = {
  title: string;
  contentKey: string;
  children: ReactNode;
  powered?: boolean;
  onBack?: () => void;
};

export function DataScreen({
  title,
  contentKey,
  children,
  powered = true,
  onBack,
}: DataScreenProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const timerId = window.setTimeout(() => setIsAnimating(false), 240);
    return () => window.clearTimeout(timerId);
  }, [contentKey]);

  useEffect(() => {
    if (!onBack) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  return (
    <CockpitScreen className="data-screen" powered={powered} title={title}>
      {onBack ? (
        <button className="data-screen__back" onClick={onBack} type="button">
          {"<- Back To System"}
        </button>
      ) : null}
      <div
        className={`data-screen__content ${isAnimating ? "is-animating" : ""}`}
      >
        {children}
      </div>
    </CockpitScreen>
  );
}
