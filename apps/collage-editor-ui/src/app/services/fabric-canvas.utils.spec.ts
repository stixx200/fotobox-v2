import { findFreePosition } from './fabric-canvas.utils';

describe('findFreePosition', () => {
  it('uses the centre when it is free', () => {
    expect(findFreePosition(1000, 600, 200, 100, [])).toEqual({
      x: 400,
      y: 250,
    });
  });

  it('picks a non-overlapping cell when the centre is taken', () => {
    const occupied = [{ x: 400, y: 250, width: 200, height: 100 }];
    const pos = findFreePosition(1000, 600, 200, 100, occupied) ?? {
      x: -1,
      y: -1,
    };
    const overlaps =
      pos.x < 600 && pos.x + 200 > 400 && pos.y < 350 && pos.y + 100 > 250;
    expect(overlaps).toBe(false);
    expect(pos.x).toBeGreaterThanOrEqual(24);
    expect(pos.y).toBeGreaterThanOrEqual(24);
    expect(pos.y + 100).toBeLessThanOrEqual(576);
  });

  it('returns null when the box cannot fit anywhere', () => {
    const occupied = [{ x: 0, y: 0, width: 300, height: 300 }];
    expect(findFreePosition(300, 300, 250, 250, occupied)).toBeNull();
  });
});
