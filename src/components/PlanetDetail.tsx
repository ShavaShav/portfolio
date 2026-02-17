type PlanetDetailProps = {
  planetId: string;
  onStartMission?: () => void;
};

export function PlanetDetail({ planetId, onStartMission }: PlanetDetailProps) {
  return (
    <div className="placeholder-card">
      <h2>PlanetDetail</h2>
      <p>Planet: {planetId}</p>
      {onStartMission ? (
        <button type="button" onClick={onStartMission}>
          Start Mission
        </button>
      ) : null}
    </div>
  );
}
