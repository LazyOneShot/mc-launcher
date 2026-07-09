from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.models.modpack import (
    Modpack, ModpackServer, ModpackServerRead,
    ServerCreate, ServerUpdate
)
from app.middleware.auth import current_user

router = APIRouter(prefix="/modpacks", tags=["servers"])

def get_session():
    from app.main import engine
    with Session(engine) as session:
        yield session

def require_owner(pack: Modpack, user: dict):
    if pack.owner != user["uuid"]:
        raise HTTPException(403, "Only the pack owner can manage servers")

@router.get("/{pack_id}/servers", response_model=list[ModpackServerRead])
def list_servers(pack_id: str, session: Session = Depends(get_session)):
    return session.exec(
        select(ModpackServer)
        .where(ModpackServer.pack_id == pack_id)
        .order_by(ModpackServer.sort_order, ModpackServer.created_at)
    ).all()

@router.post("/{pack_id}/servers", response_model=ModpackServerRead)
def add_server(pack_id: str, body: ServerCreate, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack: raise HTTPException(404, "Modpack not found")
    require_owner(pack, user)
    existing_count = len(session.exec(select(ModpackServer).where(ModpackServer.pack_id == pack_id)).all())
    server = ModpackServer(pack_id=pack_id, name=body.name, host=body.host, port=body.port, sort_order=existing_count)
    session.add(server); session.commit(); session.refresh(server)
    return server

@router.patch("/{pack_id}/servers/{server_id}", response_model=ModpackServerRead)
def update_server(pack_id: str, server_id: str, body: ServerUpdate, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack: raise HTTPException(404)
    require_owner(pack, user)
    server = session.get(ModpackServer, server_id)
    if not server or server.pack_id != pack_id: raise HTTPException(404, "Server not found")
    for k, v in body.dict(exclude_unset=True).items():
        setattr(server, k, v)
    session.commit(); session.refresh(server)
    return server

@router.delete("/{pack_id}/servers/{server_id}")
def delete_server(pack_id: str, server_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack: raise HTTPException(404)
    require_owner(pack, user)
    server = session.get(ModpackServer, server_id)
    if not server or server.pack_id != pack_id: raise HTTPException(404, "Server not found")
    session.delete(server); session.commit()
    return {"ok": True}
