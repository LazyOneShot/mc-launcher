"""
Shared input validation for anything that ends up as a path component —
either a MinIO object key or, on the launcher side, a literal filesystem
path under the user's app-data directory (see launch.ts / packDir()).

A filename that slips a "../" past the backend doesn't just corrupt a
MinIO key — it becomes a real path-traversal write on every machine that
syncs the pack. Keep this strict.

Pack IDs don't need validation here: they're server-generated (see
_generate_pack_id in routes/modpacks.py), never taken from user input.
"""
from fastapi import HTTPException


def validate_mod_filename(filename: str) -> str:
    filename = (filename or "").strip()
    if not filename or "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(400, "Invalid filename")
    if not filename.lower().endswith(".jar"):
        raise HTTPException(400, "Only .jar files are supported")
    return filename
