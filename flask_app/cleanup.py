from app import app, db
from models import Lesson

with app.app_context():
    lessons_to_delete = Lesson.query.filter(Lesson.name.like('Lektion%')).all()
    for lesson in lessons_to_delete:
        db.session.delete(lesson)
    db.session.commit()
    print("Deleted duplicate lessons")