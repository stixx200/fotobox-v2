import { CollageEditorProject } from './collage-editor-project.interface';
import {
  FOTOBOX_ASSET_FILE,
  FOTOBOX_EDITOR_ONLY,
  FOTOBOX_LAYER_TYPE,
} from './constants';

interface FabricLikeObject {
  type?: string;
  src?: string;
  [FOTOBOX_LAYER_TYPE]?: string;
  [FOTOBOX_ASSET_FILE]?: string;
  [FOTOBOX_EDITOR_ONLY]?: boolean;
}

/**
 * Strips editor-only overlays and inline image data from fabric JSON so saves
 * stay smaller (images are uploaded separately in assets[]).
 */
export function prepareProjectForSave(
  project: CollageEditorProject,
): CollageEditorProject {
  const fabricJson = structuredClone(project.fabricJson);
  const objects = fabricJson['objects'];
  if (!Array.isArray(objects)) {
    return project;
  }

  const filtered: FabricLikeObject[] = [];
  for (const raw of objects as FabricLikeObject[]) {
    if (raw[FOTOBOX_EDITOR_ONLY]) {
      continue;
    }
    const clone = structuredClone(raw);
    if (
      clone[FOTOBOX_LAYER_TYPE] === 'image' &&
      typeof clone.src === 'string' &&
      clone.src.startsWith('data:')
    ) {
      clone.src = clone[FOTOBOX_ASSET_FILE]
        ? `asset://${clone[FOTOBOX_ASSET_FILE]}`
        : '';
    }
    filtered.push(clone);
  }

  fabricJson['objects'] = filtered;
  return { ...project, fabricJson };
}
