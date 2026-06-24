import { describe, expect, it } from 'vitest';
import { calculateWidthHeight } from './helper';

describe('calculateWidthHeight', () => {
  it('subtracts border widths from the content box', () => {
    expect(
      calculateWidthHeight(100, 80, {
        background: { r: 255, g: 255, b: 255 },
        top: 2,
        bottom: 4,
        left: 3,
        right: 5,
      }),
    ).toEqual({ width: 92, height: 74 });
  });
});
