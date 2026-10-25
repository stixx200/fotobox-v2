# Fotobox v2

Photo booth application built with **Angular 22**, **NestJS 12**, and **Tauri 2** in an Nx monorepo.
It supports Sony cameras (via gphoto2), a browser webcam fallback, collage templates, printing, and a full kiosk mode for Windows/macOS.

---

## Table of Contents

1. [Project structure](#project-structure)
2. [Prerequisites](#prerequisites)
3. [Development – starting the app](#development--starting-the-app)
4. [Debugging](#debugging)
5. [Building a production release](#building-a-production-release)
6. [Releasing (versioning + Windows MSI)](#releasing-versioning--windows-msi)
7. [Deploying to a Windows Surface tablet](#deploying-to-a-windows-surface-tablet)
8. [Kiosk auto-start on Windows](#kiosk-auto-start-on-windows)
9. [Configuration reference](#configuration-reference)
10. [Useful nx commands](#useful-nx-commands)

---

## Project structure

```
apps/
  fotobox-ui/          Angular frontend (kiosk UI)
  collage-editor-ui/   Angular collage template editor
  fotobox-api/         NestJS API (standalone server and desktop sidecar)
  fotobox-tauri/       Tauri desktop app (kiosk window + API sidecar)
libs/
  cameras/             Camera abstraction (Sony, gphoto2, webcam upload, demo)
  collage-maker/       Collage rendering (sharp-based image composition)
  nest/                NestJS feature modules (cameras-api, printer-api, photo-storage, …)
  frontend-core/       Shared UI infrastructure (API config, desktop host bridge, i18n)
  photo-storage/       Core photo file storage service
  logging/, error/     Shared infra libs
```

### How the desktop app works

The Tauri host (`apps/fotobox-tauri/src-tauri`, Rust) opens the kiosk window with the Angular UI and runs the
NestJS API as a **sidecar**: a bundled Node.js runtime executing `fotobox-api`. The host restarts the API when
its health check fails, relaunches the app when restarts don't help, and the API exits with the host. The UI talks
to the API over HTTP/WebSocket on `localhost:3000` (same as guest phones and tablets on the LAN), so the UI also
runs in a plain browser.

---

## Prerequisites

| Tool               | Version                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Node.js            | ≥ 22.5 (24 LTS recommended; the desktop build bundles the Node that runs the build)                      |
| pnpm               | 12 (via `corepack enable pnpm`)                                                                          |
| Rust               | stable (only for the desktop app) – see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) |
| gphoto2 (optional) | latest – required only for Sony camera support                                                           |

Install dependencies once:

```bash
pnpm install
```

---

## Development – starting the app

**Desktop app** (starts the UI dev server, the API and the Tauri window):

```bash
pnpm nx serve fotobox-tauri
```

In development the window loads `http://localhost:4200` and talks to the API started by `nx serve fotobox-api`
(`FOTOBOX_API_URL=http://localhost:3000`), so UI and API reload on change. The collage editor window loads
`http://localhost:4201` (`pnpm nx serve collage-editor-ui`). Debug builds open in a normal window; set
`FOTOBOX_KIOSK=1` to try kiosk mode.

**Browser only** (no Rust needed):

```bash
pnpm nx serve fotobox-api   # API on http://localhost:3000
pnpm nx serve fotobox-ui    # UI on http://localhost:4200
```

### Standalone API

```bash
pnpm nx serve fotobox-api
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

### Angular UI

In debug builds (`pnpm nx serve fotobox-tauri`) right-click → **Inspect** opens the WebView dev tools.
Release builds ship without dev tools.

### NestJS backend

Run the API on its own and attach VS Code's debugger:

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

2. Build in development mode: `pnpm nx build fotobox-api --configuration=development`
3. Start the "Debug fotobox-api" configuration in VS Code.

### Desktop host logs

| Platform | Host log (`fotobox.log`) and API log (`api.log`) |
| -------- | ------------------------------------------------ |
| Windows  | `%LOCALAPPDATA%\de.se-voelk.fotobox\logs\`       |
| macOS    | `~/Library/Logs/de.se-voelk.fotobox/`            |

### GraphQL playground

Available in development at `http://localhost:3000/graphql`.

---

## Building a production release

```bash
# Build the UIs and the API
pnpm nx run-many -t build --projects=fotobox-ui,collage-editor-ui,fotobox-api

# Lint + test before releasing (Rust: rust-lint / rust-test)
pnpm nx run-many -t lint test
pnpm nx run-many -t rust-lint rust-test -p fotobox-tauri
```

Build outputs:

| Target                          | Output                                                       |
| ------------------------------- | ------------------------------------------------------------ |
| `fotobox-ui:build`              | `dist/apps/fotobox-ui/`                                      |
| `collage-editor-ui:build`       | `dist/apps/collage-editor-ui/`                               |
| `fotobox-api:build`             | `dist/apps/fotobox-api/`                                     |
| `fotobox-tauri:prepare-web`     | `dist/apps/fotobox-tauri/web/` (both UIs)                    |
| `fotobox-tauri:prepare-sidecar` | `dist/apps/fotobox-tauri/api/` + `src-tauri/binaries/node-*` |
| `fotobox-tauri:bundle`          | `apps/fotobox-tauri/src-tauri/target/release/bundle/`        |

---

## Releasing (versioning + Windows MSI)

Versions are managed with **Nx Release** (`fotobox` group). Root `package.json` and `apps/fotobox-tauri/package.json`
stay in sync; the Tauri app reads its version from the latter.

### Local release (trigger)

```bash
# 1. Ensure tests pass
pnpm nx run-many -t lint test

# 2. Preview version bump (optional)
pnpm nx release version --group=fotobox --dry-run

# 3. Create version bump, changelog, commit, and tag
pnpm run release
# equivalent to: pnpm nx release --group=fotobox --skip-publish

# 4. Push to trigger CI packaging on Windows
git push origin main --tags
```

This creates tag `fotobox-vX.Y.Z`. GitHub Actions builds the MSI on `windows-latest` and publishes it to
**GitHub Releases** with a SHA256 checksum.

### Building the installer yourself

Installers are built on the target OS:

```bash
pnpm nx run fotobox-release:package --configuration=production   # Windows: MSI, macOS: .app + DMG
pnpm nx run fotobox-tauri:bundle:debug                           # faster unoptimized bundle for testing
```

Output: `apps/fotobox-tauri/src-tauri/target/release/bundle/` (`msi/Fotobox_<version>_x64_en-US.msi`,
`macos/Fotobox.app`, `dmg/…`). The bundle configuration lives in
[`apps/fotobox-tauri/src-tauri/tauri.conf.json`](apps/fotobox-tauri/src-tauri/tauri.conf.json).

On first launch in kiosk mode, the app:

- Configures **start at login**
- On Windows, offers to run the bundled [`setup-kiosk.ps1`](scripts/windows/setup-kiosk.ps1) elevated (Startup
  shortcut fallback, Assigned Access guidance, firewall rule for LAN QR sharing)
- Imports settings, share links and the photo index of a previous **Electron** install (the old files are kept)

---

## Deploying to a Windows Surface tablet

### Requirements

- Windows 10 / 11 (x64) — Home and Pro both work; WebView2 is preinstalled (the installer adds it if missing)
- No extra drivers required for webcam mode
- For Sony cameras: install the [gphoto2 Windows port](https://github.com/gphoto2/gphoto2) and add it to the system PATH

### Installation steps

1. Copy `Fotobox_<version>_x64_en-US.msi` from GitHub Releases.
2. Double-click the `.msi` and follow the wizard.
   Default install path: `C:\Program Files\Fotobox\`
3. **First launch**: the app starts in full-screen kiosk mode automatically.
   Configure on the Settings screen:
   - **Camera** – `webcam` (built-in Surface camera) or `gphoto2` (Sony)
   - **Photo storage folder**
   - **Printer** (optional; printing is silent, via the API on the host)
   - **Active layouts**
4. Tap **"Fotobox starten"** – the app navigates to the home screen and live preview starts.

---

## Kiosk auto-start on Windows

On first production launch, Fotobox configures **start at login** automatically. The bundled `setup-kiosk.ps1`
(installed next to the app) provides additional setup:

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
3. Target: `C:\Program Files\Fotobox\Fotobox.exe`
4. Click **Finish**.

The app launches automatically after Windows login.

### Option B — Task Scheduler (runs at boot)

1. Open **Task Scheduler** → "Create Basic Task".
2. Trigger: **When the computer starts**.
3. Action: **Start a program** → `C:\Program Files\Fotobox\Fotobox.exe`
4. Check **Run whether user is logged on or not** and **Run with highest privileges**.

### Option C — Auto-login + startup folder (recommended for kiosk)

Combines unattended boot with automatic app start:

1. Enable auto-login: **Win + R** → `netplwiz` → uncheck "Users must enter a user name and password" → set the password.
2. Add the shortcut to the startup folder (Option A).

> **Tip**: Enable Windows **Assigned Access** (Settings → Accounts → Family & other users → Set up a kiosk) to lock
> the tablet to the Fotobox app only, preventing users from accessing the desktop.

---

## Configuration reference

Application settings, share tokens, and photo metadata are stored in a SQLite database (`fotobox.db`). Photo JPEG
files remain on disk in `photoDirectory`.

| Key                | Default                | Description                                             |
| ------------------ | ---------------------- | ------------------------------------------------------- |
| `camera`           | `demo`                 | Camera driver: `demo` / `webcam` / `gphoto2`            |
| `photoDirectory`   | `<app data>/photos`    | Where captured photos are saved                         |
| `collageDirectory` | built-in templates     | Custom collage template folder                          |
| `usePrinter`       | `true`                 | Show the print button after capture                     |
| `printerName`      | –                      | OS printer name (system default when empty)             |
| `showPrintDialog`  | `false`                | Use the browser print dialog instead of silent printing |
| `shutterTimeout`   | `3`                    | Countdown seconds before the shutter fires              |
| `layouts`          | `["Einzelbild","2x2"]` | Active layout tiles (max 3)                             |

Database location:

| Platform       | Path                                                           |
| -------------- | -------------------------------------------------------------- |
| Windows        | `%APPDATA%\de.se-voelk.fotobox\fotobox.db`                     |
| macOS          | `~/Library/Application Support/de.se-voelk.fotobox/fotobox.db` |
| Standalone API | `tmp/runtime/fotobox/fotobox.db` or `FOTOBOX_DATABASE_PATH`    |

### Desktop app environment

| Environment variable                | Description                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `PORT`                              | Port of the embedded API (default `3000`)                                                  |
| `FOTOBOX_KIOSK`                     | `1`/`0` forces kiosk mode on/off (default: on in release, off in debug builds)             |
| `FOTOBOX_API_URL`                   | Use an external API instead of the embedded sidecar (sends `FOTOBOX_LAN_API_TOKEN` if set) |
| `FOTOBOX_COLLAGE_EDITOR_DEV_SERVER` | Collage editor URL in debug builds (default `http://localhost:4201`)                       |

### Network access

The API listens on all interfaces so guest phones can open QR share links. Access is restricted by default:

- **Localhost** (the kiosk UI) has full access. Browser requests from untrusted origins (any web page that is not
  the desktop app's webview or a `localhost` dev server) are rejected with 403, over HTTP and WebSocket.
- **LAN clients** may only open `GET /api/share/<token>` links.

| Environment variable      | Description                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `FOTOBOX_ALLOW_LAN_API`   | `1` enables tablet mode: full API access for LAN clients that present the token below                |
| `FOTOBOX_LAN_API_TOKEN`   | Shared secret for tablet mode. Required; without it tablet mode stays disabled                       |
| `FOTOBOX_TRUSTED_ORIGINS` | Comma-separated extra browser origins trusted for localhost clients (e.g. `http://kiosk.local:8080`) |

Tablet/browser clients send the token as the `x-fotobox-token` header, the `token` WebSocket connection param, or the
`?token=` query parameter (used for `<img>` URLs). Opening the UI once with `?token=<secret>` stores the token in the
browser.

---

## Useful nx commands

```bash
# Development
pnpm nx serve fotobox-tauri        # Desktop app (UI + API dev servers + window)
pnpm nx serve fotobox-ui           # Angular dev server  (port 4200)
pnpm nx serve fotobox-api          # Standalone API only (port 3000)

# Build
pnpm nx run-many -t build --projects=fotobox-api,fotobox-ui,collage-editor-ui
pnpm nx run fotobox-tauri:bundle   # Desktop installer for the current OS

# Lint / test
pnpm nx run-many -t lint test
pnpm nx run-many -t rust-lint rust-test -p fotobox-tauri

# Package the release installer
pnpm nx run fotobox-release:package --configuration=production

# Create a release (version bump + changelog + tag)
pnpm run release

# Dependency graph
pnpm nx graph
```

[Click here to finish setting up your workspace!](https://cloud.nx.app/connect/kJeAeEOyWZ)

## Run tasks

To run the dev server for your app, use:

```sh
pnpm nx serve fotobox-ui
```

To create a production bundle:

```sh
pnpm nx build fotobox-ui
```

To see all available targets to run for a project, run:

```sh
pnpm nx show project fotobox-ui
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
pnpm nx g @nx/angular:app demo
```

To generate a new library, use:

```sh
pnpm nx g @nx/angular:lib mylib
```

You can use `pnpm nx list` to get a list of installed plugins. Then, run `pnpm nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

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
