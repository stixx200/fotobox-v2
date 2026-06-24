import {
  Circle,
  Ellipse,
  FabricObject,
  Group,
  Line,
  Path,
  Rect,
  Triangle,
} from 'fabric';

export type DecorationPresetId =
  | 'bubbles'
  | 'balloons'
  | 'confetti'
  | 'hearts'
  | 'sparkles'
  | 'petals'
  | 'bokeh';

const BUBBLE_COLORS = [
  'rgba(147, 197, 253, 0.55)',
  'rgba(196, 181, 253, 0.5)',
  'rgba(249, 168, 212, 0.5)',
  'rgba(165, 243, 252, 0.55)',
  'rgba(253, 186, 116, 0.45)',
  'rgba(167, 243, 208, 0.5)',
  'rgba(255, 255, 255, 0.35)',
];

const BOKEH_COLORS = [
  'rgba(251, 191, 36, 0.35)',
  'rgba(252, 211, 77, 0.4)',
  'rgba(254, 243, 199, 0.45)',
  'rgba(244, 114, 182, 0.25)',
  'rgba(255, 255, 255, 0.4)',
  'rgba(253, 224, 71, 0.3)',
];

const CONFETTI_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#22c55e',
  '#ec4899',
  '#8b5cf6',
  '#f97316',
  '#06b6d4',
  '#ffffff',
];

const HEART_COLORS = [
  '#f43f5e',
  '#fb7185',
  '#fda4af',
  '#fecdd3',
  '#e11d48',
  '#be123c',
];

const PETAL_COLORS = [
  '#fda4af',
  '#fbcfe8',
  '#fecdd3',
  '#fff1f2',
  '#f9a8d4',
  '#fce7f3',
  '#fef3c7',
];

const SPARKLE_COLORS = [
  '#fde047',
  '#ffffff',
  '#fef08a',
  '#fcd34d',
  '#fafafa',
];

const BALLOON_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#22c55e',
  '#ec4899',
  '#8b5cf6',
  '#f97316',
  '#06b6d4',
];

const HEART_PATH =
  'M 50,88 C 20,68 0,48 0,28 C 0,8 20,0 36,0 C 46,0 50,8 50,8 C 50,8 54,0 64,0 C 80,0 100,8 100,28 C 100,48 80,68 50,88 Z';

function decorationGroup(parts: FabricObject[]): Group {
  return new Group(parts, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    subTargetCheck: false,
  });
}

function scatterCount(
  canvasWidth: number,
  canvasHeight: number,
  areaDivisor: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, Math.round((canvasWidth * canvasHeight) / areaDivisor)));
}

function sparkleParts(
  x: number,
  y: number,
  size: number,
  color: string,
  seed: number,
): FabricObject[] {
  const angle = pseudoRandom(seed) * 45;
  const lines: FabricObject[] = [];
  for (let arm = 0; arm < 4; arm++) {
    const rad = ((angle + arm * 45) * Math.PI) / 180;
    const outer = size * (0.75 + pseudoRandom(seed + arm) * 0.35);
    lines.push(
      new Line([x, y, x + Math.cos(rad) * outer, y + Math.sin(rad) * outer], {
        stroke: color,
        strokeWidth: 1.5 + pseudoRandom(seed + arm + 10) * 1.25,
        opacity: 0.65 + pseudoRandom(seed + arm + 20) * 0.35,
      }),
    );
  }
  if (size > 14) {
    lines.push(
      new Circle({
        left: x,
        top: y,
        radius: size * 0.12,
        fill: color,
        opacity: 0.85,
        originX: 'center',
        originY: 'center',
      }),
    );
  }
  return lines;
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function balloonParts(
  x: number,
  y: number,
  scale: number,
  color: string,
  seed: number,
): FabricObject[] {
  const drift = (pseudoRandom(seed + 40) - 0.5) * 24;
  const body = new Ellipse({
    left: x,
    top: y,
    rx: 24 * scale,
    ry: 30 * scale,
    fill: color,
    stroke: 'rgba(15, 23, 42, 0.12)',
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
  });
  const shine = new Ellipse({
    left: x - 10 * scale,
    top: y - 14 * scale,
    rx: 7 * scale,
    ry: 9 * scale,
    fill: 'rgba(255, 255, 255, 0.38)',
    originX: 'center',
    originY: 'center',
  });
  const knot = new Triangle({
    left: x,
    top: y + 28 * scale,
    width: 9 * scale,
    height: 7 * scale,
    fill: color,
    angle: 180,
    originX: 'center',
    originY: 'center',
  });
  const stringEndY = y + 28 * scale + 55 * scale + pseudoRandom(seed + 50) * 30;
  const string = new Line([x, y + 32 * scale, x + drift, stringEndY], {
    stroke: 'rgba(100, 116, 139, 0.75)',
    strokeWidth: 1.25,
  });
  return [body, shine, knot, string];
}

export function buildBubblesDecoration(
  canvasWidth: number,
  canvasHeight: number,
): Group {
  const parts: FabricObject[] = [];
  const count = Math.min(
    80,
    Math.max(35, Math.round((canvasWidth * canvasHeight) / 38000)),
  );

  for (let i = 0; i < count; i++) {
    const radius = pseudoRandom(i * 3 + 1) * 48 + 12;
    const x = pseudoRandom(i * 3 + 2) * (canvasWidth + radius * 2) - radius;
    const y = pseudoRandom(i * 3 + 3) * (canvasHeight + radius * 2) - radius;
    const color = BUBBLE_COLORS[i % BUBBLE_COLORS.length];
    const opacity = 0.45 + pseudoRandom(i * 7) * 0.45;

    parts.push(
      new Circle({
        left: x,
        top: y,
        radius,
        fill: color,
        stroke: 'rgba(255, 255, 255, 0.55)',
        strokeWidth: 1.5,
        opacity,
        originX: 'center',
        originY: 'center',
      }),
    );

    if (radius > 22) {
      parts.push(
        new Circle({
          left: x - radius * 0.28,
          top: y - radius * 0.32,
          radius: radius * 0.14,
          fill: 'rgba(255, 255, 255, 0.5)',
          originX: 'center',
          originY: 'center',
        }),
      );
    }
  }

  return new Group(parts, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    subTargetCheck: false,
  });
}

