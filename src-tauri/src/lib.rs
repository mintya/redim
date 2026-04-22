mod models;
mod connection;
mod redis_manager;

use models::ConnectionConfig;
use redis_manager::{DatabaseInfo, HashField, KeyInfo, RedisManager, ZSetMember};
use tauri::State;

const KEY_PREVIEW_LIMIT: usize = 120;

fn preview_key(key: &str) -> String {
    let compact = key.replace('\n', "\\n").replace('\r', "\\r");
    let total_chars = compact.chars().count();
    if total_chars <= KEY_PREVIEW_LIMIT {
        return compact;
    }
    let preview: String = compact.chars().take(KEY_PREVIEW_LIMIT).collect();
    format!("{preview}...({total_chars})")
}

fn log_key_load_error(command: &str, id: &str, key: &str, error: &str) {
    eprintln!(
        "[key-load] {command} failed | id={id} | key={} | error={error}",
        preview_key(key)
    );
}

#[tauri::command]
fn get_connections() -> Vec<ConnectionConfig> {
    connection::load_connections()
}

#[tauri::command]
fn create_connection(config: ConnectionConfig) -> Result<Vec<ConnectionConfig>, String> {
    connection::add_connection(config)
}

#[tauri::command]
fn update_connection(config: ConnectionConfig) -> Result<Vec<ConnectionConfig>, String> {
    connection::update_connection(config)
}

#[tauri::command]
fn delete_connection(id: String, redis: State<'_, RedisManager>) -> Result<Vec<ConnectionConfig>, String> {
    redis.remove_client(&id);
    connection::delete_connection(&id)
}

#[tauri::command]
async fn test_connection(config: ConnectionConfig, redis: State<'_, RedisManager>) -> Result<u128, String> {
    redis.test_connection(&config).await
}

#[tauri::command]
async fn connect(id: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    
    let mut conn = redis.get_connection(&config).await?;
    let _: String = redis::cmd("PING")
        .query_async(&mut conn)
        .await
        .map_err(|e| format!("Ping failed: {}", e))?;
    
    Ok(true)
}

#[tauri::command]
async fn disconnect(id: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    redis.remove_client(&id);
    Ok(true)
}

// Database commands
#[tauri::command]
async fn get_dbs(id: String, redis: State<'_, RedisManager>) -> Result<Vec<DatabaseInfo>, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.get_dbs(&config).await
}

#[tauri::command]
async fn select_db(id: String, db: i64, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.select_db(&config, db).await
}

// Key commands
#[tauri::command]
async fn get_keys(id: String, pattern: Option<String>, cursor: Option<u64>, count: Option<u64>, redis: State<'_, RedisManager>) -> Result<(u64, Vec<String>), String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    let pattern = pattern.unwrap_or_else(|| "*".to_string());
    let cursor = cursor.unwrap_or(0);
    let count = count.unwrap_or(100);
    let result = redis.get_keys(&config, &pattern, cursor, count).await;
    if let Err(err) = &result {
        eprintln!(
            "[key-load] get_keys failed | id={} | pattern={} | cursor={} | count={} | error={}",
            id,
            pattern,
            cursor,
            count,
            err
        );
    }
    result
}

#[tauri::command]
async fn get_keys_with_types(id: String, pattern: Option<String>, cursor: Option<u64>, count: Option<u64>, redis: State<'_, RedisManager>) -> Result<(u64, Vec<(String, String)>), String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    let pattern = pattern.unwrap_or_else(|| "*".to_string());
    let cursor = cursor.unwrap_or(0);
    let count = count.unwrap_or(100);
    let result = redis.get_keys_with_types(&config, &pattern, cursor, count).await;
    if let Err(err) = &result {
        eprintln!(
            "[key-load] get_keys_with_types failed | id={} | pattern={} | cursor={} | count={} | error={}",
            id,
            pattern,
            cursor,
            count,
            err
        );
    }
    result
}

#[tauri::command]
async fn get_key_info(id: String, key: String, redis: State<'_, RedisManager>) -> Result<KeyInfo, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    let result = redis.get_key_info(&config, &key).await;
    if let Err(err) = &result {
        log_key_load_error("get_key_info", &id, &key, err);
    }
    result
}

// String commands
#[tauri::command]
async fn get_string(id: String, key: String, redis: State<'_, RedisManager>) -> Result<String, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    let result = redis.get_string(&config, &key).await;
    if let Err(err) = &result {
        log_key_load_error("get_string", &id, &key, err);
    }
    result
}

#[tauri::command]
async fn set_string(id: String, key: String, value: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.set_string(&config, &key, &value).await
}

// Hash commands
#[tauri::command]
async fn get_hash(id: String, key: String, redis: State<'_, RedisManager>) -> Result<Vec<HashField>, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    let result = redis.get_hash(&config, &key).await;
    if let Err(err) = &result {
        log_key_load_error("get_hash", &id, &key, err);
    }
    result
}

