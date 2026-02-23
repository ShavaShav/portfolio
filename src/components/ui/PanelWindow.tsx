import type { ReactNode } from "react";
import { Rnd } from "react-rnd";
import { audioManager } from "../../audio/AudioManager";
import "./PanelWindow.css";

type PanelWindowProps = {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  isMinimized: boolean;
  powered?: boolean;
  /** Content rendered outside overflow-hidden, can extend beyond panel bounds */
  popout?: ReactNode;
  onMinimize: () => void;
  onDragStop: (x: number, y: number) => void;
  onResizeStop: (width: number, height: number, x: number, y: number) => void;
  children: ReactNode;
};

export function PanelWindow({
  title,
  x,
  y,
  width,
  height,
  minWidth = 200,
  minHeight = 120,
  isMinimized,
  powered = true,
  popout,
  onMinimize,
  onDragStop,
  onResizeStop,
  children,
}: PanelWindowProps) {
  if (isMinimized) {
    return (
      <div
        className="panel-window panel-window--minimized"
        onClick={() => {
          audioManager.playPanelOpen();
          onMinimize();
        }}
        style={{ position: "absolute", left: x, bottom: 8, zIndex: 4 }}
      >
        <span className="panel-window__title">{title}</span>
      </div>
    );
  }

  return (
    <Rnd
      bounds="parent"
      className="panel-window"
      dragHandleClassName="panel-window__drag-handle"
      minHeight={minHeight}
      minWidth={minWidth}
      onDragStop={(_event, data) => onDragStop(data.x, data.y)}
      onResizeStop={(_event, _direction, ref, _delta, position) => {
        onResizeStop(
          parseInt(ref.style.width, 10),
          parseInt(ref.style.height, 10),
          position.x,
          position.y,
        );
      }}
      position={{ x, y }}
      size={{ width, height }}
    >
      <div className="panel-window__chrome">
        <div className="panel-window__drag-handle">
          <span className={`panel-window__led ${powered ? "" : "is-standby"}`} />
          <span className="panel-window__title">{title}</span>
        </div>
        <button
          className="panel-window__minimize"
          onClick={() => {
            audioManager.playPanelClose();
            onMinimize();
          }}
          type="button"
        >
          _
        </button>
      </div>
      <div className="panel-window__content">{children}</div>
      {popout}
    </Rnd>
  );
}
