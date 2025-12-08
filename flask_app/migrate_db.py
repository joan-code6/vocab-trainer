"""
Database migration script to add negative_streak column
Run this once to update your existing database
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'app.db')

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if column exists
        cursor.execute("PRAGMA table_info(user_word_stats)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'negative_streak' not in columns:
            print("Adding negative_streak column...")
            cursor.execute("ALTER TABLE user_word_stats ADD COLUMN negative_streak INTEGER DEFAULT 0")
            conn.commit()
            print("✓ Successfully added negative_streak column")
        else:
            print("✓ negative_streak column already exists")
            
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()
else:
    print("No database found. It will be created when you start the app.")
