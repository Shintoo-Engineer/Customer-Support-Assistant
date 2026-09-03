import os
import json
from app.models.database import SessionLocal
from app.models.simulator import Session, Conversation, Message, Scenario


def export_session_log(session_id: int, output_dir: str = "logs/simulator") -> str:
    """Exports a single simulator session log to a JSON file.

    Args:
        session_id: The ID of the session to export.
        output_dir: Directory path where the JSON file will be written.

    Returns:
        The written file path.

    Raises:
        ValueError: If the session does not exist.
    """
    db = SessionLocal()

    try:
        session_row = (
            db.query(Session)
            .filter(Session.session_id == session_id)
            .first()
        )

        if not session_row:
            raise ValueError(f"Session with id {session_id} not found.")

        scenario_row = None
        if session_row.scenario_id:
            scenario_row = (
                db.query(Scenario)
                .filter(Scenario.scenario_id == session_row.scenario_id)
                .first()
            )

        conversation_row = (
            db.query(Conversation)
            .filter(Conversation.session_id == session_row.session_id)
            .first()
        )

        messages = []
        if conversation_row:
            messages = (
                db.query(Message)
                .filter(Message.conversation_id == conversation_row.conversation_id)
                .order_by(Message.message_id.asc())
                .all()
            )

        turn_count = sum(
            1 for m in messages if m.sender_type == "Customer"
        )

        log_data = {
            "session_id": session_row.session_id,
            "scenario_title": scenario_row.title if scenario_row else None,
            "scenario_category": scenario_row.category if scenario_row else None,
            "status": session_row.status,
            "start_time": (
                session_row.start_time.isoformat()
                if session_row.start_time
                else None
            ),
            "end_time": (
                session_row.end_time.isoformat()
                if session_row.end_time
                else None
            ),
            "turn_count": turn_count,
            "messages": [
                {
                    "message_id": m.message_id,
                    "sender_type": m.sender_type,
                    "message_text": m.message_text,
                    "message_type": m.message_type,
                    "timestamp": (
                        m.timestamp.isoformat()
                        if m.timestamp
                        else None
                    ),
                }
                for m in messages
            ],
        }

        os.makedirs(output_dir, exist_ok=True)
        file_path = os.path.join(output_dir, f"session_{session_id}.json")

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(log_data, f, indent=2, ensure_ascii=False)

        return file_path

    finally:
        db.close()


def export_all_completed_sessions(output_dir: str = "logs/simulator") -> list[str]:
    """Exports all completed simulator sessions to JSON files.

    Args:
        output_dir: Directory path where JSON files will be written.

    Returns:
        List of written file paths.
    """
    db = SessionLocal()

    try:
        completed_sessions = (
            db.query(Session)
            .filter(Session.status == "Completed")
            .order_by(Session.session_id.asc())
            .all()
        )

        exported_paths = []
        for s in completed_sessions:
            path = export_session_log(s.session_id, output_dir=output_dir)
            exported_paths.append(path)

        return exported_paths

    finally:
        db.close()


if __name__ == "__main__":
    print("Exporting completed simulator session logs...")
    paths = export_all_completed_sessions()

    if not paths:
        print("No completed simulator sessions found to export.")
    else:
        print(f"Successfully exported {len(paths)} session log(s):")
        for p in paths:
            print(f" - {p}")
