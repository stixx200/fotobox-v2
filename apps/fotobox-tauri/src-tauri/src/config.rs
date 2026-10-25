//! Host configuration.
//!
//! Sources, highest priority first:
//! 1. Environment variables (same names the previous Electron shell used, so
//!    existing setups and development keep working).
//! 2. The machine-wide `host.json` written by the Windows installer
//!    (`%ProgramData%\Fotobox\host.json`, or `FOTOBOX_HOST_CONFIG`).
//! 3. Built-in defaults.

use std::env;
use std::path::PathBuf;

use serde::Deserialize;

pub const DEFAULT_API_PORT: u16 = 5100;

/// Contents of `host.json`. Every field is optional; unknown fields are
/// ignored so older app versions can read newer files.
#[derive(Debug, Default, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostFile {
    /// `"installer"` when the setup configured autostart and kiosk lockdown.
    pub managed_by: Option<String>,
    pub kiosk: Option<bool>,
    /// Windows account the kiosk applies to. Other users (the operator's
    /// admin account) get a normal window, so they can't lock themselves in.
    pub kiosk_user: Option<String>,
    pub port: Option<u16>,
    pub allow_lan_api: Option<bool>,
    pub lan_api_token: Option<String>,
}

impl HostFile {
    /// `FOTOBOX_HOST_CONFIG`, else `%ProgramData%\Fotobox\host.json` on Windows.
    pub fn default_path(lookup: impl Fn(&str) -> Option<String>) -> Option<PathBuf> {
        if let Some(path) = non_empty(lookup("FOTOBOX_HOST_CONFIG")) {
            return Some(PathBuf::from(path));
        }
        if cfg!(windows) {
            let program_data =
                non_empty(lookup("ProgramData")).unwrap_or_else(|| r"C:\ProgramData".to_string());
            return Some(
                PathBuf::from(program_data)
                    .join("Fotobox")
                    .join("host.json"),
            );
        }
        None
    }

