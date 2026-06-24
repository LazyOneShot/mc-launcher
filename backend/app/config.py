from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    minio_endpoint: str = "minio.harv.com"
    minio_access_key: str
    minio_secret_key: str
    minio_bucket: str = "mc-launcher"
    minio_secure: bool = True

    database_url: str = "sqlite:///./mc_launcher.db"

    ms_client_id: str
    ms_tenant_id: str = "consumers"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    class Config:
        env_file = ".env"

settings = Settings()
