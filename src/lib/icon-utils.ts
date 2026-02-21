import { icons } from "lucide-react";

type IconComponent = (typeof icons)[keyof typeof icons];

/**
 * Convert a kebab-case name (e.g. "pen-tool") to PascalCase ("PenTool").
 * Handles single-word names too: "rocket" -> "Rocket".
 */
function kebabToPascal(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Resolve a lucide icon name to its component, accepting both PascalCase keys
 * (e.g. "Rocket") and legacy kebab-case names (e.g. "rocket", "pen-tool").
 *
 * The `icons` map from lucide-react uses PascalCase keys. Older persisted data
 * may store kebab-case names, so we try a PascalCase conversion as fallback.
 */
export function resolveLucideIcon(name: string): IconComponent | undefined {
  // Direct lookup — works for PascalCase names (new data)
  const direct = icons[name as keyof typeof icons];
  if (direct) return direct;

  // Fallback — convert kebab-case to PascalCase for legacy persisted names
  const pascal = kebabToPascal(name);
  return icons[pascal as keyof typeof icons];
}
