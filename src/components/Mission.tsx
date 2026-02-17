type MissionProps = {
  planetId: string;
  missionId: string;
  onExit?: () => void;
};

export function Mission({ planetId, missionId, onExit }: MissionProps) {
  return (
    <div className="placeholder-card">
      <h2>Mission</h2>
      <p>Planet: {planetId}</p>
      <p>Mission: {missionId}</p>
      {onExit ? (
        <button type="button" onClick={onExit}>
          Exit Mission
        </button>
      ) : null}
    </div>
  );
}
