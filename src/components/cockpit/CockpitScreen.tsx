import type { ReactNode } from "react";

type CockpitScreenProps = {
  title: string;
  powered?: boolean;
  children: ReactNode;
  className?: string;
};

export function CockpitScreen({
  title,
  powered = true,
  children,
  className,
}: CockpitScreenProps) {
  return (
    <section
      className={`cockpit-screen ${powered ? "is-powered" : "is-standby"} ${className ?? ""}`.trim()}
    >
      <header className="cockpit-screen__header">
        <span>{title}</span>
        <span className="cockpit-screen__led" />
      </header>
      <div className="cockpit-screen__body">{children}</div>
      <div className="cockpit-screen__scanline" />
    </section>
  );
}
