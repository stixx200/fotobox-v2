//! Fotobox desktop host: kiosk window around the Angular UI, plus the NestJS
//! API running as a supervised Node sidecar on the same machine.

mod config;
mod kiosk;
mod legacy_data;
mod sidecar;
mod supervisor;
mod windows;

use tauri::{AppHandle, Manager, RunEvent, State};
use tauri_plugin_autostart::MacosLauncher;

use config::HostConfig;
use sidecar::ApiSidecar;

/// Opens the collage editor window. Called by the settings screen through
/// `openCollageEditorWindow()` in frontend-core.
#[tauri::command]
fn open_collage_editor(
    app: AppHandle,
    config: State<'_, HostConfig>,
    collage_directory: Option<String>,
) -> Result<(), String> {
    windows::open_collage_editor(&app, &config, collage_directory.as_deref())
        .map_err(|error| error.to_string())
}

pub fn run() {
    let config = HostConfig::load();

    let app = tauri::Builder::default()
        // Must be registered first so a second launch only focuses the kiosk.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(windows::MAIN_WINDOW) {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("fotobox".into()),
                    }),
                ])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(config.clone())
        .manage(ApiSidecar::default())
        .invoke_handler(tauri::generate_handler![open_collage_editor])
        .setup(move |app| {
            let handle = app.handle().clone();
            log::info!(
                "Starting Fotobox (kiosk: {}, API: {})",
                config.kiosk,
                config.api_url()
            );

            if config.uses_external_api() {
                log::info!("Using external API at {}", config.api_url());
            } else {
                sidecar::spawn_supervisor(handle.clone(), config.clone());
            }

            windows::create_main_window(&handle, &config)?;

            if config.kiosk {
                kiosk::run_first_start_setup(&handle, &config);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Fotobox app");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            app.state::<ApiSidecar>().stop();
        }
    });
}