    /// Reads the file; a missing file is normal (development, macOS), an
    /// unreadable or invalid one is logged and ignored.
    pub fn load(path: Option<PathBuf>) -> Self {
        let Some(path) = path else {
            return Self::default();
        };
        match std::fs::read_to_string(&path) {
            Ok(json) => {
                // Tolerate a UTF-8 BOM (Windows PowerShell 5 writes one).
                let json = json.trim_start_matches('\u{feff}');
                serde_json::from_str(json).unwrap_or_else(|error| {
                    log::error!("Ignoring invalid {}: {error}", path.display());
                    Self::default()
                })
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Self::default(),
            Err(error) => {
                log::error!("Cannot read {}: {error}", path.display());
                Self::default()
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostConfig {
    /// Port of the embedded API sidecar (`PORT` / `port`).
    pub api_port: u16,
    /// Use an API on another machine instead of the sidecar (`FOTOBOX_API_URL`).
    pub external_api_url: Option<String>,
    /// Tablet mode: full LAN API access with the token below
    /// (`FOTOBOX_ALLOW_LAN_API` / `allowLanApi`).
    pub allow_lan_api: bool,
    /// LAN API token (`FOTOBOX_LAN_API_TOKEN` / `lanApiToken`). Sent to an
    /// external API, or required by the embedded API in tablet mode.
    pub lan_api_token: Option<String>,
    /// Fullscreen, undecorated, non-closable window (`FOTOBOX_KIOSK` /
    /// `kiosk`, default on in release builds).
    pub kiosk: bool,
    /// The Windows installer set up autostart and lockdown, so the app must
    /// not configure them itself.
    pub managed_by_installer: bool,
    /// Collage editor dev server for debug builds (`FOTOBOX_COLLAGE_EDITOR_DEV_SERVER`).
    pub collage_editor_dev_server: Option<String>,
}

fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn parse_flag(value: Option<String>) -> Option<bool> {
    match non_empty(value).as_deref() {
        Some("1") | Some("true") | Some("yes") => Some(true),
        Some("0") | Some("false") | Some("no") => Some(false),
        _ => None,
    }
}

/// True when no kiosk user is configured or the current account is it.
fn is_kiosk_user(lookup: &impl Fn(&str) -> Option<String>, file: &HostFile) -> bool {
    let Some(kiosk_user) = non_empty(file.kiosk_user.clone()) else {
        return true;
    };
    non_empty(lookup("USERNAME").or_else(|| lookup("USER")))
        .is_some_and(|user| user.eq_ignore_ascii_case(&kiosk_user))
}

impl HostConfig {
    pub fn load() -> Self {
        let lookup = |key: &str| env::var(key).ok();
        let file = HostFile::load(HostFile::default_path(lookup));
        Self::resolve(lookup, &file)
    }

    pub fn resolve(lookup: impl Fn(&str) -> Option<String>, file: &HostFile) -> Self {
        let api_port = non_empty(lookup("PORT"))
            .and_then(|port| port.parse().ok())
            .or(file.port)
            .unwrap_or(DEFAULT_API_PORT);
        let collage_editor_dev_server = non_empty(lookup("FOTOBOX_COLLAGE_EDITOR_DEV_SERVER"))
            .or_else(|| cfg!(debug_assertions).then(|| "http://localhost:5102".to_string()));

        Self {
            api_port,
            external_api_url: non_empty(lookup("FOTOBOX_API_URL"))
                .map(|url| url.trim_end_matches('/').to_string()),
            allow_lan_api: parse_flag(lookup("FOTOBOX_ALLOW_LAN_API"))
                .or(file.allow_lan_api)
                .unwrap_or(false),
            lan_api_token: non_empty(lookup("FOTOBOX_LAN_API_TOKEN"))
                .or_else(|| non_empty(file.lan_api_token.clone())),
            kiosk: parse_flag(lookup("FOTOBOX_KIOSK"))
                .or_else(|| {
                    file.kiosk
                        .map(|kiosk| kiosk && is_kiosk_user(&lookup, file))
                })
                .unwrap_or(!cfg!(debug_assertions)),
            managed_by_installer: file.managed_by.as_deref() == Some("installer"),
            collage_editor_dev_server,
        }
    }

    pub fn uses_external_api(&self) -> bool {
        self.external_api_url.is_some()
    }

    /// API base URL the web UI talks to.
    pub fn api_url(&self) -> String {
        self.external_api_url
            .clone()
            .unwrap_or_else(|| format!("http://localhost:{}", self.api_port))
    }

    /// Token for the web UI: only needed for an external API; the embedded API
    /// trusts loopback clients from the Tauri webview origin.
    pub fn renderer_api_token(&self) -> Option<&str> {
        if self.uses_external_api() {
            self.lan_api_token.as_deref()
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn lookup(vars: &[(&str, &str)]) -> impl Fn(&str) -> Option<String> {
        let map: HashMap<String, String> = vars
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        move |key| map.get(key).cloned()
    }

    fn config(vars: &[(&str, &str)]) -> HostConfig {
        HostConfig::resolve(lookup(vars), &HostFile::default())
    }

    #[test]
    fn defaults_to_embedded_api_on_port_5100() {
        let cfg = config(&[]);
        assert_eq!(cfg.api_url(), "http://localhost:5100");
        assert!(!cfg.uses_external_api());
        assert!(!cfg.allow_lan_api);
        assert!(!cfg.managed_by_installer);
        assert_eq!(cfg.renderer_api_token(), None);
    }

    #[test]
    fn honours_port_and_external_api() {
        let cfg = config(&[
            ("PORT", "3917"),
            ("FOTOBOX_API_URL", "http://192.168.1.5:5100/"),
            ("FOTOBOX_LAN_API_TOKEN", "secret"),
        ]);
        assert_eq!(cfg.api_port, 3917);
        assert_eq!(cfg.api_url(), "http://192.168.1.5:5100");
        assert_eq!(cfg.renderer_api_token(), Some("secret"));
    }

    #[test]
    fn token_is_not_exposed_for_the_embedded_api() {
        let cfg = config(&[("FOTOBOX_LAN_API_TOKEN", "secret")]);
        assert_eq!(cfg.renderer_api_token(), None);
    }

    #[test]
    fn kiosk_flag_overrides_build_default() {
        assert!(config(&[("FOTOBOX_KIOSK", "1")]).kiosk);
        assert!(!config(&[("FOTOBOX_KIOSK", "0")]).kiosk);
        assert!(!config(&[("PORT", "not-a-port"), ("FOTOBOX_KIOSK", "false")]).kiosk);
        assert_eq!(config(&[("PORT", "not-a-port")]).api_port, DEFAULT_API_PORT);
    }

    #[test]
    fn reads_installer_host_file() {
        let file: HostFile = serde_json::from_str(
            r#"{"managedBy":"installer","kiosk":true,"port":3100,
                "allowLanApi":true,"lanApiToken":"tok","future":"ignored"}"#,
        )
        .unwrap();
        let cfg = HostConfig::resolve(lookup(&[]), &file);
        assert!(cfg.managed_by_installer);
        assert!(cfg.kiosk);
        assert_eq!(cfg.api_port, 3100);
        assert!(cfg.allow_lan_api);
        assert_eq!(cfg.lan_api_token.as_deref(), Some("tok"));
    }

    #[test]
    fn kiosk_applies_only_to_the_kiosk_user() {
        let file = HostFile {
            kiosk: Some(true),
            kiosk_user: Some("Fotobox".into()),
            ..HostFile::default()
        };
        let kiosk_user = HostConfig::resolve(lookup(&[("USERNAME", "fotobox")]), &file);
        assert!(kiosk_user.kiosk);
        let admin = HostConfig::resolve(lookup(&[("USERNAME", "Admin")]), &file);
        assert!(!admin.kiosk);
        // An explicit FOTOBOX_KIOSK still wins.
        let forced = HostConfig::resolve(
            lookup(&[("USERNAME", "Admin"), ("FOTOBOX_KIOSK", "1")]),
            &file,
        );
        assert!(forced.kiosk);
    }

    #[test]
    fn environment_overrides_host_file() {
        let file = HostFile {
            kiosk: Some(true),
            port: Some(3100),
            allow_lan_api: Some(true),
            lan_api_token: Some("file".into()),
            ..HostFile::default()
        };
        let cfg = HostConfig::resolve(
            lookup(&[
                ("FOTOBOX_KIOSK", "0"),
                ("PORT", "3200"),
                ("FOTOBOX_ALLOW_LAN_API", "false"),
                ("FOTOBOX_LAN_API_TOKEN", "env"),
            ]),
            &file,
        );
        assert!(!cfg.kiosk);
        assert_eq!(cfg.api_port, 3200);
        assert!(!cfg.allow_lan_api);
        assert_eq!(cfg.lan_api_token.as_deref(), Some("env"));
    }

    #[test]
    fn loads_file_with_bom_and_tolerates_missing_or_invalid_files() {
        let dir = env::temp_dir().join(format!("fotobox-host-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("host.json");

        std::fs::write(&path, "\u{feff}{\"kiosk\":false}").unwrap();
        assert_eq!(HostFile::load(Some(path.clone())).kiosk, Some(false));

        std::fs::write(&path, "not json").unwrap();
        assert_eq!(HostFile::load(Some(path.clone())), HostFile::default());

        std::fs::remove_file(&path).unwrap();
        assert_eq!(HostFile::load(Some(path)), HostFile::default());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn host_config_path_can_be_overridden() {
        assert_eq!(
            HostFile::default_path(lookup(&[("FOTOBOX_HOST_CONFIG", "/etc/fotobox.json")])),
            Some(PathBuf::from("/etc/fotobox.json"))
        );
    }
}