#[tauri::command]
async fn set_hash_field(id: String, key: String, field: String, value: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.set_hash_field(&config, &key, &field, &value).await
}

#[tauri::command]
async fn delete_hash_field(id: String, key: String, field: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.delete_hash_field(&config, &key, &field).await
}

// List commands
#[tauri::command]
async fn get_list(id: String, key: String, start: Option<i64>, stop: Option<i64>, redis: State<'_, RedisManager>) -> Result<Vec<String>, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    let start = start.unwrap_or(0);
    let stop = stop.unwrap_or(-1);
    let result = redis.get_list(&config, &key, start, stop).await;
    if let Err(err) = &result {
        eprintln!(
            "[key-load] get_list failed | id={} | key={} | start={} | stop={} | error={}",
            id,
            preview_key(&key),
            start,
            stop,
            err
        );
    }
    result
}

#[tauri::command]
async fn push_list(id: String, key: String, value: String, at_head: Option<bool>, redis: State<'_, RedisManager>) -> Result<i64, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.push_list(&config, &key, &value, at_head.unwrap_or(true)).await
}

#[tauri::command]
async fn get_list_len(id: String, key: String, redis: State<'_, RedisManager>) -> Result<i64, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.get_list_len(&config, &key).await
}

#[tauri::command]
async fn set_list_value(id: String, key: String, index: i64, value: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.set_list_value(&config, &key, index, &value).await
}

#[tauri::command]
async fn remove_list_value(id: String, key: String, count: i64, value: String, redis: State<'_, RedisManager>) -> Result<i64, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.remove_list_value(&config, &key, count, &value).await
}

// Set commands
#[tauri::command]
async fn get_set(id: String, key: String, redis: State<'_, RedisManager>) -> Result<Vec<String>, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    let result = redis.get_set(&config, &key).await;
    if let Err(err) = &result {
        log_key_load_error("get_set", &id, &key, err);
    }
    result
}

#[tauri::command]
async fn add_set(id: String, key: String, member: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.add_set(&config, &key, &member).await
}

#[tauri::command]
async fn remove_set_member(id: String, key: String, member: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.remove_set_member(&config, &key, &member).await
}

// Sorted Set commands
#[tauri::command]
async fn get_zset(id: String, key: String, start: Option<i64>, stop: Option<i64>, redis: State<'_, RedisManager>) -> Result<Vec<ZSetMember>, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    let start = start.unwrap_or(0);
    let stop = stop.unwrap_or(-1);
    let result = redis.get_zset(&config, &key, start, stop).await;
    if let Err(err) = &result {
        eprintln!(
            "[key-load] get_zset failed | id={} | key={} | start={} | stop={} | error={}",
            id,
            preview_key(&key),
            start,
            stop,
            err
        );
    }
    result
}

#[tauri::command]
async fn add_zset(id: String, key: String, member: String, score: f64, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.add_zset(&config, &key, &member, score).await
}

#[tauri::command]
async fn get_zset_len(id: String, key: String, redis: State<'_, RedisManager>) -> Result<i64, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.get_zset_len(&config, &key).await
}

#[tauri::command]
async fn delete_zset_member(id: String, key: String, member: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.delete_zset_member(&config, &key, &member).await
}

// Key operations
#[tauri::command]
async fn delete_key(id: String, key: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.delete_key(&config, &key).await
}

#[tauri::command]
async fn rename_key(id: String, old_key: String, new_key: String, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.rename_key(&config, &old_key, &new_key).await
}

#[tauri::command]
async fn set_ttl(id: String, key: String, ttl: i64, redis: State<'_, RedisManager>) -> Result<bool, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.set_ttl(&config, &key, ttl).await
}

// CLI command
#[tauri::command]
async fn execute_command(id: String, args: Vec<String>, redis: State<'_, RedisManager>) -> Result<String, String> {
    let config = connection::get_connection(&id)
        .ok_or_else(|| "Connection not found".to_string())?;
    redis.execute_command(&config, args).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(RedisManager::new())
        .invoke_handler(tauri::generate_handler![
            get_connections,
            create_connection,
            update_connection,
            delete_connection,
            test_connection,
            connect,
            disconnect,
            get_dbs,
            select_db,
            get_keys,
            get_keys_with_types,
            get_key_info,
            get_string,
            set_string,
            get_hash,
            set_hash_field,
            delete_hash_field,
            get_list,
            push_list,
            get_list_len,
            set_list_value,
            remove_list_value,
            get_set,
            add_set,
            remove_set_member,
            get_zset,
            add_zset,
            get_zset_len,
            delete_zset_member,
            delete_key,
            rename_key,
            set_ttl,
            execute_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
