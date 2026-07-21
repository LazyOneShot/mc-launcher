from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from datetime import datetime
import hashlib

from app.models.modpack import (
    Modpack, ModpackCreate, ModpackRead, ModpackUpdate,
    Mod, ModRead, ModpackMember, ModpackServer, AuditLog,
)
from app.middleware.auth import current_user
from app.storage.minio import upload_mod, delete_mod, presigned_url
from app.audit import log_action

router = APIRouter(prefix="/modpacks", tags=["modpacks"])


def get_session():
    from app.main import engine
    with Session(engine) as session:
        yield session


def user_role(pack: Modpack, user: dict, session: Session):
    if pack.owner == user["uuid"]:
        return "owner"
    m = session.exec(select(ModpackMember).where(
        ModpackMember.pack_id == pack.id,
        ModpackMember.minecraft_uuid == user["uuid"],
    )).first()
    return m.role if m else None


def can_edit(pack: Modpack, user: dict, session: Session) -> bool:
    return user_role(pack, user, session) in ("owner", "editor")


@router.get("/mine", response_model=list[ModpackRead])
def list_mine(user=Depends(current_user), session: Session = Depends(get_session)):
    owned = session.exec(select(Modpack).where(Modpack.owner == user["uuid"])).all()
    memberships = session.exec(select(ModpackMember).where(
        ModpackMember.minecraft_uuid == user["uuid"]
    )).all()
    member_packs = [session.get(Modpack, m.pack_id) for m in memberships]
    member_packs = [p for p in member_packs if p]
    all_packs = {p.id: p for p in list(owned) + member_packs}
    return list(all_packs.values())


@router.get("/{pack_id}", response_model=ModpackRead)
def get_modpack(pack_id: str, session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    for mod in pack.mods:
        mod.download_url = presigned_url(mod.minio_key)
    return pack


@router.post("", response_model=ModpackRead)
def create_modpack(body: ModpackCreate, user=Depends(current_user), session: Session = Depends(get_session)):
    if session.get(Modpack, body.id):
        raise HTTPException(409, "Pack ID already taken")
    pack = Modpack(**body.dict(), owner=user["uuid"])
    session.add(pack)
    log_action(session, pack.id, user, "pack.create", target=pack.name)
    session.commit()
    session.refresh(pack)
    return pack


@router.post("/{pack_id}/join")
def join_modpack(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if pack.owner == user["uuid"]:
        return {"ok": True, "role": "owner"}
    existing = session.exec(select(ModpackMember).where(
        ModpackMember.pack_id == pack_id,
        ModpackMember.minecraft_uuid == user["uuid"],
    )).first()
    if existing:
        return {"ok": True, "role": existing.role}
    session.add(ModpackMember(
        pack_id=pack_id,
        minecraft_uuid=user["uuid"],
        minecraft_username=user["name"],
        role="viewer",
    ))
    log_action(session, pack_id, user, "member.join", target=user["name"])
    session.commit()
    return {"ok": True, "role": "viewer"}


@router.patch("/{pack_id}", response_model=ModpackRead)
def update_modpack(pack_id: str, body: ModpackUpdate, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the owner can edit pack settings")

    changed = []
    for k, v in body.dict(exclude_unset=True).items():
        if getattr(pack, k) != v:
            changed.append(f"{k}: {getattr(pack, k)} -> {v}")
        setattr(pack, k, v)
    pack.updated_at = datetime.utcnow()

    if changed:
        log_action(session, pack_id, user, "pack.update", detail="; ".join(changed))
    session.commit()
    session.refresh(pack)
    return pack


@router.delete("/{pack_id}")
def delete_modpack(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the owner can delete a pack")

    for mod in pack.mods:
        try:
            delete_mod(mod.minio_key)
        except Exception:
            pass
        session.delete(mod)

    for m in session.exec(select(ModpackMember).where(ModpackMember.pack_id == pack_id)).all():
        session.delete(m)
    for s in session.exec(select(ModpackServer).where(ModpackServer.pack_id == pack_id)).all():
        session.delete(s)
    for a in session.exec(select(AuditLog).where(AuditLog.pack_id == pack_id)).all():
        session.delete(a)

    session.delete(pack)
    session.commit()
    return {"ok": True}


@router.post("/{pack_id}/mods", response_model=ModRead)
async def add_mod(pack_id: str, file: UploadFile = File(...), user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    if not can_edit(pack, user, session):
        raise HTTPException(403, "You don't have permission to modify this pack")

    data = await file.read()
    key, sha256, size = upload_mod(pack_id, file.filename, data)
    mod = Mod(
        filename=file.filename,
        sha256=sha256,
        sha1=hashlib.sha1(data).hexdigest(),
        size_bytes=size,
        minio_key=key,
        download_url=presigned_url(key),
        modpack_id=pack_id,
    )
    session.add(mod)
    pack.updated_at = datetime.utcnow()
    log_action(session, pack_id, user, "mod.add", target=file.filename)
    session.commit()
    session.refresh(mod)
    return mod


@router.delete("/{pack_id}/mods/{mod_id}")
def remove_mod(pack_id: str, mod_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    if not can_edit(pack, user, session):
        raise HTTPException(403, "You don't have permission to modify this pack")

    mod = session.get(Mod, mod_id)
    if not mod or mod.modpack_id != pack_id:
        raise HTTPException(404)

    filename = mod.filename
    delete_mod(mod.minio_key)
    session.delete(mod)
    log_action(session, pack_id, user, "mod.remove", target=filename)
    session.commit()
    return {"ok": True}
