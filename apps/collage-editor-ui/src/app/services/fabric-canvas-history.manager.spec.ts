import type { Canvas } from 'fabric';
import { FabricCanvasHistoryManager } from './fabric-canvas-history.manager';
import type { CanvasHistoryState } from './fabric-canvas.types';

describe('FabricCanvasHistoryManager dirty tracking', () => {
  let current: string;
  let history: FabricCanvasHistoryManager;

  beforeEach(() => {
    current = 'a';
    const canvas = { on: () => undefined } as unknown as Canvas;
    history = new FabricCanvasHistoryManager({
      getCanvas: () => canvas,
      captureState: () => current as unknown as CanvasHistoryState,
      restoreState: async (state) => {
        current = state as unknown as string;
      },
      statesEqual: (a, b) => a === b,
    });
    history.init();
  });

  it('is clean right after init', () => {
    expect(history.isDirty()).toBe(false);
  });

  it('becomes dirty after a change and clean after markSaved', () => {
    current = 'b';
    history.record(true);
    expect(history.isDirty()).toBe(true);
    history.markSaved();
    expect(history.isDirty()).toBe(false);
  });

  it('keeps undo available after saving', async () => {
    current = 'b';
    history.record(true);
    history.markSaved();
    expect(history.canUndo()).toBe(true);
    await history.undo();
    expect(current).toBe('a');
    expect(history.isDirty()).toBe(true);
  });

  it('is clean again when undo returns to the saved state', async () => {
    current = 'b';
    history.record(true);
    expect(history.isDirty()).toBe(true);
    await history.undo();
    expect(history.isDirty()).toBe(false);
  });
});
