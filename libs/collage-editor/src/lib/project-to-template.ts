import {
  Border,
  PhotoSpace,
  TemplateInterface,
} from '@fotobox/collage-maker';
import { CollageEditorProject, CollageEditorLayerMeta } from './collage-editor-project.interface';
import {
  FOTOBOX_BORDER,
  FOTOBOX_LAYER_TYPE,
  FOTOBOX_LAYER_ID,
} from './constants';

interface FabricLikeObject {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  originX?: string;
  originY?: string;
  [FOTOBOX_LAYER_TYPE]?: string;
  [FOTOBOX_LAYER_ID]?: string;
  [FOTOBOX_BORDER]?: Border;
}

function round(value: number): number {
  return Math.round(value);
}

function objectSize(obj: FabricLikeObject): { width: number; height: number } {
  const scaleX = obj.scaleX ?? 1;
  const scaleY = obj.scaleY ?? 1;
  return {
    width: round((obj.width ?? 0) * scaleX),
    height: round((obj.height ?? 0) * scaleY),
  };
}

/** Collage maker expects top-left placement; Fabric may store center origin after centerObject(). */
function objectTopLeft(obj: FabricLikeObject): { x: number; y: number } {
  const { width, height } = objectSize(obj);
  let x = obj.left ?? 0;
  let y = obj.top ?? 0;
  const originX = obj.originX ?? 'left';
  const originY = obj.originY ?? 'top';

  if (originX === 'center') {
    x -= width / 2;
  } else if (originX === 'right') {
    x -= width;
  }

  if (originY === 'center') {
    y -= height / 2;
  } else if (originY === 'bottom') {
    y -= height;
  }

  return { x: round(x), y: round(y) };
}

export function fabricObjectAxisAlignedBounds(obj: FabricLikeObject): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const { width, height } = objectSize(obj);
  const { x, y } = objectTopLeft(obj);
  return { x, y, width, height };
}

export function photoSpaceFromFabricObject(obj: FabricLikeObject): PhotoSpace {
  const { width, height } = objectSize(obj);
  const { x, y } = objectTopLeft(obj);
  const space: PhotoSpace = {
    type: 'photo',
    width,
    height,
    x,
    y,
  };
  const border = obj[FOTOBOX_BORDER];
  if (border) {
    space.border = border;
  }
  const angle = obj.angle ?? 0;
  if (Math.abs(angle) > 0.01) {
    space.rotation = round(angle);
  }
  return space;
}

export function extractPhotoSpaces(
  fabricJson: Record<string, unknown>,
  layerMeta: CollageEditorLayerMeta[] = [],
): PhotoSpace[] {
  const objects = fabricJson['objects'];
  if (!Array.isArray(objects)) {
    return [];
  }
  const metaById = new Map(layerMeta.map((m) => [m.id, m]));
  return (objects as FabricLikeObject[])
    .filter((obj) => {
      const id = obj[FOTOBOX_LAYER_ID] as string | undefined;
      const type =
        (id && metaById.get(id)?.type) ||
        (obj[FOTOBOX_LAYER_TYPE] as string | undefined);
      return type === 'photo';
    })
    .map((obj) => {
      const id = obj[FOTOBOX_LAYER_ID] as string | undefined;
      const meta = id ? metaById.get(id) : undefined;
      const space = photoSpaceFromFabricObject(obj);
      if (meta?.border) {
        space.border = meta.border;
      }
      return space;
    });
}

export function projectToTemplate(
  project: CollageEditorProject,
): TemplateInterface {
  return {
    id: project.id,
    width: project.width,
    height: project.height,
    border: project.border,
    spaces: extractPhotoSpaces(project.fabricJson, project.layerMeta),
  };
}
