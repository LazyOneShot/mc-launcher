from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlmodel import Session, select
from datetime import datetime
import hashlib
import httpx

from app.models.modpack import (
    Modpack, ModpackCreate, ModpackRead, ModpackUpdate, ModpackWithRole, PublicModpackRead,
    Mod, ModRead, ModpackMember, ModpackMemberRead, ModpackServer, AuditLog,
    JoinRequest, JoinRequestRead, MyJoinRequestRead, Report, ReportCreate,
)
from app.middleware.auth import current_user
from app.storage.minio import upload_mod, delete_mod, presigned_url
from app.audit import log_action
from app.validation import validate_pack_id, validate_mod_filename
from app.limiter import limiter

router = APIRouter(prefix="/modpacks", tags=["modpacks"])

MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # matches external.py's from-URL cap

VALID_VISIBILITY = {"public", "private"}
VALID_JOIN_MODE = {"open", "request"}


def _validate_policy_fields(visibility: str | None, join_mode: str | None):
    if visibility is not None and visibility not in VALID_VISIBILITY:
        raise HTTPException(400, "visibility must be 'public' or 'private'")
    if join_mode is not None and join_mode not in VALID_JOIN_MODE:
        raise HTTPException(400, "join_mode must be 'open' or 'request'")


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


@router.get("/mine", response_model=list[ModpackWithRole])
def list_mine(user=Depends(current_user), session: Session = Depends(get_session)):
    owned = session.exec(select(Modpack).where(Modpack.owner == user["uuid"])).all()
    memberships = session.exec(select(ModpackMember).where(
        ModpackMember.minecraft_uuid == user["uuid"]
    )).all()
    role_by_pack_id = {m.pack_id: m.role for m in memberships}
    member_packs = [session.get(Modpack, m.pack_id) for m in memberships]
    member_packs = [p for p in member_packs if p]
    all_packs = {p.id: p for p in list(owned) + member_packs}

    result = []
    for pack in all_packs.values():
        is_owner = pack.owner == user["uuid"]
        role = "owner" if is_owner else role_by_pack_id.get(pack.id, "viewer")
        pending = 0
        if is_owner and pack.join_mode == "request":
            pending = len(session.exec(select(JoinRequest).where(JoinRequest.pack_id == pack.id)).all())
        result.append(ModpackWithRole(**pack.dict(), my_role=role, pending_request_count=pending))
    return result


@router.get("/public", response_model=list[PublicModpackRead])
def list_public(session: Session = Depends(get_session)):
    return session.exec(select(Modpack).where(Modpack.visibility == "public")).all()


@router.get("/requests/mine", response_model=list[MyJoinRequestRead])
def list_my_join_requests(user=Depends(current_user), session: Session = Depends(get_session)):
    reqs = session.exec(select(JoinRequest).where(JoinRequest.minecraft_uuid == user["uuid"])).all()
    result = []
    for r in reqs:
        pack = session.get(Modpack, r.pack_id)
        if pack:
            result.append(MyJoinRequestRead(id=r.id, pack_id=r.pack_id, pack_name=pack.name, created_at=r.created_at))
    return result


async def _backfill_owner_username(pack: Modpack, session: Session):
    # Packs created before owner_username existed have it blank — recover it
    # once from Mojang and persist so we don't hit their API on every load.
    try:
        async with httpx.AsyncClient() as c:
            res = await c.get(f"https://sessionserver.mojang.com/session/minecraft/profile/{pack.owner.replace('-', '')}")
            if res.status_code == 200:
                pack.owner_username = res.json()["name"]
                session.commit()
    except Exception:
        pass


