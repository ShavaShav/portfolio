import gsap from "gsap";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import "./OverlaySheet.css";

type OverlaySheetProps = {
  isOpen: boolean;
  onClose: () => void;
  height: "60%" | "70%" | "85%" | "100%";
  title: string;
  /** Preserve stateful content, such as chat, while the sheet is closed. */
  keepMounted?: boolean;
  children: ReactNode;
};

export function OverlaySheet({
  isOpen,
  onClose,
  height,
  title,
  keepMounted = false,
  children,
}: OverlaySheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reducedMotion = useReducedMotion();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;

    if (isOpen) {
      // Slide up
      gsap.fromTo(
        sheet,
        { y: "100%" },
        { y: 0, duration: reducedMotion ? 0 : 0.3, ease: "power2.out" },
      );
      gsap.fromTo(
        backdrop,
        { opacity: 0 },
        { opacity: 1, duration: reducedMotion ? 0 : 0.2 },
      );
    } else {
      // Slide down
      gsap.to(sheet, {
        y: "100%",
        duration: reducedMotion ? 0 : 0.25,
        ease: "power2.in",
      });
      gsap.to(backdrop, { opacity: 0, duration: reducedMotion ? 0 : 0.2 });
    }
    return () => {
      gsap.killTweensOf(sheet);
      gsap.killTweensOf(backdrop);
    };
  }, [isOpen, reducedMotion]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const sheet = sheetRef.current;
    sheet?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      }
      if (event.key !== "Tab" || !sheet) return;
      const targets = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
        ),
      ).filter((target) => !target.closest("[hidden]"));
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === sheet)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === sheet)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen && !keepMounted) return null;

  return (
    <div className="overlay-sheet-container" hidden={!isOpen}>
      {/* Backdrop */}
      <div
        className="overlay-sheet__backdrop"
        onClick={onClose}
        ref={backdropRef}
        role="presentation"
      />

      {/* Sheet */}
      <div
        className="overlay-sheet"
        ref={sheetRef}
        style={{ height }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="overlay-sheet__header">
          <span className="overlay-sheet__title" id={titleId}>
            {title}
          </span>
          <button
            aria-label={`Close ${title}`}
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
