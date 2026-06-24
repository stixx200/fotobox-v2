import { Injectable } from '@angular/core';
import {
  Canvas,
  Circle,
  Ellipse,
  FabricObject,
  FabricText,
  IText,
  Rect,
  FabricImage,
  Line,
  ActiveSelection,
  Point,
  type TPointerEvent,
} from 'fabric';
import {
  Border,
  CollageEditorLayerMeta,
  CollageEditorProject,
  COLLAGE_EDITOR_VERSION,
  FOTOBOX_ASSET_FILE,
  FOTOBOX_BORDER,
  FOTOBOX_EDITOR_ONLY,
  FOTOBOX_LAYER_ID,
  FOTOBOX_LAYER_NAME,
  FOTOBOX_LAYER_TYPE,
  FOTOBOX_LOCKED,
  FOTOBOX_PHOTO_REF,
  FOTOBOX_PHOTO_SLOT,
  FotoboxLayerType,
  BACKGROUND_LAYER_ID,
  DEFAULT_SAFE_MARGIN,
  PHOTO_ASPECT_RATIO,
  prepareProjectForSave,
  validateCollageEditorProject,
  ProjectValidationIssue,
} from '@fotobox/collage-editor/browser';
import {
  buildDecorationPreset,
  DECORATION_PRESET_LABELS,
  DecorationPresetId,
} from './fabric-decorations';
import { FabricCanvasHistoryManager } from './fabric-canvas-history.manager';
import {
  renderEditorOverlays,
  setEditorOverlaysVisible,
} from './fabric-canvas-overlays';
import { FabricCanvasSnappingController } from './fabric-canvas-snapping.controller';
import { FabricCanvasViewportManager } from './fabric-canvas-viewport.manager';
import {
  alphaFromFill,
  boundsFromObject,
  colorToHex,
} from './fabric-canvas.utils';
import {
  DEFAULT_PHOTO_BORDER,
  DEFAULT_PHOTO_PANE_HEIGHT,
  DEFAULT_PHOTO_PANE_WIDTH,
  HISTORY_PROPERTIES,
  type AlignMode,
  type CanvasHistoryState,
  type DistributeMode,
  type EditorLayerInfo,
  type ImageStyle,
  type LayerBounds,
  type LayerGroups,
  type PhotoStyle,
  type ShapeStyle,
  type TextStyle,
  type ZoomMode,
} from './fabric-canvas.types';

export type {
  AlignMode,
  DistributeMode,
  EditorLayerInfo,
  ImageStyle,
  LayerBounds,
  LayerGroups,
  PhotoStyle,
  ShapeStyle,
  TextStyle,
  ZoomMode,
} from './fabric-canvas.types';

@Injectable()
export class FabricCanvasService {
  private canvas: Canvas | null = null;
  private layerCounter = 0;
  private photoSlotCounter = 0;
  private projectBorder?: Border;
  private snapEnabled = true;
  private magneticGuidesEnabled = false;
  private showGrid = false;
  private showGuides = true;
  private showSafeArea = false;
  private safeMargin = DEFAULT_SAFE_MARGIN;

  private readonly viewport = new FabricCanvasViewportManager({
    getCanvas: () => this.canvas,
  });

  private readonly history = new FabricCanvasHistoryManager({
    getCanvas: () => this.canvas,
    captureState: () => this.captureHistoryState(),
    restoreState: (state) => this.restoreHistoryState(state),
    statesEqual: (a, b) => this.historyStatesEqual(a, b),
  });

  private readonly snapping = new FabricCanvasSnappingController({
    getCanvas: () => this.canvas,
    getZoomLevel: () => this.viewport.zoomLevel,
    isMagneticGuidesEnabled: () => this.magneticGuidesEnabled,
    isSnapEnabled: () => this.snapEnabled,
    getShowGrid: () => this.showGrid,
    getShowSafeArea: () => this.showSafeArea,
    getSafeMargin: () => this.safeMargin,
    ensurePhotoPanesOnTop: () => this.ensurePhotoPanesOnTop(),
  });

  initCanvas(
    element: HTMLCanvasElement,
    width: number,
    height: number,
  ): Canvas {
    FabricObject.customProperties = [
      ...(FabricObject.customProperties ?? []),
      ...HISTORY_PROPERTIES,
    ];
    this.canvas = new Canvas(element, {
      width,
      height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      enableRetinaScaling: false,
    });
    this.bindCanvasHandlers();
    this.installSelectedLayerHitPriority();
    return this.canvas;
  }

  /**
   * When a layer is selected, clicks inside its bounds should keep interacting
   * with that layer even if another layer is drawn above it.
   */
  private installSelectedLayerHitPriority(): void {
    const canvas = this.canvas;
    if (!canvas) return;

    const originalFindTarget = canvas.findTarget.bind(canvas);
    canvas.findTarget = (event: TPointerEvent) => {
      const result = originalFindTarget(event);
      const active = canvas.getActiveObject();
      if (
        !active ||
        active instanceof ActiveSelection ||
        active.get(FOTOBOX_EDITOR_ONLY) ||
        result.target === active
      ) {
        return result;
      }

      active.setCoords();
      const pointer = canvas.getScenePoint(event);
      if (!active.containsPoint(pointer)) {
        return result;
      }

      const activeHit = canvas.searchPossibleTargets([active], pointer);
      if (!activeHit.target) {
        return result;
      }

      return {
        ...result,
        ...activeHit,
        target: active,
      };
    };
  }

