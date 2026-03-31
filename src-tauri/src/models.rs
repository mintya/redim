use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    #[serde(skip_serializing)]
    pub password: Option<String>,
    #[serde(default)]
    pub password_stored: bool,
    pub username: Option<String>,
    pub db: i64,
    pub ssl: bool,
    pub ssh_tunnel: bool,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<u16>,
    pub ssh_user: Option<String>,
    pub cluster: bool,
    pub sentinel: bool,
    pub sentinel_master: Option<String>,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            id: uuid(),
            name: String::new(),
            host: "127.0.0.1".to_string(),
            port: 6379,
            password: None,
            password_stored: false,
            username: None,
            db: 0,
            ssl: false,
            ssh_tunnel: false,
            ssh_host: None,
            ssh_port: None,
            ssh_user: None,
            cluster: false,
            sentinel: false,
            sentinel_master: None,
        }
    }
}

impl ConnectionConfig {
    #[allow(dead_code)]
    pub fn new(name: &str, host: &str, port: u16) -> Self {
        Self {
            id: uuid(),
            name: name.to_string(),
            host: host.to_string(),
            port,
            ..Default::default()
        }
    }

    pub fn connection_string(&self) -> String {
        let password = self.resolved_password();
        if let Some(ref pwd) = password {
            if let Some(ref username) = self.username {
                format!(
                    "redis://{}:{}@{}:{}/{}",
                    username, pwd, self.host, self.port, self.db
                )
            } else {
                format!("redis://:{}@{}:{}/{}", pwd, self.host, self.port, self.db)
            }
        } else {
            format!("redis://{}:{}/{}", self.host, self.port, self.db)
        }
    }

    /// Resolve password from keyring if stored there, otherwise use in-memory value
    pub fn resolved_password(&self) -> Option<String> {
        if self.password_stored {
            get_password_from_keyring(&self.id)
        } else {
            self.password.clone()
        }
    }

    /// Save password to keyring and mark as stored
    pub fn store_password(&mut self) -> Result<(), String> {
        if let Some(ref pwd) = self.password {
            save_password_to_keyring(&self.id, pwd)?;
            self.password_stored = true;
            self.password = None; // Clear from memory after storing
        }
        Ok(())
    }

    /// Delete password from keyring
    pub fn delete_password(&self) {
        delete_password_from_keyring(&self.id);
    }
}

fn keyring_service() -> &'static str {
    "com.redim.redis"
}

fn get_password_from_keyring(connection_id: &str) -> Option<String> {
    let entry = keyring::Entry::new(keyring_service(), connection_id).ok()?;
    entry.get_password().ok()
}

fn save_password_to_keyring(connection_id: &str, password: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(keyring_service(), connection_id)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    entry
        .set_password(password)
        .map_err(|e| format!("Failed to save password to keyring: {}", e))?;
    Ok(())
}

fn delete_password_from_keyring(connection_id: &str) {
    if let Ok(entry) = keyring::Entry::new(keyring_service(), connection_id) {
        let _ = entry.delete_credential();
    }
}

fn uuid() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{:x}{:x}", now.as_secs(), now.subsec_nanos())
}
