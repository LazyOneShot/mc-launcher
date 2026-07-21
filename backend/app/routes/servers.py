from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.models.modpack import (
    Modpack, ModpackMember, ModpackServer, ModpackServerRead, ServerCreate, ServerUpdate,
)
from app.middleware.auth import current_user
from app.audit import log_action
from app.routes.modpacks import require_not_frozen

router = APIRouter(prefix="/modpacks", tags=["servers"])


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


def require_editor(pack: Modpack, user: dict, session: Session):
    if user_role(pack, user, session) not in ("owner", "editor"):
        raise HTTPException(403, "You don't have permission to manage servers")


@router.get("/{pack_id}/servers", response_model=list[ModpackServerRead])
def list_servers(pack_id: str, session: Session = Depends(get_session)):
    q = select(ModpackServer).where(ModpackServer.pack_id == pack_id)
    q = q.order_by(ModpackServer.sort_order, ModpackServer.created_at)
    return session.exec(q).all()


@router.post("/{pack_id}/servers", response_model=ModpackServerRead)
def add_server(pack_id: str, body: ServerCreate, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404, "Modpack not found")
    require_editor(pack, user, session)
    require_not_frozen(pack, user)

    n = len(session.exec(select(ModpackServer).where(ModpackServer.pack_id == pack_id)).all())
    server = ModpackServer(pack_id=pack_id, name=body.name, host=body.host, port=body.port, sort_order=n)
    session.add(server)
    log_action(session, pack_id, user, "server.add", target=body.name, detail=f"{body.host}:{body.port}")
    session.commit()
    session.refresh(server)
    return server


@router.patch("/{pack_id}/servers/{server_id}", response_model=ModpackServerRead)
def update_server(pack_id: str, server_id: str, body: ServerUpdate, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    require_editor(pack, user, session)
    require_not_frozen(pack, user)

    server = session.get(ModpackServer, server_id)
    if not server or server.pack_id != pack_id:
        raise HTTPException(404, "Server not found")

    for k, v in body.dict(exclude_unset=True).items():
        setattr(server, k, v)
    log_action(session, pack_id, user, "server.update", target=server.name)
    session.commit()
    session.refresh(server)
    return server


@router.delete("/{pack_id}/servers/{server_id}")
def delete_server(pack_id: str, server_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack:
        raise HTTPException(404)
    require_editor(pack, user, session)
    require_not_frozen(pack, user)

    server = session.get(ModpackServer, server_id)
    if not server or server.pack_id != pack_id:
        raise HTTPException(404, "Server not found")

    name = server.name
    session.delete(server)
    log_action(session, pack_id, user, "server.remove", target=name)
    session.commit()
    return {"ok": True}
