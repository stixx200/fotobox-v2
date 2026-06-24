import {
  ActiveSelection,
  Line,
  Point,
  type Canvas,
  type FabricObject,
} from 'fabric';
import {
  FOTOBOX_EDITOR_ONLY,
  FOTOBOX_LOCKED,
} from '@fotobox/collage-editor/browser';
import {
  FOTOBOX_SMART_GUIDE,
  GRID_SIZE,
  MAGNETIC_ORIGIN_X,
  MAGNETIC_ORIGIN_Y,
  MAGNETIC_RELEASE_SCREEN_PX,
  MAGNETIC_SNAP_SCREEN_PX,
  SMART_GUIDE_COLOR,
  SNAP_THRESHOLD,
  type LayerBounds,
  type MagneticAxisLock,
  type MagneticEdgeIndex,
} from './fabric-canvas.types';
import { boundsFromObject } from './fabric-canvas.utils';

export interface FabricSnappingDeps {
  getCanvas: () => Canvas | null;
  getZoomLevel: () => number;
  isMagneticGuidesEnabled: () => boolean;
  isSnapEnabled: () => boolean;
  getShowGrid: () => boolean;
  getShowSafeArea: () => boolean;
  getSafeMargin: () => number;
  ensurePhotoPanesOnTop: () => void;
}

export class FabricCanvasSnappingController {
  private magneticDragActive = false;
  private magneticLockX: MagneticAxisLock | null = null;
  private magneticLockY: MagneticAxisLock | null = null;
  private smartGuideLineV: Line | null = null;
  private smartGuideLineH: Line | null = null;
  private smartGuideVPos: number | null = null;
  private smartGuideHPos: number | null = null;

  constructor(private readonly deps: FabricSnappingDeps) {}

  dispose(): void {
    this.clearSmartGuideLines();
    this.clearMagneticLocks();
    this.magneticDragActive = false;
  }

  onObjectMoving(obj: FabricObject): void {
    if (obj.get(FOTOBOX_EDITOR_ONLY) || obj.get(FOTOBOX_LOCKED)) {
      return;
    }
    if (this.deps.isMagneticGuidesEnabled()) {
      this.beginMagneticDragIfNeeded();
      this.applyMagneticGuides(obj, true);
    } else {
      this.clearSmartGuideLines();
      if (this.deps.isSnapEnabled()) {
        this.applyGridSnap(obj);
      }
    }
  }

  onObjectModified(obj: FabricObject | undefined): void {
    if (
      obj &&
      this.deps.isMagneticGuidesEnabled() &&
      !obj.get(FOTOBOX_EDITOR_ONLY) &&
      !obj.get(FOTOBOX_LOCKED)
    ) {
      this.applyMagneticGuides(obj, false);
    }
    this.endMagneticDrag();
    this.clearSmartGuideLines();
  }

  onMouseUp(): void {
    if (!this.magneticDragActive) {
      this.clearMagneticLocks();
      this.clearSmartGuideLines();
    }
  }

  clearSmartGuideLines(): void {
    const canvas = this.deps.getCanvas();
    if (!canvas) return;
    if (this.smartGuideLineV) {
      canvas.remove(this.smartGuideLineV);
      this.smartGuideLineV = null;
    }
    if (this.smartGuideLineH) {
      canvas.remove(this.smartGuideLineH);
      this.smartGuideLineH = null;
    }
    this.smartGuideVPos = null;
    this.smartGuideHPos = null;
    canvas.requestRenderAll();
  }

  private beginMagneticDragIfNeeded(): void {
    if (this.magneticDragActive) return;
    this.magneticDragActive = true;
    this.clearMagneticLocks();
  }

  private endMagneticDrag(): void {
    this.magneticDragActive = false;
    this.clearMagneticLocks();
  }

  private clearMagneticLocks(): void {
    this.magneticLockX = null;
    this.magneticLockY = null;
  }

  private magneticThresholds(): { snap: number; release: number } {
    const zoom = Math.max(0.1, this.deps.getZoomLevel());
    return {
      snap: Math.max(3, MAGNETIC_SNAP_SCREEN_PX / zoom),
      release: Math.max(5, MAGNETIC_RELEASE_SCREEN_PX / zoom),
    };
  }

  private movingEdges(bounds: LayerBounds): {
    x: [number, number, number];
    y: [number, number, number];
  } {
    return {
      x: [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width],
      y: [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height],
    };
  }

