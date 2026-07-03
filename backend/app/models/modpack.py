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
    role: str = "editor"
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

class TransferOwnershipRequest(SQLModel):
    minecraft_uuid: str


class Modpack(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    mc_version: str
    loader: str
    loader_version: str
    owner: str
    # Launch options (JSON string of { min_ram, max_ram, jvm_args, java_path })
    launch_options: str = '{"min_ram":"2G","max_ram":"4G","jvm_args":"","java_path":""}'
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    mods: List[Mod] = Relationship(back_populates="modpack")
    members: List[ModpackMember] = Relationship(back_populates="modpack")

class ModpackCreate(SQLModel):
    id: str
    name: str
    description: str = ""
    mc_version: str
    loader: str
    loader_version: str

class ModpackUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    mc_version: Optional[str] = None
    loader: Optional[str] = None
    loader_version: Optional[str] = None
    launch_options: Optional[str] = None

class ModpackRead(SQLModel):
    id: str
    name: str
    description: str
    mc_version: str
    loader: str
    loader_version: str
    owner: str
    launch_options: str
    created_at: datetime
    updated_at: datetime
    mods: List[ModRead] = []
    members: List[ModpackMemberRead] = []
