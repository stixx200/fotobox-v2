import type { FabricObject } from 'fabric';
import type { LayerBounds } from './fabric-canvas.types';

export function boundsFromObject(
  obj: FabricObject,
  round = true,
): LayerBounds {
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

export function colorToHex(color: string | undefined, fallback: string): string {
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
