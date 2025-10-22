use std::{
    env,
    fs,
    net::TcpStream,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use anyhow::{anyhow, Context, Result};
use parking_lot::Mutex;
use serde::Serialize;

const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 5178;
const STARTUP_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize)]
pub struct BackendStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub host: String,
    pub port: u16,
    pub base_url: String,
}

impl BackendStatus {
    pub fn stopped(port: u16) -> Self {
        Self {
            running: false,
            pid: None,
            host: DEFAULT_HOST.to_string(),
            port,
            base_url: format!("http://{}:{}/api", DEFAULT_HOST, port),
        }
    }
}

pub struct BackendManager {
    child: Mutex<Option<Child>>,
    backend_dir: PathBuf,
    data_dir: PathBuf,
    python_command: String,
    port: u16,
}

impl BackendManager {
    pub fn new<P: Into<PathBuf>>(backend_dir: P, data_dir: P, port: Option<u16>) -> Result<Self> {
        let backend_dir = backend_dir.into();
        let data_dir = data_dir.into();
        if !backend_dir.exists() {
            return Err(anyhow!(
                "Backend directory `{}` does not exist.",
                backend_dir.display()
            ));
        }
        fs::create_dir_all(&data_dir)
            .with_context(|| format!("Failed to create data directory `{}`", data_dir.display()))?;

        let python_command = env::var("KNOWLEDGE_QA_PYTHON").unwrap_or_else(|_| "python".to_string());
        Ok(Self {
            child: Mutex::new(None),
            backend_dir,
            data_dir,
            python_command,
            port: port.unwrap_or(DEFAULT_PORT),
        })
    }

    pub fn ensure_started(&self) -> Result<BackendStatus> {
        {
            let mut guard = self.child.lock();
            if let Some(child) = guard.as_mut() {
                if child.try_wait()?.is_none() {
                    return Ok(self.status_inner(true, child.id()));
                }
                *guard = None;
            }
        }

        let mut child = self.spawn_process()?;
        let pid = child.id();

        self.wait_until_ready()?;

        let mut guard = self.child.lock();
        *guard = Some(child);

        Ok(self.status_inner(true, pid))
    }

    pub fn status(&self) -> BackendStatus {
        let guard = self.child.lock();
        if let Some(child) = guard.as_ref() {
            if child.try_wait().ok().flatten().is_none() {
                return self.status_inner(true, child.id());
            }
        }
        BackendStatus::stopped(self.port)
    }

    pub fn stop(&self) -> Result<()> {
        let mut guard = self.child.lock();
        if let Some(mut child) = guard.take() {
            child.kill().ok();
            child.wait().ok();
        }
        Ok(())
    }

    fn spawn_process(&self) -> Result<Child> {
        let uploads_dir = self.data_dir.join("storage").join("uploads");
        let chroma_dir = self.data_dir.join("storage").join("chroma");
        let metadata_file = self.data_dir.join("storage").join("metadata.json");
        let conversations_file = self.data_dir.join("storage").join("conversations.json");

        for dir in [&uploads_dir, &chroma_dir] {
            fs::create_dir_all(dir)
                .with_context(|| format!("Failed to create directory `{}`", dir.display()))?;
        }
        if let Some(parent) = metadata_file.parent() {
            fs::create_dir_all(parent).ok();
        }
        if let Some(parent) = conversations_file.parent() {
            fs::create_dir_all(parent).ok();
        }

        let mut command = Command::new(&self.python_command);
        command
            .current_dir(&self.backend_dir)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .arg("-m")
            .arg("uvicorn")
            .arg("app.main:app")
            .arg("--host")
            .arg(DEFAULT_HOST)
            .arg("--port")
            .arg(self.port.to_string());

        command.env("PKB_UPLOADS_DIR", uploads_dir);
        command.env("PKB_CHROMA_DIR", chroma_dir);
        command.env("PKB_METADATA_FILE", metadata_file);
        command.env("PKB_CONVERSATIONS_FILE", conversations_file);
        command.env("PKB_OPENAI_API_KEY", "");

        command
            .spawn()
            .with_context(|| "Failed to spawn backend process using uvicorn")
    }

    fn wait_until_ready(&self) -> Result<()> {
        let deadline = Instant::now() + STARTUP_TIMEOUT;
        while Instant::now() < deadline {
            if TcpStream::connect((DEFAULT_HOST, self.port)).is_ok() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(300));
        }
        Err(anyhow!(
            "Timed out waiting for backend to start on port {}",
            self.port
        ))
    }

    fn status_inner(&self, running: bool, pid: u32) -> BackendStatus {
        BackendStatus {
            running,
            pid: Some(pid),
            host: DEFAULT_HOST.to_string(),
            port: self.port,
            base_url: format!("http://{}:{}/api", DEFAULT_HOST, self.port),
        }
    }
}

impl Drop for BackendManager {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}
