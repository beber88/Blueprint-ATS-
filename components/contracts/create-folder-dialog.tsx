"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PRESET_COLORS = [
  "#C9A84C", // gold (default)
  "#1A5AA8", // blue
  "#2D8B55", // green
  "#A32D2D", // red
  "#7C3AED", // purple
  "#E97A2B", // orange
];

interface Props {
  open: boolean;
  parentId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateFolderDialog({ open, parentId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contracts/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parent_id: parentId, color }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create folder");
        return;
      }
      setName("");
      setColor(PRESET_COLORS[0]);
      onCreated();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent style={{ maxWidth: 400 }}>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
            <Input
              placeholder="Folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Color</div>
              <div style={{ display: "flex", gap: 8 }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: c,
                      border: color === c ? "2px solid var(--text-primary)" : "2px solid transparent",
                      cursor: "pointer",
                      outline: color === c ? "2px solid var(--bg-card)" : "none",
                      outlineOffset: -4,
                    }}
                  />
                ))}
              </div>
            </div>
            {error && <div style={{ color: "#A32D2D", fontSize: 12 }}>{error}</div>}
          </div>
          <DialogFooter style={{ paddingTop: 8 }}>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
