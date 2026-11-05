import { useState } from "react";
import { createPortal } from "react-dom";

const SLIDERS = [
  { key: "speed", label: "Speed", min: 0, max: 5, step: 0.05 },
  { key: "height", label: "Height on screen", min: 0, max: 1, step: 0.01 },
  { key: "tilt", label: "Tilt", min: -0.4, max: 0.4, step: 0.01 },
  { key: "waves", label: "Wave size", min: 0, max: 3, step: 0.05 },
  { key: "width", label: "Ribbon width", min: 0, max: 0.4, step: 0.005 },
  { key: "softness", label: "Band softness", min: 0.05, max: 1, step: 0.01 },
  { key: "strength", label: "Colour strength", min: 0, max: 1, step: 0.01 },
  { key: "haze", label: "Blue haze", min: 0, max: 1, step: 0.01 },
  { key: "twist", label: "Twist position", min: -1, max: 1, step: 0.01 },
  { key: "dim", label: "Overall strength", min: 0, max: 1, step: 0.01 },
];

export default function PrismTuner({ settings, defaults, onChange }) {
  const [open, setOpen] = useState(true);
  const [copyState, setCopyState] = useState("idle");
  const json = JSON.stringify(settings, null, 2);

  const set = (key, value) => {
    setCopyState("idle");
    onChange({ ...settings, [key]: value });
  };

  const setColor = (index, value) => {
    set("colors", settings.colors.map((c, i) => (i === index ? value : c)));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return createPortal(
    <aside className={`tuner${open ? "" : " tuner--closed"}`} aria-label="Ribbon settings">
      <div className="tuner__head">
        <strong>Ribbon</strong>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <>
          {SLIDERS.map(({ key, label, min, max, step }) => (
            <label key={key} className="tuner__row">
              <span>
                {label}
                <output>{settings[key].toFixed(step < 0.01 ? 3 : 2)}</output>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings[key]}
                onChange={(e) => set(key, Number(e.target.value))}
              />
            </label>
          ))}

          <div className="tuner__colors">
            <span>Colours</span>
            <div>
              {settings.colors.map((color, i) => (
                <input
                  key={i}
                  type="color"
                  value={color}
                  aria-label={`Colour ${i + 1}`}
                  onChange={(e) => setColor(i, e.target.value)}
                />
              ))}
            </div>
          </div>

          <div className="tuner__actions">
            <button type="button" className="tuner__primary" onClick={copy}>
              {copyState === "copied" ? "Copied" : "Copy settings"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCopyState("idle");
                onChange(defaults);
              }}
            >
              Reset
            </button>
          </div>

          {copyState === "failed" && (
            <textarea readOnly rows={5} value={json} aria-label="Settings to copy" onFocus={(e) => e.target.select()} />
          )}
        </>
      )}
    </aside>,
    document.body
  );
}
