import type { ReactNode } from "react";

type CockpitScreenProps = {
  powered?: boolean;
  children: ReactNode;
  className?: string;
};

export function CockpitScreen({
  powered = true,
  children,
  className,
}: CockpitScreenProps) {
  return (
    <section
      className={`cockpit-screen ${powered ? "is-powered" : "is-standby"} ${className ?? ""}`.trim()}
    >
      <div className="cockpit-screen__body">{children}</div>
      <div className="cockpit-screen__scanline" />
    </section>
  );
}
