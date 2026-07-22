from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import SQLModel, Session, create_engine, select
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.limiter import limiter
from app.routes import auth, modpacks, members, servers, external, audit, admin, account

engine = create_engine(settings.database_url)

app = FastAPI(
    title="MC Launcher API",
    version="0.2.0",
    docs_url="/docs" if settings.enable_docs else None,
    redoc_url="/redoc" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(modpacks.router)
app.include_router(members.router)
app.include_router(servers.router)
app.include_router(external.router)
app.include_router(audit.router)
app.include_router(admin.router)
app.include_router(account.router)


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)


@app.get("/health")
def health():
    # Touches the DB, not just the process, so a bad deploy (e.g. a
    # permissions mismatch on the bind-mounted file) fails the CI health
    # check instead of shipping silently.
    try:
        with Session(engine) as session:
            session.exec(select(1))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "db_unavailable"})
    return {"status": "ok"}
