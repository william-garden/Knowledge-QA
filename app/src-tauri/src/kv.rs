use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use anyhow::{bail, Context, Result};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

fn read_json_file<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
    let data = fs::read_to_string(path)
        .with_context(|| format!("Failed to read provider store `{}`", path.display()))?;
    let parsed = serde_json::from_str(&data)
        .with_context(|| format!("Failed to parse provider store `{}`", path.display()))?;
    Ok(parsed)
}

fn write_json_file<T: Serialize>(path: &Path, payload: &T) -> Result<()> {
    let serialized = serde_json::to_string_pretty(payload)?;
    fs::write(path, serialized)
        .with_context(|| format!("Failed to write provider store `{}`", path.display()))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProviderSecret {
    pub provider_id: String,
    pub api_key: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct ProviderStoreData {
    providers: HashMap<String, ProviderSecret>,
    active_provider_id: Option<String>,
}

pub struct ProviderVault {
    path: PathBuf,
    state: Mutex<ProviderStoreData>,
}

impl ProviderVault {
    pub fn new<P: Into<PathBuf>>(dir: P) -> Result<Self> {
        let dir = dir.into();
        fs::create_dir_all(&dir)
            .with_context(|| format!("Failed to ensure data directory `{}`", dir.display()))?;
        let path = dir.join("providers.json");
        let state = if path.exists() {
            read_json_file(&path)?
        } else {
            ProviderStoreData::default()
        };
        Ok(Self {
            path,
            state: Mutex::new(state),
        })
    }

    pub fn list(&self) -> Vec<ProviderSecret> {
        let guard = self.state.lock();
        guard.providers.values().cloned().collect()
    }

    pub fn get(&self, provider_id: &str) -> Option<ProviderSecret> {
        let guard = self.state.lock();
        guard.providers.get(provider_id).cloned()
    }

    pub fn upsert(&self, secret: ProviderSecret) -> Result<ProviderSecret> {
        let mut guard = self.state.lock();
        guard
            .providers
            .insert(secret.provider_id.clone(), secret.clone());
        if guard.active_provider_id.is_none() {
            guard.active_provider_id = Some(secret.provider_id.clone());
        }
        write_json_file(&self.path, &*guard)?;
        Ok(secret)
    }

    pub fn remove(&self, provider_id: &str) -> Result<bool> {
        let mut guard = self.state.lock();
        let removed = guard.providers.remove(provider_id).is_some();
        if removed {
            if guard
                .active_provider_id
                .as_ref()
                .map(|active| active == provider_id)
                .unwrap_or(false)
            {
                guard.active_provider_id = guard.providers.keys().next().cloned();
            }
            write_json_file(&self.path, &*guard)?;
        }
        Ok(removed)
    }

    pub fn active_provider(&self) -> Option<String> {
        let guard = self.state.lock();
        guard.active_provider_id.clone()
    }

    pub fn set_active_provider(&self, provider_id: Option<String>) -> Result<Option<String>> {
        let mut guard = self.state.lock();
        match provider_id {
            Some(id) => {
                if guard.providers.contains_key(&id) {
                    guard.active_provider_id = Some(id.clone());
                    write_json_file(&self.path, &*guard)?;
                    Ok(Some(id))
                } else {
                    bail!("Provider `{}` not found", id);
                }
            }
            None => {
                guard.active_provider_id = None;
                write_json_file(&self.path, &*guard)?;
                Ok(None)
            }
        }
    }
}

unsafe impl Send for ProviderVault {}
unsafe impl Sync for ProviderVault {}
