"""
Audit log write helper.

Lives at app root rather than under routes/ so every route module can import it
without a circular dependency through the router package.

log_action() only stages the row — the calling route commits. An audit entry can
therefore never outlive a transaction that rolled back.
"""
from sqlmodel import Session
from app.models.modpack import AuditLog


def log_action(
    session: Session,
    pack_id: str,
    user: dict,
    action: str,
    target: str = "",
    detail: str = "",
) -> None:
    session.add(
        AuditLog(
            pack_id=pack_id,
            actor_uuid=user["uuid"],
            actor_username=user["name"],
            action=action,
            target=target or "",
            detail=detail or "",
        )
    )
