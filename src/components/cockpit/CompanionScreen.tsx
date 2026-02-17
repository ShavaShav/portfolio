import { CockpitScreen } from "./CockpitScreen";

type CompanionScreenProps = {
  mode?: "standby" | "active" | "copilot";
};

export function CompanionScreen({ mode = "standby" }: CompanionScreenProps) {
  const statusLabel =
    mode === "copilot"
      ? "COPILOT MODE"
      : mode === "active"
        ? "COMMS ONLINE"
        : "COMMS: STANDBY";

  return (
    <CockpitScreen powered={mode !== "standby"} title="COMPANION COMMS">
      <div className="companion-screen">
        <div className="companion-screen__avatar">ZS</div>
        <p>{statusLabel}</p>
        <small>Companion interface enters full chat mode in Phase 9.</small>
      </div>
    </CockpitScreen>
  );
}
