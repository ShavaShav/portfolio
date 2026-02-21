import { useEffect, useState, type CSSProperties } from "react";
import "./TalkingHead.css";

type TalkingHeadProps = {
  isTalking: boolean;
  active: boolean;
  mobile?: boolean;
};

export function TalkingHead({
  isTalking,
  active,
  mobile = false,
}: TalkingHeadProps) {
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

  const handleAnimationIteration = () => {
    setRandomTranslate(Math.random() * 10);
    setRandomRotate(Math.random() * 30 - 15);
  };

  if (!active) return null;

  const wrapperClasses = [
    "talking-head__wrapper",
    mobile ? "talking-head__wrapper--mobile" : "",
    isTalking || isFlipped ? "talking-head--flipped" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const headClasses = [
    "talking-head",
    isTalking ? "talking-head--talking" : "talking-head--chilling",
  ].join(" ");

  return (
    <div className={wrapperClasses} onClick={() => setIsFlipped((f) => !f)}>
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
    </div>
  );
}
