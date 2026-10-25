//! One-time kiosk bootstrap for installs the Windows setup did not configure
//! (manual kiosk mode, macOS): start the app at login.
//!
//! When the installer manages the machine (`host.json` `managedBy`), it has
//! already set up a scheduled task, auto-logon and lockdown for the kiosk
//! user, so the app must not add its own login item on top.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt as _;

use crate::config::HostConfig;

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KioskState {
    login_item_configured: bool,
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

pub fn run_first_start_setup(app: &AppHandle, config: &HostConfig) {
    if config.managed_by_installer {
        log::info!("Kiosk autostart is managed by the installer");
        return;
    }

    let mut state = read_state(app);
    if state.login_item_configured {
        return;
    }
    match app.autolaunch().enable() {
        Ok(()) => {
            log::info!("Configured start at login");
            state.login_item_configured = true;
            write_state(app, &state);
        }
        Err(error) => log::error!("Failed to enable start at login: {error}"),
    }
}
