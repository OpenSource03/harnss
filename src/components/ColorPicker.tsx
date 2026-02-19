import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import type { SpaceColor } from "@/types";

const PRESETS: SpaceColor[] = [
  { hue: 0, chroma: 0 },         // Neutral
  { hue: 15, chroma: 0.15 },     // Red
  { hue: 45, chroma: 0.15 },     // Orange
  { hue: 85, chroma: 0.15 },     // Yellow-Green
  { hue: 150, chroma: 0.15 },    // Green
  { hue: 200, chroma: 0.15 },    // Cyan
  { hue: 260, chroma: 0.15 },    // Blue
  { hue: 300, chroma: 0.15 },    // Purple
  { hue: 340, chroma: 0.15 },    // Pink
];

interface ColorPickerProps {
  value: SpaceColor;
  onChange: (color: SpaceColor) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [useGradient, setUseGradient] = useState(value.gradientHue !== undefined);

  const handlePreset = (preset: SpaceColor) => {
    onChange({
      ...preset,
      gradientHue: useGradient ? (preset.hue + 120) % 360 : undefined,
    });
  };

  return (
    <div className="space-y-3">
      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset, i) => {
          const isActive = value.hue === preset.hue && value.chroma === preset.chroma;
          const bg =
            preset.chroma === 0
              ? "oklch(0.5 0 0)"
              : `oklch(0.6 ${preset.chroma} ${preset.hue})`;
          return (
            <button
              key={i}
              onClick={() => handlePreset(preset)}
              className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                isActive ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ background: bg }}
            />
          );
        })}
      </div>

      {/* Hue slider */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Hue</label>
        <div
          className="h-3 rounded-full"
          style={{
            background:
              "linear-gradient(to right, oklch(0.6 0.15 0), oklch(0.6 0.15 60), oklch(0.6 0.15 120), oklch(0.6 0.15 180), oklch(0.6 0.15 240), oklch(0.6 0.15 300), oklch(0.6 0.15 360))",
          }}
        />
        <Slider
          min={0}
          max={360}
          step={1}
          value={[value.hue]}
          onValueChange={([hue]) => onChange({ ...value, hue })}
        />
      </div>

      {/* Chroma slider */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Intensity</label>
        <Slider
          min={0}
          max={0.3}
          step={0.01}
          value={[value.chroma]}
          onValueChange={([chroma]) => onChange({ ...value, chroma })}
        />
      </div>

      {/* Gradient toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const next = !useGradient;
            setUseGradient(next);
            onChange({
              ...value,
              gradientHue: next ? (value.hue + 120) % 360 : undefined,
            });
          }}
          className={`h-4 w-8 rounded-full transition-colors ${
            useGradient ? "bg-primary" : "bg-muted"
          }`}
        >
          <div
            className={`h-3 w-3 rounded-full bg-white transition-transform ms-0.5 ${
              useGradient ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-xs text-muted-foreground">Gradient</span>
      </div>

      {/* Gradient hue slider */}
      {useGradient && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Gradient Hue</label>
          <Slider
            min={0}
            max={360}
            step={1}
            value={[value.gradientHue ?? 180]}
            onValueChange={([gradientHue]) => onChange({ ...value, gradientHue })}
          />
        </div>
      )}

      {/* Preview */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Preview</span>
        <div
          className="h-6 w-12 rounded-md"
          style={{
            background:
              value.gradientHue !== undefined
                ? `linear-gradient(135deg, oklch(0.6 ${value.chroma} ${value.hue}), oklch(0.6 ${value.chroma} ${value.gradientHue}))`
                : value.chroma === 0
                  ? "oklch(0.5 0 0)"
                  : `oklch(0.6 ${value.chroma} ${value.hue})`,
          }}
        />
      </div>
    </div>
  );
}
