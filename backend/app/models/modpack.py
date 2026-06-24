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

class ModpackCreate(SQLModel):
    id: str
    name: str
    description: str = ""
    mc_version: str
    loader: str
    loader_version: str

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