  private resolveAxisLock(
    edges: [number, number, number],
    targets: number[],
    lock: MagneticAxisLock | null,
    snapThreshold: number,
    releaseThreshold: number,
    allowAcquire: boolean,
  ): { guideLine: number | null; lock: MagneticAxisLock | null } {
    if (lock) {
      const edgeValue = edges[lock.edgeIndex];
      const dist = Math.abs(edgeValue - lock.target);
      if (dist <= releaseThreshold) {
        return { guideLine: lock.target, lock };
      }
      if (!allowAcquire) {
        return { guideLine: null, lock: null };
      }
    } else if (!allowAcquire) {
      return { guideLine: null, lock: null };
    }

    let bestDist = snapThreshold + 1;
    let bestLock: MagneticAxisLock | null = null;

    for (let i = 0; i < 3; i++) {
      const edgeIndex = i as MagneticEdgeIndex;
      const edgeValue = edges[edgeIndex];
      for (const target of targets) {
        const dist = Math.abs(edgeValue - target);
        if (dist <= snapThreshold && dist < bestDist) {
          bestDist = dist;
          bestLock = { target, edgeIndex };
        }
      }
    }

    if (!bestLock) {
      return { guideLine: null, lock: null };
    }

    return { guideLine: bestLock.target, lock: bestLock };
  }

  private resolveMagneticLocks(
    movingEdgesX: [number, number, number],
    targetXs: number[],
    movingEdgesY: [number, number, number],
    targetYs: number[],
    snap: number,
    release: number,
    allowAcquire: boolean,
  ): {
    lockX: MagneticAxisLock | null;
    lockY: MagneticAxisLock | null;
    guideX: number | null;
    guideY: number | null;
  } {
    const snapX = this.resolveAxisLock(
      movingEdgesX,
      targetXs,
      this.magneticLockX,
      snap,
      release,
      allowAcquire,
    );
    const snapY = this.resolveAxisLock(
      movingEdgesY,
      targetYs,
      this.magneticLockY,
      snap,
      release,
      allowAcquire,
    );

    return {
      lockX: snapX.lock,
      lockY: snapY.lock,
      guideX: snapX.guideLine,
      guideY: snapY.guideLine,
    };
  }

  private applyMagneticLocks(
    target: FabricObject,
    lockX: MagneticAxisLock | null,
    lockY: MagneticAxisLock | null,
  ): void {
    if (!lockX && !lockY) {
      return;
    }

    target.setCoords();
    const center = target.getCenterPoint();

    if (lockX && lockY) {
      target.setPositionByOrigin(
        new Point(lockX.target, lockY.target),
        MAGNETIC_ORIGIN_X[lockX.edgeIndex],
        MAGNETIC_ORIGIN_Y[lockY.edgeIndex],
      );
    } else if (lockX) {
      target.setPositionByOrigin(
        new Point(lockX.target, center.y),
        MAGNETIC_ORIGIN_X[lockX.edgeIndex],
        'center',
      );
    } else if (lockY) {
      target.setPositionByOrigin(
        new Point(center.x, lockY.target),
        'center',
        MAGNETIC_ORIGIN_Y[lockY.edgeIndex],
      );
    }

    target.setCoords();
  }

  private applyMagneticGuides(
    target: FabricObject,
    allowAcquire: boolean,
  ): void {
    const canvas = this.deps.getCanvas();
    if (!canvas) return;

    target.setCoords();

    const excluded = this.excludedFromSnap(target);
    const bounds = boundsFromObject(target, false);
    const canvasW = canvas.getWidth();
    const canvasH = canvas.getHeight();
    const { snap, release } = this.magneticThresholds();
    const { xs: targetXs, ys: targetYs } = this.collectMagneticTargets(
      excluded,
      canvasW,
      canvasH,
    );
    const { x: movingEdgesX, y: movingEdgesY } = this.movingEdges(bounds);

    const resolved = this.resolveMagneticLocks(
      movingEdgesX,
      targetXs,
      movingEdgesY,
      targetYs,
      snap,
      release,
      allowAcquire,
    );

    this.magneticLockX = resolved.lockX;
    this.magneticLockY = resolved.lockY;

    this.applyMagneticLocks(target, resolved.lockX, resolved.lockY);

    this.updateSmartGuideLines(resolved.guideX, resolved.guideY);
  }

