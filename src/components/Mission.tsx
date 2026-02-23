import { useEffect, useMemo, useRef, useState } from "react";
import { getMissionById, getMissionForPlanet } from "../data/missions";
import { emitCompanionMessage } from "../state/companionBus";
import "./Mission.css";

type MissionProps = {
  planetId: string;
  missionId: string;
  onExit?: () => void;
};

export function Mission({ planetId, missionId, onExit }: MissionProps) {
  const mission = useMemo(() => {
    return getMissionById(missionId) ?? getMissionForPlanet(planetId);
  }, [missionId, planetId]);

  const [revealedStepCount, setRevealedStepCount] = useState(1);
  const [selectedChoices, setSelectedChoices] = useState<
    Record<number, number | undefined>
  >({});
  const lockedStepsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    setRevealedStepCount(1);
    setSelectedChoices({});
    lockedStepsRef.current = new Set();
  }, [mission?.id]);

  useEffect(() => {
    if (!onExit) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);

  if (!mission) {
    return (
      <section className="mission-view">
        <header>
          <h2>Mission Unavailable</h2>
        </header>
        <p>No mission data is configured for this planet yet.</p>
        {onExit ? (
          <button className="mission-view__btn" onClick={onExit} type="button">
            {"<- Back to planet"}
          </button>
        ) : null}
      </section>
    );
  }

  const visibleSteps = mission.steps.slice(0, revealedStepCount);
  const currentStepIndex = Math.max(0, revealedStepCount - 1);
  const currentStepAnswered = selectedChoices[currentStepIndex] !== undefined;
  const hasMoreSteps = revealedStepCount < mission.steps.length;
  const isComplete = !hasMoreSteps && currentStepAnswered;
  const answeredCount = Object.values(selectedChoices).filter(
    (value) => value !== undefined,
  ).length;

  const handleChoiceSelect = (stepIndex: number, choiceIndex: number) => {
    const step = mission.steps[stepIndex];
    if (!step) {
      return;
    }
    if (lockedStepsRef.current.has(stepIndex)) {
      return;
    }
    if (selectedChoices[stepIndex] !== undefined) {
      return;
    }

    const selectedChoice = step.choices[choiceIndex];
    if (!selectedChoice) {
      return;
    }

    lockedStepsRef.current.add(stepIndex);
    setSelectedChoices((previous) => ({
      ...previous,
      [stepIndex]: choiceIndex,
    }));

    if (!selectedChoice.isCorrect) {
      emitCompanionMessage({
        role: "assistant",
        content: `Hint - ${step.title}: ${step.hint ?? step.correctAction}`,
      });
    }
  };

  return (
    <section className="mission-view">
      <header className="mission-view__header">
        <h2>{mission.title}</h2>
        <p>{mission.briefing}</p>
      </header>

      <div className="mission-view__briefing">
        <h3>Scenario</h3>
        <p>{mission.scenario}</p>
      </div>

      <div className="mission-view__steps">
        <h3>
          Steps ({answeredCount}/{mission.steps.length} answered)
        </h3>
        {visibleSteps.map((step, index) => {
          const selectedChoiceIndex = selectedChoices[index];
          const isAnswered = selectedChoiceIndex !== undefined;
          const selectedChoice =
            selectedChoiceIndex !== undefined
              ? step.choices[selectedChoiceIndex]
              : undefined;
          const isCurrentStep = index === currentStepIndex;

          return (
            <article className="mission-step" key={`${step.title}:${index}`}>
              <h4>
                {index + 1}. {step.title}
              </h4>
              <p>
                <strong>Challenge:</strong> {step.challenge}
              </p>

              <div className="mission-step__choices">
                {step.choices.map((choice, choiceIndex) => {
                  const isSelected = selectedChoiceIndex === choiceIndex;
                  const choiceClassName = [
                    "mission-choice",
                    isSelected ? "is-selected" : "",
                    isAnswered && choice.isCorrect ? "is-correct" : "",
                    isSelected && !choice.isCorrect ? "is-incorrect" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      className={choiceClassName}
                      disabled={!isCurrentStep || isAnswered}
                      key={`${step.title}:choice:${choiceIndex}`}
                      onClick={() => handleChoiceSelect(index, choiceIndex)}
                      type="button"
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>

              {isAnswered && selectedChoice ? (
                <>
                  <div
                    className={`mission-step__feedback ${selectedChoice.isCorrect ? "is-correct" : "is-incorrect"}`}
                  >
                    <strong>
                      {selectedChoice.isCorrect ? "Correct decision" : "Not ideal"}
                    </strong>
                    <p>{selectedChoice.feedback}</p>
                  </div>
                  <div className="mission-step__resolution">
                    <p>
                      <strong>Best action:</strong> {step.correctAction}
                    </p>
                    <p>
                      <strong>Outcome:</strong> {step.outcome}
                    </p>
                  </div>
                </>
              ) : isCurrentStep ? (
                <p className="mission-step__prompt">
                  Select your approach to continue.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      {!isComplete ? (
        currentStepAnswered ? (
          <button
            className="mission-view__btn"
            onClick={() =>
              setRevealedStepCount((count) =>
                Math.min(count + 1, mission.steps.length),
              )
            }
            type="button"
          >
            Next step {"->"}
          </button>
        ) : (
          <p className="mission-view__progress-hint">
            Choose the best response to unlock the next step.
          </p>
        )
      ) : (
        <div className="mission-view__outcome">
          <h3>Mission Outcome</h3>
          <p>{mission.outcome}</p>
          <p className="mission-view__copilot">
            Copilot context: {mission.copilotPrompt}
          </p>
        </div>
      )}

      {onExit ? (
        <button
          className="mission-view__btn is-secondary"
          onClick={onExit}
          type="button"
        >
          {"<- Back to planet"}
        </button>
      ) : null}
    </section>
  );
}
