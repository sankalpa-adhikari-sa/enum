use anyhow::{Context, Result};
use sqlx::{sqlite::SqlitePool, Pool, Sqlite};
use std::env;
use std::fs;
use tauri::AppHandle;
use tauri::Manager;

pub struct Database {
    pub pool: Pool<Sqlite>,
}

impl Database {
    pub async fn new(app_handle: &AppHandle) -> Result<Self> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .expect("Failed to get app data directory");

        fs::create_dir_all(&app_dir)
            .with_context(|| format!("Failed to create app directory: {}", app_dir.display()))?;

        let db_path = app_dir.join("dev.db");

        env::set_var("DATABASE_URL", format!("sqlite://{}", db_path.display()));

        println!("-----------------------------------------------");
        println!("Initializing database at: {:?}", db_path);
        println!("-----------------------------------------------");

        let connection_options = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

        let pool = SqlitePool::connect_with(connection_options)
            .await
            .with_context(|| format!("Failed to connect to database: {}", db_path.display()))?;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .context("Failed to run database migrations")?;

        Ok(Self { pool })
    }
}

#[allow(dead_code)]
pub struct DatabaseState(pub Pool<Sqlite>);
