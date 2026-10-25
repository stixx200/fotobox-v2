//! One-time production kiosk bootstrap: start at login, and on Windows offer
//! the bundled `setup-kiosk.ps1` (firewall rule, Assigned Access guidance).

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt as _;

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KioskState {
    login_item_configured: bool,
    advanced_setup_prompted: bool,
}

fn state_path(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_config_dir()?.join("kiosk-setup.json"))
}

fn read_state(app: &AppHandle) -> KioskState {
    state_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

fn write_state(app: &AppHandle, state: &KioskState) {
    let result = state_path(app).and_then(|path| {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        let json = serde_json::to_string_pretty(state).map_err(std::io::Error::other)?;
        fs::write(path, json)?;
        Ok(())
    });
    if let Err(error) = result {
        log::warn!("Could not persist kiosk setup state: {error}");
    }
}

pub fn run_first_start_setup(app: &AppHandle) {
    let mut state = read_state(app);

    if !state.login_item_configured {
        match app.autolaunch().enable() {
            Ok(()) => {
                log::info!("Configured start at login");
                state.login_item_configured = true;
            }
            Err(error) => log::error!("Failed to enable start at login: {error}"),
        }
    }

    if !state.advanced_setup_prompted && cfg!(windows) {
        state.advanced_setup_prompted = true;
        prompt_advanced_setup(app);
    }

    write_state(app, &state);
}

#[cfg(windows)]
fn prompt_advanced_setup(app: &AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

    let script = match app.path().resource_dir() {
        Ok(dir) => dir.join("setup-kiosk.ps1"),
        Err(error) => {
            log::error!("Cannot resolve resource dir: {error}");
            return;
        }
    };
    let exe = std::env::current_exe().unwrap_or_default();

    app.dialog()
        .message(
            "Fotobox will start automatically after login. For full desktop lockdown \
             (Assigned Access) and the LAN firewall rule for QR sharing, run the \
             elevated kiosk setup.",
        )
        .title("Fotobox kiosk setup")
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Run elevated setup".into(),
            "Later".into(),
        ))
        .show(move |run_setup| {
            if run_setup {
                run_elevated_setup(&script, &exe);
            }
        });
}

#[cfg(not(windows))]
fn prompt_advanced_setup(_app: &AppHandle) {}

#[cfg(windows)]
fn run_elevated_setup(script: &std::path::Path, exe: &std::path::Path) {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    if !script.exists() {
        log::error!("setup-kiosk.ps1 not found at {}", script.display());
        return;
    }
    // Paths go through environment variables so they are never parsed as
    // PowerShell code; Start-Process -Verb RunAs triggers the UAC prompt.
    let result = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$env:FOTOBOX_SETUP_SCRIPT,'-Elevated','-ExePath',$env:FOTOBOX_EXE)",
        ])
        .env("FOTOBOX_SETUP_SCRIPT", script)
        .env("FOTOBOX_EXE", exe)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
    if let Err(error) = result {
        log::error!("Failed to launch kiosk setup: {error}");
    }
}
