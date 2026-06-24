import fs from 'fs';
import path from 'path';

function imagesDirectoryCandidates(): string[] {
  const candidates = [
    path.resolve(__dirname, 'images'),
    path.resolve(process.cwd(), 'dist/apps/fotobox-electron/images'),
    path.resolve(__dirname, '../images'),
    path.resolve(process.cwd(), 'libs/collage-maker/src/images'),
  ];

  let dir = __dirname;
  for (let depth = 0; depth < 8; depth++) {
    candidates.push(path.join(dir, 'libs/collage-maker/src/images'));
    candidates.push(path.join(dir, 'dist/apps/fotobox-electron/images'));
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return candidates;
}

/** Directory containing bundled collage-maker assets (questionmark, preview photos, …). */
export function resolveCollageMakerImagesDirectory(): string {
  for (const candidate of imagesDirectoryCandidates()) {
    if (fs.existsSync(path.join(candidate, 'questionmark.png'))) {
      return candidate;
    }
  }
  return imagesDirectoryCandidates()[0];
}

export function resolveCollageMakerAssetPath(filename: string): string {
  const direct = path.join(resolveCollageMakerImagesDirectory(), filename);
  if (fs.existsSync(direct)) {
    return direct;
  }

  for (const dir of imagesDirectoryCandidates()) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return direct;
}
