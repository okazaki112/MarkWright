// MarkWright - 专业 Markdown 编辑器
// Rust 后端入口：注册 Tauri 插件、定义命令

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

#[derive(Default)]
struct DbState(Mutex<Option<Connection>>);

#[derive(Serialize, Deserialize, Debug, Clone)]
struct DailyStat {
    date: String,         // YYYY-MM-DD
    words: i64,
    pomodoros: i64,
    duration_sec: i64,
    sessions: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct WordRecord {
    ts: i64,
    delta: i64,           // 增量字数（正数）
    total: i64,           // 累计字数
    tab: String,          // 文件名
    duration: i64,        // 本次会话时长（秒）
}

fn get_db_path(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().expect("app_data_dir");
    std::fs::create_dir_all(&dir).ok();
    dir.join("markwright.db")
}

fn init_db(conn: &Connection) {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS daily_stats (
            date TEXT PRIMARY KEY,
            words INTEGER NOT NULL DEFAULT 0,
            pomodoros INTEGER NOT NULL DEFAULT 0,
            duration_sec INTEGER NOT NULL DEFAULT 0,
            sessions INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS word_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts INTEGER NOT NULL,
            delta INTEGER NOT NULL,
            total INTEGER NOT NULL,
            tab TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS pomodoro_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_ts INTEGER NOT NULL,
            end_ts INTEGER NOT NULL,
            duration_sec INTEGER NOT NULL,
            kind TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_word_events_ts ON word_events(ts);
        CREATE INDEX IF NOT EXISTS idx_pomodoro_start ON pomodoro_sessions(start_ts);",
    )
    .expect("init_db");
}

#[tauri::command]
fn init_db_cmd(state: State<DbState>, app: tauri::AppHandle) -> Result<(), String> {
    let path = get_db_path(&app);
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    init_db(&conn);
    *state.0.lock().unwrap() = Some(conn);
    Ok(())
}

#[tauri::command]
fn record_word_event(state: State<DbState>, event: WordRecord) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let conn = conn.as_ref().ok_or("db not init")?;
    conn.execute(
        "INSERT INTO word_events (ts, delta, total, tab) VALUES (?, ?, ?, ?)",
        rusqlite::params![event.ts, event.delta, event.total, event.tab],
    )
    .map_err(|e| e.to_string())?;
    // 更新当日聚合
    let date = chrono_date(event.ts);
    conn.execute(
        "INSERT INTO daily_stats (date, words, sessions, duration_sec) VALUES (?, ?, 1, ?)
         ON CONFLICT(date) DO UPDATE SET words = words + ?, sessions = sessions + 1, duration_sec = duration_sec + ?",
        rusqlite::params![
            date,
            event.delta.max(0),
            event.duration.max(0),
            event.delta.max(0),
            event.duration.max(0)
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn record_pomodoro(
    state: State<DbState>,
    start_ts: i64,
    end_ts: i64,
    duration_sec: i64,
    kind: String,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let conn = conn.as_ref().ok_or("db not init")?;
    conn.execute(
        "INSERT INTO pomodoro_sessions (start_ts, end_ts, duration_sec, kind) VALUES (?, ?, ?, ?)",
        rusqlite::params![start_ts, end_ts, duration_sec, kind],
    )
    .map_err(|e| e.to_string())?;
    let date = chrono_date(start_ts);
    conn.execute(
        "INSERT INTO daily_stats (date, pomodoros, duration_sec) VALUES (?, 1, ?)
         ON CONFLICT(date) DO UPDATE SET pomodoros = pomodoros + 1, duration_sec = duration_sec + ?",
        rusqlite::params![date, duration_sec, duration_sec],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn daily_stats(conn: &Connection, days: i64) -> Vec<DailyStat> {
    // 窗口起点：今天往前 (days-1) 天
    let cutoff = {
        let (y, m, d) = parse_date(&today_str()).unwrap_or((2025i32, 1u32, 1u32));
        let ts = ymd_to_days(y, m as i32, d as i32) - (days - 1).max(0);
        let (cy, cm, cd) = days_to_ymd(ts);
        format!("{:04}-{:02}-{:02}", cy, cm, cd)
    };
    // 聚合表 daily_stats 由 record_word_event / record_pomodoro 实时维护
    let mut stmt = conn
        .prepare(
            "SELECT date, words, pomodoros, duration_sec, sessions
             FROM daily_stats
             WHERE date >= ?
             ORDER BY date DESC",
        )
        .map_err(|e| e.to_string())
        .unwrap();
    let rows = stmt
        .query_map([cutoff], |r| {
            Ok(DailyStat {
                date: r.get(0)?,
                words: r.get(1)?,
                pomodoros: r.get(2)?,
                duration_sec: r.get(3)?,
                sessions: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())
        .unwrap();
    let mut out = vec![];
    for row in rows {
        out.push(row.map_err(|e| e.to_string()).unwrap());
    }
    out
}

#[tauri::command]
fn get_daily_stats(state: State<DbState>, days: i64) -> Result<Vec<DailyStat>, String> {
    let conn = state.0.lock().unwrap();
    let conn = conn.as_ref().ok_or("db not init")?;
    Ok(daily_stats(conn, days))
}

#[tauri::command]
fn get_setting(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state.0.lock().unwrap();
    let conn = conn.as_ref().ok_or("db not init")?;
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query([key])
        .map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(row.get(0).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn set_setting(state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let conn = conn.as_ref().ok_or("db not init")?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = ?",
        rusqlite::params![key, value, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn summarize(conn: &Connection) -> serde_json::Value {
    let today = today_str();
    let week_start = week_start_str();
    // 今日 / 本周 / 总计：聚合表 daily_stats
    let today_row = conn
        .query_row(
            "SELECT words, pomodoros, duration_sec FROM daily_stats WHERE date = ?",
            [&today],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)),
        )
        .unwrap_or((0i64, 0i64, 0i64));
    let week_row = conn
        .query_row(
            "SELECT COALESCE(SUM(words),0), COALESCE(SUM(pomodoros),0), COALESCE(SUM(duration_sec),0)
             FROM daily_stats WHERE date >= ?",
            [&week_start],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)),
        )
        .unwrap_or((0i64, 0i64, 0i64));
    let total_row = conn
        .query_row(
            "SELECT COALESCE(SUM(words),0), COALESCE(SUM(pomodoros),0), COALESCE(SUM(duration_sec),0)
             FROM daily_stats",
            [],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)),
        )
        .unwrap_or((0i64, 0i64, 0i64));
    serde_json::json!({
        "today": { "words": today_row.0, "pomodoros": today_row.1, "duration": today_row.2 },
        "week":  { "words": week_row.0,  "pomodoros": week_row.1,  "duration": week_row.2  },
        "total": { "words": total_row.0, "pomodoros": total_row.1, "duration": total_row.2 }
    })
}

#[tauri::command]
fn get_summary(state: State<DbState>) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().unwrap();
    let conn = conn.as_ref().ok_or("db not init")?;
    Ok(summarize(conn))
}

/* 时间工具：避免引入 chrono 依赖 */
fn today_str() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    chrono_date(ts)
}
fn week_start_str() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    let date = chrono_date(ts);
    // 简化：返回 7 天前的日期
    let (y, m, d) = parse_date(&date).unwrap_or((2025i32, 1u32, 1u32));
    let day_ts = ymd_to_days(y, m as i32, d as i32);
    let week_start_ts = day_ts - 6;
    let (wy, wm, wd) = days_to_ymd(week_start_ts);
    format!("{:04}-{:02}-{:02}", wy, wm, wd)
}
fn chrono_date(ts: i64) -> String {
    let days = ts / 86400;
    let (y, m, d) = days_to_ymd(days);
    format!("{:04}-{:02}-{:02}", y, m, d)
}
fn parse_date(s: &str) -> Option<(i32, u32, u32)> {
    let p: Vec<&str> = s.split('-').collect();
    if p.len() != 3 { return None; }
    Some((p[0].parse().ok()?, p[1].parse().ok()?, p[2].parse().ok()?))
}
fn ymd_to_days(y: i32, m: i32, d: i32) -> i64 {
    // 简化算法：从 1970-01-01 起算
    let mut days = 0i64;
    for yr in 1970..y { days += if leap(yr) { 366 } else { 365 }; }
    let mdays = [31, if leap(y) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for mo in 1..m { days += mdays[(mo - 1) as usize] as i64; }
    days + (d as i64) - 1
}
fn days_to_ymd(days: i64) -> (i32, i32, i32) {
    let mut y = 1970i32;
    let mut d = days;
    loop {
        let dy = if leap(y) { 366 } else { 365 };
        if d < dy { break; }
        d -= dy;
        y += 1;
    }
    let mdays = [31, if leap(y) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m = 1;
    for dm in mdays.iter() {
        if d < *dm as i64 { break; }
        d -= *dm as i64;
        m += 1;
    }
    (y, m, (d as i32) + 1)
}
fn leap(y: i32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

/* ============== 加密 / 解密 ============== */

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use sha2::{Digest, Sha256};

fn derive_key(password: &str) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(password.as_bytes());
    h.update(b"markwright-vault-salt-v1");
    let out = h.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&out);
    key
}

#[tauri::command]
fn encrypt_text(plaintext: String, password: String) -> Result<String, String> {
    let key = derive_key(&password);
    let cipher = Aes256Gcm::new(&key.into());
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;
    // 拼成 base64: nonce(12) + ciphertext
    let mut combined = Vec::with_capacity(12 + ct.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ct);
    Ok(base64_encode(&combined))
}

#[tauri::command]
fn decrypt_text(ciphertext_b64: String, password: String) -> Result<String, String> {
    let key = derive_key(&password);
    let cipher = Aes256Gcm::new(&key.into());
    let combined = base64_decode(&ciphertext_b64).map_err(|e| e.to_string())?;
    if combined.len() < 12 {
        return Err("invalid ciphertext".to_string());
    }
    let (nonce_bytes, ct) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let pt = cipher
        .decrypt(nonce, ct)
        .map_err(|_| "密码错误或文件已损坏".to_string())?;
    String::from_utf8(pt).map_err(|e| e.to_string())
}

#[tauri::command]
fn encrypt_file(src: String, dst: String, password: String) -> Result<(), String> {
    let data = std::fs::read(&src).map_err(|e| e.to_string())?;
    let key = derive_key(&password);
    let cipher = Aes256Gcm::new(&key.into());
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, data.as_ref())
        .map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(4 + 12 + ct.len());
    out.extend_from_slice(b"MWV1");
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct);
    std::fs::write(&dst, &out).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn decrypt_file(src: String, password: String) -> Result<Vec<u8>, String> {
    let data = std::fs::read(&src).map_err(|e| e.to_string())?;
    if data.len() < 16 || &data[0..4] != b"MWV1" {
        return Err("文件格式无效（非 MarkWright Vault）".to_string());
    }
    let key = derive_key(&password);
    let cipher = Aes256Gcm::new(&key.into());
    let (nonce_bytes, ct) = data[4..].split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ct)
        .map_err(|_| "密码错误或文件已损坏".to_string())
}

/// 判断文件是否为 MarkWright 密文（首 4 字节为 MWV1 魔数）。
/// 空文件 / 不足 4 字节一律视为未加密。
#[tauri::command]
fn is_encrypted_file(path: String) -> Result<bool, String> {
    use std::io::Read;
    let mut f = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut magic = [0u8; 4];
    match f.read_exact(&mut magic) {
        Ok(()) => Ok(&magic == b"MWV1"),
        Err(_) => Ok(false),
    }
}

/// 明文 → MWV1 密文（4 字节魔数 + 12 字节 nonce + AES-256-GCM 密文）
fn seal_bytes(data: &[u8], password: &str) -> Result<Vec<u8>, String> {
    let key = derive_key(password);
    let cipher = Aes256Gcm::new(&key.into());
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher.encrypt(nonce, data).map_err(|e| e.to_string())?;
    let mut out = Vec::with_capacity(4 + 12 + ct.len());
    out.extend_from_slice(b"MWV1");
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ct);
    Ok(out)
}

/// 先写同目录临时文件再原子重命名，避免中途失败把原文件截断
fn write_atomic(path: &str, bytes: &[u8]) -> Result<(), String> {
    let tmp = format!("{}.mwtmp", path);
    std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

/// 把内存中的明文直接加密落盘 —— **磁盘上不会出现明文**。
/// 保存加密文档走这条路径。
#[tauri::command]
fn write_encrypted_text(path: String, plaintext: String, password: String) -> Result<(), String> {
    let sealed = seal_bytes(plaintext.as_bytes(), &password)?;
    write_atomic(&path, &sealed)
}

/// 原地加密一个已存在的明文文件（已是密文则幂等返回）。
#[tauri::command]
fn encrypt_file_in_place(path: String, password: String) -> Result<(), String> {
    if is_encrypted_file(path.clone())? {
        return Ok(());
    }
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    let sealed = seal_bytes(&data, &password)?;
    write_atomic(&path, &sealed)
}

/* 简易 base64（无外部依赖） */
const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
fn base64_encode(data: &[u8]) -> String {
    let mut s = String::with_capacity((data.len() + 2) / 3 * 4);
    for i in (0..data.len()).step_by(3) {
        let b0 = data[i];
        let b1 = if i + 1 < data.len() { data[i + 1] } else { 0 };
        let b2 = if i + 2 < data.len() { data[i + 2] } else { 0 };
        s.push(B64[(b0 >> 2) as usize] as char);
        s.push(B64[(((b0 & 3) << 4) | (b1 >> 4)) as usize] as char);
        s.push(if i + 1 < data.len() { B64[(((b1 & 0xf) << 2) | (b2 >> 6)) as usize] as char } else { '=' });
        s.push(if i + 2 < data.len() { B64[(b2 & 0x3f) as usize] as char } else { '=' });
    }
    s
}
fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let mut buf = [0u8; 4];
        let mut n = 0;
        while n < 4 && i < bytes.len() {
            let c = bytes[i];
            if c == b'=' { break; }
            let pos = B64.iter().position(|&x| x == c).ok_or("非 base64 字符")?;
            buf[n] = pos as u8;
            n += 1;
            i += 1;
        }
        if n == 0 { break; }
        out.push((buf[0] << 2) | (buf[1] >> 4));
        if n > 2 { out.push((buf[1] << 4) | (buf[2] >> 2)); }
        if n > 3 { out.push((buf[2] << 6) | buf[3]); }
        if n < 4 { break; }
    }
    Ok(out)
}

