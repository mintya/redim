use crate::models::ConnectionConfig;
use serde_json;
use std::fs;
use std::path::PathBuf;

fn config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("redim");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).unwrap_or_default();
    }

    config_dir.join("connections.json")
}

pub fn load_connections() -> Vec<ConnectionConfig> {
    let path = config_path();
    if !path.exists() {
        return Vec::new();
    }

    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_connections(connections: &[ConnectionConfig]) -> Result<(), String> {
    let path = config_path();
    let content = serde_json::to_string_pretty(connections)
        .map_err(|e| format!("Failed to serialize: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("Failed to write: {}", e))?;
    Ok(())
}

pub fn add_connection(mut config: ConnectionConfig) -> Result<Vec<ConnectionConfig>, String> {
    // Store password in keyring before saving
    config.store_password()?;

    let mut connections = load_connections();
    connections.push(config);
    save_connections(&connections)?;
    Ok(connections)
}

pub fn update_connection(mut config: ConnectionConfig) -> Result<Vec<ConnectionConfig>, String> {
    // Store password in keyring before saving
    config.store_password()?;

    let mut connections = load_connections();
    if let Some(conn) = connections.iter_mut().find(|c| c.id == config.id) {
        // Delete old keyring entry if id changed (shouldn't happen, but be safe)
        if conn.password_stored && !config.password_stored {
            conn.delete_password();
        }
        *conn = config;
    }
    save_connections(&connections)?;
    Ok(connections)
}

pub fn delete_connection(id: &str) -> Result<Vec<ConnectionConfig>, String> {
    let mut connections = load_connections();

    // Clean up keyring for deleted connection
    if let Some(conn) = connections.iter().find(|c| c.id == id) {
        if conn.password_stored {
            conn.delete_password();
        }
    }

    connections.retain(|c| c.id != id);
    save_connections(&connections)?;
    Ok(connections)
}

pub fn get_connection(id: &str) -> Option<ConnectionConfig> {
    let connections = load_connections();
    connections.into_iter().find(|c| c.id == id)
}
