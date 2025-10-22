mod backend;
mod kv;

use std::{env, fs, path::PathBuf};

use anyhow::{Context, Result};
use backend::{BackendManager, BackendStatus};
use kv::{ProviderSecret, ProviderVault};
use tauri::Manager;

#[tauri::command]
fn get_backend_status(manager: tauri::State<'_, BackendManager>) -> BackendStatus {
    manager.status()
}

#[tauri::command]
fn start_backend(manager: tauri::State<'_, BackendManager>) -> Result<BackendStatus, String> {
    manager.ensure_started().map_err(|err| err.to_string())
}

#[tauri::command]
fn stop_backend(manager: tauri::State<'_, BackendManager>) -> Result<(), String> {
    manager.stop().map_err(|err| err.to_string())
}

#[tauri::command]
fn list_provider_secrets(vault: tauri::State<'_, ProviderVault>) -> Vec<ProviderSecret> {
    vault.list()
}

#[tauri::command]
fn upsert_provider_secret(
    vault: tauri::State<'_, ProviderVault>,
    secret: ProviderSecret,
) -> Result<ProviderSecret, String> {
    vault.upsert(secret).map_err(|err| err.to_string())
}

#[tauri::command]
fn remove_provider_secret(
    vault: tauri::State<'_, ProviderVault>,
    provider_id: String,
) -> Result<bool, String> {
    vault.remove(&provider_id).map_err(|err| err.to_string())
}

#[tauri::command]
fn get_active_provider(vault: tauri::State<'_, ProviderVault>) -> Option<String> {
    vault.active_provider()
}

#[tauri::command]
fn set_active_provider(
    vault: tauri::State<'_, ProviderVault>,
    provider_id: Option<String>,
) -> Result<Option<String>, String> {
    vault
        .set_active_provider(provider_id)
        .map_err(|err| err.to_string())
}

fn resolve_backend_dir(handle: &tauri::AppHandle) -> Result<PathBuf> {
    if let Ok(explicit) = env::var("KNOWLEDGE_QA_BACKEND_DIR") {
        return Ok(PathBuf::from(explicit));
    }
    if let Some(resource) = handle.path_resolver().resolve_resource("backend") {
        if resource.exists() {
            return Ok(resource);
        }
    }
    if let Some(resource) = handle.path_resolver().resolve_resource("../backend") {
        if resource.exists() {
            return Ok(resource);
        }
    }
    let current = env::current_dir().context("Failed to determine current directory")?;
    let mut candidate = current.join("../backend");
    if !candidate.exists() {
        if let Some(parent) = current.parent() {
            candidate = parent.join("backend");
        }
    }
    candidate
        .canonicalize()
        .with_context(|| format!("Unable to resolve backend directory from `{}`", candidate.display()))
}

fn resolve_data_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf> {
    let dir = app_handle
        .path_resolver()
        .app_data_dir()
        .context("Failed to resolve application data directory")?;
    fs::create_dir_all(&dir).context("Failed to create application data directory")?;
    Ok(dir)
}

fn initialize(app: &mut tauri::App) -> Result<()> {
    let handle = app.handle();
    let data_dir = resolve_data_dir(&handle)?;
    let secrets_dir = data_dir.join("secrets");
    let provider_vault = ProviderVault::new(secrets_dir)?;

    let backend_dir = resolve_backend_dir(&handle)?;
    let backend_state_dir = data_dir.join("backend");
    fs::create_dir_all(&backend_state_dir)
        .with_context(|| format!("Failed to create backend state dir `{}`", backend_state_dir.display()))?;
    let backend_manager = BackendManager::new(backend_dir, backend_state_dir, None)?;
    if let Err(err) = backend_manager.ensure_started() {
        eprintln!("Failed to start backend automatically: {err}");
    }

    app.manage(provider_vault);
    app.manage(backend_manager);

    let event_handle = handle.clone();
    handle.listen_global("backend::restart", move |_| {
        if let Some(manager) = event_handle.try_state::<BackendManager>() {
            let _ = manager.stop();
            if let Err(err) = manager.ensure_started() {
                eprintln!("Failed to restart backend: {err}");
            }
        }
    });

    Ok(())
}

fn main() -> Result<()> {
    tauri::Builder::default()
        .setup(|app| initialize(app).map_err(|err| err.into()))
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            start_backend,
            stop_backend,
            list_provider_secrets,
            upsert_provider_secret,
            remove_provider_secret,
            get_active_provider,
            set_active_provider
        ])
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                if let Some(manager) = event.window().try_state::<BackendManager>() {
                    let _ = manager.stop();
                }
            }
        })
        .run(tauri::generate_context!("tauri.conf.json"))
        .map_err(|err| err.into())
}
