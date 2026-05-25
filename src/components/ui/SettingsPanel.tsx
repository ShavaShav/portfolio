import { useState } from "react";
import { getAnalyticsOptOut, setAnalyticsOptOut } from "../../analytics";
import "./SettingsPanel.css";

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  // Source of truth is the persisted preference; mirrored in component state
  // so the toggle reflects the user's pending choice without a reload.
  const [optedOut, setOptedOut] = useState<boolean>(() => getAnalyticsOptOut());

  if (!isOpen) return null;

  const handleToggle = () => {
    const next = !optedOut;
    setAnalyticsOptOut(next);
    setOptedOut(next);
  };

  return (
    <div className="settings-panel-container" role="dialog" aria-modal="true">
      <div
        className="settings-panel__backdrop"
        onClick={onClose}
        role="presentation"
      />
      <div className="settings-panel">
        <div className="settings-panel__header">
          <span className="settings-panel__title">SETTINGS</span>
          <button
            className="settings-panel__close"
            onClick={onClose}
            type="button"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>
        <div className="settings-panel__body">
          <div className="settings-panel__row">
            <div className="settings-panel__label">
              <strong>Analytics</strong>
              <p>
                Anonymous usage metrics help me tune this site. Opt out to
                disable all analytics from your browser.
              </p>
            </div>
            <button
              className={`settings-panel__toggle ${optedOut ? "is-off" : "is-on"}`}
              onClick={handleToggle}
              type="button"
              role="switch"
              aria-checked={!optedOut}
              aria-label="Analytics enabled"
            >
              <span className="settings-panel__toggle-track">
                <span className="settings-panel__toggle-knob" />
              </span>
              <span className="settings-panel__toggle-state">
                {optedOut ? "OFF" : "ON"}
              </span>
            </button>
          </div>
          <p className="settings-panel__hint">
            Changes take effect on next page load.
          </p>
        </div>
      </div>
    </div>
  );
}
