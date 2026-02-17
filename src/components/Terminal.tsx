type TerminalProps = {
  onLaunch?: () => void;
};

export function Terminal({ onLaunch }: TerminalProps) {
  return (
    <div className="placeholder-card">
      <h2>Terminal</h2>
      <p>Placeholder terminal intro screen.</p>
      {onLaunch ? (
        <button type="button" onClick={onLaunch}>
          Launch
        </button>
      ) : null}
    </div>
  );
}
