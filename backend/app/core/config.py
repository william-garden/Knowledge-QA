from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
  # Pydantic doesn't accept Path default to relative? We'll convert to absolute in model post-init.
    project_name: str = "Personal Knowledge Base QA"
    api_prefix: str = "/api"

    uploads_dir: Path = Field(default=Path("storage/uploads"))
    chroma_dir: Path = Field(default=Path("storage/chroma"))
    metadata_file: Path = Field(default=Path("storage/metadata.json"))

    openai_api_key: str | None = None
    api_base: str = "https://ark.cn-beijing.volces.com/api/v3"
    embedding_model: str = "text-embedding-v1"
    chat_model: str = "doubao-seed-1-6-251015"

    chunk_size: int = 800
    chunk_overlap: int = 200
    top_k: int = 8

    max_upload_size_mb: int = 15

    model_config = SettingsConfigDict(env_prefix="PKB_", env_file=".env", env_file_encoding="utf-8")

    def resolve_paths(self) -> None:
        self.uploads_dir = self._ensure_dir(self.uploads_dir)
        self.chroma_dir = self._ensure_dir(self.chroma_dir)
        self.metadata_file = self.metadata_file if self.metadata_file.is_absolute() else Path.cwd() / self.metadata_file
        if not self.metadata_file.parent.exists():
            self.metadata_file.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _ensure_dir(path: Path) -> Path:
        absolute = path if path.is_absolute() else Path.cwd() / path
        absolute.mkdir(parents=True, exist_ok=True)
        return absolute


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.resolve_paths()
    return settings
