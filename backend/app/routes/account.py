from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.models.modpack import Modpack, ModpackMember, JoinRequest, AuditLog, Report
from app.middleware.auth import current_user
from app.audit import log_action

router = APIRouter(prefix="/account", tags=["account"])

ANONYMIZED_NAME = "[deleted user]"
ANONYMIZED_UUID = "deleted"


def get_session():
    from app.main import engine
    with Session(engine) as session:
        yield session


@router.delete("/me")
def delete_my_account(user=Depends(current_user), session: Session = Depends(get_session)):
    owned = session.exec(select(Modpack).where(Modpack.owner == user["uuid"])).all()
    if owned:
        names = ", ".join(p.name for p in owned)
        raise HTTPException(409, f"Transfer ownership or delete these packs first: {names}")

    memberships = session.exec(select(ModpackMember).where(
        ModpackMember.minecraft_uuid == user["uuid"]
    )).all()
    for m in memberships:
        # A truthful, visible record for the packs they're leaving — this
        # entry itself gets anonymized along with everything else below.
        log_action(session, m.pack_id, user, "member.account_deleted", target=user["name"])
        session.delete(m)

    requests = session.exec(select(JoinRequest).where(
        JoinRequest.minecraft_uuid == user["uuid"]
    )).all()
    for r in requests:
        session.delete(r)

    # Anonymize rather than delete: these rows live in *other people's* pack
    # activity logs and moderation records, so erasing them outright would
    # leave holes in someone else's history. Blanking the name satisfies the
    # actual privacy concern without doing that.
    audit_entries = session.exec(select(AuditLog).where(AuditLog.actor_uuid == user["uuid"])).all()
    for a in audit_entries:
        a.actor_username = ANONYMIZED_NAME
        a.actor_uuid = ANONYMIZED_UUID

    reports_filed = session.exec(select(Report).where(Report.reporter_uuid == user["uuid"])).all()
    for r in reports_filed:
        r.reporter_username = ANONYMIZED_NAME
        r.reporter_uuid = ANONYMIZED_UUID

    reports_about = session.exec(select(Report).where(Report.reported_uuid == user["uuid"])).all()
    for r in reports_about:
        r.reported_username = ANONYMIZED_NAME
        r.reported_uuid = ANONYMIZED_UUID

    session.commit()
    return {"ok": True}
