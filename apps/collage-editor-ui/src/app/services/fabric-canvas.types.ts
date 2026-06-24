import type { TOriginX, TOriginY } from 'fabric';
import type { Border, FotoboxLayerType } from '@fotobox/collage-editor/browser';
import {
  FOTOBOX_ASSET_FILE,
  FOTOBOX_BORDER,
  FOTOBOX_EDITOR_ONLY,
  FOTOBOX_LAYER_ID,
  FOTOBOX_LAYER_NAME,
  FOTOBOX_LAYER_TYPE,
  FOTOBOX_LOCKED,
  FOTOBOX_PHOTO_REF,
  FOTOBOX_PHOTO_SLOT,
} from '@fotobox/collage-editor/browser';
import type { CollageEditorLayerMeta } from '@fotobox/collage-editor/browser';

export const DEFAULT_PHOTO_PANE_WIDTH = 450;
export const DEFAULT_PHOTO_PANE_HEIGHT = 300;

export const DEFAULT_PHOTO_BORDER: Border = {
  background: { r: 255, g: 255, b: 255 },
  top: 4,
  bottom: 4,
  left: 4,
  right: 4,
};

export const HISTORY_PROPERTIES = [
  FOTOBOX_LAYER_TYPE,
  FOTOBOX_LAYER_ID,
  FOTOBOX_BORDER,
  FOTOBOX_ASSET_FILE,
  FOTOBOX_LAYER_NAME,
  FOTOBOX_LOCKED,
  FOTOBOX_PHOTO_SLOT,
  FOTOBOX_EDITOR_ONLY,
  FOTOBOX_PHOTO_REF,
] as const;

export const MAX_HISTORY = 50;
export const VIEWPORT_PADDING = 8;
export const GRID_SIZE = 10;
export const SNAP_THRESHOLD = 8;
export const MAGNETIC_SNAP_SCREEN_PX = 12;
export const MAGNETIC_RELEASE_SCREEN_PX = 32;
export const FOTOBOX_SMART_GUIDE = 'fotoboxSmartGuide';
export const SMART_GUIDE_COLOR = '#ec4899';

export type MagneticEdgeIndex = 0 | 1 | 2;

export interface MagneticAxisLock {
  target: number;
  edgeIndex: MagneticEdgeIndex;
}

export const MAGNETIC_ORIGIN_X: TOriginX[] = ['left', 'center', 'right'];
export const MAGNETIC_ORIGIN_Y: TOriginY[] = ['top', 'center', 'bottom'];

export interface CanvasHistoryState {
  fabricJson: Record<string, unknown>;
  layerMeta: CollageEditorLayerMeta[];
  backgroundColor: string;
  projectBorder?: Border;
}

export interface LayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignMode =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'center-h'
  | 'center-v';

export type DistributeMode = 'horizontal' | 'vertical';

export interface ShapeStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  rotation: number;
  opacity: number;
  supportsFill: boolean;
}

export interface TextStyle {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fillColor: string;
  textAlign: string;
  rotation: number;
  charSpacing: number;
  lineHeight: number;
}

export interface PhotoStyle {
  rotation: number;
  border: Border;
  lockAspect: boolean;
}

export interface ImageStyle {
  filename: string;
  opacity: number;
  flipX: boolean;
  flipY: boolean;
}

export interface EditorLayerInfo {
  id: string;
  type: FotoboxLayerType | 'background';
  label: string;
  name: string;
  locked: boolean;
  visible: boolean;
  photoSlot?: number;
  assetFile?: string;
  fixed?: boolean;
  group: 'background' | 'decoration' | 'photo';
}

export interface LayerGroups {
  background: EditorLayerInfo;
  decorations: EditorLayerInfo[];
  photos: EditorLayerInfo[];
}

export type ZoomMode = 'fit' | '100' | 'manual';
