//! Runs the NestJS API (`resources/api/main.js`) on the bundled Node binary
//! and keeps it alive.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::config::HostConfig;
use crate::supervisor::{Action, Supervisor};

const HEALTH_INTERVAL: Duration = Duration::from_secs(30);
const HEALTH_TIMEOUT: Duration = Duration::from_secs(5);
const HEALTH_MAX_FAILURES: u32 = 3;

/// Handle to the running API process, stored in Tauri state.
#[derive(Default)]
pub struct ApiSidecar {
    child: Mutex<Option<Child>>,
}

struct SidecarPaths {
    node: PathBuf,
    api_dir: PathBuf,
    data_dir: PathBuf,
    log_dir: PathBuf,
}

fn resolve_paths(app: &AppHandle) -> tauri::Result<SidecarPaths> {
    // Tauri places `externalBin` entries next to the main executable, without
    // the target-triple suffix.
    let exe_dir = std::env::current_exe()?
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    let node = exe_dir.join(format!("node{}", std::env::consts::EXE_SUFFIX));
    let api_dir = app.path().resource_dir()?.join("api");
    let data_dir = app.path().app_data_dir()?;
    let log_dir = app.path().app_log_dir()?;
    Ok(SidecarPaths {
        node,
        api_dir,
        data_dir,
        log_dir,
    })
}

/// Environment for the API: data under the OS app-data directory. Variables
/// already set by the operator (e.g. FOTOBOX_ALLOW_LAN_API) are inherited and
/// take precedence over these defaults.
fn api_env(paths: &SidecarPaths, config: &HostConfig) -> Vec<(String, String)> {
    let data = |name: &str| paths.data_dir.join(name).to_string_lossy().into_owned();
    let defaults = [
        ("FOTOBOX_WORKSPACE_ROOT", data("")),
        ("FOTOBOX_DATABASE_PATH", data("fotobox.db")),
        ("FOTOBOX_SETTINGS_PATH", data("settings.json")),
        ("FOTOBOX_PHOTO_DIR", data("photos")),
        ("FOTOBOX_TEMPLATE_DIR", data("collage-templates")),
        (
            "FOTOBOX_LOG_FILE",
            paths.log_dir.join("api.log").to_string_lossy().into_owned(),
        ),
        (
            "FOTOBOX_BUILTIN_TEMPLATE_DIR",
            paths
                .api_dir
                .join("collage-templates")
                .to_string_lossy()
                .into_owned(),
        ),
    ];
    let mut env: Vec<(String, String)> = defaults
        .into_iter()
        .filter(|(key, _)| std::env::var_os(key).is_none())
        .map(|(key, value)| (key.to_string(), value))
        .collect();
    // Always bind on all interfaces so guest phones can open QR share links;
    // the API's access policy restricts what LAN clients may do.
    env.push(("PORT".into(), config.api_port.to_string()));
    env.push(("HOST".into(), "0.0.0.0".into()));
    env.push(("NODE_ENV".into(), "production".into()));
    // The API exits when this pipe closes, i.e. whenever the host process
    // ends — including crashes and kills that skip RunEvent::Exit.
    env.push(("FOTOBOX_EXIT_ON_STDIN_CLOSE".into(), "1".into()));
    env
}

fn forward_output(stream: impl Read + Send + 'static, level: log::Level) {
    thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            log::log!(target: "api", level, "{line}");
        }
    });
}

