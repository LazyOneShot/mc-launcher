from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from datetime import datetime
from app.models.modpack import Modpack, ModpackCreate, ModpackRead, Mod, ModRead
from app.middleware.auth import current_user
from app.storage.minio import upload_mod, delete_mod, presigned_url

router = APIRouter(prefix="/modpacks", tags=["modpacks"])

def get_session():
    from app.main import engine
    with Session(engine) as session:
        yield session

@router.get("/mine", response_model=list[ModpackRead])
def list_mine(user=Depends(current_user), session: Session = Depends(get_session)):
    return session.exec(select(Modpack).where(Modpack.owner == user["uuid"])).all()

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
    session.add(pack); session.commit(); session.refresh(pack)
    return pack

@router.post("/{pack_id}/mods", response_model=ModRead)
async def add_mod(pack_id: str, file: UploadFile = File(...), user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack: raise HTTPException(404)
    if pack.owner != user["uuid"]: raise HTTPException(403, "Not your modpack")
    data = await file.read()
    key, sha256, size = upload_mod(pack_id, file.filename, data)
    mod = Mod(filename=file.filename, sha256=sha256, size_bytes=size, minio_key=key,
              download_url=presigned_url(key), modpack_id=pack_id)
    session.add(mod); pack.updated_at = datetime.utcnow(); session.commit(); session.refresh(mod)
    return mod

@router.delete("/{pack_id}/mods/{mod_id}")
def remove_mod(pack_id: str, mod_id: str, user=Depends(current_user), session: Session = Depends(get_session)):
    pack = session.get(Modpack, pack_id)
    if not pack or pack.owner != user["uuid"]: raise HTTPException(403)
    mod = session.get(Mod, mod_id)
    if not mod or mod.modpack_id != pack_id: raise HTTPException(404)
    delete_mod(mod.minio_key); session.delete(mod); session.commit()
    return {"ok": True}
