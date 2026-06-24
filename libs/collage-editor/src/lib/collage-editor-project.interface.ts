import type { Border } from '@fotobox/collage-maker';
import type { FotoboxLayerType } from './constants';
import { COLLAGE_EDITOR_VERSION } from './constants';

export interface CollageEditorLayerMeta {
  id: string;
  type: FotoboxLayerType;
  /** User-visible layer name in the sidebar. */
  name?: string;
  locked?: boolean;
  visible?: boolean;
  /** Capture order label for photo panes (1-based). */
  photoSlot?: number;
  border?: Border;
  assetFile?: string;
}

export interface CollageEditorProject {
  version: typeof COLLAGE_EDITOR_VERSION;
  id: string;
  name?: string;
  width: number;
  height: number;
  border?: Border;
  /** Serialized Fabric.js canvas JSON (objects + background). */
  fabricJson: Record<string, unknown>;
  /** Layer metadata keyed by fotoboxLayerId (survives Fabric serialization). */
  layerMeta: CollageEditorLayerMeta[];
}

export interface CollageEditorProjectSummary {
  id: string;
  name?: string;
  width: number;
  height: number;
  updatedAt?: string;
  thumbnailBase64?: string;
}

export interface CollageEditorAssetInput {
  filename: string;
  base64: string;
}

export interface SaveCollageEditorProjectInput {
  project: CollageEditorProject;
  backgroundBase64: string;
  assets?: CollageEditorAssetInput[];
  overwrite?: boolean;
}
