use redis::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tokio::time::timeout;

use crate::models::ConnectionConfig;

pub struct RedisManager {
    clients: Mutex<HashMap<String, Client>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseInfo {
    pub index: i64,
    pub keys: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyInfo {
    pub name: String,
    pub key_type: String,
    pub ttl: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HashField {
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZSetMember {
    pub member: String,
    pub score: f64,
}

impl RedisManager {
    pub fn new() -> Self {
        Self {
            clients: Mutex::new(HashMap::new()),
        }
    }

    pub fn get_client(&self, config: &ConnectionConfig) -> Result<Client, String> {
        let mut clients = self.clients.lock().map_err(|e| e.to_string())?;
        
        if let Some(client) = clients.get(&config.id) {
            return Ok(client.clone());
        }
        
        let conn_string = config.connection_string();
        let client = Client::open(conn_string).map_err(|e| format!("Failed to create client: {}", e))?;
        clients.insert(config.id.clone(), client.clone());
        
        Ok(client)
    }

    pub fn remove_client(&self, id: &str) {
        if let Ok(mut clients) = self.clients.lock() {
            clients.remove(id);
        }
    }

    pub async fn test_connection(&self, config: &ConnectionConfig) -> Result<u128, String> {
        // 测试连接时直接创建新客户端，不使用缓存
        let conn_string = config.connection_string();
        let client = Client::open(conn_string).map_err(|e| format!("Failed to create client: {}", e))?;
        
        let start = std::time::Instant::now();
        
        // 10秒超时
        let result = timeout(Duration::from_secs(10), async {
            let mut conn = client.get_multiplexed_async_connection()
                .await
                .map_err(|e| format!("Connection failed: {}", e))?;
            
            let _: String = redis::cmd("PING")
                .query_async(&mut conn)
                .await
                .map_err(|e| format!("Ping failed: {}", e))?;
            
            Ok::<u128, String>(start.elapsed().as_millis())
        }).await;
        
        match result {
            Ok(Ok(latency)) => Ok(latency),
            Ok(Err(e)) => Err(e),
            Err(_) => Err("Connection timeout (10s)".to_string()),
        }
    }

    pub async fn get_connection(&self, config: &ConnectionConfig) -> Result<redis::aio::MultiplexedConnection, String> {
        let client = self.get_client(config)?;
        
        // 10秒超时
        let result = timeout(Duration::from_secs(10), async {
            client.get_multiplexed_async_connection()
                .await
                .map_err(|e| format!("Connection failed: {}", e))
        }).await;
        
        match result {
            Ok(conn) => conn,
            Err(_) => Err("Connection timeout (10s)".to_string()),
        }
    }

    pub async fn get_dbs(&self, config: &ConnectionConfig) -> Result<Vec<DatabaseInfo>, String> {
        let mut conn = self.get_connection(config).await?;
        
        let info: String = redis::cmd("INFO")
            .arg("keyspace")
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get info: {}", e))?;
        
        let mut dbs = Vec::new();
        for line in info.lines() {
            if line.starts_with("db") {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() == 2 {
                    let index = parts[0].replace("db", "").parse::<i64>().unwrap_or(0);
                    let stats: Vec<&str> = parts[1].split(',').collect();
                    let keys = stats.first()
                        .and_then(|s| s.split('=').nth(1))
                        .and_then(|s| s.parse::<i64>().ok())
                        .unwrap_or(0);
                    dbs.push(DatabaseInfo { index, keys });
                }
            }
        }
        
        if dbs.is_empty() {
            dbs.push(DatabaseInfo { index: 0, keys: 0 });
        }
        
        Ok(dbs)
    }

    pub async fn select_db(&self, config: &ConnectionConfig, db: i64) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: String = redis::cmd("SELECT")
            .arg(db)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to select db: {}", e))?;
        Ok(true)
    }

    pub async fn get_keys(&self, config: &ConnectionConfig, pattern: &str, cursor: u64, count: u64) -> Result<(u64, Vec<String>), String> {
        let mut conn = self.get_connection(config).await?;
        
        let (new_cursor, keys): (u64, Vec<String>) = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg(pattern)
            .arg("COUNT")
            .arg(count)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to scan keys: {}", e))?;
        
        Ok((new_cursor, keys))
    }

    pub async fn get_keys_with_types(&self, config: &ConnectionConfig, pattern: &str, cursor: u64, count: u64) -> Result<(u64, Vec<(String, String)>), String> {
        let mut conn = self.get_connection(config).await?;
        
        let (new_cursor, keys): (u64, Vec<String>) = redis::cmd("SCAN")
            .arg(cursor)
            .arg("MATCH")
            .arg(pattern)
            .arg("COUNT")
            .arg(count)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to scan keys: {}", e))?;
        
        let mut keys_with_types = Vec::new();
        for key in &keys {
            let key_type: String = redis::cmd("TYPE")
                .arg(key)
                .query_async(&mut conn)
                .await
                .unwrap_or_else(|_| "unknown".to_string());
            keys_with_types.push((key.clone(), key_type));
        }
        
        Ok((new_cursor, keys_with_types))
    }

    pub async fn get_key_type(&self, config: &ConnectionConfig, key: &str) -> Result<String, String> {
        let mut conn = self.get_connection(config).await?;
        let key_type: String = redis::cmd("TYPE")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get type: {}", e))?;
        Ok(key_type)
    }

    pub async fn get_ttl(&self, config: &ConnectionConfig, key: &str) -> Result<i64, String> {
        let mut conn = self.get_connection(config).await?;
        let ttl: i64 = redis::cmd("TTL")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get TTL: {}", e))?;
        Ok(ttl)
    }

    pub async fn get_key_info(&self, config: &ConnectionConfig, key: &str) -> Result<KeyInfo, String> {
        let key_type = self.get_key_type(config, key).await?;
        let ttl = self.get_ttl(config, key).await?;
        Ok(KeyInfo {
            name: key.to_string(),
            key_type,
            ttl,
        })
    }

    // String operations
    pub async fn get_string(&self, config: &ConnectionConfig, key: &str) -> Result<String, String> {
        let mut conn = self.get_connection(config).await?;
        let value: String = redis::cmd("GET")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get string: {}", e))?;
        Ok(value)
    }

    pub async fn set_string(&self, config: &ConnectionConfig, key: &str, value: &str) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: String = redis::cmd("SET")
            .arg(key)
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to set string: {}", e))?;
        Ok(true)
    }

    // Hash operations
    pub async fn get_hash(&self, config: &ConnectionConfig, key: &str) -> Result<Vec<HashField>, String> {
        let mut conn = self.get_connection(config).await?;
        let result: HashMap<String, String> = redis::cmd("HGETALL")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get hash: {}", e))?;
        
        let fields = result.into_iter()
            .map(|(field, value)| HashField { field, value })
            .collect();
        Ok(fields)
    }

    pub async fn set_hash_field(&self, config: &ConnectionConfig, key: &str, field: &str, value: &str) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: i32 = redis::cmd("HSET")
            .arg(key)
            .arg(field)
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to set hash field: {}", e))?;
        Ok(true)
    }

    pub async fn delete_hash_field(&self, config: &ConnectionConfig, key: &str, field: &str) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: i32 = redis::cmd("HDEL")
            .arg(key)
            .arg(field)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to delete hash field: {}", e))?;
        Ok(true)
    }

