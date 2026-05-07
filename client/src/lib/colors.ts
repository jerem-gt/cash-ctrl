const basePalette = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function generateColor(i: number): string {
  // D'abord palette fixe
  if (i < basePalette.length) {
    return basePalette[i];
  }

  // Ensuite génération dynamique
  const goldenRatio = 0.618033988749895;

  const hue = ((i * goldenRatio) % 1) * 360;

  // Variation plus forte
  const saturation = 65 + ((i * 13) % 25); // 65-90
  const lightness = 40 + ((i * 17) % 20); // 40-60

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