@router.get("/{pack_id}", response_model=ModpackRead)
async def get_modpack(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if pack.visibility != "public" and user_role(pack, user, session) is None:
        raise HTTPException(403, "You must be a member of this pack to view it")
    if not pack.owner_username:
        await _backfill_owner_username(pack, session)
    for mod in pack.mods:
        mod.download_url = presigned_url(mod.minio_key)
    return pack


@router.post("", response_model=ModpackRead)
@limiter.limit("10/minute")
def create_modpack(request: Request, body: ModpackCreate, user=Depends(current_user), session: Session = Depends(get_session)):
    validate_pack_id(body.id)
    if session.get(Modpack, body.id):
        raise HTTPException(409, "Pack ID already taken")
    _validate_policy_fields(body.visibility, body.join_mode)
    pack = Modpack(**body.dict(), owner=user["uuid"], owner_username=user["name"])
    session.add(pack)
    log_action(session, pack.id, user, "pack.create", target=pack.name)
    session.commit()
    session.refresh(pack)
    return pack


@router.post("/{pack_id}/join")
@limiter.limit("20/minute")
def join_modpack(request: Request, pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
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

    if pack.join_mode == "request":
        pending = session.exec(select(JoinRequest).where(
            JoinRequest.pack_id == pack_id,
            JoinRequest.minecraft_uuid == user["uuid"],
        )).first()
        if pending:
            return {"ok": True, "status": "pending"}
        session.add(JoinRequest(pack_id=pack_id, minecraft_uuid=user["uuid"], minecraft_username=user["name"]))
        log_action(session, pack_id, user, "member.request", target=user["name"])
        session.commit()
        return {"ok": True, "status": "pending"}

    session.add(ModpackMember(
        pack_id=pack_id,
        minecraft_uuid=user["uuid"],
        minecraft_username=user["name"],
        role="viewer",
    ))
    log_action(session, pack_id, user, "member.join", target=user["name"])
    session.commit()
    return {"ok": True, "role": "viewer"}


@router.get("/{pack_id}/join-requests", response_model=list[JoinRequestRead])
def list_join_requests(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the pack owner can view join requests")
    return session.exec(select(JoinRequest).where(JoinRequest.pack_id == pack_id)).all()


@router.post("/{pack_id}/join-requests/{request_id}/approve", response_model=ModpackMemberRead)
def approve_join_request(pack_id: str, request_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the pack owner can approve join requests")

    req = session.get(JoinRequest, request_id)
    if not req or req.pack_id != pack_id:
        raise HTTPException(404, "Join request not found")

    member = ModpackMember(pack_id=pack_id, minecraft_uuid=req.minecraft_uuid, minecraft_username=req.minecraft_username, role="viewer")
    session.add(member)
    session.delete(req)
    log_action(session, pack_id, user, "member.approve", target=req.minecraft_username)
    session.commit()
    session.refresh(member)
    return member


@router.post("/{pack_id}/join-requests/{request_id}/deny")
def deny_join_request(pack_id: str, request_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the pack owner can deny join requests")

    req = session.get(JoinRequest, request_id)
    if not req or req.pack_id != pack_id:
        raise HTTPException(404, "Join request not found")

    log_action(session, pack_id, user, "member.deny", target=req.minecraft_username)
    session.delete(req)
    session.commit()
    return {"ok": True}


@router.delete("/{pack_id}/join-requests/mine")
def cancel_my_join_request(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    req = session.exec(select(JoinRequest).where(
        JoinRequest.pack_id == pack_id,
        JoinRequest.minecraft_uuid == user["uuid"],
    )).first()
    if not req:
        raise HTTPException(404, "No pending request found")
    session.delete(req)
    session.commit()
    return {"ok": True}


@router.patch("/{pack_id}", response_model=ModpackRead)
def update_modpack(pack_id: str, body: ModpackUpdate, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the owner can edit pack settings")
    _validate_policy_fields(body.visibility, body.join_mode)

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


def delete_pack_and_data(pack: Modpack, session: Session):
    """Shared by the owner-facing delete and the admin force-delete — keeping
    this in one place means a forgotten cleanup step can't drift between them."""
    pack_id = pack.id
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
    for r in session.exec(select(JoinRequest).where(JoinRequest.pack_id == pack_id)).all():
        session.delete(r)
    for rep in session.exec(select(Report).where(Report.pack_id == pack_id)).all():
        session.delete(rep)

    session.delete(pack)
    session.commit()


@router.delete("/{pack_id}")
def delete_modpack(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the owner can delete a pack")

    delete_pack_and_data(pack, session)
    return {"ok": True}


@router.post("/{pack_id}/report")
@limiter.limit("5/minute")
def report_pack(request: Request, pack_id: str, body: ReportCreate, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if not body.reason.strip():
        raise HTTPException(400, "A reason is required")

    session.add(Report(
        pack_id=pack_id,
        pack_name=pack.name,
        reporter_uuid=user["uuid"],
        reporter_username=user["name"],
        reason=body.reason.strip(),
    ))
    session.commit()
    return {"ok": True}


@router.post("/{pack_id}/mods", response_model=ModRead)
@limiter.limit("30/minute")
async def add_mod(request: Request, pack_id: str, file: UploadFile = File(...), user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    if not can_edit(pack, user, session):
        raise HTTPException(403, "You don't have permission to modify this pack")

    filename = validate_mod_filename(file.filename)
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Mod file exceeds size limit")
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
    log_action(session, pack_id, user, "mod.add", target=filename)
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
