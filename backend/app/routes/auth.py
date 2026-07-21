import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.middleware.auth import verify_microsoft_token, create_jwt
from app.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    ms_access_token: str

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest):
    try:
        profile = await verify_microsoft_token(body.ms_access_token)
    except Exception:
        logger.exception("Microsoft auth failed during login")
        raise HTTPException(401, "Microsoft authentication failed")
    return {
        "token": create_jwt(profile["id"], profile["name"]),
        "minecraft_uuid": profile["id"],
        "minecraft_username": profile["name"],
        "mc_access_token": profile["_mc_access_token"],
        "mc_expires_in": 86400
    }

@router.post("/refresh")
@limiter.limit("20/minute")
async def refresh(request: Request, body: LoginRequest):
    try:
        profile = await verify_microsoft_token(body.ms_access_token)
    except Exception:
        logger.exception("Microsoft auth failed during refresh")
        raise HTTPException(401, "Token refresh failed")
    return {
        "token": create_jwt(profile["id"], profile["name"]),
        "minecraft_uuid": profile["id"],
        "minecraft_username": profile["name"],
        "mc_access_token": profile["_mc_access_token"],
        "mc_expires_in": 86400
    }
