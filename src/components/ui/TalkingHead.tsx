import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./TalkingHead.css";

type TalkingHeadProps = {
  isTalking: boolean;
  active: boolean;
  mobile?: boolean;
  position?: "side" | "top" | "auto";
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function TalkingHead({
  isTalking,
  active,
  mobile = false,
  position = "auto",
  collapsed = false,
  onToggleCollapsed,
}: TalkingHeadProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [resolvedDock, setResolvedDock] = useState<"left" | "right">("right");
  const [randomTranslate, setRandomTranslate] = useState(0);
  const [randomRotate, setRandomRotate] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (!active) return;

    let timeoutId = 0;
    const flipLater = () => {
      setIsFlipped((flipped) => !flipped);
      timeoutId = window.setTimeout(flipLater, 2500 + Math.random() * 5500);
    };

    timeoutId = window.setTimeout(flipLater, 2500 + Math.random() * 5500);
    return () => clearTimeout(timeoutId);
  }, [active]);

  useEffect(() => {
    if (isTalking) {
      setIsFlipped(true);
    }
  }, [isTalking]);

  useEffect(() => {
    if (mobile || position === "top") return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const panel = wrapper.closest(".panel-window");
    if (!panel) return;

    const REQUIRED_WIDTH = 118;

    const updateDock = () => {
      const panelRect = panel.getBoundingClientRect();
      const leftSpace = panelRect.left;
      const rightSpace = window.innerWidth - panelRect.right;

      const nextDock =
        rightSpace >= REQUIRED_WIDTH
          ? "right"
          : leftSpace >= REQUIRED_WIDTH
            ? "left"
            : rightSpace >= leftSpace
              ? "right"
              : "left";

      setResolvedDock(nextDock);
    };

    updateDock();

    const resizeObserver = new ResizeObserver(updateDock);
    resizeObserver.observe(panel);

    const mutationObserver = new MutationObserver(updateDock);
    mutationObserver.observe(panel, {
      attributes: true,
      attributeFilter: ["style"],
    });

    window.addEventListener("resize", updateDock);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateDock);
    };
  }, [mobile, position]);

  const handleAnimationIteration = () => {
    setRandomTranslate(Math.random() * 10);
    setRandomRotate(Math.random() * 30 - 15);
  };

  const posClass = (() => {
    if (mobile) {
      return "talking-head__wrapper--mobile";
    }
    if (position === "top") {
      return "talking-head__wrapper--top";
    }
    if (position === "side") {
      return "talking-head__wrapper--right";
    }
    return `talking-head__wrapper--${resolvedDock}`;
  })();

  if (!active) return null;

  const wrapperClasses = [
    "talking-head__wrapper",
    posClass,
    collapsed ? "talking-head__wrapper--collapsed" : "",
    !collapsed && (isTalking || isFlipped) ? "talking-head--flipped" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const headClasses = [
    "talking-head",
    isTalking ? "talking-head--talking" : "talking-head--chilling",
  ].join(" ");

  return (
    <div
      className={wrapperClasses}
      onClick={() => {
        if (collapsed) return;
        setIsFlipped((f) => !f);
      }}
      ref={wrapperRef}
    >
      {onToggleCollapsed ? (
        <button
          aria-label={collapsed ? "Expand talking head" : "Collapse talking head"}
          className="talking-head__toggle"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapsed();
          }}
          type="button"
        >
          {collapsed ? (resolvedDock === "left" ? ">" : "<") : "x"}
        </button>
      ) : null}
      {!collapsed ? (
        <>
          <div
            className={headClasses}
            onAnimationIteration={handleAnimationIteration}
            style={
              {
                "--random-translate": `${randomTranslate}px`,
                "--random-rotate": `${randomRotate}deg`,
              } as CSSProperties
            }
          >
            <img src="/zachhead_100px_top.png" alt="" />
            <img src="/zachhead_100px_bottom.png" alt="" />
          </div>
          <div className="talking-head__holo-overlay" />
        </>
      ) : null}
    </div>
  );
}
