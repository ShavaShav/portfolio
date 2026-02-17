import { useEffect, useState } from "react";
import type { AppView } from "../../state/AppState";
import { CockpitScreen } from "./CockpitScreen";

type StatusBarProps = {
  view: AppView;
  visitedCount: number;
  totalPlanets: number;
};

function getStatusLabel(view: AppView) {
  if (view.type === "MISSION") {
    return `MISSION ACTIVE - ${view.planetId.toUpperCase()}`;
  }

  if (view.type === "PLANET_DETAIL") {
    return `IN ORBIT - ${view.planetId.toUpperCase()}`;
  }

  if (view.type === "FLYING_TO_PLANET") {
    return `APPROACH VECTOR - ${view.planetId.toUpperCase()}`;
  }

  if (view.type === "FLYING_HOME") {
    return "RETURNING TO STAR SYSTEM";
  }

  return "ORBIT STABLE";
}

export function StatusBar({
  view,
  visitedCount,
  totalPlanets,
}: StatusBarProps) {
  const [timestamp, setTimestamp] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimestamp(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const signalX = Math.sin(timestamp / 2100) * 20;
  const signalY = Math.cos(timestamp / 1800) * 8;
  const signalZ = Math.sin(timestamp / 1650) * 16;

  return (
    <CockpitScreen title="STATUS" powered>
      <div className="status-bar">
        <p>{getStatusLabel(view)}</p>
        <p>
          X: {signalX.toFixed(1)} Y: {signalY.toFixed(1)} Z:{" "}
          {signalZ.toFixed(1)}
        </p>
        <p>
          SURVEYED: {visitedCount}/{totalPlanets}
        </p>
      </div>
    </CockpitScreen>
  );
}
