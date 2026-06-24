import type { Canvas } from 'fabric';
import { VIEWPORT_PADDING, type ZoomMode } from './fabric-canvas.types';

export interface FabricViewportDeps {
  getCanvas: () => Canvas | null;
}

export class FabricCanvasViewportManager {
  zoomLevel = 1;
  zoomMode: ZoomMode = 'fit';
  panOffset = { x: 0, y: 0 };
  isPanning = false;
  panStart = { x: 0, y: 0 };
  panOrigin = { x: 0, y: 0 };

  private viewportContainer: HTMLElement | null = null;

  constructor(private readonly deps: FabricViewportDeps) {}

  setViewportContainer(container: HTMLElement): void {
    this.viewportContainer = container;
  }

  getViewportContainer(): HTMLElement | null {
    return this.viewportContainer;
  }

  dispose(): void {
    this.viewportContainer = null;
    this.isPanning = false;
  }

  zoomIn(): void {
    this.zoomBy(1.25);
  }

  zoomOut(): void {
    this.zoomBy(0.8);
  }

  zoomTo100(): void {
    this.zoomMode = '100';
    this.zoomLevel = 1;
    this.panOffset = { x: 0, y: 0 };
    this.syncCssCanvasSize();
  }

  zoomBy(factor: number): void {
    const canvas = this.deps.getCanvas();
    if (!canvas) return;
    const newZoom = Math.min(4, Math.max(0.1, this.zoomLevel * factor));
    this.zoomLevel = newZoom;
    this.zoomMode = 'manual';
    this.panOffset = { x: 0, y: 0 };
    this.syncCssCanvasSize();
  }

  fitToViewport(container?: HTMLElement): void {
    const canvas = this.deps.getCanvas();
    const target = container ?? this.viewportContainer;
    if (!canvas || !target) return;

    const templateWidth = canvas.getWidth();
    const templateHeight = canvas.getHeight();
    if (templateWidth <= 0 || templateHeight <= 0) return;

    const style = getComputedStyle(target);
    const padX =
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.paddingRight);
    const padY =
      Number.parseFloat(style.paddingTop) +
      Number.parseFloat(style.paddingBottom);
    const availableWidth = Math.max(
      0,
      target.clientWidth - padX - VIEWPORT_PADDING,
    );
    const availableHeight = Math.max(
      0,
      target.clientHeight - padY - VIEWPORT_PADDING,
    );
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const scale = Math.min(
      availableWidth / templateWidth,
      availableHeight / templateHeight,
    );

    this.zoomMode = 'fit';
    this.zoomLevel = scale;
    this.panOffset = { x: 0, y: 0 };
    this.syncCssCanvasSize();
    this.centerViewportScroll(target);
  }

  beginPan(clientX: number, clientY: number): void {
    this.isPanning = true;
    this.panStart = { x: clientX, y: clientY };
    this.panOrigin = { ...this.panOffset };
  }

  updatePan(clientX: number, clientY: number): void {
    if (!this.isPanning) return;
    const scale = this.zoomLevel || 1;
    this.panOffset = {
      x: this.panOrigin.x + (clientX - this.panStart.x) / scale,
      y: this.panOrigin.y + (clientY - this.panStart.y) / scale,
    };
    this.zoomMode = 'manual';
    this.applyViewportTransform();
  }

  endPan(): void {
    this.isPanning = false;
  }

  syncCssCanvasSize(): void {
    const canvas = this.deps.getCanvas();
    if (!canvas) return;

    const templateWidth = canvas.getWidth();
    const templateHeight = canvas.getHeight();
    canvas.setDimensions({ width: templateWidth, height: templateHeight });
    canvas.setDimensions(
      {
        width: Math.max(1, Math.round(templateWidth * this.zoomLevel)),
        height: Math.max(1, Math.round(templateHeight * this.zoomLevel)),
      },
      { cssOnly: true },
    );
    this.applyViewportTransform();
  }

  applyViewportTransform(): void {
    const canvas = this.deps.getCanvas();
    if (!canvas) return;
    canvas.setViewportTransform([
      1,
      0,
      0,
      1,
      this.panOffset.x,
      this.panOffset.y,
    ]);
    canvas.calcOffset();
    canvas.requestRenderAll();
  }

  private centerViewportScroll(container: HTMLElement): void {
    container.scrollLeft = Math.max(
      0,
      (container.scrollWidth - container.clientWidth) / 2,
    );
    container.scrollTop = Math.max(
      0,
      (container.scrollHeight - container.clientHeight) / 2,
    );
  }
}
