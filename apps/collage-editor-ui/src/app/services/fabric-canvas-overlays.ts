import { Line, Rect, type Canvas } from 'fabric';
import type { Border } from '@fotobox/collage-editor/browser';
import {
  FOTOBOX_EDITOR_ONLY,
  FOTOBOX_PHOTO_REF,
} from '@fotobox/collage-editor/browser';
import { FOTOBOX_SMART_GUIDE, GRID_SIZE } from './fabric-canvas.types';

export interface EditorOverlayOptions {
  showGrid: boolean;
  showGuides: boolean;
  showSafeArea: boolean;
  safeMargin: number;
  projectBorder?: Border;
}

function isStaticEditorOverlay(obj: { get: (key: string) => unknown }): boolean {
  return (
    !!obj.get(FOTOBOX_EDITOR_ONLY) &&
    !obj.get(FOTOBOX_PHOTO_REF) &&
    !obj.get(FOTOBOX_SMART_GUIDE)
  );
}

export function removeEditorOverlayObjects(canvas: Canvas): void {
  const overlays = canvas.getObjects().filter(isStaticEditorOverlay);
  for (const obj of overlays) {
    canvas.remove(obj);
  }
}

export function renderEditorOverlays(
  canvas: Canvas,
  options: EditorOverlayOptions,
): void {
  removeEditorOverlayObjects(canvas);

  const w = canvas.getWidth();
  const h = canvas.getHeight();

  if (options.showGrid) {
    for (let x = GRID_SIZE; x < w; x += GRID_SIZE) {
      const line = new Line([x, 0, x, h], {
        stroke: 'rgba(148, 163, 184, 0.35)',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      line.set({ [FOTOBOX_EDITOR_ONLY]: true });
      canvas.add(line);
    }
    for (let y = GRID_SIZE; y < h; y += GRID_SIZE) {
      const line = new Line([0, y, w, y], {
        stroke: 'rgba(148, 163, 184, 0.35)',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      line.set({ [FOTOBOX_EDITOR_ONLY]: true });
      canvas.add(line);
    }
  }

  if (options.showGuides) {
    const cx = w / 2;
    const cy = h / 2;
    const guideLines: [number, number, number, number][] = [
      [cx, 0, cx, h],
      [0, cy, w, cy],
    ];
    for (const coords of guideLines) {
      const guide = new Line(coords, {
        stroke: 'rgba(37, 99, 235, 0.25)',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      guide.set({ [FOTOBOX_EDITOR_ONLY]: true });
      canvas.add(guide);
    }
  }

  if (options.showSafeArea) {
    const m = options.safeMargin;
    const safe = new Rect({
      left: m,
      top: m,
      width: w - m * 2,
      height: h - m * 2,
      originX: 'left',
      originY: 'top',
      fill: 'transparent',
      stroke: 'rgba(234, 88, 12, 0.6)',
      strokeWidth: 2,
      strokeDashArray: [8, 6],
      selectable: false,
      evented: false,
    });
    safe.set({ [FOTOBOX_EDITOR_ONLY]: true });
    canvas.add(safe);
  }

  if (options.projectBorder) {
    const frame = new Rect({
      left: 0,
      top: 0,
      width: w,
      height: h,
      originX: 'left',
      originY: 'top',
      fill: 'transparent',
      stroke: '#f97316',
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    frame.set({ [FOTOBOX_EDITOR_ONLY]: true });
    canvas.add(frame);
  }

  canvas.requestRenderAll();
}

export function setEditorOverlaysVisible(canvas: Canvas, visible: boolean): void {
  for (const obj of canvas.getObjects()) {
    if (isStaticEditorOverlay(obj)) {
      obj.set({ visible });
    }
  }
}