/* ============== 备份 ============== */

#[tauri::command]
fn backup_file(src: String, backup_dir: String) -> Result<String, String> {
    let now = chrono_date(std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64);
    let ts = now.replace('-', "");
    let hhmm = {
        let secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64 % 86400;
        let h = secs / 3600;
        let m = (secs % 3600) / 60;
        let s = secs % 60;
        format!("{:02}{:02}{:02}", h, m, s)
    };
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let file_name = std::path::Path::new(&src)
        .file_name().ok_or("invalid src")?
        .to_string_lossy().to_string();
    let backup_name = format!("{}-{}-{}", ts, hhmm, file_name);
    let backup_path = std::path::Path::new(&backup_dir).join(&backup_name);
    std::fs::copy(&src, &backup_path).map_err(|e| e.to_string())?;
    Ok(backup_path.to_string_lossy().to_string())
}

#[tauri::command]
fn app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "MarkWright",
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
    })
}

/// 通过「打开方式」/ 双击文件传入、等待前端取走的文件路径
#[derive(Default)]
struct PendingFile(Mutex<Option<String>>);

/// 从命令行参数中找出要打开的 Markdown 文件
fn extract_md_path(args: &[String]) -> Option<String> {
    args.iter().skip(1).find_map(|a| {
        let p = std::path::Path::new(a);
        let is_md = p.is_file()
            && matches!(
                p.extension()
                    .and_then(|e| e.to_str())
                    .map(|s| s.to_ascii_lowercase())
                    .as_deref(),
                Some("md") | Some("markdown") | Some("txt")
            );
        if is_md { Some(a.clone()) } else { None }
    })
}

