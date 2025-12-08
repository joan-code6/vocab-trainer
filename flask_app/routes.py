from flask import render_template, flash, redirect, url_for, request, jsonify
from app import app, db
from models import User, Lesson, Word, UserWordStats
from flask_login import current_user, login_user, logout_user, login_required
from urllib.parse import urlparse
import json
import os
import random

@app.route('/')
@login_required
def index():
    lessons = Lesson.query.all()
    return render_template('index.html', lessons=lessons)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user is None or not user.check_password(password):
            flash('Invalid username or password')
            return redirect(url_for('login'))
        login_user(user)
        next_page = request.args.get('next')
        if not next_page or urlparse(next_page).netloc != '':
            next_page = url_for('index')
        return redirect(next_page)
    return render_template('login.html')

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if User.query.filter_by(username=username).first():
            flash('Username already exists')
            return redirect(url_for('register'))
        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        flash('Congratulations, you are now a registered user!')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/api/get_words', methods=['POST'])
@login_required
def get_words():
    data = request.get_json()
    lesson_ids = data.get('lessons', [])
    last_word_id = data.get('last_word_id', None)
    
    if not lesson_ids:
        return jsonify([])

    # Fetch words from selected lessons
    words = Word.query.filter(Word.lesson_id.in_(lesson_ids)).all()
    
    # Build word list with weights based on confidence
    # Lower confidence = higher weight (more likely to appear)
    word_pool = []
    
    for word in words:
        # Skip the last shown word to prevent immediate repetition
        if last_word_id and word.id == last_word_id:
            continue
            
        stats = UserWordStats.query.filter_by(user_id=current_user.id, word_id=word.id).first()
        confidence = stats.confidence if stats else 0.0
        streak = stats.streak if stats else 0
        negative_streak = stats.negative_streak if stats else 0
        
        word_data = {
            'id': word.id,
            'latin': word.latin,
            'german': word.german,
            'confidence': confidence
        }
        
        # Calculate weight: inverse of confidence
        # confidence 0.0 -> weight = 10 (very likely to appear)
        # confidence 0.5 -> weight = 5
        # confidence 0.875 -> weight = 1.25
        # confidence 1.0 -> weight = 1 (still shows but less often)
        weight = max(1.0, 10 * (1 - confidence))
        
        # EXTREME BOOST for negative streaks (repeatedly failed words)
        # This heavily prioritizes struggling words until streak reaches 2
        if negative_streak >= 3 and streak < 2:
            weight *= 5.0  # 5x boost for 3+ consecutive failures
        elif negative_streak == 2 and streak < 2:
            weight *= 3.0  # 3x boost for 2 consecutive failures
        elif negative_streak == 1 and streak < 2:
            weight *= 2.0  # 2x boost for 1 failure
        
        # Add streak bonus: words on a good streak (1-2) get a small boost
        # This helps reinforce recently learned words without overdoing it
        if streak == 1:
            weight *= 1.3  # 30% boost for streak 1 (just learned)
        elif streak == 2:
            weight *= 1.15  # 15% boost for streak 2 (reinforcement)
        # No bonus for streak 0 (unknown) or streak 3+ (well known)
        
        word_pool.append((word_data, weight))
    
    # Select words using weighted random selection
    batch_size = min(20, len(word_pool))
    
    if not word_pool:
        return jsonify([])
    
    # Weighted random selection without replacement
    selected_words = []
    available_pool = word_pool.copy()
    
    for _ in range(batch_size):
        if not available_pool:
            break
            
        # Extract words and weights
        pool_words = [item[0] for item in available_pool]
        weights = [item[1] for item in available_pool]
        
        # Random weighted choice
        chosen_word = random.choices(pool_words, weights=weights, k=1)[0]
        selected_words.append(chosen_word)
        
        # Remove chosen word from pool
        available_pool = [(w, wt) for w, wt in available_pool if w['id'] != chosen_word['id']]
    
    # Shuffle final order
    random.shuffle(selected_words)
    
    return jsonify(selected_words)

@app.route('/api/submit_result', methods=['POST'])
@login_required
def submit_result():
    data = request.get_json()
    word_id = data.get('word_id')
    is_correct = data.get('correct')
    
    stats = UserWordStats.query.filter_by(user_id=current_user.id, word_id=word_id).first()
    if not stats:
        stats = UserWordStats(user_id=current_user.id, word_id=word_id)
        db.session.add(stats)
    
    stats.add_attempt(is_correct)
    db.session.commit()
    
    # Calculate new overall progress for the user's current lessons
    # We'll return it so the frontend can update the progress bar
    return jsonify({'status': 'success', 'new_confidence': stats.confidence})

@app.route('/api/get_progress', methods=['POST'])
@login_required
def get_progress():
    data = request.get_json()
    lesson_ids = data.get('lessons', [])
    
    if not lesson_ids:
        return jsonify({'progress': 0.0})
    
    # Fetch all words from selected lessons
    words = Word.query.filter(Word.lesson_id.in_(lesson_ids)).all()
    
    if not words:
        return jsonify({'progress': 0.0})
    
    # Calculate average confidence
    total_confidence = 0.0
    for word in words:
        stats = UserWordStats.query.filter_by(user_id=current_user.id, word_id=word.id).first()
        confidence = stats.confidence if stats else 0.0
        total_confidence += confidence
    
    average_confidence = total_confidence / len(words)
    
    return jsonify({'progress': average_confidence})

@app.route('/import_data')
@login_required
def import_data():
    # This is a helper to import the existing JSON files
    # In a real app, you might want to secure this or run it as a script
    base_path = os.path.dirname(os.path.abspath(__file__))
    # Assuming json files are in the parent directory or a specific data folder
    # The user has files like L14.json in the root of the workspace
    # Let's look in the parent directory of flask_app
    workspace_root = os.path.dirname(base_path)
    
    imported_count = 0
    
    # List all files in workspace root
    for filename in os.listdir(workspace_root):
        if filename.startswith('L') and filename.endswith('.json') and 'LT' not in filename:
            lesson_name = filename.replace('.json', '')
            
            # Create or get lesson
            lesson = Lesson.query.filter_by(name=lesson_name).first()
            if not lesson:
                lesson = Lesson(name=lesson_name)
                db.session.add(lesson)
                db.session.commit()
            
            # Read file
            try:
                with open(os.path.join(workspace_root, filename), 'r', encoding='utf-8') as f:
                    words_data = json.load(f)
                    
                    for w in words_data:
                        # Check if word exists
                        existing_word = Word.query.filter_by(lesson_id=lesson.id, latin=w['latein']).first()
                        if not existing_word:
                            new_word = Word(lesson_id=lesson.id, latin=w['latein'], german=w['deutsch'])
                            db.session.add(new_word)
                            imported_count += 1
                    db.session.commit()
            except Exception as e:
                print(f"Error importing {filename}: {e}")
                
    flash(f"Imported {imported_count} words successfully.")
    return redirect(url_for('index'))
