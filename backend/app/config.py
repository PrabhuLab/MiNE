from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="MINE_", env_file=".env", extra="ignore")

    backend_version: str = "0.2.0"
    cors_origins: str = "https://prabhulab.github.io,http://localhost:3000,http://127.0.0.1:3000"
    max_nodes: int = 1_000_000
    max_edges: int = 5_000_000
    max_compressed_bytes: int = 32 * 1024 * 1024
    max_decompressed_bytes: int = 192 * 1024 * 1024
    request_timeout_seconds: int = 240
    response_gzip_min_bytes: int = 1024
    diameter_max_nodes: int = 100_000
    eccentricity_max_nodes: int = 75_000
    closeness_max_nodes: int = 75_000
    betweenness_max_nodes: int = 50_000
    betweenness_max_edges: int = 250_000
    edge_betweenness_max_nodes: int = 25_000
    edge_betweenness_max_edges: int = 150_000
    fr_max_nodes: int = 20_000

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
