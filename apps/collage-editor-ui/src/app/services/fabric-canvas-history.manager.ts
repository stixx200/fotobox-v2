import type { Canvas } from 'fabric';
import { MAX_HISTORY, type CanvasHistoryState } from './fabric-canvas.types';

export interface FabricHistoryDeps {
  getCanvas: () => Canvas | null;
  captureState: () => CanvasHistoryState;
  restoreState: (state: CanvasHistoryState) => Promise<void>;
  statesEqual: (a: CanvasHistoryState, b: CanvasHistoryState) => boolean;
}

export class FabricCanvasHistoryManager {
  private undoStack: CanvasHistoryState[] = [];
  private redoStack: CanvasHistoryState[] = [];
  private enabled = false;
  private paused = false;
  private debounceTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly deps: FabricHistoryDeps) {}

  isEnabled(): boolean {
    return this.enabled;
  }

  init(): void {
    const canvas = this.deps.getCanvas();
    if (!canvas) return;
    this.enabled = true;
    this.reset();
    canvas.on('object:modified', () => this.record());
  }

  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  async undo(): Promise<void> {
    if (!this.canUndo()) return;
    this.redoStack.push(this.undoStack.pop()!);
    await this.deps.restoreState(this.undoStack[this.undoStack.length - 1]);
  }

  async redo(): Promise<void> {
    if (!this.canRedo()) return;
    const state = this.redoStack.pop()!;
    this.undoStack.push(state);
    await this.deps.restoreState(state);
  }

  reset(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.pushState();
  }

  record(immediate = false): void {
    if (!this.enabled || this.paused) return;
    clearTimeout(this.debounceTimer);
    if (immediate) {
      this.pushState();
      return;
    }
    this.debounceTimer = setTimeout(() => this.pushState(), 400);
  }

  runPaused<T>(fn: () => T | Promise<T>): Promise<T> {
    this.paused = true;
    clearTimeout(this.debounceTimer);
    return Promise.resolve(fn()).finally(() => {
      this.paused = false;
    });
  }

  dispose(): void {
    clearTimeout(this.debounceTimer);
    this.undoStack = [];
    this.redoStack = [];
    this.enabled = false;
  }

  private pushState(): void {
    if (!this.deps.getCanvas() || this.paused) return;
    const state = this.deps.captureState();
    const previous = this.undoStack[this.undoStack.length - 1];
    if (previous && this.deps.statesEqual(previous, state)) {
      return;
    }
    this.undoStack.push(state);
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }
}
