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

    enable_docs: bool = False

    # Comma-separated Minecraft UUIDs allowed to call /admin/* routes.
    admin_uuids: str = ""

    class Config:
        env_file = ".env"

settings = Settings()


def _normalize_uuid(u: str) -> str:
    return u.strip().replace("-", "").lower()


def is_admin(uuid: str) -> bool:
    # Mojang's own APIs aren't consistent about dashes (some endpoints return
    # dashed, some don't) — normalize both sides so a format mismatch alone
    # can never cause a false "not admin".
    admins = {_normalize_uuid(u) for u in settings.admin_uuids.split(",") if u.strip()}
    return _normalize_uuid(uuid) in admins
