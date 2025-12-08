from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), index=True, unique=True)
    password_hash = db.Column(db.String(128))
    stats = db.relationship('UserWordStats', backref='user', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Lesson(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True)
    words = db.relationship('Word', backref='lesson', lazy='dynamic')

class Word(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lesson.id'))
    latin = db.Column(db.String(128))
    german = db.Column(db.String(128))
    stats = db.relationship('UserWordStats', backref='word', lazy='dynamic')

class UserWordStats(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    word_id = db.Column(db.Integer, db.ForeignKey('word.id'))
    correct_count = db.Column(db.Integer, default=0)
    wrong_count = db.Column(db.Integer, default=0)
    last_reviewed = db.Column(db.DateTime, default=datetime.utcnow)
    # Store last 3 attempts as a string, e.g., "101" (1=correct, 0=wrong)
    last_attempts = db.Column(db.String(10), default="") 
    streak = db.Column(db.Integer, default=0)
    negative_streak = db.Column(db.Integer, default=0)  # Track consecutive failures

    def add_attempt(self, is_correct):
        if self.correct_count is None: self.correct_count = 0
        if self.wrong_count is None: self.wrong_count = 0
        if self.streak is None: self.streak = 0
        if self.negative_streak is None: self.negative_streak = 0
        if self.last_attempts is None: self.last_attempts = ""

        if is_correct:
            self.correct_count += 1
            self.streak += 1
            self.negative_streak = 0  # Reset negative streak on success
            result = "1"
        else:
            self.wrong_count += 1
            self.streak = 0
            self.negative_streak += 1  # Increment negative streak on failure
            result = "0"
        
        self.last_reviewed = datetime.utcnow()
        self.last_attempts = (self.last_attempts + result)[-3:] # Keep only last 3

    @property
    def confidence(self):
        # Steep learning curve based on streak
        # Streak 0: 0.0
        # Streak 1: 0.5
        # Streak 2: 0.75
        # Streak 3: 0.875
        # Streak 4: 0.9375
        # This ensures that even if you failed 10 times (streak 0), 
        # one correct answer brings you back to 0.5 immediately.
        if self.streak == 0:
            return 0.0
        
        return 1.0 - (0.5 ** self.streak)
