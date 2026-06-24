from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from app.config import settings

bearer = HTTPBearer()

async def verify_microsoft_token(ms_token: str) -> dict:
    async with httpx.AsyncClient() as c:
        xbl = (await c.post("https://user.auth.xboxlive.com/user/authenticate", json={
            "Properties": {"AuthMethod": "RPS", "SiteName": "user.auth.xboxlive.com", "RpsTicket": f"d={ms_token}"},
            "RelyingParty": "http://auth.xboxlive.com", "TokenType": "JWT"
        })).json()
        xbl_token = xbl["Token"]
        user_hash = xbl["DisplayClaims"]["xui"][0]["uhs"]

        xsts_token = (await c.post("https://xsts.auth.xboxlive.com/xsts/authorize", json={
            "Properties": {"SandboxId": "RETAIL", "UserTokens": [xbl_token]},
            "RelyingParty": "rp://api.minecraftservices.com/", "TokenType": "JWT"
        })).json()["Token"]

        mc_token = (await c.post("https://api.minecraftservices.com/authentication/login_with_xbox", json={
            "identityToken": f"XBL3.0 x={user_hash};{xsts_token}"
        })).json()["access_token"]

        return (await c.get("https://api.minecraftservices.com/minecraft/profile",
                             headers={"Authorization": f"Bearer {mc_token}"})).json()

def create_jwt(mc_uuid: str, mc_name: str) -> str:
    return jwt.encode({"sub": mc_uuid, "name": mc_name}, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return {"uuid": payload["sub"], "name": payload["name"]}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
