export interface Color {
  r: number;
  g: number;
  b: number;
  alpha?: number;
}

export interface Border {
  background: Color;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PhotoSpace {
  type: 'photo';
  width: number;
  height: number;
  x: number;
  y: number;
  border?: Border;
  rotation?: number;
}

export type Space = PhotoSpace;

export interface TemplateInterface {
  id: string;
  width: number;
  height: number;
  spaces: Space[];
  background?: string;
  border?: Border;
}
