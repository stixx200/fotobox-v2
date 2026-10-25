//! Maintenance pause for the Windows kiosk: "Zu Windows wechseln" closes the
//! booth and keeps the scheduled task (which starts Fotobox with
//! `--autostart` every minute) from reopening it for a while, so the operator
//! can switch to an administrator account. A manual start always works.

use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

pub const AUTOSTART_ARG: &str = "--autostart";
const PAUSE: Duration = Duration::from_secs(30 * 60);
const MARKER_FILE: &str = "maintenance-until";

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn marker_path(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_local_data_dir()?.join(MARKER_FILE))
}

/// True while a pause written at `content` (unix seconds) has not expired.
pub fn is_paused(content: &str, now: u64) -> bool {
    content.trim().parse::<u64>().is_ok_and(|until| until > now)
}

/// Starts the maintenance pause.
pub fn begin(app: &AppHandle) -> tauri::Result<()> {
    let path = marker_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(&path, (now_secs() + PAUSE.as_secs()).to_string())?;
    log::info!(
        "Maintenance pause for {} minutes (kiosk autostart suspended)",
        PAUSE.as_secs() / 60
    );
    Ok(())
}

/// Whether this launch should exit right away: started by the kiosk task
/// during a maintenance pause. Removes an expired marker.
pub fn should_skip_autostart(app: &AppHandle, args: &[String]) -> bool {
    if !args.iter().any(|arg| arg == AUTOSTART_ARG) {
        return false;
    }
    let Ok(path) = marker_path(app) else {
        return false;
    };
    match fs::read_to_string(&path) {
        Ok(content) if is_paused(&content, now_secs()) => true,
        Ok(_) => {
            let _ = fs::remove_file(&path);
            false
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pause_is_active_until_its_end() {
        assert!(is_paused("1000", 999));
        assert!(!is_paused("1000", 1000));
        assert!(!is_paused("1000\n", 2000));
    }

    #[test]
    fn invalid_marker_is_ignored() {
        assert!(!is_paused("", 0));
        assert!(!is_paused("soon", 0));
    }
}
