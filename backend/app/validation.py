"""
Shared input validation for anything that ends up as a path component —
either a MinIO object key or, on the launcher side, a literal filesystem
path under the user's app-data directory (see launch.ts / packDir()).

A pack ID or filename that slips a "../" past the backend doesn't just
corrupt a MinIO key — it becomes a real path-traversal write on every
machine that syncs the pack. Keep this strict.
"""
import re
from fastapi import HTTPException

PACK_ID_RE = re.compile(r"^[a-z0-9-]{1,64}$")


def validate_pack_id(pack_id: str) -> None:
    if not PACK_ID_RE.match(pack_id or ""):
        raise HTTPException(400, "Pack ID must be 1-64 characters, lowercase letters/numbers/hyphens only")


def validate_mod_filename(filename: str) -> str:
    filename = (filename or "").strip()
    if not filename or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(400, "Invalid filename")
    if not filename.lower().endswith(".jar"):
        raise HTTPException(400, "Only .jar files are supported")
    return filename