impl ApiSidecar {
    pub fn start(&self, app: &AppHandle, config: &HostConfig) -> tauri::Result<()> {
        let paths = resolve_paths(app)?;
        match crate::legacy_data::import_legacy_data(&paths.data_dir) {
            Ok(Some(source)) => log::info!("Imported data from {}", source.display()),
            Ok(None) => {}
            Err(error) => log::error!("Importing legacy data failed: {error}"),
        }
        std::fs::create_dir_all(&paths.data_dir)?;
        std::fs::create_dir_all(&paths.log_dir)?;

        let mut command = Command::new(&paths.node);
        command
            .arg(paths.api_dir.join("main.js"))
            .current_dir(&paths.api_dir)
            .envs(api_env(&paths, config))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command.spawn()?;
        log::info!(
            "Started API sidecar (pid {}) with {}",
            child.id(),
            paths.node.display()
        );
        if let Some(stdout) = child.stdout.take() {
            forward_output(stdout, log::Level::Info);
        }
        if let Some(stderr) = child.stderr.take() {
            forward_output(stderr, log::Level::Warn);
        }
        *self.child.lock().expect("sidecar lock poisoned") = Some(child);
        Ok(())
    }

    pub fn stop(&self) {
        let child = self.child.lock().expect("sidecar lock poisoned").take();
        if let Some(mut child) = child {
            log::info!("Stopping API sidecar (pid {})", child.id());
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    pub fn restart(&self, app: &AppHandle, config: &HostConfig) -> tauri::Result<()> {
        self.stop();
        self.start(app, config)
    }

    /// True while the process exists (it may still be booting).
    pub fn is_running(&self) -> bool {
        let mut guard = self.child.lock().expect("sidecar lock poisoned");
        match guard.as_mut().map(Child::try_wait) {
            Some(Ok(None)) => true,
            Some(Ok(Some(status))) => {
                log::error!("API sidecar exited: {status}");
                *guard = None;
                false
            }
            Some(Err(error)) => {
                log::error!("Failed to query API sidecar: {error}");
                false
            }
            None => false,
        }
    }
}

/// POST `{ __typename }` to the API, like the UI's own readiness probe.
pub fn check_api_health(port: u16) -> bool {
    let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let Ok(mut stream) = TcpStream::connect_timeout(&addr, HEALTH_TIMEOUT) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(HEALTH_TIMEOUT));
    let _ = stream.set_write_timeout(Some(HEALTH_TIMEOUT));
    let body = r#"{"query":"{ __typename }"}"#;
    let request = format!(
        "POST /graphql HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut status_line = String::new();
    BufReader::new(stream).read_line(&mut status_line).is_ok() && is_ok_status(&status_line)
}

fn is_ok_status(status_line: &str) -> bool {
    status_line.split_whitespace().nth(1) == Some("200")
}

/// Starts the API and supervises it for the lifetime of the app. Runs even
/// when the first start fails, so a kiosk keeps trying instead of showing a
/// UI without backend.
pub fn spawn_supervisor(app: AppHandle, config: HostConfig) {
    if let Err(error) = app.state::<ApiSidecar>().start(&app, &config) {
        log::error!("Failed to start API sidecar: {error}");
    }

    thread::spawn(move || {
        let mut supervisor = Supervisor::new(HEALTH_MAX_FAILURES);
        loop {
            thread::sleep(HEALTH_INTERVAL);
            let sidecar = app.state::<ApiSidecar>();
            let healthy = sidecar.is_running() && check_api_health(config.api_port);
            match supervisor.on_check(healthy) {
                Action::None => {}
                Action::RestartApi => {
                    log::error!(
                        "API health check failed ({}/{HEALTH_MAX_FAILURES}), restarting",
                        supervisor.failures()
                    );
                    if let Err(error) = sidecar.restart(&app, &config) {
                        log::error!("API restart failed: {error}");
                    }
                }
                Action::RelaunchApp => {
                    log::error!("API unreachable after repeated failures, relaunching app");
                    sidecar.stop();
                    app.restart();
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognises_ok_status_lines() {
        assert!(is_ok_status("HTTP/1.1 200 OK\r\n"));
        assert!(!is_ok_status("HTTP/1.1 403 Forbidden\r\n"));
        assert!(!is_ok_status(""));
    }

    #[test]
    fn unreachable_port_is_unhealthy() {
        // Port 9 (discard) is essentially never listening on loopback.
        assert!(!check_api_health(9));
    }
}
