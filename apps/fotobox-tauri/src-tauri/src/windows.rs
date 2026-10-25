//! Kiosk window and collage editor window.

use tauri::{
    AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

use crate::config::HostConfig;

pub const MAIN_WINDOW: &str = "main";
pub const EDITOR_WINDOW: &str = "collage-editor";
const APP_TITLE: &str = "Fotobox";

/// Script injected before the web app boots: tells the UI where the API is
/// (read by `resolveApiBaseUrl()` in frontend-core) and, in kiosk mode,
/// disables the context menu.
pub fn init_script(config: &HostConfig, collage_directory: Option<&str>) -> String {
    let json = |value: &str| serde_json::to_string(value).expect("string serializes");
    let mut script = format!(
        "window.__FOTOBOX_API_URL__ = {};\n",
        json(&config.api_url())
    );
    if let Some(token) = config.renderer_api_token() {
        script.push_str(&format!(
            "window.__FOTOBOX_API_TOKEN__ = {};\n",
            json(token)
        ));
    }
    if let Some(dir) = collage_directory {
        script.push_str(&format!(
            "window.__FOTOBOX_COLLAGE_DIR__ = {};\n",
            json(dir)
        ));
    }
    if config.kiosk {
        script.push_str(
            "window.addEventListener('contextmenu', (event) => event.preventDefault());\n",
        );
    }
    script
}

pub fn create_main_window(app: &AppHandle, config: &HostConfig) -> tauri::Result<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::App("index.html".into()))
        .title(APP_TITLE)
        .initialization_script(init_script(config, None))
        .inner_size(1280.0, 800.0)
        .fullscreen(config.kiosk)
        .decorations(!config.kiosk)
        .resizable(!config.kiosk)
        .always_on_top(config.kiosk)
        .build()?;

    if config.kiosk {
        // Keep the booth from being closed with Alt+F4 / Cmd+Q.
        window.on_window_event(|event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
            }
        });
    }
    Ok(window)
}

fn editor_url(config: &HostConfig) -> tauri::Result<WebviewUrl> {
    match config.collage_editor_dev_server.as_deref() {
        Some(dev_server) => {
            let url = Url::parse(dev_server).map_err(|error| {
                tauri::Error::Io(std::io::Error::other(format!(
                    "invalid FOTOBOX_COLLAGE_EDITOR_DEV_SERVER: {error}"
                )))
            })?;
            Ok(WebviewUrl::External(url))
        }
        None => Ok(WebviewUrl::App("collage-editor/index.html".into())),
    }
}

/// Opens (or re-opens with another template directory) the collage editor.
pub fn open_collage_editor(
    app: &AppHandle,
    config: &HostConfig,
    collage_directory: Option<&str>,
) -> tauri::Result<()> {
    // The directory is baked into the init script, so re-create the window
    // when it is already open.
    if let Some(existing) = app.get_webview_window(EDITOR_WINDOW) {
        existing.destroy()?;
    }

    let mut builder = WebviewWindowBuilder::new(app, EDITOR_WINDOW, editor_url(config)?)
        .title(format!("{APP_TITLE} Collage Editor"))
        .initialization_script(init_script(config, collage_directory))
        .inner_size(1600.0, 1000.0)
        .fullscreen(config.kiosk)
        .decorations(!config.kiosk);
    if config.kiosk {
        if let Some(main) = app.get_webview_window(MAIN_WINDOW) {
            // Stays above the always-on-top kiosk window.
            builder = builder.parent(&main)?.always_on_top(true);
        }
    }
    let editor = builder.build()?;
    editor.set_focus()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(kiosk: bool, external: Option<&str>, token: Option<&str>) -> HostConfig {
        HostConfig {
            api_port: 3000,
            external_api_url: external.map(String::from),
            lan_api_token: token.map(String::from),
            kiosk,
            collage_editor_dev_server: None,
        }
    }

    #[test]
    fn injects_api_url_as_json() {
        let script = init_script(&config(false, None, None), None);
        assert_eq!(
            script,
            "window.__FOTOBOX_API_URL__ = \"http://localhost:3000\";\n"
        );
    }

    #[test]
    fn escapes_collage_directory_and_token() {
        let script = init_script(
            &config(true, Some("http://host:3000"), Some("t\"</script>")),
            Some("C:\\Fotos\\\"x\""),
        );
        assert!(script.contains("window.__FOTOBOX_API_TOKEN__ = \"t\\\"</script>\";"));
        assert!(script.contains("window.__FOTOBOX_COLLAGE_DIR__ = \"C:\\\\Fotos\\\\\\\"x\\\"\";"));
        assert!(script.contains("contextmenu"));
    }
}
