from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List
from datetime import datetime
from urllib.parse import urlparse
import hashlib
import os
import httpx

from app.models.modpack import Modpack, ModpackMember, Mod, ModRead
from app.middleware.auth import current_user
from app.storage.minio import upload_mod, delete_mod, presigned_url, client as minio_client
from app.audit import log_action
from app.validation import validate_mod_filename

router = APIRouter(prefix="/modpacks", tags=["external"])

ALLOWED_HOSTS = {"cdn.modrinth.com"}
MAX_BYTES = 200 * 1024 * 1024
BUCKET = os.getenv("MINIO_BUCKET", "mc-launcher")
MODRINTH = "https://api.modrinth.com/v2"
UA = "LazyOneShot/mc-launcher (github.com/LazyOneShot/mc-launcher)"


def get_session():
    from app.main import engine
    with Session(engine) as session:
        yield session


def can_edit(pack: Modpack, user: dict, session: Session) -> bool:
    if pack.owner == user["uuid"]:
        return True
    m = session.exec(select(ModpackMember).where(
        ModpackMember.pack_id == pack.id,
        ModpackMember.minecraft_uuid == user["uuid"],
    )).first()
    return bool(m and m.role == "editor")


def _validate_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise HTTPException(400, f"URL host not allowed: {parsed.hostname}")


async def _download(url: str) -> bytes:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=120) as c:
            resp = await c.get(url)
            resp.raise_for_status()
            data = resp.content
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Failed to download from Modrinth: {e}")
    if not data:
        raise HTTPException(502, "Modrinth returned an empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Mod file exceeds size limit")
    return data


def _fetch_from_minio(key: str) -> bytes:
    resp = minio_client.get_object(BUCKET, key)
    try:
        return resp.read()
    finally:
        resp.close()
        resp.release_conn()


class AddFromUrlRequest(BaseModel):
    url: str
    filename: str


@router.post("/{pack_id}/mods/from-url", response_model=ModRead)
async def add_mod_from_url(pack_id: str, body: AddFromUrlRequest, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if not can_edit(pack, user, session):
        raise HTTPException(403, "You don't have permission to modify this pack")

    _validate_url(body.url)
    filename = validate_mod_filename(body.filename)

    if any(m.filename == filename for m in pack.mods):
        raise HTTPException(409, f"{filename} is already in this pack")

    data = await _download(body.url)
    key, sha256, size = upload_mod(pack_id, filename, data)

    mod = Mod(
        filename=filename,
        sha256=sha256,
        sha1=hashlib.sha1(data).hexdigest(),
        size_bytes=size,
        minio_key=key,
        download_url=presigned_url(key),
        modpack_id=pack_id,
    )
    session.add(mod)
    pack.updated_at = datetime.utcnow()
    log_action(session, pack_id, user, "mod.add", target=filename, detail="via Modrinth")
    session.commit()
    session.refresh(mod)
    return mod


class UpdateCandidate(BaseModel):
    mod_id: str
    current_filename: str
    new_filename: str
    new_version_number: str
    new_version_type: str
    url: str
    size: int


class CheckUpdatesResponse(BaseModel):
    checked: int
    unmatched: int
    updates: List[UpdateCandidate]


@router.post("/{pack_id}/check-updates", response_model=CheckUpdatesResponse)
async def check_updates(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if not can_edit(pack, user, session):
        raise HTTPException(403, "You don't have permission to modify this pack")

    mods = list(pack.mods)
    if not mods:
        return CheckUpdatesResponse(checked=0, unmatched=0, updates=[])

    dirty = False
    for m in mods:
        if not m.sha1:
            try:
                m.sha1 = hashlib.sha1(_fetch_from_minio(m.minio_key)).hexdigest()
                dirty = True
            except Exception:
                continue
    if dirty:
        session.commit()

    by_hash = {m.sha1: m for m in mods if m.sha1}
    if not by_hash:
        return CheckUpdatesResponse(checked=0, unmatched=len(mods), updates=[])

    try:
        async with httpx.AsyncClient(timeout=30, headers={"User-Agent": UA}) as c:
            resp = await c.post(f"{MODRINTH}/version_files/update", json={
                "hashes": list(by_hash.keys()),
                "algorithm": "sha1",
                "loaders": [pack.loader],
                "game_versions": [pack.mc_version],
            })
            resp.raise_for_status()
            latest = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Modrinth lookup failed: {e}")

    updates = []
    for old_hash, version in latest.items():
        mod = by_hash.get(old_hash)
        if not mod:
            continue
        files = version.get("files") or []
        primary = next((f for f in files if f.get("primary")), files[0] if files else None)
        if not primary:
            continue
        new_hash = (primary.get("hashes") or {}).get("sha1")
        if not new_hash or new_hash == old_hash:
            continue
        updates.append(UpdateCandidate(
            mod_id=mod.id,
            current_filename=mod.filename,
            new_filename=primary["filename"],
            new_version_number=version.get("version_number", "?"),
            new_version_type=version.get("version_type", "release"),
            url=primary["url"],
            size=primary.get("size", 0),
        ))

    return CheckUpdatesResponse(checked=len(by_hash), unmatched=len(mods) - len(latest), updates=updates)


class ApplyUpdateRequest(BaseModel):
    url: str
    filename: str


@router.post("/{pack_id}/mods/{mod_id}/update", response_model=ModRead)
async def apply_update(pack_id: str, mod_id: str, body: ApplyUpdateRequest, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if not can_edit(pack, user, session):
        raise HTTPException(403, "You don't have permission to modify this pack")

    mod = session.get(Mod, mod_id)
    if not mod or mod.modpack_id != pack_id:
        raise HTTPException(404, "Mod not found in this pack")

    _validate_url(body.url)
    new_filename = validate_mod_filename(body.filename)

    data = await _download(body.url)
    new_key, sha256, size = upload_mod(pack_id, new_filename, data)

    old_filename = mod.filename
    old_key = mod.minio_key

    mod.filename = new_filename
    mod.sha256 = sha256
    mod.sha1 = hashlib.sha1(data).hexdigest()
    mod.size_bytes = size
    mod.minio_key = new_key
    mod.download_url = presigned_url(new_key)
    mod.uploaded_at = datetime.utcnow()
    pack.updated_at = datetime.utcnow()

    log_action(session, pack_id, user, "mod.update", target=new_filename, detail=f"from {old_filename}")
    session.commit()
    session.refresh(mod)

    if old_key != new_key:
        try:
            delete_mod(old_key)
        except Exception:
            pass

    return mod
