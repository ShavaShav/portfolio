import { useEffect, useMemo, useState } from "react";
import { getMissionById, getMissionForPlanet } from "../data/missions";
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

  useEffect(() => {
    setRevealedStepCount(1);
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
  const isComplete = revealedStepCount >= mission.steps.length;

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
          Steps ({visibleSteps.length}/{mission.steps.length})
        </h3>
        {visibleSteps.map((step, index) => (
          <article className="mission-step" key={step.title}>
            <h4>
              {index + 1}. {step.title}
            </h4>
            <p>
              <strong>Challenge:</strong> {step.challenge}
            </p>
            <p>
              <strong>Action:</strong> {step.action}
            </p>
            <p>
              <strong>Outcome:</strong> {step.outcome}
            </p>
          </article>
        ))}
      </div>

      {!isComplete ? (
        <button
          className="mission-view__btn"
          onClick={() =>
            setRevealedStepCount((count) =>
              Math.min(count + 1, mission.steps.length),
            )
          }
          type="button"
        >
          Reveal next step
        </button>
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
