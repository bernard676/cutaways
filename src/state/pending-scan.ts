// One-shot handoff from the camera screen back to Home. The camera route identifies the
// photographed subject, stashes the resulting search term here, and pops back; Home reads it
// once on focus (`useFocusEffect` -> `takePendingScan`) and runs it through the normal
// search/generate pipeline. A module-level slot rather than route params so there's no param
// lifecycle to clear and no risk of the same scan firing twice.

let pending: string | null = null;

export function setPendingScan(query: string): void {
  pending = query.trim() || null;
}

/** Returns the stashed term and clears it, so a second read yields null. */
export function takePendingScan(): string | null {
  const value = pending;
  pending = null;
  return value;
}
