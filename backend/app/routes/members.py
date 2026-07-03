from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.models.modpack import (
    Modpack, ModpackMember, ModpackMemberRead,
    AddMemberRequest, TransferOwnershipRequest
)
from app.middleware.auth import current_user
import httpx

router = APIRouter(prefix="/modpacks", tags=["members"])

def get_session():
    from app.main import engine
    with Session(engine) as session:
        yield session

def require_owner(pack: Modpack, user: dict):
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the pack owner can do this")

async def lookup_minecraft_uuid(username: str) -> tuple[str, str]:
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
    return session.exec(
        select(ModpackMember).where(ModpackMember.pack_id == pack_id)
    ).all()

@router.post("/{pack_id}/members", response_model=ModpackMemberRead)
async def add_member(
    pack_id: str,
    body: AddMemberRequest,
    user=Depends(current_user),
    session: Session = Depends(get_session)
):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    require_owner(pack, user)

    mc_uuid, mc_name = await lookup_minecraft_uuid(body.minecraft_username)

    existing = session.exec(
        select(ModpackMember).where(
            ModpackMember.pack_id == pack_id,
            ModpackMember.minecraft_uuid == mc_uuid
        )
    ).first()
    if existing:
        raise HTTPException(409, f"{mc_name} is already a member")

    if mc_uuid == pack.owner:
        raise HTTPException(400, "That player is already the pack owner")

    member = ModpackMember(
        pack_id=pack_id,
        minecraft_uuid=mc_uuid,
        minecraft_username=mc_name,
        role="editor"
    )
    session.add(member)
    session.commit()
    session.refresh(member)
    return member

@router.delete("/{pack_id}/members/{member_uuid}")
def remove_member(
    pack_id: str,
    member_uuid: str,
    user=Depends(current_user),
    session: Session = Depends(get_session)
):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    require_owner(pack, user)

    member = session.exec(
        select(ModpackMember).where(
            ModpackMember.pack_id == pack_id,
            ModpackMember.minecraft_uuid == member_uuid
        )
    ).first()
    if not member:
        raise HTTPException(404, "Member not found")

    session.delete(member)
    session.commit()
    return {"ok": True}

@router.post("/{pack_id}/transfer")
def transfer_ownership(
    pack_id: str,
    body: TransferOwnershipRequest,
    user=Depends(current_user),
    session: Session = Depends(get_session)
):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    require_owner(pack, user)

    new_owner_member = session.exec(
        select(ModpackMember).where(
            ModpackMember.pack_id == pack_id,
            ModpackMember.minecraft_uuid == body.minecraft_uuid
        )
    ).first()
    if not new_owner_member:
        raise HTTPException(400, "Target user must be a member of the pack first")

    old_owner_uuid = pack.owner
    old_owner_name = user["name"]

    # Promote new owner
    pack.owner = body.minecraft_uuid
    # Remove from members table (they're now owner)
    session.delete(new_owner_member)
    # Old owner becomes editor
    session.add(ModpackMember(
        pack_id=pack_id,
        minecraft_uuid=old_owner_uuid,
        minecraft_username=old_owner_name,
        role="editor"
    ))

    session.commit()
    return {"ok": True, "new_owner": body.minecraft_uuid}
