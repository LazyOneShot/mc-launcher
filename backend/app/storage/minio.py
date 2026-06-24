from minio import Minio
import hashlib, io
from datetime import timedelta
from app.config import settings

client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=settings.minio_secure
)

def ensure_bucket():
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)

def upload_mod(pack_id: str, filename: str, data: bytes) -> tuple[str, str, int]:
    ensure_bucket()
    key = f"packs/{pack_id}/mods/{filename}"
    sha256 = hashlib.sha256(data).hexdigest()
    client.put_object(settings.minio_bucket, key, io.BytesIO(data), len(data), content_type="application/java-archive")
    return key, sha256, len(data)

def delete_mod(minio_key: str):
    client.remove_object(settings.minio_bucket, minio_key)

def presigned_url(minio_key: str) -> str:
    return client.presigned_get_object(settings.minio_bucket, minio_key, expires=timedelta(days=7))
