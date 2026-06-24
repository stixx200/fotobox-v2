# collage-maker

Sharp-based collage rendering for the fotobox runtime.

## Template format

Each template lives in its own folder:

```
my-template/
  background.jpg           # baked decoration (fixed text, shapes, images)
  index.js                 # photo slot coordinates (CommonJS)
  template.editor.json     # optional editor sidecar for re-editing
  assets/                  # optional uploaded images
```

Author templates with the **Collage Template Editor** app (`collage-editor-ui`):

```bash
npm exec nx serve collage-editor-ui   # http://localhost:4201
npm exec nx serve fotobox-api         # GraphQL API on :3000
```

From fotobox settings, use **Open template editor** (Electron opens a second window; browser opens a new tab).

Built-in example: [`src/templates/2x2`](src/templates/2x2/index.json).
