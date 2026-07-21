from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
import httpx

from app.models.modpack import (
    Modpack, ModpackMember, BannedUser, BannedUserRead, BanRequest,
    Report, ReportRead, AdminPackRead,
)
from app.middleware.auth import current_user
from app.config import is_admin
from app.audit import log_action
from app.routes.modpacks import delete_pack_and_data

router = APIRouter(prefix="/admin", tags=["admin"])


def get_session():
    from app.main import engine
    with Session(engine) as session:
        yield session


def require_admin(user: dict):
    if not is_admin(user["uuid"]):
        raise HTTPException(403, "Admin access required")


async def lookup_minecraft_uuid(username: str):
    async with httpx.AsyncClient() as c:
        res = await c.get(f"https://api.mojang.com/users/profiles/minecraft/{username}")
        if res.status_code in (400, 404):
            raise HTTPException(404, f"Minecraft player '{username}' not found")
        res.raise_for_status()
        data = res.json()
        raw = data["id"]
        formatted = f"{raw[:8]}-{raw[8:12]}-{raw[12:16]}-{raw[16:20]}-{raw[20:]}"
        return formatted, data["name"]


@router.get("/check")
def check_admin_access(user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    open_reports = len(session.exec(select(Report).where(Report.status == "open")).all())
    return {"is_admin": True, "open_report_count": open_reports}


@router.get("/bans", response_model=list[BannedUserRead])
def list_bans(user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    return session.exec(select(BannedUser)).all()


@router.post("/bans", response_model=BannedUserRead)
async def ban_user(body: BanRequest, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    mc_uuid, mc_name = await lookup_minecraft_uuid(body.minecraft_username)

    existing = session.exec(select(BannedUser).where(BannedUser.minecraft_uuid == mc_uuid)).first()
    if existing:
        raise HTTPException(409, f"{mc_name} is already banned")

    ban = BannedUser(minecraft_uuid=mc_uuid, minecraft_username=mc_name, reason=body.reason, banned_by=user["uuid"])
    session.add(ban)
    session.commit()
    session.refresh(ban)
    return ban


@router.delete("/bans/{minecraft_uuid}")
def unban_user(minecraft_uuid: str, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    ban = session.exec(select(BannedUser).where(BannedUser.minecraft_uuid == minecraft_uuid)).first()
    if not ban:
        raise HTTPException(404, "That account is not banned")
    session.delete(ban)
    session.commit()
    return {"ok": True}


@router.get("/reports", response_model=list[ReportRead])
def list_reports(status: str = "open", user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    q = select(Report)
    if status != "all":
        q = q.where(Report.status == status)
    q = q.order_by(Report.created_at.desc())
    return session.exec(q).all()


@router.post("/reports/{report_id}/resolve")
def resolve_report(report_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = "resolved"
    session.commit()
    return {"ok": True}


@router.post("/reports/{report_id}/dismiss")
def dismiss_report(report_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    report = session.get(Report, report_id)
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = "dismissed"
    session.commit()
    return {"ok": True}


@router.post("/packs/{pack_id}/force-private")
def force_private(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    pack.visibility = "private"
    session.commit()
    return {"ok": True}


@router.delete("/packs/{pack_id}")
def force_delete_pack(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    delete_pack_and_data(pack, session)
    return {"ok": True}


@router.get("/packs", response_model=list[AdminPackRead])
def list_all_packs(user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    packs = session.exec(select(Modpack).order_by(Modpack.created_at.desc())).all()
    result = []
    for pack in packs:
        member_count = len(session.exec(select(ModpackMember).where(ModpackMember.pack_id == pack.id)).all())
        result.append(AdminPackRead(
            id=pack.id, name=pack.name, owner_username=pack.owner_username,
            visibility=pack.visibility, join_mode=pack.join_mode, frozen=pack.frozen,
            member_count=member_count, created_at=pack.created_at,
        ))
    return result


@router.post("/packs/{pack_id}/freeze")
def freeze_pack(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    pack.frozen = True
    log_action(session, pack_id, user, "admin.freeze", target=user["name"])
    session.commit()
    return {"ok": True}


@router.post("/packs/{pack_id}/unfreeze")
def unfreeze_pack(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    pack.frozen = False
    log_action(session, pack_id, user, "admin.unfreeze", target=user["name"])
    session.commit()
    return {"ok": True}


@router.post("/packs/{pack_id}/assist")
def start_assist(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
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

    session.add(ModpackMember(pack_id=pack_id, minecraft_uuid=user["uuid"], minecraft_username=user["name"], role="editor"))
    log_action(session, pack_id, user, "admin.assist_start", target=user["name"])
    session.commit()
    return {"ok": True, "role": "editor"}


@router.delete("/packs/{pack_id}/assist")
def stop_assist(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    require_admin(user)
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")

    member = session.exec(select(ModpackMember).where(
        ModpackMember.pack_id == pack_id,
        ModpackMember.minecraft_uuid == user["uuid"],
    )).first()
    if not member:
        raise HTTPException(404, "You don't have an active assist grant on this pack")

    session.delete(member)
    log_action(session, pack_id, user, "admin.assist_end", target=user["name"])
    session.commit()
    return {"ok": True}
