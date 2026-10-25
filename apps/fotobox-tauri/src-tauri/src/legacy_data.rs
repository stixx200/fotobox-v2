//! One-time import of data from the former Electron app, so existing kiosks
//! keep their settings, share links and photo index after upgrading.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Electron stored data in the OS app-data directory under the app name.
const LEGACY_DIR_NAMES: [&str; 2] = ["Fotobox", "fotobox-electron"];
/// SQLite database (with WAL side files) and the legacy settings file.
const LEGACY_FILES: [&str; 4] = [
    "fotobox.db",
    "fotobox.db-wal",
    "fotobox.db-shm",
    "settings.json",
];

fn legacy_dir(data_dir: &Path) -> Option<PathBuf> {
    let parent = data_dir.parent()?;
    LEGACY_DIR_NAMES
        .iter()
        .map(|name| parent.join(name))
        .find(|dir| dir != data_dir && dir.join("fotobox.db").is_file())
}

/// Copies the Electron database into `data_dir` if this app has no database
/// yet. Returns the directory imported from, if any. The old files are left
/// in place so a rollback to the Electron build still works.
pub fn import_legacy_data(data_dir: &Path) -> io::Result<Option<PathBuf>> {
    if data_dir.join("fotobox.db").exists() {
        return Ok(None);
    }
    let Some(source) = legacy_dir(data_dir) else {
        return Ok(None);
    };
    fs::create_dir_all(data_dir)?;
    for name in LEGACY_FILES {
        let from = source.join(name);
        if from.is_file() {
            fs::copy(&from, data_dir.join(name))?;
        }
    }
    Ok(Some(source))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("fotobox-{name}-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn imports_electron_database_once() {
        let root = temp_root("import");
        let legacy = root.join("Fotobox");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("fotobox.db"), b"db").unwrap();
        fs::write(legacy.join("fotobox.db-wal"), b"wal").unwrap();
        let data_dir = root.join("de.se-voelk.fotobox");

        assert_eq!(import_legacy_data(&data_dir).unwrap(), Some(legacy.clone()));
        assert_eq!(fs::read(data_dir.join("fotobox.db")).unwrap(), b"db");
        assert_eq!(fs::read(data_dir.join("fotobox.db-wal")).unwrap(), b"wal");
        assert!(!data_dir.join("settings.json").exists());
        // Legacy data stays for rollback; a second start does nothing.
        assert!(legacy.join("fotobox.db").exists());
        assert_eq!(import_legacy_data(&data_dir).unwrap(), None);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn never_overwrites_existing_data() {
        let root = temp_root("keep");
        let legacy = root.join("fotobox-electron");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("fotobox.db"), b"old").unwrap();
        let data_dir = root.join("de.se-voelk.fotobox");
        fs::create_dir_all(&data_dir).unwrap();
        fs::write(data_dir.join("fotobox.db"), b"new").unwrap();

        assert_eq!(import_legacy_data(&data_dir).unwrap(), None);
        assert_eq!(fs::read(data_dir.join("fotobox.db")).unwrap(), b"new");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn nothing_to_import_without_legacy_install() {
        let root = temp_root("none");
        assert_eq!(import_legacy_data(&root.join("app")).unwrap(), None);
        fs::remove_dir_all(root).unwrap();
    }
}
