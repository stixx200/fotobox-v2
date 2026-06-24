export const COLLAGE_EDITOR_VERSION = 1 as const;
export const SIDECAR_FILENAME = 'template.editor.json';
export const BACKGROUND_FILENAME = 'background.jpg';
export const INDEX_JS_FILENAME = 'index.js';
export const ASSETS_DIR = 'assets';

export const FOTOBOX_LAYER_TYPE = 'fotoboxLayerType';
export const FOTOBOX_LAYER_ID = 'fotoboxLayerId';
export const FOTOBOX_BORDER = 'fotoboxBorder';
export const FOTOBOX_ASSET_FILE = 'fotoboxAssetFile';
export const FOTOBOX_LAYER_NAME = 'fotoboxLayerName';
export const FOTOBOX_LOCKED = 'fotoboxLocked';
export const FOTOBOX_PHOTO_SLOT = 'fotoboxPhotoSlot';
export const FOTOBOX_EDITOR_ONLY = 'fotoboxEditorOnly';
export const FOTOBOX_PHOTO_REF = 'fotoboxPhotoRef';

/** Virtual layer id for the canvas background (not a Fabric object). */
export const BACKGROUND_LAYER_ID = '__background__';

export type FotoboxLayerType =
  | 'photo'
  | 'text'
  | 'image'
  | 'shape'
  | 'background';

/** Default photo pane aspect ratio (width / height). */
export const PHOTO_ASPECT_RATIO = 3 / 2;

/** Editor safe-area inset from each canvas edge (px). */
export const DEFAULT_SAFE_MARGIN = 40;
