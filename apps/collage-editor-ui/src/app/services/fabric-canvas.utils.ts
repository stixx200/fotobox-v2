import type { FabricObject } from 'fabric';
import type { LayerBounds } from './fabric-canvas.types';

export function boundsFromObject(obj: FabricObject, round = true): LayerBounds {
  const rect = obj.getBoundingRect();
  if (round) {
    return {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function colorToHex(
  color: string | undefined,
  fallback: string,
): string {
  if (!color || color === 'transparent') {
    return fallback;
  }
  if (color.startsWith('#')) {
    return color.length >= 7 ? color.slice(0, 7) : fallback;
  }
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgbMatch) {
    return fallback;
  }
  const toHex = (value: string) =>
    Number.parseInt(value, 10).toString(16).padStart(2, '0');
  return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
}

export function alphaFromFill(color: string | undefined): number | null {
  const match = color?.match(
    /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/i,
  );
  return match ? Number.parseFloat(match[1]) : null;
}

function rectsOverlap(a: LayerBounds, b: LayerBounds): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * Top-left position for a new `width`×`height` box that overlaps none of
 * `occupied` and stays `margin` px inside the canvas. Prefers the canvas
 * centre, then the free grid cell closest to it. `null` when nothing fits.
 */
export function findFreePosition(
  canvasWidth: number,
  canvasHeight: number,
  width: number,
  height: number,
  occupied: LayerBounds[],
  margin = 24,
): { x: number; y: number } | null {
  const isFree = (x: number, y: number) =>
    !occupied.some((o) => rectsOverlap({ x, y, width, height }, o));
  const centre = {
    x: Math.round((canvasWidth - width) / 2),
    y: Math.round((canvasHeight - height) / 2),
  };
  if (isFree(centre.x, centre.y)) {
    return centre;
  }

  const maxX = canvasWidth - margin - width;
  const maxY = canvasHeight - margin - height;
  if (maxX < margin || maxY < margin) {
    return null;
  }
  const columns = Math.floor((maxX - margin) / (width + margin)) + 1;
  const rows = Math.floor((maxY - margin) / (height + margin)) + 1;
  // Spread the cells evenly over the free width/height.
  const stepX = columns > 1 ? (maxX - margin) / (columns - 1) : 0;
  const stepY = rows > 1 ? (maxY - margin) / (rows - 1) : 0;

  let best: { x: number; y: number; distance: number } | null = null;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = Math.round(margin + column * stepX);
      const y = Math.round(margin + row * stepY);
      if (!isFree(x, y)) continue;
      // Prefer neighbours in the same row: collages are usually landscape.
      const distance = Math.hypot(x - centre.x, (y - centre.y) * 2);
      if (!best || distance < best.distance) {
        best = { x, y, distance };
      }
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}
