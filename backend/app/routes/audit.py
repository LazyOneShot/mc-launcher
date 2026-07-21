from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.models.modpack import Modpack, ModpackMember, AuditLog, AuditLogRead
from app.middleware.auth import current_user

router = APIRouter(prefix="/modpacks", tags=["audit"])


def get_session():
    from app.main import engine
    with Session(engine) as session:
        yield session


@router.get("/{pack_id}/audit", response_model=list[AuditLogRead])
def list_audit(
    pack_id: str,
    limit: int = Query(100, le=500),
    user=Depends(current_user),
    session: Session = Depends(get_session),
):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")

    if pack.owner != user["uuid"]:
        member = session.exec(select(ModpackMember).where(
            ModpackMember.pack_id == pack_id,
            ModpackMember.minecraft_uuid == user["uuid"],
        )).first()
        if not member or member.role != "editor":
            raise HTTPException(403, "Only the owner and editors can view activity")

    q = select(AuditLog).where(AuditLog.pack_id == pack_id)
    q = q.order_by(AuditLog.created_at.desc()).limit(limit)
    return session.exec(q).all()
