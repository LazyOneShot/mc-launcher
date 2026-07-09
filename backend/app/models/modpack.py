from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import uuid

class Mod(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    filename: str
    sha256: str
    size_bytes: int
    minio_key: str
    download_url: str = ""
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    modpack_id: str = Field(foreign_key="modpack.id")
    modpack: Optional["Modpack"] = Relationship(back_populates="mods")

class ModRead(SQLModel):
    id: str
    filename: str
    sha256: str
    size_bytes: int
    download_url: str
    uploaded_at: datetime


class ModpackMember(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    pack_id: str = Field(foreign_key="modpack.id")
    minecraft_uuid: str
    minecraft_username: str
    role: str = "viewer"
    added_at: datetime = Field(default_factory=datetime.utcnow)
    modpack: Optional["Modpack"] = Relationship(back_populates="members")

class ModpackMemberRead(SQLModel):
    id: str
    pack_id: str
    minecraft_uuid: str
    minecraft_username: str
    role: str
    added_at: datetime

class AddMemberRequest(SQLModel):
    minecraft_username: str

class ChangeRoleRequest(SQLModel):
    role: str

class TransferOwnershipRequest(SQLModel):
    minecraft_uuid: str


class ModpackServer(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    pack_id: str = Field(foreign_key="modpack.id")
    name: str
    host: str
    port: int = 25565
    sort_order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    modpack: Optional["Modpack"] = Relationship(back_populates="servers")

class ModpackServerRead(SQLModel):
    id: str
    pack_id: str
    name: str
    host: str
    port: int
    sort_order: int

class ServerCreate(SQLModel):
    name: str
    host: str
    port: int = 25565

class ServerUpdate(SQLModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    sort_order: Optional[int] = None


class Modpack(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    mc_version: str
    loader: str
    loader_version: str
    owner: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    mods: List[Mod] = Relationship(back_populates="modpack")
    members: List[ModpackMember] = Relationship(back_populates="modpack")
    servers: List[ModpackServer] = Relationship(back_populates="modpack")

class ModpackCreate(SQLModel):
    id: str
    name: str
    description: str = ""
    mc_version: str
    loader: str
    loader_version: str = ""

class ModpackUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    mc_version: Optional[str] = None
    loader: Optional[str] = None
    loader_version: Optional[str] = None

class ModpackRead(SQLModel):
    id: str
    name: str
    description: str
    mc_version: str
    loader: str
    loader_version: str
    owner: str
    created_at: datetime
    updated_at: datetime
    mods: List[ModRead] = []
    members: List[ModpackMemberRead] = []
    servers: List[ModpackServerRead] = []
