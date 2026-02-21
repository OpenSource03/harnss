import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconPicker } from "./IconPicker";
import { ColorPicker } from "./ColorPicker";
import type { Space, SpaceColor } from "@/types";

interface SpaceCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSpace?: Space | null;
  onSave: (name: string, icon: string, iconType: "emoji" | "lucide", color: SpaceColor) => void;
}

export function SpaceCreator({ open, onOpenChange, editingSpace, onSave }: SpaceCreatorProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Layers");
  const [iconType, setIconType] = useState<"emoji" | "lucide">("lucide");
  const [color, setColor] = useState<SpaceColor>({ hue: 260, chroma: 0.15 });

  useEffect(() => {
    if (editingSpace) {
      setName(editingSpace.name);
      setIcon(editingSpace.icon);
      setIconType(editingSpace.iconType);
      setColor(editingSpace.color);
    } else {
      setName("");
      setIcon("Layers");
      setIconType("lucide");
      setColor({ hue: 260, chroma: 0.15 });
    }
  }, [editingSpace, open]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, icon, iconType, color);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editingSpace ? "Edit Space" : "Create Space"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Space"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Icon</label>
            <IconPicker
              value={icon}
              iconType={iconType}
              onChange={(ic, type) => {
                setIcon(ic);
                setIconType(type);
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {editingSpace ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
