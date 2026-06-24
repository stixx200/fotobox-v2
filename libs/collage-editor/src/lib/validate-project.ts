import { CollageEditorProject } from './collage-editor-project.interface';
import {
  DEFAULT_SAFE_MARGIN,
  FOTOBOX_EDITOR_ONLY,
  FOTOBOX_LAYER_ID,
  FOTOBOX_LAYER_TYPE,
} from './constants';
import { fabricObjectAxisAlignedBounds } from './project-to-template';

export type ValidationSeverity = 'error' | 'warning';

export interface ProjectValidationIssue {
  severity: ValidationSeverity;
  message: string;
  layerId?: string;
  /** Second layer for issues that involve two layers (e.g. overlap). */
  relatedLayerId?: string;
}

interface FabricLikeRect {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  originX?: string;
  originY?: string;
  [FOTOBOX_LAYER_ID]?: string;
  [FOTOBOX_LAYER_TYPE]?: string;
  [FOTOBOX_EDITOR_ONLY]?: boolean;
}

function isOutsideSafeArea(
  bounds: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  margin: number,
): boolean {
  const safeRight = canvasWidth - margin;
  const safeBottom = canvasHeight - margin;
  return (
    bounds.x < margin ||
    bounds.y < margin ||
    bounds.x + bounds.width > safeRight ||
    bounds.y + bounds.height > safeBottom
  );
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

function extractPhotoLayersForValidation(
  project: CollageEditorProject,
): Array<{
  layerId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const objects = project.fabricJson['objects'];
  if (!Array.isArray(objects)) {
    return [];
  }
  const metaById = new Map(project.layerMeta.map((m) => [m.id, m]));
  return (objects as FabricLikeRect[])
    .filter((obj) => {
      if (obj[FOTOBOX_EDITOR_ONLY]) {
        return false;
      }
      const id = obj[FOTOBOX_LAYER_ID];
      const type =
        (id && metaById.get(id)?.type) ||
        (obj[FOTOBOX_LAYER_TYPE] as string | undefined);
      return type === 'photo';
    })
    .map((obj) => ({
      layerId: obj[FOTOBOX_LAYER_ID],
      ...fabricObjectAxisAlignedBounds(obj),
    }));
}

export function validateCollageEditorProject(
  project: CollageEditorProject,
): ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = [];
  const photoLayers = extractPhotoLayersForValidation(project);

  if (photoLayers.length === 0) {
    issues.push({
      severity: 'error',
      message: 'Template must have at least one photo pane.',
    });
  }

  for (let i = 0; i < photoLayers.length; i++) {
    for (let j = i + 1; j < photoLayers.length; j++) {
      const a = photoLayers[i];
      const b = photoLayers[j];
      if (rectsOverlap(a, b)) {
        issues.push({
          severity: 'warning',
          message: `Photo panes ${i + 1} and ${j + 1} overlap.`,
          layerId: a.layerId,
          relatedLayerId: b.layerId,
        });
      }
    }
  }

  const safeMargin = DEFAULT_SAFE_MARGIN;
  for (const photo of photoLayers) {
    if (
      isOutsideSafeArea(
        photo,
        project.width,
        project.height,
        safeMargin,
      )
    ) {
      issues.push({
        severity: 'warning',
        message: 'A photo pane extends outside the safe area.',
        layerId: photo.layerId,
      });
    }
  }

  const objects = project.fabricJson['objects'];
  if (Array.isArray(objects)) {
    for (const raw of objects as FabricLikeRect[]) {
      if (raw[FOTOBOX_EDITOR_ONLY]) {
        continue;
      }
      const id = raw[FOTOBOX_LAYER_ID];
      const bounds = fabricObjectAxisAlignedBounds(raw);
      if (
        bounds.x < -1 ||
        bounds.y < -1 ||
        bounds.x + bounds.width > project.width + 1 ||
        bounds.y + bounds.height > project.height + 1
      ) {
        issues.push({
          severity: 'warning',
          message: 'A layer extends outside the canvas bounds.',
          layerId: id,
        });
      }
    }
  }

  return issues;
}

export function projectHasValidationErrors(
  issues: ProjectValidationIssue[],
): boolean {
  return issues.some((issue) => issue.severity === 'error');
}