  private collectMagneticTargets(
    excluded: Set<FabricObject>,
    canvasW: number,
    canvasH: number,
  ): { xs: number[]; ys: number[] } {
    const xs = new Set<number>([0, canvasW / 2, canvasW]);
    const ys = new Set<number>([0, canvasH / 2, canvasH]);

    if (this.deps.getShowSafeArea()) {
      const m = this.deps.getSafeMargin();
      xs.add(m);
      xs.add(canvasW - m);
      ys.add(m);
      ys.add(canvasH - m);
    }

    const canvas = this.deps.getCanvas();
    if (!canvas) {
      return { xs: [...xs], ys: [...ys] };
    }

    for (const other of canvas.getObjects()) {
      if (excluded.has(other) || other.get(FOTOBOX_EDITOR_ONLY)) {
        continue;
      }
      const b = boundsFromObject(other);
      xs.add(b.x);
      xs.add(b.x + b.width / 2);
      xs.add(b.x + b.width);
      ys.add(b.y);
      ys.add(b.y + b.height / 2);
      ys.add(b.y + b.height);
    }

    return { xs: [...xs], ys: [...ys] };
  }

  private applyGridSnap(obj: FabricObject): void {
    if (!this.deps.getShowGrid()) return;

    const gridSnapX = Math.round((obj.left ?? 0) / GRID_SIZE) * GRID_SIZE;
    const gridSnapY = Math.round((obj.top ?? 0) / GRID_SIZE) * GRID_SIZE;
    let snapX: number | null = null;
    let snapY: number | null = null;

    if (Math.abs((obj.left ?? 0) - gridSnapX) <= SNAP_THRESHOLD) {
      snapX = gridSnapX;
    }
    if (Math.abs((obj.top ?? 0) - gridSnapY) <= SNAP_THRESHOLD) {
      snapY = gridSnapY;
    }

    if (snapX != null || snapY != null) {
      obj.set({
        left: snapX ?? obj.left,
        top: snapY ?? obj.top,
      });
      obj.setCoords();
    }
  }

  private excludedFromSnap(target: FabricObject): Set<FabricObject> {
    if (target instanceof ActiveSelection) {
      return new Set(target.getObjects());
    }
    return new Set([target]);
  }

  private createSmartGuideLine(
    coords: [number, number, number, number],
  ): Line {
    const line = new Line(coords, {
      stroke: SMART_GUIDE_COLOR,
      strokeWidth: 1,
      strokeDashArray: [5, 4],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    line.set({
      [FOTOBOX_EDITOR_ONLY]: true,
      [FOTOBOX_SMART_GUIDE]: true,
    });
    return line;
  }

  private updateSmartGuideLines(
    vertical: number | null,
    horizontal: number | null,
  ): void {
    const canvas = this.deps.getCanvas();
    if (!canvas) return;

    if (
      vertical === this.smartGuideVPos &&
      horizontal === this.smartGuideHPos
    ) {
      return;
    }

    this.smartGuideVPos = vertical;
    this.smartGuideHPos = horizontal;

    const w = canvas.getWidth();
    const h = canvas.getHeight();

    if (vertical == null) {
      if (this.smartGuideLineV) {
        canvas.remove(this.smartGuideLineV);
        this.smartGuideLineV = null;
      }
    } else if (this.smartGuideLineV) {
      this.smartGuideLineV.set({ x1: vertical, y1: 0, x2: vertical, y2: h });
      this.smartGuideLineV.setCoords();
    } else {
      this.smartGuideLineV = this.createSmartGuideLine([
        vertical,
        0,
        vertical,
        h,
      ]);
      canvas.add(this.smartGuideLineV);
    }

    if (horizontal == null) {
      if (this.smartGuideLineH) {
        canvas.remove(this.smartGuideLineH);
        this.smartGuideLineH = null;
      }
    } else if (this.smartGuideLineH) {
      this.smartGuideLineH.set({
        x1: 0,
        y1: horizontal,
        x2: w,
        y2: horizontal,
      });
      this.smartGuideLineH.setCoords();
    } else {
      this.smartGuideLineH = this.createSmartGuideLine([
        0,
        horizontal,
        w,
        horizontal,
      ]);
      canvas.add(this.smartGuideLineH);
    }

    if (vertical != null || horizontal != null) {
      this.deps.ensurePhotoPanesOnTop();
      if (this.smartGuideLineV) {
        canvas.bringObjectToFront(this.smartGuideLineV);
      }
      if (this.smartGuideLineH) {
        canvas.bringObjectToFront(this.smartGuideLineH);
      }
    }

    canvas.requestRenderAll();
  }
}
