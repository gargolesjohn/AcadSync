from app.database import SessionLocal
from app.models.schedule import Schedule
from app.models.user import User
from app.api.schedules import get_pending_schedules

db = SessionLocal()
current_user = db.query(User).filter(User.name == 'Prof. Michael Lim').first()

# 1. Delete
s = db.query(Schedule).filter(Schedule.id == 4).first()
if s:
    db.delete(s)
    db.commit()
    print('Deleted Schedule 4')

# 2. Fetch Pending
res = get_pending_schedules(db=db, current_user=current_user)
for p in res['data']:
    print(f"{p['course_code']} - {p['scheduled_hours']}/{p['units']}")

# 3. Restore
if s:
    db.add(Schedule(id=4, user_id=s.user_id, course_code=s.course_code, course_label=s.course_label, day_of_week=s.day_of_week, start_time=s.start_time, end_time=s.end_time, room_location=s.room_location, section_or_instructor=s.section_or_instructor))
    db.commit()
    print('Restored Schedule 4')