export function buildBalloonsDecoration(
  canvasWidth: number,
  canvasHeight: number,
): Group {
  const parts: FabricObject[] = [];
  const count = Math.min(
    20,
    Math.max(10, Math.round((canvasWidth * canvasHeight) / 180000)),
  );

  for (let i = 0; i < count; i++) {
    const x = pseudoRandom(i * 5 + 1) * canvasWidth;
    const y = pseudoRandom(i * 5 + 2) * canvasHeight * 0.82 + canvasHeight * 0.02;
    const scale = 0.65 + pseudoRandom(i * 5 + 3) * 0.9;
    const color = BALLOON_COLORS[i % BALLOON_COLORS.length];
    parts.push(...balloonParts(x, y, scale, color, i * 5));
  }

  return new Group(parts, {
    left: 0,
    top: 0,
    originX: 'left',
    originY: 'top',
    subTargetCheck: false,
  });
}

export function buildConfettiDecoration(
  canvasWidth: number,
  canvasHeight: number,
): Group {
  const parts: FabricObject[] = [];
  const count = scatterCount(canvasWidth, canvasHeight, 12000, 60, 140);

  for (let i = 0; i < count; i++) {
    const x = pseudoRandom(i * 4 + 1) * canvasWidth;
    const y = pseudoRandom(i * 4 + 2) * canvasHeight;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const angle = pseudoRandom(i * 4 + 3) * 360;
    const isRect = pseudoRandom(i * 4 + 4) > 0.35;
    const size = 4 + pseudoRandom(i * 4 + 5) * 10;

    if (isRect) {
      parts.push(
        new Rect({
          left: x,
          top: y,
          width: size * 1.4,
          height: size * 0.55,
          fill: color,
          angle,
          opacity: 0.75 + pseudoRandom(i * 4 + 6) * 0.25,
          originX: 'center',
          originY: 'center',
        }),
      );
    } else {
      parts.push(
        new Circle({
          left: x,
          top: y,
          radius: size * 0.45,
          fill: color,
          opacity: 0.8 + pseudoRandom(i * 4 + 6) * 0.2,
          originX: 'center',
          originY: 'center',
        }),
      );
    }
  }

  return decorationGroup(parts);
}

export function buildHeartsDecoration(
  canvasWidth: number,
  canvasHeight: number,
): Group {
  const parts: FabricObject[] = [];
  const count = scatterCount(canvasWidth, canvasHeight, 45000, 18, 45);

  for (let i = 0; i < count; i++) {
    const x = pseudoRandom(i * 6 + 1) * canvasWidth;
    const y = pseudoRandom(i * 6 + 2) * canvasHeight;
    const scale = 0.18 + pseudoRandom(i * 6 + 3) * 0.55;
    const color = HEART_COLORS[i % HEART_COLORS.length];
    const opacity = 0.35 + pseudoRandom(i * 6 + 4) * 0.55;

    parts.push(
      new Path(HEART_PATH, {
        left: x,
        top: y,
        fill: color,
        scaleX: scale,
        scaleY: scale,
        angle: pseudoRandom(i * 6 + 5) * 360,
        opacity,
        originX: 'center',
        originY: 'center',
      }),
    );
  }

  return decorationGroup(parts);
}

