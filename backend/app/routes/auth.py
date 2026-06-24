from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.middleware.auth import verify_microsoft_token, create_jwt

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    ms_access_token: str

@router.post("/login")
async def login(body: LoginRequest):
    try:
        profile = await verify_microsoft_token(body.ms_access_token)
    except Exception as e:
        raise HTTPException(401, f"Microsoft auth failed: {e}")
    return {
        "token": create_jwt(profile["id"], profile["name"]),
        "minecraft_uuid": profile["id"],
        "minecraft_username": profile["name"]
    }
