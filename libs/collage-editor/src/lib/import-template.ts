import { TemplateInterface } from '@fotobox/collage-maker';
import {
  CollageEditorProject,
  CollageEditorLayerMeta,
} from './collage-editor-project.interface';
import { COLLAGE_EDITOR_VERSION } from './constants';
import { photoSpaceFromFabricObject } from './project-to-template';

function photoRectFromSpace(space: TemplateInterface['spaces'][number]) {
  const width = space.width;
  const height = space.height;
  return {
    type: 'rect',
    version: '6.0.0',
    originX: 'left',
    originY: 'top',
    left: space.x,
    top: space.y,
    width,
    height,
    fill: 'rgba(200, 220, 255, 0.35)',
    stroke: '#2563eb',
    strokeWidth: 2,
    strokeDashArray: [8, 4],
    angle: space.rotation ?? 0,
    scaleX: 1,
    scaleY: 1,
    fotoboxLayerType: 'photo',
    fotoboxLayerId: `photo-${space.x}-${space.y}`,
    fotoboxBorder: space.border,
  };
}

export function templateToPartialProject(
  template: TemplateInterface,
  options?: { name?: string; backgroundDataUrl?: string },
): CollageEditorProject {
  const objects: Record<string, unknown>[] = [];

  if (options?.backgroundDataUrl) {
    objects.push({
      type: 'image',
      version: '6.0.0',
      originX: 'left',
      originY: 'top',
      left: 0,
      top: 0,
      selectable: false,
      evented: false,
      lockMovementX: true,
      lockMovementY: true,
      fotoboxLayerType: 'background',
      fotoboxLayerId: 'legacy-background',
      src: options.backgroundDataUrl,
    });
  }

  for (const space of template.spaces) {
    if (space.type === 'photo') {
      objects.push(photoRectFromSpace(space));
    }
  }

  return {
    version: COLLAGE_EDITOR_VERSION,
    id: template.id,
    name: options?.name ?? template.id,
    width: template.width,
    height: template.height,
    border: template.border,
    layerMeta: objects
      .filter((obj) => obj['fotoboxLayerType'] === 'photo')
      .map(
        (obj): CollageEditorLayerMeta => ({
          id: obj['fotoboxLayerId'] as string,
          type: 'photo',
          border: obj['fotoboxBorder'] as CollageEditorLayerMeta['border'],
        }),
      ),
    fabricJson: {
      version: '6.0.0',
      objects,
      background: '#ffffff',
    },
  };
}

export function fabricObjectToPhotoSpace(
  obj: Record<string, unknown>,
): ReturnType<typeof photoSpaceFromFabricObject> | null {
  if (obj['fotoboxLayerType'] !== 'photo') {
    return null;
  }
  return photoSpaceFromFabricObject(obj as Parameters<typeof photoSpaceFromFabricObject>[0]);
}
