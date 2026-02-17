type AudioToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

export function AudioToggle({ enabled, onToggle }: AudioToggleProps) {
  return (
    <button className="audio-toggle" onClick={onToggle} type="button">
      {enabled ? "AUDIO: ON" : "AUDIO: OFF"}
    </button>
  );
}