  private bindCanvasHandlers(): void {
    const canvas = this.canvas;
    if (!canvas) return;

    canvas.on('object:scaling', (e) => {
      const obj = e.target;
      if (!obj) return;
      if (obj.get(FOTOBOX_LAYER_TYPE) === 'photo') {
        this.enforcePhotoAspectRatio(obj);
        this.syncPhotoSlotLabelsForTarget(obj);
      }
    });

    canvas.on('object:rotating', (e) => {
      const obj = e.target;
      if (!obj) return;
      this.syncPhotoSlotLabelsForTarget(obj);
    });

    canvas.on('object:moving', (e) => {
      const obj = e.target;
      if (!obj) return;
      this.snapping.onObjectMoving(obj);
      this.syncPhotoSlotLabelsForTarget(obj);
    });

    canvas.on('object:modified', (e) => {
      this.snapping.onObjectModified(e.target);
      this.syncPhotoSlotLabels();
      this.ensurePhotoPanesOnTop();
    });

    canvas.on('mouse:up', () => {
      this.snapping.onMouseUp();
      if (this.viewport.isPanning) {
        this.viewport.endPan();
        canvas.selection = true;
      }
    });

    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent;
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.viewport.zoomBy(delta);
    });

    canvas.on('mouse:down', (opt) => {
      const e = opt.e as MouseEvent;
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.viewport.beginPan(e.clientX, e.clientY);
        canvas.selection = false;
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (!this.viewport.isPanning) return;
      const e = opt.e as MouseEvent;
      this.viewport.updatePan(e.clientX, e.clientY);
    });
  }

  setViewportContainer(container: HTMLElement): void {
    this.viewport.setViewportContainer(container);
  }

  initHistory(): void {
    this.history.init();
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  async undo(): Promise<void> {
    await this.history.undo();
  }

  async redo(): Promise<void> {
    await this.history.redo();
  }

  resetHistory(): void {
    this.history.reset();
  }

  private recordHistory(immediate = false): void {
    this.history.record(immediate);
  }

  private captureHistoryState(): CanvasHistoryState {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    return {
      fabricJson: this.canvas.toJSON() as Record<string, unknown>,
      layerMeta: this.collectLayerMeta(),
      backgroundColor: this.getBackgroundColor(),
      projectBorder: this.projectBorder,
    };
  }

  private historyStatesEqual(
    a: CanvasHistoryState,
    b: CanvasHistoryState,
  ): boolean {
    return (
      JSON.stringify(a.fabricJson) === JSON.stringify(b.fabricJson) &&
      JSON.stringify(a.layerMeta) === JSON.stringify(b.layerMeta) &&
      a.backgroundColor === b.backgroundColor &&
      JSON.stringify(a.projectBorder) === JSON.stringify(b.projectBorder)
    );
  }

  private async restoreHistoryState(state: CanvasHistoryState): Promise<void> {
    const canvas = this.canvas;
    if (!canvas) return;

    await this.history.runPaused(async () => {
      canvas.backgroundColor = state.backgroundColor;
      this.projectBorder = state.projectBorder;
      await canvas.loadFromJSON(state.fabricJson);
      this.applyLayerMeta(state.layerMeta);
      this.syncLayerCounterFromObjects();
      this.syncPhotoSlotCounter();
      this.syncPhotoSlotLabels();
      this.ensurePhotoPanesOnTop();
      this.renderEditorOverlays();
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    });
  }

  private applyLayerMeta(layerMeta: CollageEditorLayerMeta[]): void {
    const canvas = this.canvas;
    if (!canvas) return;

    const metaById = new Map(layerMeta.map((meta) => [meta.id, meta]));
    for (const obj of canvas.getObjects()) {
      if (obj.get(FOTOBOX_EDITOR_ONLY)) continue;
      const id = obj.get(FOTOBOX_LAYER_ID) as string | undefined;
      const meta = id ? metaById.get(id) : undefined;
      if (!meta) continue;
      obj.set({ [FOTOBOX_LAYER_TYPE]: meta.type });
      if (meta.name) {
        obj.set({ [FOTOBOX_LAYER_NAME]: meta.name });
      }
      if (meta.border) {
        obj.set({ [FOTOBOX_BORDER]: meta.border });
      }
      if (meta.assetFile) {
        obj.set({ [FOTOBOX_ASSET_FILE]: meta.assetFile });
      }
      if (meta.photoSlot != null) {
        obj.set({ [FOTOBOX_PHOTO_SLOT]: meta.photoSlot });
      }
      this.applyLockState(obj, meta.locked ?? false);
      if (meta.visible === false) {
        obj.set({ visible: false });
      }
    }
  }

  private syncLayerCounterFromObjects(): void {
    if (!this.canvas) return;
    let max = 0;
    for (const obj of this.canvas.getObjects()) {
      if (obj.get(FOTOBOX_EDITOR_ONLY)) continue;
      const id = obj.get(FOTOBOX_LAYER_ID) as string | undefined;
      if (!id) continue;
      const match = id.match(/-(\d+)$/);
      if (match) {
        max = Math.max(max, Number.parseInt(match[1], 10));
      }
    }
    this.layerCounter = max;
  }

  private syncPhotoSlotCounter(): void {
    if (!this.canvas) return;
    let max = 0;
    for (const obj of this.getPhotoObjects()) {
      const slot = obj.get(FOTOBOX_PHOTO_SLOT) as number | undefined;
      if (slot != null) {
        max = Math.max(max, slot);
      }
    }
    this.photoSlotCounter = max;
  }

  getCanvas(): Canvas | null {
    return this.canvas;
  }

  getZoomLevel(): number {
    return this.viewport.zoomLevel;
  }

  getZoomMode(): ZoomMode {
    return this.viewport.zoomMode;
  }

  isSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  isMagneticGuidesEnabled(): boolean {
    return this.magneticGuidesEnabled;
  }

  isShowGrid(): boolean {
    return this.showGrid;
  }

  isShowGuides(): boolean {
    return this.showGuides;
  }

  isShowSafeArea(): boolean {
    return this.showSafeArea;
  }

  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
  }

  setMagneticGuidesEnabled(enabled: boolean): void {
    this.magneticGuidesEnabled = enabled;
    if (!enabled) {
      this.snapping.clearSmartGuideLines();
    }
  }

  setShowGrid(show: boolean): void {
    this.showGrid = show;
    this.renderEditorOverlays();
  }

  setShowGuides(show: boolean): void {
    this.showGuides = show;
    this.renderEditorOverlays();
  }

  setShowSafeArea(show: boolean): void {
    this.showSafeArea = show;
    this.renderEditorOverlays();
  }

  zoomIn(): void {
    this.viewport.zoomIn();
  }

  zoomOut(): void {
    this.viewport.zoomOut();
  }

  zoomTo100(): void {
    this.viewport.zoomTo100();
  }

  zoomBy(factor: number, _pointX?: number, _pointY?: number): void {
    this.viewport.zoomBy(factor);
  }

  fitToViewport(container?: HTMLElement): void {
    this.viewport.fitToViewport(container);
  }

  dispose(): void {
    this.snapping.dispose();
    this.history.dispose();
    this.viewport.dispose();
    this.canvas?.dispose();
    this.canvas = null;
  }

  private nextLayerId(type: FotoboxLayerType): string {
    this.layerCounter += 1;
    return `${type}-${this.layerCounter}`;
  }

  private nextPhotoSlot(): number {
    this.photoSlotCounter += 1;
    return this.photoSlotCounter;
  }

  private defaultLayerName(type: FotoboxLayerType): string {
    return `${type} ${this.layerCounter + 1}`;
  }

  private tagObject(
    obj: FabricObject,
    type: FotoboxLayerType,
    extra?: Record<string, unknown>,
  ): void {
    const name = this.defaultLayerName(type);
    obj.set({
      [FOTOBOX_LAYER_TYPE]: type,
      [FOTOBOX_LAYER_ID]: this.nextLayerId(type),
      [FOTOBOX_LAYER_NAME]: name,
      ...extra,
    });
  }

  private addCentered(obj: FabricObject): void {
    if (!this.canvas) return;
    this.canvas.add(obj);
    this.canvas.centerObject(obj);
    obj.setCoords();
    this.applyLockState(obj, false);
    this.ensurePhotoPanesOnTop();
    this.canvas.setActiveObject(obj);
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  addPhotoPane(
    width = DEFAULT_PHOTO_PANE_WIDTH,
    height = DEFAULT_PHOTO_PANE_HEIGHT,
  ): void {
    if (!this.canvas) return;
    const slot = this.nextPhotoSlot();
    const rect = new Rect({
      width,
      height,
      fill: 'rgba(37, 99, 235, 0.12)',
      stroke: '#2563eb',
      strokeWidth: 3,
      strokeDashArray: [10, 6],
      rx: 2,
      ry: 2,
    });
    this.tagObject(rect, 'photo', {
      [FOTOBOX_BORDER]: DEFAULT_PHOTO_BORDER,
      [FOTOBOX_PHOTO_SLOT]: slot,
    });
    this.addCentered(rect);
    this.createPhotoSlotLabel(rect, slot);
    this.syncPhotoSlotLabels();
  }

  private createPhotoSlotLabel(photo: FabricObject, slot: number): void {
    if (!this.canvas) return;
    const label = new FabricText(String(slot), {
      fontSize: 48,
      fontWeight: '700',
      fill: '#2563eb',
      fontFamily: 'Arial',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    label.set({
      [FOTOBOX_EDITOR_ONLY]: true,
      [FOTOBOX_PHOTO_REF]: photo.get(FOTOBOX_LAYER_ID),
    });
    this.canvas.add(label);
    this.positionPhotoSlotLabel(photo, label);
  }

  private positionPhotoSlotLabel(
    photo: FabricObject,
    label: FabricObject,
  ): void {
    const center = photo.getCenterPoint();
    label.set({ left: center.x, top: center.y, angle: photo.angle ?? 0 });
    label.setCoords();
  }

  private syncPhotoSlotLabelsForTarget(target: FabricObject): void {
    if (target instanceof ActiveSelection) {
      for (const obj of target.getObjects()) {
        if (obj.get(FOTOBOX_LAYER_TYPE) === 'photo') {
          this.syncPhotoSlotLabelForPhoto(obj);
        }
      }
      return;
    }
    if (target.get(FOTOBOX_LAYER_TYPE) === 'photo') {
      this.syncPhotoSlotLabelForPhoto(target);
    }
  }

  private syncPhotoSlotLabelForPhoto(photo: FabricObject): void {
    if (!this.canvas) return;
    const photoId = photo.get(FOTOBOX_LAYER_ID);
    const label = this.canvas
      .getObjects()
      .find(
        (obj) =>
          obj.get(FOTOBOX_EDITOR_ONLY) && obj.get(FOTOBOX_PHOTO_REF) === photoId,
      );
    if (label) {
      this.positionPhotoSlotLabel(photo, label);
    }
  }

  private syncPhotoSlotLabels(): void {
    if (!this.canvas) return;
    const photos = this.getPhotoObjects();
    const labels = this.canvas
      .getObjects()
      .filter((obj) => obj.get(FOTOBOX_EDITOR_ONLY));
    for (const photo of photos) {
      const photoId = photo.get(FOTOBOX_LAYER_ID);
      const label = labels.find((l) => l.get(FOTOBOX_PHOTO_REF) === photoId);
      if (label) {
        const slot = photo.get(FOTOBOX_PHOTO_SLOT) as number | undefined;
        if (slot != null && label instanceof FabricText) {
          label.set({ text: String(slot) });
        }
        this.positionPhotoSlotLabel(photo, label);
      } else {
        const slot = photo.get(FOTOBOX_PHOTO_SLOT) as number | undefined;
        if (slot != null) {
          this.createPhotoSlotLabel(photo, slot);
        }
      }
    }
  }

  getPhotoPaneCount(): number {
    return this.getPhotoObjects().length;
  }

  addText(text = 'Text'): void {
    if (!this.canvas) return;
    const label = new IText(text, {
      fontSize: 48,
      fill: '#111827',
      fontFamily: 'Arial',
      fontWeight: 'normal',
    });
    this.tagObject(label, 'text');
    this.addCentered(label);
  }

  addShape(): void {
    if (!this.canvas) return;
    const rect = new Rect({
      width: 200,
      height: 80,
      fill: 'rgba(239, 68, 68, 0.4)',
      stroke: '#dc2626',
      strokeWidth: 2,
    });
    this.tagObject(rect, 'shape');
    this.addCentered(rect);
  }

  addEllipse(): void {
    if (!this.canvas) return;
    const ellipse = new Ellipse({
      rx: 120,
      ry: 80,
      fill: 'rgba(239, 68, 68, 0.4)',
      stroke: '#dc2626',
      strokeWidth: 2,
    });
    this.tagObject(ellipse, 'shape');
    this.addCentered(ellipse);
  }

  addCircle(): void {
    if (!this.canvas) return;
    const circle = new Circle({
      radius: 80,
      fill: 'rgba(239, 68, 68, 0.4)',
      stroke: '#dc2626',
      strokeWidth: 2,
    });
    this.tagObject(circle, 'shape');
    this.addCentered(circle);
  }

  addRoundedRect(): void {
    if (!this.canvas) return;
    const rect = new Rect({
      width: 200,
      height: 100,
      rx: 16,
      ry: 16,
      fill: 'rgba(239, 68, 68, 0.4)',
      stroke: '#dc2626',
      strokeWidth: 2,
    });
    this.tagObject(rect, 'shape');
    this.addCentered(rect);
  }

  addLine(): void {
    if (!this.canvas) return;
    const line = new Line([-150, 0, 150, 0], {
      stroke: '#374151',
      strokeWidth: 3,
    });
    this.tagObject(line, 'shape');
    this.addCentered(line);
  }

  addDecorationPreset(preset: DecorationPresetId): void {
    if (!this.canvas) return;
    const width = this.canvas.getWidth();
    const height = this.canvas.getHeight();
    const group = buildDecorationPreset(preset, width, height);
    this.tagObject(group, 'shape', {
      [FOTOBOX_LAYER_NAME]: DECORATION_PRESET_LABELS[preset],
    });
    this.canvas.add(group);
    this.canvas.sendObjectToBack(group);
    group.setCoords();
    this.applyLockState(group, false);
    this.ensurePhotoPanesOnTop();
    this.canvas.setActiveObject(group);
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  async addImageFromFile(file: File): Promise<void> {
    if (!this.canvas) return;
    const dataUrl = await this.readFileAsDataUrl(file);
    const img = await FabricImage.fromURL(dataUrl);
    if (img.width && img.width > 400) {
      img.scaleToWidth(400);
    }
    this.tagObject(img, 'image', {
      [FOTOBOX_ASSET_FILE]: file.name,
    });
    this.addCentered(img);
  }

  async replaceActiveImage(file: File): Promise<void> {
    const obj = this.canvas?.getActiveObject();
    if (!obj || obj.get(FOTOBOX_LAYER_TYPE) !== 'image' || !this.canvas) return;
    const dataUrl = await this.readFileAsDataUrl(file);
    const img = await FabricImage.fromURL(dataUrl);
    const bounds = boundsFromObject(obj);
    if (img.width && bounds.width > 0) {
      img.scaleToWidth(bounds.width);
    }
    img.set({
      [FOTOBOX_LAYER_TYPE]: 'image',
      [FOTOBOX_LAYER_ID]: obj.get(FOTOBOX_LAYER_ID),
      [FOTOBOX_LAYER_NAME]: obj.get(FOTOBOX_LAYER_NAME),
      [FOTOBOX_ASSET_FILE]: file.name,
      left: obj.left,
      top: obj.top,
      angle: obj.angle,
      opacity: obj.opacity,
      flipX: obj.flipX,
      flipY: obj.flipY,
    });
    this.canvas.remove(obj);
    this.canvas.add(img);
    this.ensurePhotoPanesOnTop();
    this.canvas.setActiveObject(img);
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  deleteActive(): void {
    if (!this.canvas) return;
    const active = this.canvas.getActiveObjects().filter(
      (obj) => !obj.get(FOTOBOX_EDITOR_ONLY) && !obj.get(FOTOBOX_LOCKED),
    );
    if (!active.length) return;
    for (const obj of active) {
      if (obj.get(FOTOBOX_LAYER_TYPE) === 'photo') {
        this.removePhotoSlotLabel(obj);
      }
      this.canvas.remove(obj);
    }
    this.canvas.discardActiveObject();
    this.ensurePhotoPanesOnTop();
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  private removePhotoSlotLabel(photo: FabricObject): void {
    if (!this.canvas) return;
    const photoId = photo.get(FOTOBOX_LAYER_ID);
    const label = this.canvas
      .getObjects()
      .find(
        (obj) =>
          obj.get(FOTOBOX_EDITOR_ONLY) &&
          obj.get(FOTOBOX_PHOTO_REF) === photoId,
      );
    if (label) {
      this.canvas.remove(label);
    }
  }

  deleteLayerById(layerId: string): void {
    if (layerId === BACKGROUND_LAYER_ID) return;
    const obj = this.findLayerById(layerId);
    if (!obj || !this.canvas || obj.get(FOTOBOX_LOCKED)) return;
    if (obj.get(FOTOBOX_LAYER_TYPE) === 'photo') {
      this.removePhotoSlotLabel(obj);
    }
    this.canvas.remove(obj);
    this.canvas.discardActiveObject();
    this.ensurePhotoPanesOnTop();
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  duplicateActive(): void {
    const obj = this.canvas?.getActiveObject();
    if (!obj || !this.canvas || obj.get(FOTOBOX_EDITOR_ONLY)) return;
    if (obj.get(FOTOBOX_LOCKED)) return;
    void obj.clone().then((cloned) => {
      if (!this.canvas) return;
      const type = obj.get(FOTOBOX_LAYER_TYPE) as FotoboxLayerType;
      cloned.set({
        left: (obj.left ?? 0) + 20,
        top: (obj.top ?? 0) + 20,
        [FOTOBOX_LAYER_ID]: this.nextLayerId(type),
        [FOTOBOX_LAYER_NAME]: `${obj.get(FOTOBOX_LAYER_NAME) ?? type} copy`,
      });
      if (type === 'photo') {
        const slot = this.nextPhotoSlot();
        cloned.set({
          [FOTOBOX_PHOTO_SLOT]: slot,
          [FOTOBOX_BORDER]:
            obj.get(FOTOBOX_BORDER) ?? DEFAULT_PHOTO_BORDER,
        });
      }
      this.canvas.add(cloned);
      if (type === 'photo') {
        this.createPhotoSlotLabel(cloned, cloned.get(FOTOBOX_PHOTO_SLOT) as number);
      }
      this.ensurePhotoPanesOnTop();
      this.canvas.setActiveObject(cloned);
      this.canvas.requestRenderAll();
      this.recordHistory(true);
    });
  }

  duplicateLayerById(layerId: string): void {
    this.selectLayerById(layerId);
    this.duplicateActive();
  }

  nudgeActive(dx: number, dy: number): void {
    if (!this.canvas) return;
    const objects = this.canvas
      .getActiveObjects()
      .filter((obj) => !obj.get(FOTOBOX_LOCKED) && !obj.get(FOTOBOX_EDITOR_ONLY));
    if (!objects.length) return;
    for (const obj of objects) {
      obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy });
      obj.setCoords();
    }
    this.syncPhotoSlotLabels();
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  getActiveSelectionCount(): number {
    return (
      this.canvas?.getActiveObjects().filter((o) => !o.get(FOTOBOX_EDITOR_ONLY))
        .length ?? 0
    );
  }

  getActiveLayerBounds(): LayerBounds | null {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1) return null;
    return boundsFromObject(objects[0]);
  }

  updateLayerBounds(layerId: string, bounds: Partial<LayerBounds>): void {
    const obj = this.findLayerById(layerId);
    if (!obj || !this.canvas || obj.get(FOTOBOX_LOCKED)) return;

    const current = boundsFromObject(obj);

    if (bounds.x != null || bounds.y != null) {
      const deltaX = (bounds.x ?? current.x) - current.x;
      const deltaY = (bounds.y ?? current.y) - current.y;
      obj.set({ left: obj.left + deltaX, top: obj.top + deltaY });
      obj.setCoords();
    }

    if (bounds.width != null) {
      const updated = boundsFromObject(obj);
      if (updated.width > 0) {
        const scaleFactor = bounds.width / updated.width;
        obj.set({ scaleX: (obj.scaleX ?? 1) * scaleFactor });
        if (obj.get(FOTOBOX_LAYER_TYPE) === 'photo') {
          obj.set({ scaleY: (obj.scaleY ?? 1) * scaleFactor });
        }
        obj.setCoords();
      }
    }

    if (bounds.height != null && obj.get(FOTOBOX_LAYER_TYPE) !== 'photo') {
      const updated = boundsFromObject(obj);
      if (updated.height > 0) {
        obj.set({
          scaleY: (obj.scaleY ?? 1) * (bounds.height / updated.height),
        });
        obj.setCoords();
      }
    }

    this.syncPhotoSlotLabels();
    this.canvas.requestRenderAll();
    this.recordHistory();
  }

  alignActiveObjects(mode: AlignMode): void {
    if (!this.canvas) return;
    const objects = this.canvas
      .getActiveObjects()
      .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY) && !o.get(FOTOBOX_LOCKED));
    if (objects.length < 2) return;

    const [reference, ...targets] = objects;
    const ref = boundsFromObject(reference);

    for (const obj of targets) {
      const bounds = boundsFromObject(obj);
      let deltaX = 0;
      let deltaY = 0;

      switch (mode) {
        case 'top':
          deltaY = ref.y - bounds.y;
          break;
        case 'bottom':
          deltaY = ref.y + ref.height - bounds.y - bounds.height;
          break;
        case 'left':
          deltaX = ref.x - bounds.x;
          break;
        case 'right':
          deltaX = ref.x + ref.width - bounds.x - bounds.width;
          break;
        case 'center-h': {
          const refCenter = ref.x + ref.width / 2;
          const objCenter = bounds.x + bounds.width / 2;
          deltaX = refCenter - objCenter;
          break;
        }
        case 'center-v': {
          const refCenter = ref.y + ref.height / 2;
          const objCenter = bounds.y + bounds.height / 2;
          deltaY = refCenter - objCenter;
          break;
        }
      }

      obj.set({ left: obj.left + deltaX, top: obj.top + deltaY });
      obj.setCoords();
    }

    this.syncPhotoSlotLabels();
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  distributeActiveObjects(mode: DistributeMode): void {
    if (!this.canvas) return;
    const objects = this.canvas
      .getActiveObjects()
      .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY) && !o.get(FOTOBOX_LOCKED));
    if (objects.length < 3) return;

    const sorted = [...objects].sort((a, b) => {
      const ba = boundsFromObject(a);
      const bb = boundsFromObject(b);
      return mode === 'horizontal' ? ba.x - bb.x : ba.y - bb.y;
    });

    const first = boundsFromObject(sorted[0]);
    const last = boundsFromObject(sorted[sorted.length - 1]);

    if (mode === 'horizontal') {
      const totalWidth = sorted.reduce(
        (sum, obj) => sum + boundsFromObject(obj).width,
        0,
      );
      const span = last.x + last.width - first.x;
      const gap = (span - totalWidth) / (sorted.length - 1);
      let cursor = first.x;
      for (const obj of sorted) {
        const bounds = boundsFromObject(obj);
        const deltaX = cursor - bounds.x;
        obj.set({ left: obj.left + deltaX, top: obj.top });
        obj.setCoords();
        cursor += bounds.width + gap;
      }
    } else {
      const totalHeight = sorted.reduce(
        (sum, obj) => sum + boundsFromObject(obj).height,
        0,
      );
      const span = last.y + last.height - first.y;
      const gap = (span - totalHeight) / (sorted.length - 1);
      let cursor = first.y;
      for (const obj of sorted) {
        const bounds = boundsFromObject(obj);
        const deltaY = cursor - bounds.y;
        obj.set({ left: obj.left, top: obj.top + deltaY });
        obj.setCoords();
        cursor += bounds.height + gap;
      }
    }

    this.syncPhotoSlotLabels();
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  bringDecorationForward(layerId?: string): void {
    this.moveDecoration(layerId, 1);
  }

  sendDecorationBackward(layerId?: string): void {
    this.moveDecoration(layerId, -1);
  }

  bringDecorationToFront(layerId?: string): void {
    const decorations = this.getDecorationObjects();
    const obj = layerId ? this.findLayerById(layerId) : this.getActiveDecoration();
    if (!obj || !this.canvas) return;
    const index = decorations.indexOf(obj);
    if (index < 0 || index >= decorations.length - 1) return;
    for (let i = index; i < decorations.length - 1; i++) {
      this.canvas.bringObjectForward(decorations[i]);
    }
    this.ensurePhotoPanesOnTop();
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  sendDecorationToBack(layerId?: string): void {
    const decorations = this.getDecorationObjects();
    const obj = layerId ? this.findLayerById(layerId) : this.getActiveDecoration();
    if (!obj || !this.canvas) return;
    const index = decorations.indexOf(obj);
    if (index <= 0) return;
    for (let i = index; i > 0; i--) {
      this.canvas.sendObjectBackwards(decorations[i]);
    }
    this.ensurePhotoPanesOnTop();
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  reorderDecorationsTopFirst(orderedIds: string[]): void {
    const canvas = this.canvas;
    if (!canvas || orderedIds.length === 0) return;

    const bottomFirst = [...orderedIds].reverse();
    for (let i = 0; i < bottomFirst.length; i++) {
      const obj = this.findLayerById(bottomFirst[i]);
      if (obj) {
        canvas.moveObjectTo(obj, i);
      }
    }
    this.ensurePhotoPanesOnTop();
    canvas.requestRenderAll();
    this.recordHistory(true);
  }

  private moveDecoration(layerId: string | undefined, direction: 1 | -1): void {
    const obj = layerId
      ? this.findLayerById(layerId)
      : this.getActiveDecoration();
    if (!obj || !this.canvas) return;
    if (direction > 0) {
      this.canvas.bringObjectForward(obj);
    } else {
      this.canvas.sendObjectBackwards(obj);
    }
    this.ensurePhotoPanesOnTop();
    this.canvas.requestRenderAll();
    this.recordHistory(true);
  }

  private getActiveDecoration(): FabricObject | undefined {
    const obj = this.canvas?.getActiveObject();
    if (!obj || obj.get(FOTOBOX_EDITOR_ONLY)) return undefined;
    if (obj.get(FOTOBOX_LAYER_TYPE) === 'photo') return undefined;
    return obj;
  }

  private ensurePhotoPanesOnTop(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    for (const photo of this.getPhotoObjects()) {
      canvas.bringObjectToFront(photo);
      const photoId = photo.get(FOTOBOX_LAYER_ID);
      const label = canvas
        .getObjects()
        .find(
          (obj) =>
            obj.get(FOTOBOX_EDITOR_ONLY) &&
            obj.get(FOTOBOX_PHOTO_REF) === photoId,
        );
      if (label) {
        canvas.bringObjectToFront(label);
      }
    }
  }

  private enforcePhotoAspectRatio(obj: FabricObject): void {
    const baseWidth = (obj.width ?? 1) * (obj.scaleX ?? 1);
    const baseHeight = baseWidth / PHOTO_ASPECT_RATIO;
    obj.set({
      scaleY: baseHeight / (obj.height ?? 1),
    });
    obj.setCoords();
  }

  setLayerName(layerId: string, name: string): void {
    const obj = this.findLayerById(layerId);
    if (!obj) return;
    obj.set({ [FOTOBOX_LAYER_NAME]: name.trim() || name });
    this.canvas?.requestRenderAll();
    this.recordHistory();
  }

  setLayerLocked(layerId: string, locked: boolean): void {
    const obj = this.findLayerById(layerId);
    if (!obj) return;
    obj.set({ [FOTOBOX_LOCKED]: locked });
    this.applyLockState(obj, locked);
    this.canvas?.requestRenderAll();
    this.recordHistory();
  }

  setLayerVisible(layerId: string, visible: boolean): void {
    const obj = this.findLayerById(layerId);
    if (!obj || !this.canvas) return;
    obj.set({ visible });
    if (obj.get(FOTOBOX_LAYER_TYPE) === 'photo') {
      const photoId = obj.get(FOTOBOX_LAYER_ID);
      const label = this.canvas
        .getObjects()
        .find(
          (l) =>
            l.get(FOTOBOX_EDITOR_ONLY) && l.get(FOTOBOX_PHOTO_REF) === photoId,
        );
      label?.set({ visible });
    }
    this.canvas.requestRenderAll();
    this.recordHistory();
  }

  private applyLockState(obj: FabricObject, locked: boolean): void {
    obj.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      hasControls: !locked,
    });
  }

  setPhotoBorder(border: Border): void {
    const obj = this.canvas?.getActiveObject();
    if (!obj || obj.get(FOTOBOX_LAYER_TYPE) !== 'photo') return;
    obj.set({ [FOTOBOX_BORDER]: border });
    this.canvas?.requestRenderAll();
    this.recordHistory();
  }

  setProjectBorder(border: Border | undefined): void {
    this.projectBorder = border;
    this.renderEditorOverlays();
    this.recordHistory();
  }

  getProjectBorder(): Border | undefined {
    return this.projectBorder;
  }

  getActiveLayerType(): FotoboxLayerType | null {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1) return null;
    return (objects[0].get(FOTOBOX_LAYER_TYPE) as FotoboxLayerType) ?? null;
  }

  getActiveLayerId(): string | null {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1) return null;
    return (objects[0].get(FOTOBOX_LAYER_ID) as string) ?? null;
  }

  getActivePhotoBorder(): Border | undefined {
    const style = this.getActivePhotoStyle();
    return style?.border;
  }

  getActivePhotoStyle(): PhotoStyle | null {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1) return null;
    const obj = objects[0];
    if (obj.get(FOTOBOX_LAYER_TYPE) !== 'photo') return null;
    return {
      rotation: Math.round(obj.angle ?? 0),
      border: (obj.get(FOTOBOX_BORDER) as Border) ?? DEFAULT_PHOTO_BORDER,
      lockAspect: true,
    };
  }

  updateActivePhotoStyle(style: Partial<PhotoStyle>): void {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1 || !this.canvas) return;
    const obj = objects[0];
    if (obj.get(FOTOBOX_LAYER_TYPE) !== 'photo') return;

    if (style.rotation != null) {
      obj.set({ angle: style.rotation });
      obj.setCoords();
    }
    if (style.border) {
      obj.set({ [FOTOBOX_BORDER]: style.border });
    }

    this.syncPhotoSlotLabels();
    this.canvas.requestRenderAll();
    this.recordHistory();
  }

  getActiveShapeStyle(): ShapeStyle | null {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1) return null;
    const obj = objects[0];
    if (obj.get(FOTOBOX_LAYER_TYPE) !== 'shape') return null;

    const supportsFill = obj.type !== 'line';
    const fill = typeof obj.fill === 'string' ? obj.fill : undefined;
    const stroke = typeof obj.stroke === 'string' ? obj.stroke : undefined;
    const fillAlpha = alphaFromFill(fill);

    return {
      fillColor: colorToHex(fill, '#ef4444'),
      strokeColor: colorToHex(stroke, '#374151'),
      strokeWidth: obj.strokeWidth ?? 0,
      rotation: Math.round(obj.angle ?? 0),
      opacity: Math.round((fillAlpha ?? 1) * (obj.opacity ?? 1) * 100),
      supportsFill,
    };
  }

  updateActiveShapeStyle(style: Partial<ShapeStyle>): void {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1 || !this.canvas) return;
    const obj = objects[0];
    if (obj.get(FOTOBOX_LAYER_TYPE) !== 'shape') return;

    const current = this.getActiveShapeStyle();
    if (!current) return;

    if (current.supportsFill) {
      const fill = typeof obj.fill === 'string' ? obj.fill : undefined;
      if (fill && alphaFromFill(fill) != null) {
        obj.set({ fill: colorToHex(fill, current.fillColor) });
      }
    }

    if (style.fillColor != null && current.supportsFill) {
      obj.set({ fill: style.fillColor });
    }
    if (style.strokeColor != null) {
      obj.set({ stroke: style.strokeColor });
    }
    if (style.strokeWidth != null) {
      obj.set({ strokeWidth: Math.max(0, style.strokeWidth) });
    }
    if (style.rotation != null) {
      obj.set({ angle: style.rotation });
      obj.setCoords();
    }
    if (style.opacity != null) {
      obj.set({
        opacity: Math.min(100, Math.max(0, style.opacity)) / 100,
      });
    }

    this.canvas.requestRenderAll();
    this.recordHistory();
  }

  getActiveTextStyle(): TextStyle | null {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1) return null;
    const obj = objects[0];
    if (obj.get(FOTOBOX_LAYER_TYPE) !== 'text' || !(obj instanceof IText)) {
      return null;
    }
    return {
      content: obj.text ?? '',
      fontFamily: obj.fontFamily ?? 'Arial',
      fontSize: obj.fontSize ?? 48,
      fontWeight: String(obj.fontWeight ?? 'normal'),
      fillColor: colorToHex(
        typeof obj.fill === 'string' ? obj.fill : undefined,
        '#111827',
      ),
      textAlign: obj.textAlign ?? 'left',
      rotation: Math.round(obj.angle ?? 0),
      charSpacing: obj.charSpacing ?? 0,
      lineHeight: obj.lineHeight ?? 1.16,
    };
  }

  updateActiveTextStyle(style: Partial<TextStyle>): void {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1 || !this.canvas) return;
    const obj = objects[0];
    if (obj.get(FOTOBOX_LAYER_TYPE) !== 'text' || !(obj instanceof IText)) {
      return;
    }

    if (style.content != null) obj.set({ text: style.content });
    if (style.fontFamily != null) obj.set({ fontFamily: style.fontFamily });
    if (style.fontSize != null) obj.set({ fontSize: style.fontSize });
    if (style.fontWeight != null) obj.set({ fontWeight: style.fontWeight });
    if (style.fillColor != null) obj.set({ fill: style.fillColor });
    if (style.textAlign != null) obj.set({ textAlign: style.textAlign });
    if (style.rotation != null) {
      obj.set({ angle: style.rotation });
      obj.setCoords();
    }
    if (style.charSpacing != null) obj.set({ charSpacing: style.charSpacing });
    if (style.lineHeight != null) obj.set({ lineHeight: style.lineHeight });

    this.canvas.requestRenderAll();
    this.recordHistory();
  }

  getActiveImageStyle(): ImageStyle | null {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1) return null;
    const obj = objects[0];
    if (obj.get(FOTOBOX_LAYER_TYPE) !== 'image') return null;
    return {
      filename:
        (obj.get(FOTOBOX_ASSET_FILE) as string) ??
        (obj.get(FOTOBOX_LAYER_NAME) as string) ??
        'image',
      opacity: Math.round((obj.opacity ?? 1) * 100),
      flipX: !!obj.flipX,
      flipY: !!obj.flipY,
    };
  }

  updateActiveImageStyle(style: Partial<ImageStyle>): void {
    const objects =
      this.canvas
        ?.getActiveObjects()
        .filter((o) => !o.get(FOTOBOX_EDITOR_ONLY)) ?? [];
    if (objects.length !== 1 || !this.canvas) return;
    const obj = objects[0];
    if (obj.get(FOTOBOX_LAYER_TYPE) !== 'image') return;

    if (style.opacity != null) {
      obj.set({ opacity: Math.min(100, Math.max(0, style.opacity)) / 100 });
    }
    if (style.flipX != null) obj.set({ flipX: style.flipX });
    if (style.flipY != null) obj.set({ flipY: style.flipY });

    this.canvas.requestRenderAll();
    this.recordHistory();
  }

  enterTextEditMode(): void {
    const obj = this.canvas?.getActiveObject();
    if (!obj || !(obj instanceof IText)) return;
    obj.enterEditing();
    this.canvas?.requestRenderAll();
  }

  buildProject(
    id: string,
    name: string,
    width: number,
    height: number,
  ): CollageEditorProject {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    const project: CollageEditorProject = {
      version: COLLAGE_EDITOR_VERSION,
      id,
      name,
      width,
      height,
      border: this.projectBorder,
      fabricJson: this.canvas.toJSON() as Record<string, unknown>,
      layerMeta: this.collectLayerMeta(),
    };
    return prepareProjectForSave(project);
  }

  validateProject(
    width: number,
    height: number,
    id: string,
    name: string,
  ): ProjectValidationIssue[] {
    return validateCollageEditorProject(
      this.buildProject(id, name, width, height),
    );
  }

  private collectLayerMeta(): CollageEditorLayerMeta[] {
    if (!this.canvas) return [];
    return this.canvas.getObjects().flatMap((obj) => {
      if (obj.get(FOTOBOX_EDITOR_ONLY)) return [];
      const type = obj.get(FOTOBOX_LAYER_TYPE) as FotoboxLayerType | undefined;
      const id = obj.get(FOTOBOX_LAYER_ID) as string | undefined;
      if (!type || !id) return [];
      const meta: CollageEditorLayerMeta = {
        id,
        type,
        name: obj.get(FOTOBOX_LAYER_NAME) as string | undefined,
        locked: !!obj.get(FOTOBOX_LOCKED),
        visible: obj.visible !== false,
      };
      if (type === 'photo') {
        meta.border = obj.get(FOTOBOX_BORDER) as Border | undefined;
        meta.photoSlot = obj.get(FOTOBOX_PHOTO_SLOT) as number | undefined;
      }
      if (type === 'image') {
        meta.assetFile = obj.get(FOTOBOX_ASSET_FILE) as string | undefined;
      }
      return [meta];
    });
  }

  loadProject(project: CollageEditorProject): Promise<void> {
    const canvas = this.canvas;
    if (!canvas) {
      throw new Error('Canvas not initialized');
    }
    this.projectBorder = project.border;
    canvas.setDimensions({ width: project.width, height: project.height });
    return canvas.loadFromJSON(project.fabricJson).then(() => {
      this.applyLayerMeta(project.layerMeta);
      this.syncLayerCounterFromObjects();
      this.syncPhotoSlotCounter();
      this.syncPhotoSlotLabels();
      this.ensurePhotoPanesOnTop();
      this.renderEditorOverlays();
      this.viewport.syncCssCanvasSize();
      canvas.requestRenderAll();
      if (this.history.isEnabled()) {
        this.resetHistory();
      }
    });
  }

  async exportBackgroundJpeg(quality = 0.92): Promise<string> {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    const hidden = this.canvas
      .getObjects()
      .filter(
        (obj) =>
          obj.get(FOTOBOX_LAYER_TYPE) === 'photo' ||
          obj.get(FOTOBOX_EDITOR_ONLY),
      );
    const previousVisibility = hidden.map((obj) => obj.visible);
    hidden.forEach((obj) => obj.set({ visible: false }));
    this.hideEditorOverlays(true);
    this.canvas.renderAll();

    const dataUrl = this.canvas.toDataURL({
      format: 'jpeg',
      quality,
      multiplier: 1,
    });

    hidden.forEach((obj, i) => obj.set({ visible: previousVisibility[i] }));
    this.hideEditorOverlays(false);
    this.canvas.requestRenderAll();
    return dataUrl;
  }

  collectImageAssets(): { filename: string; base64: string }[] {
    if (!this.canvas) return [];
    const assets: { filename: string; base64: string }[] = [];
    for (const obj of this.canvas.getObjects()) {
      if (obj.get(FOTOBOX_LAYER_TYPE) !== 'image') continue;
      const filename =
        (obj.get(FOTOBOX_ASSET_FILE) as string) ||
        `asset-${obj.get(FOTOBOX_LAYER_ID)}.png`;
      const src = (obj as FabricImage).getSrc?.() ?? '';
      if (src.startsWith('data:')) {
        const base64 = src.replace(/^data:image\/\w+;base64,/, '');
        assets.push({ filename, base64 });
      }
    }
    return assets;
  }

  getLayerGroups(): LayerGroups {
    const decorations: EditorLayerInfo[] = [];
    const photos: EditorLayerInfo[] = [];
    if (!this.canvas) {
      return {
        background: this.getBackgroundLayerInfo(),
        decorations,
        photos,
      };
    }

    for (const obj of this.canvas.getObjects()) {
      if (obj.get(FOTOBOX_EDITOR_ONLY)) continue;
      const info = this.layerInfoFromObject(obj);
      if (!info) continue;
      if (info.group === 'photo') {
        photos.push(info);
      } else if (info.group === 'decoration') {
        decorations.push(info);
      }
    }

    photos.sort(
      (a, b) => (a.photoSlot ?? 0) - (b.photoSlot ?? 0),
    );
    decorations.reverse();

    return {
      background: this.getBackgroundLayerInfo(),
      decorations,
      photos,
    };
  }

  listLayers(): EditorLayerInfo[] {
    const groups = this.getLayerGroups();
    return [...groups.photos, ...groups.decorations, groups.background];
  }

  private layerInfoFromObject(obj: FabricObject): EditorLayerInfo | null {
    const type = obj.get(FOTOBOX_LAYER_TYPE) as FotoboxLayerType | undefined;
    const id = obj.get(FOTOBOX_LAYER_ID) as string | undefined;
    if (!type || !id) return null;
    const name =
      (obj.get(FOTOBOX_LAYER_NAME) as string) ?? `${type} ${id.split('-').pop()}`;
    return {
      id,
      type,
      label: name,
      name,
      locked: !!obj.get(FOTOBOX_LOCKED),
      visible: obj.visible !== false,
      photoSlot: obj.get(FOTOBOX_PHOTO_SLOT) as number | undefined,
      assetFile: obj.get(FOTOBOX_ASSET_FILE) as string | undefined,
      group: type === 'photo' ? 'photo' : 'decoration',
    };
  }

  getBackgroundLayerInfo(): EditorLayerInfo {
    return {
      id: BACKGROUND_LAYER_ID,
      type: 'background',
      label: 'Background',
      name: 'Background',
      locked: false,
      visible: true,
      fixed: true,
      group: 'background',
    };
  }

  getBackgroundLayer(): EditorLayerInfo {
    return this.getBackgroundLayerInfo();
  }

  getBackgroundColor(): string {
    if (!this.canvas) return '#ffffff';
    const bg = this.canvas.backgroundColor;
    return colorToHex(typeof bg === 'string' ? bg : undefined, '#ffffff');
  }

  setBackgroundColor(color: string): void {
    if (!this.canvas) return;
    this.canvas.backgroundColor = color;
    this.canvas.requestRenderAll();
    this.recordHistory();
  }

  discardSelection(): void {
    this.canvas?.discardActiveObject();
    this.canvas?.requestRenderAll();
  }

  selectLayerById(layerId: string): void {
    if (!this.canvas) return;
    if (layerId === BACKGROUND_LAYER_ID) {
      this.discardSelection();
      return;
    }
    const obj = this.findLayerById(layerId);
    if (obj) {
      this.canvas.setActiveObject(obj);
      this.canvas.requestRenderAll();
    }
  }

  isDirty(): boolean {
    return this.canUndo();
  }

  markSaved(): void {
    this.resetHistory();
  }

  private getPhotoObjects(): FabricObject[] {
    return (
      this.canvas
        ?.getObjects()
        .filter((obj) => obj.get(FOTOBOX_LAYER_TYPE) === 'photo') ?? []
    );
  }

  private getDecorationObjects(): FabricObject[] {
    return (
      this.canvas
        ?.getObjects()
        .filter(
          (obj) =>
            !obj.get(FOTOBOX_EDITOR_ONLY) &&
            obj.get(FOTOBOX_LAYER_TYPE) !== 'photo',
        ) ?? []
    );
  }

  private findLayerById(layerId: string): FabricObject | undefined {
    return this.canvas
      ?.getObjects()
      .find(
        (o) =>
          o.get(FOTOBOX_LAYER_ID) === layerId && !o.get(FOTOBOX_EDITOR_ONLY),
      );
  }

  private renderEditorOverlays(): void {
    if (!this.canvas) return;
    renderEditorOverlays(this.canvas, {
      showGrid: this.showGrid,
      showGuides: this.showGuides,
      showSafeArea: this.showSafeArea,
      safeMargin: this.safeMargin,
      projectBorder: this.projectBorder,
    });
    this.ensurePhotoPanesOnTop();
  }

  private hideEditorOverlays(hide: boolean): void {
    if (!this.canvas) return;
    setEditorOverlaysVisible(this.canvas, !hide);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