    // List operations
    pub async fn get_list(&self, config: &ConnectionConfig, key: &str, start: i64, stop: i64) -> Result<Vec<String>, String> {
        let mut conn = self.get_connection(config).await?;
        let result: Vec<String> = redis::cmd("LRANGE")
            .arg(key)
            .arg(start)
            .arg(stop)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get list: {}", e))?;
        Ok(result)
    }

    pub async fn push_list(&self, config: &ConnectionConfig, key: &str, value: &str, at_head: bool) -> Result<i64, String> {
        let mut conn = self.get_connection(config).await?;
        let cmd = if at_head { "LPUSH" } else { "RPUSH" };
        let len: i64 = redis::cmd(cmd)
            .arg(key)
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to push list: {}", e))?;
        Ok(len)
    }

    pub async fn get_list_len(&self, config: &ConnectionConfig, key: &str) -> Result<i64, String> {
        let mut conn = self.get_connection(config).await?;
        let len: i64 = redis::cmd("LLEN")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get list length: {}", e))?;
        Ok(len)
    }

    pub async fn set_list_value(&self, config: &ConnectionConfig, key: &str, index: i64, value: &str) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: String = redis::cmd("LSET")
            .arg(key)
            .arg(index)
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to set list value: {}", e))?;
        Ok(true)
    }

    pub async fn remove_list_value(&self, config: &ConnectionConfig, key: &str, count: i64, value: &str) -> Result<i64, String> {
        let mut conn = self.get_connection(config).await?;
        let removed: i64 = redis::cmd("LREM")
            .arg(key)
            .arg(count)
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to remove list value: {}", e))?;
        Ok(removed)
    }

    // Set operations
    pub async fn get_set(&self, config: &ConnectionConfig, key: &str) -> Result<Vec<String>, String> {
        let mut conn = self.get_connection(config).await?;
        let result: Vec<String> = redis::cmd("SMEMBERS")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get set: {}", e))?;
        Ok(result)
    }

    pub async fn add_set(&self, config: &ConnectionConfig, key: &str, member: &str) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: i32 = redis::cmd("SADD")
            .arg(key)
            .arg(member)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to add set member: {}", e))?;
        Ok(true)
    }

    pub async fn remove_set_member(&self, config: &ConnectionConfig, key: &str, member: &str) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: i32 = redis::cmd("SREM")
            .arg(key)
            .arg(member)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to remove set member: {}", e))?;
        Ok(true)
    }

    // Sorted Set operations
    pub async fn get_zset(&self, config: &ConnectionConfig, key: &str, start: i64, stop: i64) -> Result<Vec<ZSetMember>, String> {
        let mut conn = self.get_connection(config).await?;
        let result: Vec<(String, f64)> = redis::cmd("ZRANGE")
            .arg(key)
            .arg(start)
            .arg(stop)
            .arg("WITHSCORES")
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get zset: {}", e))?;
        
        let members = result.into_iter()
            .map(|(member, score)| ZSetMember { member, score })
            .collect();
        Ok(members)
    }

    pub async fn add_zset(&self, config: &ConnectionConfig, key: &str, member: &str, score: f64) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: i32 = redis::cmd("ZADD")
            .arg(key)
            .arg(score)
            .arg(member)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to add zset member: {}", e))?;
        Ok(true)
    }

    pub async fn get_zset_len(&self, config: &ConnectionConfig, key: &str) -> Result<i64, String> {
        let mut conn = self.get_connection(config).await?;
        let len: i64 = redis::cmd("ZCARD")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to get zset length: {}", e))?;
        Ok(len)
    }

    pub async fn delete_zset_member(&self, config: &ConnectionConfig, key: &str, member: &str) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: i32 = redis::cmd("ZREM")
            .arg(key)
            .arg(member)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to delete zset member: {}", e))?;
        Ok(true)
    }

    // Key operations
    pub async fn delete_key(&self, config: &ConnectionConfig, key: &str) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: i32 = redis::cmd("DEL")
            .arg(key)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to delete key: {}", e))?;
        Ok(true)
    }

    pub async fn rename_key(&self, config: &ConnectionConfig, old_key: &str, new_key: &str) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let _: String = redis::cmd("RENAME")
            .arg(old_key)
            .arg(new_key)
            .query_async(&mut conn)
            .await
            .map_err(|e| format!("Failed to rename key: {}", e))?;
        Ok(true)
    }

    pub async fn set_ttl(&self, config: &ConnectionConfig, key: &str, ttl: i64) -> Result<bool, String> {
        let mut conn = self.get_connection(config).await?;
        let result: i32 = if ttl > 0 {
            redis::cmd("EXPIRE")
                .arg(key)
                .arg(ttl)
                .query_async(&mut conn)
                .await
                .map_err(|e| format!("Failed to set TTL: {}", e))?
        } else {
            redis::cmd("PERSIST")
                .arg(key)
                .query_async(&mut conn)
                .await
                .map_err(|e| format!("Failed to persist key: {}", e))?
        };
        Ok(result == 1)
    }

    pub async fn execute_command(&self, config: &ConnectionConfig, args: Vec<String>) -> Result<String, String> {
        if args.is_empty() {
            return Err("No command provided".to_string());
        }

        // Handle UNBLOCK prefix for dangerous commands
        let (actual_args, is_unblocked) = if args[0].to_uppercase() == "UNBLOCK" {
            if args.len() < 2 {
                return Err("UNBLOCK requires a command argument".to_string());
            }
            (args[1..].to_vec(), true)
        } else {
            (args, false)
        };

        let cmd_name = actual_args[0].to_uppercase();
        if !is_unblocked && (cmd_name == "FLUSHDB" || cmd_name == "FLUSHALL") {
            return Err(format!(
                "Blocked: {} is a destructive operation. Use the GUI confirmation to proceed.",
                cmd_name
            ));
        }

        let mut conn = self.get_connection(config).await?;
        let mut cmd = redis::cmd(&actual_args[0]);
        for arg in &actual_args[1..] {
            cmd.arg(arg);
        }
        
        let result: redis::Value = cmd.query_async(&mut conn)
            .await
            .map_err(|e| format!("Command failed: {}", e))?;
        
        Ok(format_value(&result))
    }
}

fn format_value(value: &redis::Value) -> String {
    match value {
        redis::Value::Nil => "(nil)".to_string(),
        redis::Value::Int(n) => n.to_string(),
        redis::Value::BulkString(data) => String::from_utf8_lossy(data).to_string(),
        redis::Value::Array(values) => {
            let items: Vec<String> = values.iter().enumerate().map(|(i, v)| {
                format!("{}) {}", i + 1, format_value(v))
            }).collect();
            items.join("\n")
        }
        redis::Value::SimpleString(s) => s.clone(),
        redis::Value::Okay => "OK".to_string(),
        _ => format!("{:?}", value),
    }
}
