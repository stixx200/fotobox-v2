import { Border } from "./template.interface";

export function calculateWidthHeight(width: number, height: number, border?: Border) {
  let w = width;
  let h = height;
  if (border) {
    w -= border.left + border.right;
    h -= border.top + border.bottom;
  }
  return { width: w, height: h };
}
