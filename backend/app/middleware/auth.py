from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from datetime import datetime, timedelta
import httpx
from app.config import settings

bearer = HTTPBearer()

async def verify_microsoft_token(ms_token: str) -> dict:
    async with httpx.AsyncClient() as c:
        xbl_res = await c.post("https://user.auth.xboxlive.com/user/authenticate", json={
            "Properties": {"AuthMethod": "RPS", "SiteName": "user.auth.xboxlive.com", "RpsTicket": f"d={ms_token}"},
            "RelyingParty": "http://auth.xboxlive.com", "TokenType": "JWT"
        })
        xbl = xbl_res.json()
        xbl_token = xbl["Token"]
        user_hash = xbl["DisplayClaims"]["xui"][0]["uhs"]

        xsts_res = await c.post("https://xsts.auth.xboxlive.com/xsts/authorize", json={
            "Properties": {"SandboxId": "RETAIL", "UserTokens": [xbl_token]},
            "RelyingParty": "rp://api.minecraftservices.com/", "TokenType": "JWT"
        })
        xsts_token = xsts_res.json()["Token"]

        mc_res = await c.post("https://api.minecraftservices.com/authentication/login_with_xbox", json={
            "identityToken": f"XBL3.0 x={user_hash};{xsts_token}"
        })
        print("Minecraft auth response:", mc_res.status_code, mc_res.text)
        mc_data = mc_res.json()
        mc_token = mc_data["access_token"]

        profile_res = await c.get("https://api.minecraftservices.com/minecraft/profile",
                                   headers={"Authorization": f"Bearer {mc_token}"})
        print("Minecraft profile response:", profile_res.status_code, profile_res.text)
        profile = profile_res.json()
        profile["_mc_access_token"] = mc_token
        return profile

def create_jwt(mc_uuid: str, mc_name: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": mc_uuid, "name": mc_name, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Every authenticated request passes through here, which makes this the
    # one place a platform-wide ban can actually be enforced everywhere at once.
    from sqlmodel import Session, select
    from app.main import engine
    from app.models.modpack import BannedUser
    with Session(engine) as session:
        banned = session.exec(select(BannedUser).where(BannedUser.minecraft_uuid == payload["sub"])).first()
        if banned:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been banned")

    return {"uuid": payload["sub"], "name": payload["name"]}
