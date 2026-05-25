import json
from typing import Dict, List, Optional
from fastapi import WebSocket
from sqlalchemy.orm import Session
from app.security import decode_token
from app.database import SessionLocal
from app.models.user import User
from app.utils.constants import ROLE_STUDENT, ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD, ROLE_ADMIN, ROLE_REGISTRAR, TARGET_ALL, TARGET_FACULTY, TARGET_STUDENTS

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> list of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Stores user details (role, department_section) for active connections
        self.connection_users: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket, token: str) -> Optional[str]:
        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                await websocket.close(code=4003, reason="Invalid token type")
                return None
            user_id = payload.get("sub")
            if not user_id:
                await websocket.close(code=4003, reason="Invalid user ID in token")
                return None
            
            # Fetch user details to determine role/section for announcement filtering
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if not user or not user.is_active:
                    await websocket.close(code=4003, reason="User inactive or not found")
                    return None
                user_info = {
                    "id": user.id,
                    "role": user.role,
                    "department_section": user.department_section or ""
                }
            finally:
                db.close()

            await websocket.accept()
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            self.active_connections[user_id].append(websocket)
            self.connection_users[websocket] = user_info
            print(f"[WS] User {user_id} connected. Active connections count: {len(self.active_connections[user_id])}")
            return user_id
        except Exception as e:
            print(f"[WS] Connection authentication failed: {e}")
            try:
                await websocket.close(code=4003, reason="Authentication failed")
            except Exception:
                pass
            return None

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        if websocket in self.connection_users:
            del self.connection_users[websocket]
        print(f"[WS] User {user_id} disconnected.")

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"[WS] Error sending to user {user_id}: {e}")

    async def notify_new_message(self, recipient_id: str, message_data: dict):
        payload = {
            "type": "new_message",
            "data": message_data
        }
        await self.send_to_user(recipient_id, payload)

    async def notify_new_announcement(self, announcement_data: dict):
        target_aud = announcement_data.get("target_audience", TARGET_ALL)
        target_cls = announcement_data.get("target_class")
        author_id = announcement_data.get("author_id")

        def get_dept(s: str) -> str:
            if not s: return ""
            s = s.upper()
            if any(x in s for x in ["BSCS", "BSIT", "ICS", "IT"]): return "ICS"
            if any(x in s for x in ["BSBA", "IBE"]): return "IBE"
            if any(x in s for x in ["BSE", "ITE"]): return "ITE"
            return s

        payload = {
            "type": "new_announcement",
            "data": announcement_data
        }

        print(f"[WS] Broadcasting announcement {announcement_data.get('id')} targets: aud={target_aud}, class={target_cls}")
        for user_id, connections in list(self.active_connections.items()):
            for conn in list(connections):
                user_info = self.connection_users.get(conn)
                if not user_info:
                    continue
                
                # Check if this user should receive it
                should_receive = False
                u_role = user_info["role"]
                u_dept_sec = user_info["department_section"]

                # Author always gets their own notifications
                if user_info["id"] == author_id:
                    should_receive = True
                # Admins and registrars get all announcements
                elif u_role in (ROLE_ADMIN, ROLE_REGISTRAR):
                    should_receive = True
                elif u_role == ROLE_STUDENT:
                    if target_aud in (TARGET_ALL, TARGET_STUDENTS):
                        if not target_cls:
                            should_receive = True
                        else:
                            u_dept = get_dept(u_dept_sec)
                            if (target_cls.strip().lower() == u_dept_sec.strip().lower() or
                                target_cls.strip().lower() == u_dept.strip().lower()):
                                should_receive = True
                elif u_role in (ROLE_INSTRUCTOR, ROLE_PROGRAM_HEAD):
                    if target_aud in (TARGET_ALL, TARGET_FACULTY):
                        should_receive = True

                if should_receive:
                    try:
                        await conn.send_json(payload)
                        print(f"[WS] Delivered announcement to connected user {user_info['id']}")
                    except Exception as e:
                        print(f"[WS] Failed to send announcement to user {user_info['id']}: {e}")

    async def notify_grade_updated(self, grade_data: dict):
        payload = {
            "type": "grade_updated",
            "data": grade_data
        }
        student_id = grade_data.get("student_id")
        professor_id = grade_data.get("professor_id")

        for user_id, connections in list(self.active_connections.items()):
            for conn in list(connections):
                user_info = self.connection_users.get(conn)
                if not user_info:
                    continue

                should_receive = (
                    user_info["id"] in (student_id, professor_id)
                    or user_info["role"] in (ROLE_ADMIN, ROLE_REGISTRAR)
                )

                if should_receive:
                    try:
                        await conn.send_json(payload)
                    except Exception as e:
                        print(f"[WS] Failed to send grade update to user {user_info['id']}: {e}")

    async def notify_assignment_updated(self, assignment_data: dict):
        payload = {
            "type": "assignment_updated",
            "data": assignment_data
        }
        instructor_id = assignment_data.get("instructor_id")
        student_id = assignment_data.get("student_id")

        for user_id, connections in list(self.active_connections.items()):
            for conn in list(connections):
                user_info = self.connection_users.get(conn)
                if not user_info:
                    continue

                should_receive = (
                    user_info["id"] in (instructor_id, student_id)
                    or user_info["role"] in (ROLE_ADMIN, ROLE_REGISTRAR)
                )

                if should_receive:
                    try:
                        await conn.send_json(payload)
                    except Exception as e:
                        print(f"[WS] Failed to send assignment update to user {user_info['id']}: {e}")

manager = ConnectionManager()
