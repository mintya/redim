use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub password: Option<String>,
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
        if let Some(ref password) = self.password {
            if let Some(ref username) = self.username {
                format!(
                    "redis://{}:{}@{}:{}/{}",
                    username, password, self.host, self.port, self.db
                )
            } else {
                format!(
                    "redis://:{}@{}:{}/{}",
                    password, self.host, self.port, self.db
                )
            }
        } else {
            format!("redis://{}:{}/{}", self.host, self.port, self.db)
        }
    }
}

fn uuid() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{:x}{:x}", now.as_secs(), now.subsec_nanos())
}
