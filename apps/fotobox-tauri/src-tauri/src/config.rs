//! Host configuration from environment variables. The names match the ones
//! the previous Electron shell used, so existing kiosk setups keep working.

use std::env;

pub const DEFAULT_API_PORT: u16 = 3000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostConfig {
    /// Port of the embedded API sidecar (`PORT`).
    pub api_port: u16,
    /// Use an API on another machine instead of the sidecar (`FOTOBOX_API_URL`).
    pub external_api_url: Option<String>,
    /// LAN token sent to an external API in tablet mode (`FOTOBOX_LAN_API_TOKEN`).
    pub lan_api_token: Option<String>,
    /// Fullscreen, undecorated, non-closable window (`FOTOBOX_KIOSK`, default on
    /// in release builds).
    pub kiosk: bool,
    /// Collage editor dev server for debug builds (`FOTOBOX_COLLAGE_EDITOR_DEV_SERVER`).
    pub collage_editor_dev_server: Option<String>,
}

fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn parse_flag(value: Option<String>, default: bool) -> bool {
    match non_empty(value).as_deref() {
        Some("1") | Some("true") | Some("yes") => true,
        Some("0") | Some("false") | Some("no") => false,
        _ => default,
    }
}

impl HostConfig {
    pub fn from_env() -> Self {
        Self::from_lookup(|key| env::var(key).ok())
    }

    pub fn from_lookup(lookup: impl Fn(&str) -> Option<String>) -> Self {
        let api_port = non_empty(lookup("PORT"))
            .and_then(|port| port.parse().ok())
            .unwrap_or(DEFAULT_API_PORT);
        let collage_editor_dev_server = non_empty(lookup("FOTOBOX_COLLAGE_EDITOR_DEV_SERVER"))
            .or_else(|| cfg!(debug_assertions).then(|| "http://localhost:4201".to_string()));

        Self {
            api_port,
            external_api_url: non_empty(lookup("FOTOBOX_API_URL"))
                .map(|url| url.trim_end_matches('/').to_string()),
            lan_api_token: non_empty(lookup("FOTOBOX_LAN_API_TOKEN")),
            kiosk: parse_flag(lookup("FOTOBOX_KIOSK"), !cfg!(debug_assertions)),
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

    fn config(vars: &[(&str, &str)]) -> HostConfig {
        let map: HashMap<String, String> = vars
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        HostConfig::from_lookup(|key| map.get(key).cloned())
    }

    #[test]
    fn defaults_to_embedded_api_on_port_3000() {
        let cfg = config(&[]);
        assert_eq!(cfg.api_url(), "http://localhost:3000");
        assert!(!cfg.uses_external_api());
        assert_eq!(cfg.renderer_api_token(), None);
    }

    #[test]
    fn honours_port_and_external_api() {
        let cfg = config(&[
            ("PORT", "3917"),
            ("FOTOBOX_API_URL", "http://192.168.1.5:3000/"),
            ("FOTOBOX_LAN_API_TOKEN", "secret"),
        ]);
        assert_eq!(cfg.api_port, 3917);
        assert_eq!(cfg.api_url(), "http://192.168.1.5:3000");
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
}
