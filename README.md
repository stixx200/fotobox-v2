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
6. [Releasing (versioning + Windows setup)](#releasing-versioning--windows-setup)
7. [Deploying to a Windows Surface tablet](#deploying-to-a-windows-surface-tablet)
8. [Kiosk mode on Windows](#kiosk-mode-on-windows)
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
to the API over HTTP/WebSocket on `localhost:5100` (same as guest phones and tablets on the LAN), so the UI also
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

In development the window loads `http://localhost:5101` and talks to the API started by `nx serve fotobox-api`
(`FOTOBOX_API_URL=http://localhost:5100`), so UI and API reload on change. The collage editor window loads
`http://localhost:5102` (`pnpm nx serve collage-editor-ui`). Debug builds open in a normal window; set
`FOTOBOX_KIOSK=1` to try kiosk mode.

**Browser only** (no Rust needed):

```bash
pnpm nx serve fotobox-api   # API on http://localhost:5100
pnpm nx serve fotobox-ui    # UI on http://localhost:5101
```

### Standalone API

```bash
pnpm nx serve fotobox-api
# API available at http://localhost:5100
# GraphQL playground at http://localhost:5100/graphql
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

Available in development at `http://localhost:5100/graphql`.

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

## Releasing (versioning + Windows setup)

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

This creates tag `fotobox-vX.Y.Z`. GitHub Actions builds the Windows setup (`Fotobox_<version>_x64-setup.exe`) on
`windows-latest` and publishes it to **GitHub Releases** with a SHA256 checksum.

The `Windows` workflow (`.github/workflows/windows.yml`) tests every change to the desktop app or the kiosk scripts:
PSScriptAnalyzer + Pester unit tests for the scripts, then it builds the setup, installs it silently in kiosk mode on
the runner, checks user, auto-logon, task, firewall, `host.json` and power settings, starts the app and its API, runs
the setup again (update) and uninstalls. The built setup is attached to the run for manual testing.

### Building the installer yourself

Installers are built on the target OS:

```bash
pnpm nx run fotobox-release:package --configuration=windows   # Windows: NSIS setup
pnpm nx run fotobox-tauri:bundle                              # macOS: .app + DMG
pnpm nx run fotobox-tauri:bundle:debug                        # faster unoptimized bundle for testing
```

Output: `apps/fotobox-tauri/src-tauri/target/release/bundle/` (`nsis/Fotobox_<version>_x64-setup.exe`,
`macos/Fotobox.app`, `dmg/…`). Bundle configuration: [`tauri.conf.json`](apps/fotobox-tauri/src-tauri/tauri.conf.json);
installer hooks: [`windows/hooks.nsh`](apps/fotobox-tauri/src-tauri/windows/hooks.nsh); kiosk setup:
[`scripts/windows/FotoboxKiosk.psm1`](scripts/windows/FotoboxKiosk.psm1).

On its first start the app imports settings, share links and the photo index of a previous **Electron** install
(the old files are kept).

---

## Deploying to a Windows Surface tablet

### Requirements

- Windows 10 / 11 (x64), Home, Pro, Enterprise or Education; WebView2 is preinstalled (the setup adds it if missing)
- An administrator account to run the setup
- No extra drivers required for webcam mode
- For Sony cameras: install the [gphoto2 Windows port](https://github.com/gphoto2/gphoto2) and add it to the
  **system** PATH; install printer drivers for all users (the kiosk user is a standard user)

### Installation

1. Download `Fotobox_<version>_x64-setup.exe` from GitHub Releases. The setup is not code-signed yet: if Windows
   SmartScreen warns, choose **More info → Run anyway**.
2. Run it and confirm the administrator prompt. It installs to `C:\Program Files\Fotobox\`.
3. Answer **"Diesen PC als Fotobox-Kiosk einrichten?"**:
   - **Yes (kiosk):** see [Kiosk mode on Windows](#kiosk-mode-on-windows). Restart Windows when the setup finishes.
   - **No (normal):** Fotobox is started from the Start menu like any app.
4. Configure the booth on the Settings screen (camera, photo folder, printer, layouts), then tap
   **"Fotobox starten"**.

Running a newer setup later updates the app and keeps the chosen mode, kiosk user and settings.

---

## Kiosk mode on Windows

In kiosk mode the setup ([`FotoboxKiosk.psm1`](scripts/windows/FotoboxKiosk.psm1)) prepares Windows so the booth runs
without any input after power-on:

| What                | How                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Kiosk account       | Standard (non-admin) user `Fotobox` with a random password                                                        |
| Automatic sign-in   | Auto-logon for that user; the password is stored as LSA secret (like Sysinternals Autologon), never in plain text |
| Start and restart   | Scheduled task `\Fotobox\Kiosk` starts Fotobox at sign-in and restarts it within a minute if it exits             |
| Full screen         | Fotobox runs as kiosk (full screen, can't be closed) for the kiosk user only; admins get a normal window          |
| Awake               | No sleep, screen-off or password on wake (AC and battery)                                                         |
| Fewer interruptions | Notifications, tips, lock screen and edge swipes off; no Windows Update restarts while signed in                  |
| Fewer ways out      | Task Manager, Win key, Run and lock disabled for the kiosk user                                                   |
| Network             | Firewall rule for the bundled `node.exe` on TCP 5100 (QR share links work on private and public Wi-Fi)            |
| App settings        | `%ProgramData%\Fotobox\host.json` (mode, kiosk user, port, tablet mode)                                           |

Edge-swipe, lock-screen and update policies are best effort on Windows **Home**. Ctrl+Alt+Del can't be blocked on
Home/Pro; it only leads to the sign-in screen of a standard user.

**Booth settings for kiosks** (Settings → _Betrieb_):

- **Betreiber-PIN:** 4 digits; the settings (start screen and the hidden 5-tap corner) then ask for it.
- **Beim Start direkt die Fotobox öffnen:** after a restart the booth goes straight to the guest screen instead of the
  settings.
- **Zu Windows wechseln** (desktop app): closes Fotobox for 30 minutes of maintenance; the kiosk task doesn't reopen it
  meanwhile. Then press **Ctrl+Alt+Del → Switch user** and sign in with an administrator account, where Fotobox opens
  as a normal window.

**Change mode later** (as administrator, from the Start menu folder _Fotobox_): **Fotobox Kiosk einrichten** /
**Fotobox Kiosk deaktivieren**, or:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Program Files\Fotobox\setup-kiosk.ps1" -Mode Kiosk   # or -Mode Normal
```

**Silent install** (e.g. for several booths):

```powershell
Fotobox_<version>_x64-setup.exe /S /KIOSK=1                    # kiosk mode
Fotobox_<version>_x64-setup.exe /S /KIOSK=1 /LANTOKEN=auto     # + tablet mode with a generated token
Fotobox_<version>_x64-setup.exe /S /KIOSK=1 /KIOSKUSER=Booth   # other kiosk account name
```

Without `/KIOSK`, a first silent install is a normal install and an update keeps the current mode.

**Uninstall** (Settings → Apps → Fotobox) removes the kiosk configuration and restores the previous Windows settings.
It asks whether to also delete the `Fotobox` user with its photos (silent uninstalls keep them).

Setup log: `%ProgramData%\Fotobox\setup.log`.

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

| Environment variable                | Description                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `PORT`                              | Port of the embedded API (default `5100`)                                                         |
| `FOTOBOX_KIOSK`                     | `1`/`0` forces kiosk mode on/off (default: `host.json`, else on in release / off in debug builds) |
| `FOTOBOX_HOST_CONFIG`               | Path of the machine config written by the setup (default `%ProgramData%\Fotobox\host.json`)       |
| `FOTOBOX_API_URL`                   | Use an external API instead of the embedded sidecar (sends `FOTOBOX_LAN_API_TOKEN` if set)        |
| `FOTOBOX_COLLAGE_EDITOR_DEV_SERVER` | Collage editor URL in debug builds (default `http://localhost:5102`)                              |

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
pnpm nx serve fotobox-ui           # Angular dev server  (port 5101)
pnpm nx serve fotobox-api          # Standalone API only (port 5100)

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
