from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
import httpx

from app.models.modpack import (
    Modpack, ModpackMember, ModpackMemberRead,
    AddMemberRequest, ChangeRoleRequest, TransferOwnershipRequest,
)
from app.middleware.auth import current_user
from app.audit import log_action

router = APIRouter(prefix="/modpacks", tags=["members"])


def get_session():
    from app.main import engine
    with Session(engine) as session:
        yield session


def require_owner(pack: Modpack, user: dict):
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the pack owner can do this")


async def lookup_minecraft_uuid(username: str):
    async with httpx.AsyncClient() as c:
        res = await c.get(f"https://api.mojang.com/users/profiles/minecraft/{username}")
        if res.status_code == 404:
            raise HTTPException(404, f"Minecraft player '{username}' not found")
        res.raise_for_status()
        data = res.json()
        raw = data["id"]
        formatted = f"{raw[:8]}-{raw[8:12]}-{raw[12:16]}-{raw[16:20]}-{raw[20:]}"
        return formatted, data["name"]


@router.get("/{pack_id}/members", response_model=list[ModpackMemberRead])
def list_members(pack_id: str, session: Session = Depends(get_session)):
    return session.exec(select(ModpackMember).where(ModpackMember.pack_id == pack_id)).all()


@router.post("/{pack_id}/members", response_model=ModpackMemberRead)
async def add_member(pack_id: str, body: AddMemberRequest, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    require_owner(pack, user)

    mc_uuid, mc_name = await lookup_minecraft_uuid(body.minecraft_username)
    existing = session.exec(select(ModpackMember).where(
        ModpackMember.pack_id == pack_id,
        ModpackMember.minecraft_uuid == mc_uuid,
    )).first()
    if existing:
        raise HTTPException(409, f"{mc_name} is already a member")
    if mc_uuid == pack.owner:
        raise HTTPException(400, "That player is already the pack owner")

    member = ModpackMember(pack_id=pack_id, minecraft_uuid=mc_uuid, minecraft_username=mc_name, role="editor")
    session.add(member)
    log_action(session, pack_id, user, "member.add", target=mc_name, detail="role: editor")
    session.commit()
    session.refresh(member)
    return member


@router.patch("/{pack_id}/members/{member_uuid}", response_model=ModpackMemberRead)
def change_role(pack_id: str, member_uuid: str, body: ChangeRoleRequest, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    require_owner(pack, user)
    if body.role not in ("editor", "viewer"):
        raise HTTPException(400, "Role must be 'editor' or 'viewer'")

    member = session.exec(select(ModpackMember).where(
        ModpackMember.pack_id == pack_id,
        ModpackMember.minecraft_uuid == member_uuid,
    )).first()
    if not member:
        raise HTTPException(404, "Member not found")

    old_role = member.role
    member.role = body.role
    log_action(session, pack_id, user, "member.role_change", target=member.minecraft_username, detail=f"{old_role} -> {body.role}")
    session.commit()
    session.refresh(member)
    return member


@router.delete("/{pack_id}/members/{member_uuid}")
def remove_member(pack_id: str, member_uuid: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    require_owner(pack, user)

    member = session.exec(select(ModpackMember).where(
        ModpackMember.pack_id == pack_id,
        ModpackMember.minecraft_uuid == member_uuid,
    )).first()
    if not member:
        raise HTTPException(404, "Member not found")

    username = member.minecraft_username
    session.delete(member)
    log_action(session, pack_id, user, "member.remove", target=username)
    session.commit()
    return {"ok": True}


@router.post("/{pack_id}/leave")
def leave_modpack(pack_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    if pack.owner == user["uuid"]:
        raise HTTPException(400, "Owner can't leave — transfer ownership first")

    member = session.exec(select(ModpackMember).where(
        ModpackMember.pack_id == pack_id,
        ModpackMember.minecraft_uuid == user["uuid"],
    )).first()
    if not member:
        raise HTTPException(404, "You are not a member of this pack")

    session.delete(member)
    log_action(session, pack_id, user, "member.leave", target=user["name"])
    session.commit()
    return {"ok": True}


@router.post("/{pack_id}/transfer")
def transfer_ownership(pack_id: str, body: TransferOwnershipRequest, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    require_owner(pack, user)

    target = session.exec(select(ModpackMember).where(
        ModpackMember.pack_id == pack_id,
        ModpackMember.minecraft_uuid == body.minecraft_uuid,
    )).first()
    if not target:
        raise HTTPException(400, "Target user must be a member of the pack first")

    old_owner_uuid = pack.owner
    old_owner_name = user["name"]
    new_owner_name = target.minecraft_username

    pack.owner = body.minecraft_uuid
    session.delete(target)
    session.add(ModpackMember(
        pack_id=pack_id,
        minecraft_uuid=old_owner_uuid,
        minecraft_username=old_owner_name,
        role="editor",
    ))
    log_action(session, pack_id, user, "pack.transfer", target=new_owner_name, detail=f"from {old_owner_name}")
    session.commit()
    return {"ok": True, "new_owner": body.minecraft_uuid}