/// 读取通过「打开方式」传入的文件（Rust 直读，不受 fs 插件 scope 限制）
#[tauri::command]
fn read_opened_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// 根据扩展名推断图片 MIME
fn image_mime(path: &str) -> &'static str {
    match std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("bmp") => "image/bmp",
        Some("ico") => "image/x-icon",
        Some("avif") => "image/avif",
        Some("tif") | Some("tiff") => "image/tiff",
        _ => "application/octet-stream",
    }
}

/// 把本地图片读成 data URL 供预览显示。
/// 用 Rust 直读，绕过 fs 插件 scope —— 桌面、任意盘符的绝对路径都能读，
/// 且 Windows 下 `/` 与 `\` 两种分隔符都能正确打开。
#[tauri::command]
fn read_image_data_url(path: String) -> Result<String, String> {
    use base64::Engine as _;
    let bytes = std::fs::read(&path).map_err(|e| format!("读取图片失败 {}: {}", path, e))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", image_mime(&path), b64))
}

/// 按顺序返回第一个真实存在的文件路径（不存在则返回 None）。
/// 用于本地图片解析：前端给出「文档目录 → 工作区根」等候选路径，
/// 由 Rust 一次性判定，避免对不存在的候选逐个发起资产协议请求并等待超时。
#[tauri::command]
fn first_existing_path(paths: Vec<String>) -> Option<String> {
    paths
        .into_iter()
        .find(|p| std::path::Path::new(p).is_file())
}

