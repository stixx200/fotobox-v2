# Fotobox v2

Photo booth application built with **Angular 21**, **NestJS 11**, and **Electron** in an Nx monorepo.  
It supports Sony cameras (via gphoto2), a browser webcam fallback, collage templates, printing, and a full kiosk mode for Windows/macOS.

---

## Table of Contents

1. [Project structure](#project-structure)
2. [Prerequisites](#prerequisites)
3. [Development – starting the app](#development--starting-the-app)
4. [Debugging](#debugging)
5. [Building a production release](#building-a-production-release)
6. [Packaging the Electron app (installer)](#packaging-the-electron-app-installer)
7. [Deploying to a Windows Surface tablet](#deploying-to-a-windows-surface-tablet)
8. [Kiosk auto-start on Windows](#kiosk-auto-start-on-windows)
9. [Configuration reference](#configuration-reference)
10. [Useful nx commands](#useful-nx-commands)

---

## Project structure

```
apps/
  fotobox-ui/         Angular 21 frontend (kiosk UI)
  fotobox-electron/   Electron shell (embeds UI + NestJS API)
  fotobox-api/        Standalone NestJS API server (headless / server deployment)
libs/
  cameras/            Camera abstraction (Sony gphoto2, webcam upload, demo)
  collage-maker/      Collage rendering (sharp-based image composition)
  nest/               NestJS feature modules (cameras-api, collage-maker, photo-storage, …)
  photo-storage/      Core photo file storage service
  logging/, error/    Shared infra libs
```

---

## Prerequisites

| Tool               | Version                                        |
| ------------------ | ---------------------------------------------- |
| Node.js            | ≥ 22 LTS                                       |
| npm                | ≥ 10                                           |
| gphoto2 (optional) | latest – required only for Sony camera support |

Install dependencies once:

```bash
npm install
```

---

## Development – starting the app

The Electron app embeds both the Angular UI and the NestJS backend in a single process.  
Run **two terminals** when developing:

**Terminal 1 – Angular dev server** (must be started first):

```bash
npx nx serve fotobox-ui
# Wait for: "Local: http://localhost:4200/"
```

**Terminal 2 – Electron shell** (starts the NestJS backend + opens the window):

```bash
npx nx serve fotobox-electron
```

The Electron shell detects the dev server via the `FOTOBOX_DEV_SERVER` environment variable (set automatically by the Nx serve target) and loads `http://localhost:4200` instead of the bundled UI. Dev tools are enabled automatically in dev mode.

### Standalone API (without Electron)

```bash
npx nx serve fotobox-api
# API available at http://localhost:3000
# GraphQL playground at http://localhost:3000/graphql
```

Override defaults with environment variables:

```bash
PORT=3999 \
FOTOBOX_PHOTO_DIR=tmp/runtime/fotobox/photos \
FOTOBOX_TEMPLATE_DIR=tmp/runtime/fotobox/collage-templates \
FOTOBOX_SETTINGS_PATH=tmp/runtime/fotobox/settings.json \
node dist/apps/fotobox-api/main.js
```

By default the API bootstraps these paths under `tmp/` automatically (see `tmp/README.md`).

---

## Debugging

### Angular UI (Chrome DevTools)

Dev tools open automatically when running via `npx nx serve fotobox-electron` (dev mode).  
You can also press `Ctrl+Shift+I` / `Cmd+Option+I` in the Electron window during development.

> **Note**: Dev tools are disabled in production builds (kiosk mode). Build with `--configuration=development` to re-enable them in a built binary.

### NestJS backend

The backend runs inside the Electron process. Use VS Code's debugger:

1. Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug fotobox-api",
      "program": "${workspaceFolder}/dist/apps/fotobox-api/main.js",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": { "PORT": "3999", "NODE_ENV": "development" }
    }
  ]
}
```

2. Build in development mode: `npx nx build fotobox-api --configuration=development`
3. Start the "Debug fotobox-api" configuration in VS Code.

### GraphQL playground

Available in development at `http://localhost:3000/graphql`.

---

## Building a production release

```bash
# Build all apps (or use the release package target below)
npx nx run-many -t build --projects=fotobox-ui,collage-editor-ui,fotobox-electron --configuration=production

# Lint + test before releasing
npx nx run-many -t lint
npx nx run-many -t test
```

Build outputs:

| App                | Output directory              |
| ------------------ | ----------------------------- |
| `fotobox-ui`       | `dist/apps/fotobox-ui/`       |
| `collage-editor-ui`| `dist/apps/collage-editor-ui/`|
| `fotobox-api`      | `dist/apps/fotobox-api/`      |
| `fotobox-electron` | `dist/apps/fotobox-electron/` |

The Electron dist bundles both UIs plus runtime assets (templates, migrations, images). Verify before packaging:

```bash
node scripts/verify-electron-dist.mjs
```

---

## Releasing (versioning + Windows MSI)

Versions are managed with **Nx Release** (`fotobox` group). Root `package.json` and `apps/fotobox-electron/package.json` stay in sync.

### Local release (trigger)

```bash
# 1. Ensure tests pass
npx nx run-many -t lint test

# 2. Preview version bump (optional)
npx nx release version --group=fotobox --dry-run --first-release

# 3. Create version bump, changelog, commit, and tag
npm run release
# equivalent to: npx nx release --group=fotobox --skip-publish
# On the first release, add: --first-release

# 4. Push to trigger CI packaging on Windows
git push origin main --tags
```

This creates tag `fotobox-vX.Y.Z`. GitHub Actions builds the MSI on `windows-latest` and publishes it to **GitHub Releases** with a SHA256 checksum.

### Manual MSI build (on Windows)

```bash
npx nx run fotobox-release:package --configuration=production
```

Output: `dist/packages/Fotobox-<version>-x64.msi`

---

## Packaging the Electron app (installer)

The `fotobox-release:package` target builds both Angular apps, bundles Electron, verifies static assets, and creates the installer.

### Windows MSI installer

Run this on a **Windows machine** (or via the release CI workflow):

```bash
npx nx run fotobox-release:package --configuration=production
```

Output: `dist/packages/Fotobox-<version>-x64.msi`

The MSI configuration lives in [`apps/fotobox-electron/src/app/options/maker.options.json`](apps/fotobox-electron/src/app/options/maker.options.json).  
Installs per-user under `%LOCALAPPDATA%` (`msi.perMachine: false`).

After install, the app:
- Launches once automatically (`msi.runAfterFinish`)
- Configures **open-at-login** on first run
- Prompts to run **`setup-kiosk.ps1`** for advanced kiosk options (Startup shortcut fallback, Assigned Access guidance, optional firewall rule)

Bundled kiosk script: [`scripts/windows/setup-kiosk.ps1`](scripts/windows/setup-kiosk.ps1)

### macOS DMG

Run on a **macOS machine**:

```bash
npx nx build fotobox-electron
npx nx run fotobox-electron:package
```

Output: `dist/packages/fotobox-electron-<version>.dmg`

---

## Deploying to a Windows Surface tablet

### Requirements

- Windows 10 / 11 (x64) — Home and Pro both work
- No extra drivers required for webcam mode
- For Sony cameras: install the [gphoto2 Windows port](https://github.com/gphoto2/gphoto2) and add it to the system PATH

### Installation steps

1. Copy `Fotobox-<version>-x64.msi` from GitHub Releases (or `dist/packages/`).
2. Double-click the `.msi` and follow the wizard.  
   Default install path: `%LOCALAPPDATA%\Programs\fotobox-electron\`
3. **First launch**: the app starts in full-screen kiosk mode automatically.  
   Configure on the Settings screen:
   - **Camera** – `webcam` (built-in Surface camera) or `gphoto2` (Sony)
   - **Photo storage folder**
   - **Printer** (optional)
   - **Active layouts**
4. Tap **"Fotobox starten"** – the app navigates to the home screen and live preview starts.

---

## Kiosk auto-start on Windows

On first production launch, Fotobox configures **open-at-login** automatically. The bundled `setup-kiosk.ps1` (installed next to the app) provides additional setup:

```powershell
# From the install directory (or via the in-app prompt)
powershell -ExecutionPolicy Bypass -File setup-kiosk.ps1

# Optional: open firewall for LAN QR sharing (requires admin)
powershell -ExecutionPolicy Bypass -File setup-kiosk.ps1 -Elevated
```

### Manual options (if needed)

#### Option A — Startup folder (manual fallback)

1. Press **Win + R**, type `shell:startup`, press **Enter**.
2. Right-click → **New → Shortcut**.
3. Target: `%LOCALAPPDATA%\Programs\fotobox-electron\Fotobox.exe`
4. Click **Finish**.

The app launches automatically after Windows login.

### Option B — Task Scheduler (runs at boot)

1. Open **Task Scheduler** → "Create Basic Task".
2. Trigger: **When the computer starts**.
3. Action: **Start a program** → `%LOCALAPPDATA%\fotobox-electron\fotobox-electron.exe`
4. Check **Run whether user is logged on or not** and **Run with highest privileges**.

### Option C — Auto-login + startup folder (recommended for kiosk)

Combines unattended boot with automatic app start:

1. Enable auto-login: **Win + R** → `netplwiz` → uncheck "Users must enter a user name and password" → set the password.
2. Add the shortcut to the startup folder (Option A).

> **Tip**: Enable Windows **Assigned Access** (Settings → Accounts → Family & other users → Set up a kiosk) to lock the tablet to the Fotobox app only, preventing users from accessing the desktop.

---

## Configuration reference

Application settings, share tokens, and photo metadata are stored in a SQLite database (`fotobox.db`). Photo JPEG files remain on disk in `photoDirectory`.

| Key                | Default                | Description                                  |
| ------------------ | ---------------------- | -------------------------------------------- |
| `camera`           | `demo`                 | Camera driver: `demo` / `webcam` / `gphoto2` |
| `photoDirectory`   | `<userData>/photos`    | Where captured photos are saved              |
| `collageDirectory` | built-in templates     | Custom collage template folder               |
| `usePrinter`       | `true`                 | Show the print button after capture          |
| `printerName`      | –                      | OS printer name                              |
| `shutterTimeout`   | `3`                    | Countdown seconds before the shutter fires   |
| `layouts`          | `["Einzelbild","2x2"]` | Active layout tiles (max 3)                  |

Database location:

| Platform           | Path                                                           |
| ------------------ | -------------------------------------------------------------- |
| Windows (Electron) | `%APPDATA%\fotobox-electron\fotobox.db`                       |
| macOS (Electron)   | `~/Library/Application Support/fotobox-electron/fotobox.db`  |
| Standalone API     | `tmp/runtime/fotobox/fotobox.db` or `FOTOBOX_DATABASE_PATH`    |

---

## Useful nx commands

```bash
# Development
npx nx serve fotobox-ui           # Angular dev server  (port 4200)
npx nx serve fotobox-electron     # Electron + API      (port 3000)
npx nx serve fotobox-api          # Standalone API only (port 3000)

# Build
npx nx build fotobox-ui
npx nx build fotobox-api
npx nx build fotobox-electron
npx nx run-many -t build --projects=fotobox-api,fotobox-ui,fotobox-electron

# Lint
npx nx run-many -t lint

# Test
npx nx run-many -t test

# Package Electron installer (build + verify + package)
npx nx run fotobox-release:package --configuration=production

# Create a release (version bump + changelog + tag)
npm run release

# Dependency graph
npx nx graph
```

[Click here to finish setting up your workspace!](https://cloud.nx.app/connect/kJeAeEOyWZ)

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve fotobox-ui
```

To create a production bundle:

```sh
npx nx build fotobox-ui
```

To see all available targets to run for a project, run:

```sh
npx nx show project fotobox-ui
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/angular:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/angular:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/getting-started/tutorials/angular-monorepo-tutorial?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
