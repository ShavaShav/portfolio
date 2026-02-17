import { AudioToggle } from "../ui/AudioToggle";
import { SocialLinks } from "../ui/SocialLinks";

type CockpitFrameProps = {
  audioEnabled: boolean;
  onToggleAudio: () => void;
  booted: boolean;
};

export function CockpitFrame({
  audioEnabled,
  onToggleAudio,
  booted,
}: CockpitFrameProps) {
  return (
    <header className={`cockpit-frame ${booted ? "is-booted" : ""}`}>
      <div className="cockpit-frame__identity">
        <strong>ZACH SHAVER</strong>
        <span>Software Engineer - Digital Cosmos</span>
      </div>
      <div className="cockpit-frame__controls">
        <AudioToggle enabled={audioEnabled} onToggle={onToggleAudio} />
        <SocialLinks />
      </div>
    </header>
  );
}
