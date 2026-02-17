import type { ReactNode } from "react";

type CockpitLayoutProps = {
  canvas: ReactNode;
  screens: {
    nav: ReactNode;
    data: ReactNode;
    companion: ReactNode;
    status: ReactNode;
  };
};

export function CockpitLayout({ canvas, screens }: CockpitLayoutProps) {
  return (
    <div className="cockpit-placeholder">
      <div className="cockpit-placeholder__bezel">CockpitLayout</div>
      <div className="cockpit-placeholder__viewport">{canvas}</div>
      <div className="cockpit-placeholder__screen">{screens.nav}</div>
      <div className="cockpit-placeholder__screen">{screens.data}</div>
      <div className="cockpit-placeholder__screen">{screens.companion}</div>
      <div className="cockpit-placeholder__screen">{screens.status}</div>
    </div>
  );
}