/// 把导出的二进制（base64 编码）写入用户在保存对话框中选择的路径。
/// 路径来自用户自己的保存操作，可信，故绕过 fs 插件 scope 限制。
#[tauri::command]
fn write_export_file(path: String, base64_data: String) -> Result<(), String> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data.trim())
        .map_err(|e| format!("base64 解码失败: {e}"))?;
    if let Some(parent) = std::path::Path::new(&path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&path, bytes).map_err(|e| format!("写入失败: {e}"))
}

/// 前端启动后取走命令行传入的待打开文件
#[tauri::command]
fn take_pending_file(state: State<PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

/// 唤起主窗口到前台
fn focus_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // 单实例：程序已运行时再次双击文件 → 唤起已有窗口并打开（必须最先注册）
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            focus_main(app);
            if let Some(path) = extract_md_path(&args) {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.emit("open-file", path);
                }
            }
        }));
    }

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DbState::default())
        .manage(PendingFile::default())
        .invoke_handler(tauri::generate_handler![
            app_info,
            read_opened_file,
            read_image_data_url,
            first_existing_path,
            take_pending_file,
            write_export_file,
            init_db_cmd,
            record_word_event,
            record_pomodoro,
            get_daily_stats,
            get_setting,
            set_setting,
            get_summary,
            encrypt_text,
            decrypt_text,
            encrypt_file,
            encrypt_file_in_place,
            write_encrypted_text,
            is_encrypted_file,
            decrypt_file,
            backup_file
        ])
        .setup(|app| {
            // 应用启动时立即初始化数据库
            let path = get_db_path(&app.handle());
            if let Ok(conn) = Connection::open(&path) {
                init_db(&conn);
                let state: State<DbState> = app.state();
                *state.0.lock().unwrap() = Some(conn);
            }
            // 记录「打开方式」传入的文件路径，等前端就绪后取走
            let args: Vec<String> = std::env::args().collect();
            if let Some(p) = extract_md_path(&args) {
                let pf: State<PendingFile> = app.state();
                *pf.0.lock().unwrap() = Some(p);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running markwright");
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    use std::io::Write;

    #[test]
    fn base64_round_trip() {
        for len in [0usize, 1, 2, 3, 4, 5, 7, 16, 100, 255] {
            let data: Vec<u8> = (0..len).map(|i| (i * 37 % 251) as u8).collect();
            let enc = base64_encode(&data);
            let dec = base64_decode(&enc).expect("decode");
            assert_eq!(dec, data, "round trip failed for len {}", len);
        }
    }

    #[test]
    fn date_helpers() {
        assert!(leap(2024));
        assert!(!leap(2025));
        assert!(leap(2000));
        assert!(!leap(1900));
        assert_eq!(days_to_ymd(ymd_to_days(2024, 2, 29)), (2024, 2, 29));
        assert_eq!(days_to_ymd(ymd_to_days(2026, 1, 1)), (2026, 1, 1));
        assert_eq!(days_to_ymd(ymd_to_days(2025, 12, 31)), (2025, 12, 31));
        assert!(parse_date("2026-03-08").is_some());
        assert!(parse_date("not-a-date").is_none());
    }

    #[test]
    fn key_derivation_deterministic() {
        let a = derive_key("secret");
        let b = derive_key("secret");
        assert_eq!(a, b);
        assert_eq!(a.len(), 32);
        assert_ne!(derive_key("secret"), derive_key("other"));
    }

    #[test]
    fn aes_text_round_trip() {
        let ct = encrypt_text("hello markwright".to_string(), "pw".to_string()).unwrap();
        assert_eq!(decrypt_text(ct, "pw".to_string()).unwrap(), "hello markwright");
        assert!(decrypt_text(
            encrypt_text("x".to_string(), "pw".to_string()).unwrap(),
            "wrong".to_string()
        )
        .is_err());
    }

    #[test]
    fn aes_file_round_trip() {
        let dir = std::env::temp_dir().join("markwright_vault_test");
        std::fs::create_dir_all(&dir).unwrap();
        let src = dir.join("secret.bin");
        let dst = dir.join("secret.bin.vault");
        let mut f = std::fs::File::create(&src).unwrap();
        f.write_all(b"the quick brown fox").unwrap();
        drop(f);
        encrypt_file(
            src.to_str().unwrap().to_string(),
            dst.to_str().unwrap().to_string(),
            "pw".to_string(),
        )
        .unwrap();
        let out = decrypt_file(dst.to_str().unwrap().to_string(), "pw".to_string()).unwrap();
        assert_eq!(out, b"the quick brown fox");
    }

    #[test]
    fn read_image_data_url_builds_data_url() {
        let dir = std::env::temp_dir().join("markwright_img_test");
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("a.png");
        // 最小 PNG 魔数
        std::fs::write(&p, [0x89u8, 0x50, 0x4e, 0x47]).unwrap();
        let url = read_image_data_url(p.to_str().unwrap().to_string()).unwrap();
        assert!(url.starts_with("data:image/png;base64,"), "got: {}", url);
        // 4 字节 → 8 个 base64 字符（末尾 2 个 = 填充）
        let b64 = url.strip_prefix("data:image/png;base64,").unwrap();
        assert_eq!(b64.len(), 8);
        assert_eq!(image_mime("x.JPG"), "image/jpeg");
        assert_eq!(image_mime("no_ext"), "application/octet-stream");
        // 文件不存在时应报错而不是 panic
        assert!(read_image_data_url(dir.join("nope.png").to_str().unwrap().to_string()).is_err());
    }

    #[test]
    fn first_existing_path_picks_first_hit() {
        let dir = std::env::temp_dir().join("markwright_first_path_test");
        std::fs::create_dir_all(&dir).unwrap();
        let hit = dir.join("hit.png");
        std::fs::write(&hit, [0x89u8, 0x50]).unwrap();
        let missing = dir.join("missing.png");

        let got = first_existing_path(vec![
            missing.to_string_lossy().to_string(),
            hit.to_string_lossy().to_string(),
        ]);
        assert_eq!(got, Some(hit.to_string_lossy().to_string()));

        // 全部不存在 → None
        assert_eq!(
            first_existing_path(vec![missing.to_string_lossy().to_string()]),
            None
        );
        // 目录不算文件
        assert_eq!(
            first_existing_path(vec![dir.to_string_lossy().to_string()]),
            None
        );
    }

    #[test]
    fn encrypt_in_place_round_trip() {
        let dir = std::env::temp_dir().join("markwright_inplace_test");
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("note.md");
        std::fs::write(&p, "# 标题\n正文内容").unwrap();
        let path = p.to_string_lossy().to_string();

        assert!(!is_encrypted_file(path.clone()).unwrap());
        encrypt_file_in_place(path.clone(), "pw123".to_string()).unwrap();
        assert!(is_encrypted_file(path.clone()).unwrap());
        // 幂等：再次加密不改变结果
        encrypt_file_in_place(path.clone(), "pw123".to_string()).unwrap();
        assert!(is_encrypted_file(path.clone()).unwrap());

        let out = decrypt_file(path.clone(), "pw123".to_string()).unwrap();
        assert_eq!(String::from_utf8(out).unwrap(), "# 标题\n正文内容");
        // 密码错误
        assert!(decrypt_file(path.clone(), "wrong".to_string()).is_err());
        // 临时文件已清理
        assert!(!std::path::Path::new(&format!("{}.mwtmp", path)).exists());
    }

    #[test]
    fn is_encrypted_file_handles_plain_and_empty() {
        let dir = std::env::temp_dir().join("markwright_encrypt_probe");
        std::fs::create_dir_all(&dir).unwrap();
        let plain = dir.join("plain.md");
        std::fs::write(&plain, "hello").unwrap();
        assert!(!is_encrypted_file(plain.to_string_lossy().to_string()).unwrap());

        let empty = dir.join("empty.md");
        std::fs::write(&empty, b"").unwrap();
        assert!(!is_encrypted_file(empty.to_string_lossy().to_string()).unwrap());
    }

    #[test]
    fn write_encrypted_text_never_leaves_plaintext() {
        let dir = std::env::temp_dir().join("markwright_seal_test");
        std::fs::create_dir_all(&dir).unwrap();
        let p = dir.join("sealed.md");
        let path = p.to_string_lossy().to_string();
        write_encrypted_text(path.clone(), "# 机密\n正文".to_string(), "pw123".to_string()).unwrap();

        // 磁盘上不含明文，且以 MWV1 开头
        let raw = std::fs::read(&p).unwrap();
        assert_eq!(&raw[0..4], b"MWV1");
        assert!(!String::from_utf8_lossy(&raw).contains("机密"));
        assert!(is_encrypted_file(path.clone()).unwrap());

        let out = decrypt_file(path.clone(), "pw123".to_string()).unwrap();
        assert_eq!(String::from_utf8(out).unwrap(), "# 机密\n正文");
        assert!(!std::path::Path::new(&format!("{}.mwtmp", path)).exists());
    }

    #[test]
    fn stats_aggregate_from_daily_stats() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn);
        let today = today_str();
        conn.execute(
            "INSERT INTO daily_stats(date, words, pomodoros, duration_sec, sessions) VALUES (?1, 15, 1, 180, 2)",
            params![today],
        )
        .unwrap();

        let s = summarize(&conn);
        assert_eq!(s["today"]["words"].as_i64().unwrap(), 15);
        assert_eq!(s["today"]["pomodoros"].as_i64().unwrap(), 1);
        assert_eq!(s["today"]["duration"].as_i64().unwrap(), 180);
        assert_eq!(s["total"]["words"].as_i64().unwrap(), 15);

        let rows = daily_stats(&conn, 365);
        let today_row = rows.iter().find(|r| r.date == today).expect("today present");
        assert_eq!(today_row.words, 15);
        assert_eq!(today_row.pomodoros, 1);
        assert_eq!(today_row.duration_sec, 180);
        assert_eq!(today_row.sessions, 2);
    }
}
