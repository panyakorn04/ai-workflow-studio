import { Plus } from "lucide-react";
import { useState } from "react";

const defaultNodes = [
  "Trigger",
  "Search",
  "Analyze",
  "Extract",
  "Generate",
  "Review",
  "Approve",
  "Publish",
  "Notify",
  "Sync",
];

type Props = {
  onAddNode: (label: string) => void;
};

export function NodePalette({ onAddNode }: Props) {
  const [custom, setCustom] = useState("");

  const addCustom = () => {
    const trimmed = custom.trim();
    if (trimmed && trimmed.length <= 80) {
      onAddNode(trimmed);
      setCustom("");
    }
  };

  return (
    <div className="node-palette">
      <h3 className="palette-label">Add node:</h3>
      {defaultNodes.map((label) => (
        <button key={label} type="button" className="palette-chip" onClick={() => onAddNode(label)}>
          {label}
        </button>
      ))}
      <div className="palette-custom">
        <input
          className="palette-input"
          placeholder="Custom…"
          value={custom}
          maxLength={80}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addCustom();
          }}
        />
        <button
          type="button"
          className="palette-add-btn"
          onClick={addCustom}
          disabled={!custom.trim()}
          aria-label="Add custom node"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