export function buildSparklesDecoration(
  canvasWidth: number,
  canvasHeight: number,
): Group {
  const parts: FabricObject[] = [];
  const count = scatterCount(canvasWidth, canvasHeight, 55000, 25, 70);

  for (let i = 0; i < count; i++) {
    const x = pseudoRandom(i * 7 + 1) * canvasWidth;
    const y = pseudoRandom(i * 7 + 2) * canvasHeight;
    const size = 8 + pseudoRandom(i * 7 + 3) * 22;
    const color = SPARKLE_COLORS[i % SPARKLE_COLORS.length];
    parts.push(...sparkleParts(x, y, size, color, i * 7));
  }

  return decorationGroup(parts);
}

export function buildPetalsDecoration(
  canvasWidth: number,
  canvasHeight: number,
): Group {
  const parts: FabricObject[] = [];
  const count = scatterCount(canvasWidth, canvasHeight, 28000, 35, 90);

  for (let i = 0; i < count; i++) {
    const x = pseudoRandom(i * 8 + 1) * (canvasWidth + 40) - 20;
    const y = pseudoRandom(i * 8 + 2) * (canvasHeight + 60) - 30;
    const color = PETAL_COLORS[i % PETAL_COLORS.length];
    const scale = 0.55 + pseudoRandom(i * 8 + 3) * 1.1;
    const angle = pseudoRandom(i * 8 + 4) * 360;

    parts.push(
      new Ellipse({
        left: x,
        top: y,
        rx: 7 * scale,
        ry: 16 * scale,
        fill: color,
        angle,
        opacity: 0.45 + pseudoRandom(i * 8 + 5) * 0.45,
        originX: 'center',
        originY: 'center',
      }),
    );
  }

  return decorationGroup(parts);
}

export function buildBokehDecoration(
  canvasWidth: number,
  canvasHeight: number,
): Group {
  const parts: FabricObject[] = [];
  const count = scatterCount(canvasWidth, canvasHeight, 42000, 28, 65);

  for (let i = 0; i < count; i++) {
    const radius = pseudoRandom(i * 9 + 1) * 55 + 18;
    const x = pseudoRandom(i * 9 + 2) * (canvasWidth + radius * 2) - radius;
    const y = pseudoRandom(i * 9 + 3) * (canvasHeight + radius * 2) - radius;
    const color = BOKEH_COLORS[i % BOKEH_COLORS.length];
    const opacity = 0.35 + pseudoRandom(i * 9 + 4) * 0.45;

    parts.push(
      new Circle({
        left: x,
        top: y,
        radius,
        fill: color,
        stroke: 'rgba(255, 255, 255, 0.35)',
        strokeWidth: 1.25,
        opacity,
        originX: 'center',
        originY: 'center',
      }),
    );

    if (radius > 28) {
      parts.push(
        new Circle({
          left: x - radius * 0.25,
          top: y - radius * 0.3,
          radius: radius * 0.12,
          fill: 'rgba(255, 255, 255, 0.45)',
          originX: 'center',
          originY: 'center',
        }),
      );
    }
  }

  return decorationGroup(parts);
}

const PRESET_BUILDERS: Record<
  DecorationPresetId,
  (width: number, height: number) => Group
> = {
  bubbles: buildBubblesDecoration,
  balloons: buildBalloonsDecoration,
  confetti: buildConfettiDecoration,
  hearts: buildHeartsDecoration,
  sparkles: buildSparklesDecoration,
  petals: buildPetalsDecoration,
  bokeh: buildBokehDecoration,
};

export const DECORATION_PRESET_LABELS: Record<DecorationPresetId, string> = {
  bubbles: 'Bubbles background',
  balloons: 'Balloons background',
  confetti: 'Confetti',
  hearts: 'Hearts',
  sparkles: 'Sparkles',
  petals: 'Flower petals',
  bokeh: 'Bokeh lights',
};

export function buildDecorationPreset(
  preset: DecorationPresetId,
  canvasWidth: number,
  canvasHeight: number,
): Group {
  return PRESET_BUILDERS[preset](canvasWidth, canvasHeight);
}
