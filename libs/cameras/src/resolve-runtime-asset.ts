import fs from 'fs';
import path from 'path';

export interface RuntimeAssetOptions {
  /** Directory next to the electron bundle, e.g. `demo-camera`. */
  bundleRelativeDir: string;
  filename: string;
  /** Path from the workspace root, e.g. `libs/cameras/src/demo/giraffe.jpg`. */
  sourceRelativePath: string;
}

/**
 * Locate a file copied beside the electron bundle, falling back to the
 * workspace source tree when the bundle assets are missing (e.g. stale Nx cache).
 */
export function resolveRuntimeAsset(options: RuntimeAssetOptions): string {
  const { bundleRelativeDir, filename, sourceRelativePath } = options;
  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (candidate: string) => {
    const resolved = path.resolve(candidate);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      candidates.push(resolved);
    }
  };

  add(path.join(__dirname, bundleRelativeDir, filename));
  add(
    path.join(
      process.cwd(),
      'dist/apps/fotobox-electron',
      bundleRelativeDir,
      filename,
    ),
  );
  add(path.join(process.cwd(), sourceRelativePath));

  let dir = __dirname;
  for (let depth = 0; depth < 8; depth++) {
    add(path.join(dir, sourceRelativePath));
    add(
      path.join(
        dir,
        'dist/apps/fotobox-electron',
        bundleRelativeDir,
        filename,
      ),
    );
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Runtime asset not found: ${bundleRelativeDir}/${filename}`,
  );
}
