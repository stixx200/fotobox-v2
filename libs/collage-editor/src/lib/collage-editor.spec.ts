import { describe, expect, it } from 'vitest';
import { generateIndexJs } from './generate-index-js';
import {
  extractPhotoSpaces,
  photoSpaceFromFabricObject,
  projectToTemplate,
} from './project-to-template';
import { templateToPartialProject } from './import-template';
import { validateCollageEditorProject } from './validate-project';
import { COLLAGE_EDITOR_VERSION } from './constants';

describe('projectToTemplate', () => {
  it('maps photo fabric objects to PhotoSpace entries', () => {
    const fabricJson = {
      objects: [
        {
          left: 108,
          top: 72,
          width: 751,
          height: 501,
          scaleX: 1,
          scaleY: 1,
          angle: 2,
          fotoboxLayerType: 'photo',
          fotoboxLayerId: 'photo-1',
          fotoboxBorder: {
            background: { r: 255, g: 255, b: 255 },
            top: 4,
            bottom: 4,
            left: 4,
            right: 4,
          },
        },
        {
          left: 10,
          top: 10,
          width: 200,
          height: 40,
          fotoboxLayerType: 'text',
        },
      ],
    };

    const template = projectToTemplate({
      version: COLLAGE_EDITOR_VERSION,
      id: 'test',
      width: 1796,
      height: 1204,
      fabricJson,
      layerMeta: [
        {
          id: 'photo-1',
          type: 'photo',
          border: {
            background: { r: 255, g: 255, b: 255 },
            top: 4,
            bottom: 4,
            left: 4,
            right: 4,
          },
        },
      ],
    });

    expect(template.id).toBe('test');
    expect(template.spaces).toHaveLength(1);
    expect(template.spaces[0]).toEqual({
      type: 'photo',
      width: 751,
      height: 501,
      x: 108,
      y: 72,
      rotation: 2,
      border: {
        background: { r: 255, g: 255, b: 255 },
        top: 4,
        bottom: 4,
        left: 4,
        right: 4,
      },
    });
  });
});

describe('photoSpaceFromFabricObject', () => {
  it('applies scale to width and height', () => {
    const space = photoSpaceFromFabricObject({
      left: 0,
      top: 0,
      width: 100,
      height: 50,
      scaleX: 2,
      scaleY: 1.5,
    });
    expect(space.width).toBe(200);
    expect(space.height).toBe(75);
  });

  it('converts center origin to top-left coordinates', () => {
    const space = photoSpaceFromFabricObject({
      left: 400,
      top: 300,
      originX: 'center',
      originY: 'center',
      width: 200,
      height: 100,
      scaleX: 1,
      scaleY: 1,
    });
    expect(space.x).toBe(300);
    expect(space.y).toBe(250);
  });
});

describe('generateIndexJs', () => {
  it('emits CommonJS with background.jpg path', () => {
    const js = generateIndexJs({
      id: 'wedding',
      width: 800,
      height: 600,
      spaces: [],
    });
    expect(js).toContain('module.exports');
    expect(js).toContain('"background": "background.jpg"');
    expect(js).toContain('"id": "wedding"');
  });
});

describe('templateToPartialProject', () => {
  it('round-trips photo spaces from a template', () => {
    const template = {
      id: '2x2',
      width: 1796,
      height: 1204,
      spaces: [
        {
          type: 'photo' as const,
          width: 751,
          height: 501,
          x: 108,
          y: 72,
          rotation: 2,
        },
      ],
    };

    const project = templateToPartialProject(template);
    const restored = projectToTemplate(project);
    expect(restored.spaces).toEqual(template.spaces);
    expect(extractPhotoSpaces(project.fabricJson, project.layerMeta)).toEqual(
      template.spaces,
    );
  });
});

describe('validateCollageEditorProject', () => {
  it('requires at least one photo pane', () => {
    const issues = validateCollageEditorProject({
      version: COLLAGE_EDITOR_VERSION,
      id: 'empty',
      width: 100,
      height: 100,
      fabricJson: { objects: [] },
      layerMeta: [],
    });
    expect(issues.some((i) => i.severity === 'error')).toBe(true);
  });

  it('warns when a photo pane extends outside the safe area', () => {
    const issues = validateCollageEditorProject({
      version: COLLAGE_EDITOR_VERSION,
      id: 'unsafe',
      width: 200,
      height: 200,
      fabricJson: {
        objects: [
          {
            left: 10,
            top: 10,
            width: 50,
            height: 50,
            originX: 'left',
            originY: 'top',
            fotoboxLayerType: 'photo',
            fotoboxLayerId: 'photo-1',
          },
        ],
      },
      layerMeta: [{ id: 'photo-1', type: 'photo' }],
    });

    expect(issues).toContainEqual({
      severity: 'warning',
      message: 'A photo pane extends outside the safe area.',
      layerId: 'photo-1',
    });
  });

  it('does not warn when a photo pane is inside the safe area', () => {
    const issues = validateCollageEditorProject({
      version: COLLAGE_EDITOR_VERSION,
      id: 'safe',
      width: 200,
      height: 200,
      fabricJson: {
        objects: [
          {
            left: 50,
            top: 50,
            width: 100,
            height: 100,
            originX: 'left',
            originY: 'top',
            fotoboxLayerType: 'photo',
            fotoboxLayerId: 'photo-1',
          },
        ],
      },
      layerMeta: [{ id: 'photo-1', type: 'photo' }],
    });

    expect(
      issues.some((issue) =>
        issue.message.includes('outside the safe area'),
      ),
    ).toBe(false);
  });
});
