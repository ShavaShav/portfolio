import gsap from "gsap";
import { useEffect, useRef, type ReactNode } from "react";
import "./OverlaySheet.css";

type OverlaySheetProps = {
  isOpen: boolean;
  onClose: () => void;
  height: "60%" | "70%" | "100%";
  title: string;
  children: ReactNode;
};

export function OverlaySheet({
  isOpen,
  onClose,
  height,
  title,
  children,
}: OverlaySheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;

    if (isOpen) {
      // Slide up
      gsap.fromTo(
        sheet,
        { y: "100%" },
        { y: 0, duration: 0.3, ease: "power2.out" },
      );
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    } else {
      // Slide down
      gsap.to(sheet, { y: "100%", duration: 0.25, ease: "power2.in" });
      gsap.to(backdrop, { opacity: 0, duration: 0.2 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="overlay-sheet-container">
      {/* Backdrop */}
      <div
        className="overlay-sheet__backdrop"
        onClick={onClose}
        ref={backdropRef}
        role="presentation"
      />

      {/* Sheet */}
      <div className="overlay-sheet" ref={sheetRef} style={{ height }}>
        <div className="overlay-sheet__header">
          <span className="overlay-sheet__title">{title}</span>
          <button
            className="overlay-sheet__close"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="overlay-sheet__body">{children}</div>
        <div className="overlay-sheet__scanline" />
      </div>
    </div>
  );
}
