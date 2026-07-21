from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import uuid


class Mod(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    filename: str
    sha256: str
    sha1: Optional[str] = None
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


class JoinRequest(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    pack_id: str = Field(foreign_key="modpack.id")
    minecraft_uuid: str
    minecraft_username: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JoinRequestRead(SQLModel):
    id: str
    pack_id: str
    minecraft_uuid: str
    minecraft_username: str
    created_at: datetime


class MyJoinRequestRead(SQLModel):
    id: str
    pack_id: str
    pack_name: str
    created_at: datetime


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


class AuditLog(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    pack_id: str = Field(foreign_key="modpack.id", index=True)
    actor_uuid: str
    actor_username: str
    action: str
    target: str = ""
    detail: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class AuditLogRead(SQLModel):
    id: str
    pack_id: str
    actor_uuid: str
    actor_username: str
    action: str
    target: str
    detail: str
    created_at: datetime


class Modpack(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    mc_version: str
    loader: str
    loader_version: str
    owner: str
    owner_username: str = ""
    visibility: str = "private"     # "private" | "public" — whether it's listed in the public directory
    join_mode: str = "open"         # "open" | "request" — whether /join adds instantly or files a request
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
    visibility: str = "private"
    join_mode: str = "open"


class ModpackUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    mc_version: Optional[str] = None
    loader: Optional[str] = None
    loader_version: Optional[str] = None
    visibility: Optional[str] = None
    join_mode: Optional[str] = None


class ModpackRead(SQLModel):
    id: str
    name: str
    description: str
    mc_version: str
    loader: str
    loader_version: str
    owner: str
    owner_username: str
    visibility: str
    join_mode: str
    created_at: datetime
    updated_at: datetime
    mods: List[ModRead] = []
    members: List[ModpackMemberRead] = []
    servers: List[ModpackServerRead] = []


class PublicModpackRead(SQLModel):
    id: str
    name: str
    description: str
    mc_version: str
    loader: str
    owner_username: str
    join_mode: str


class ModpackWithRole(ModpackRead):
    my_role: str
    pending_request_count: int = 0


class BannedUser(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    minecraft_uuid: str = Field(index=True, unique=True)
    minecraft_username: str
    reason: str = ""
    banned_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class BannedUserRead(SQLModel):
    id: str
    minecraft_uuid: str
    minecraft_username: str
    reason: str
    created_at: datetime


class BanRequest(SQLModel):
    minecraft_username: str
    reason: str = ""


class Report(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    pack_id: str = Field(foreign_key="modpack.id", index=True)
    pack_name: str
    reported_uuid: Optional[str] = None       # set when this is a report about a specific member, not the pack itself
    reported_username: str = ""
    reporter_uuid: str
    reporter_username: str
    reason: str
    status: str = "open"  # "open" | "resolved" | "dismissed"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReportRead(SQLModel):
    id: str
    pack_id: str
    pack_name: str
    reported_uuid: Optional[str] = None
    reported_username: str = ""
    reporter_uuid: str
    reporter_username: str
    reason: str
    status: str
    created_at: datetime


class ReportCreate(SQLModel):
    reason: str
