import sqlite3
import time
from datetime import datetime, timedelta
import bcrypt
import jwt
from config import Config

def get_db_connection():
    conn = sqlite3.connect('parental_control.db')
    conn.row_factory = sqlite3.Row
    return conn

class User:
    @staticmethod
    def create(username, password, email, role, parent_id=None):
        # Hash the password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                'INSERT INTO users (username, password, email, role, parent_id) VALUES (?, ?, ?, ?, ?)',
                (username, hashed_password, email, role, parent_id)
            )
            conn.commit()
            user_id = cursor.lastrowid
            return user_id
        except sqlite3.IntegrityError:
            return None
        finally:
            conn.close()
    
    @staticmethod
    def authenticate(username, password):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        conn.close()
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
            return dict(user)
        return None
    
    @staticmethod
    def get_by_id(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if user:
            return dict(user)
        return None
    
    @staticmethod
    def get_children(parent_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE parent_id = ?', (parent_id,))
        children = cursor.fetchall()
        conn.close()
        
        return [dict(child) for child in children]

class AppUsage:
    @staticmethod
    def log_usage(user_id, app_name, usage_time, date=None):
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if entry exists for this app and date
        cursor.execute(
            'SELECT * FROM app_usage WHERE user_id = ? AND app_name = ? AND date = ?',
            (user_id, app_name, date)
        )
        existing = cursor.fetchone()
        
        if existing:
            # Update existing entry
            cursor.execute(
                'UPDATE app_usage SET usage_time = usage_time + ? WHERE id = ?',
                (usage_time, existing['id'])
            )
        else:
            # Create new entry
            cursor.execute(
                'INSERT INTO app_usage (user_id, app_name, usage_time, date) VALUES (?, ?, ?, ?)',
                (user_id, app_name, usage_time, date)
            )
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def get_daily_usage(user_id, date=None):
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT app_name, usage_time FROM app_usage WHERE user_id = ? AND date = ?',
            (user_id, date)
        )
        
        usage_data = cursor.fetchall()
        conn.close()
        
        return [dict(item) for item in usage_data]
    
    @staticmethod
    def get_weekly_usage(user_id):
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=6)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            SELECT date, SUM(usage_time) as total_time 
            FROM app_usage 
            WHERE user_id = ? AND date BETWEEN ? AND ?
            GROUP BY date
            ORDER BY date
            ''',
            (user_id, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
        )
        
        usage_data = cursor.fetchall()
        conn.close()
        
        return [dict(item) for item in usage_data]

class BrowsingHistory:
    @staticmethod
    def log_visit(user_id, url, title=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'INSERT INTO browsing_history (user_id, url, title) VALUES (?, ?, ?)',
            (user_id, url, title)
        )
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def get_history(user_id, limit=100):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT * FROM browsing_history WHERE user_id = ? ORDER BY visit_time DESC LIMIT ?',
            (user_id, limit)
        )
        
        history = cursor.fetchall()
        conn.close()
        
        return [dict(item) for item in history]

class LocationService:
    @staticmethod
    def update_location(user_id, latitude, longitude):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'INSERT INTO location_history (user_id, latitude, longitude) VALUES (?, ?, ?)',
            (user_id, latitude, longitude)
        )
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def get_current_location(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT * FROM location_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
            (user_id,)
        )
        
        location = cursor.fetchone()
        conn.close()
        
        return dict(location) if location else None
    
    @staticmethod
    def get_location_history(user_id, limit=100):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT * FROM location_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
            (user_id, limit)
        )
        
        history = cursor.fetchall()
        conn.close()
        
        return [dict(item) for item in history]

class Geofence:
    @staticmethod
    def create(parent_id, child_id, name, latitude, longitude, radius=None):
        if radius is None:
            radius = Config.DEFAULT_GEOFENCE_RADIUS
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            INSERT INTO geofences (parent_id, child_id, name, latitude, longitude, radius) 
            VALUES (?, ?, ?, ?, ?, ?)
            ''',
            (parent_id, child_id, name, latitude, longitude, radius)
        )
        
        conn.commit()
        geofence_id = cursor.lastrowid
        conn.close()
        
        return geofence_id
    
    @staticmethod
    def get_by_child(child_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM geofences WHERE child_id = ? AND is_active = 1', (child_id,))
        geofences = cursor.fetchall()
        conn.close()
        
        return [dict(item) for item in geofences]
    
    @staticmethod
    def update(geofence_id, name=None, latitude=None, longitude=None, radius=None, is_active=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get current geofence data
        cursor.execute('SELECT * FROM geofences WHERE id = ?', (geofence_id,))
        geofence = cursor.fetchone()
        
        if not geofence:
            conn.close()
            return False
        
        # Update only provided fields
        name = name if name is not None else geofence['name']
        latitude = latitude if latitude is not None else geofence['latitude']
        longitude = longitude if longitude is not None else geofence['longitude']
        radius = radius if radius is not None else geofence['radius']
        is_active = is_active if is_active is not None else geofence['is_active']
        
        cursor.execute(
            '''
            UPDATE geofences 
            SET name = ?, latitude = ?, longitude = ?, radius = ?, is_active = ?
            WHERE id = ?
            ''',
            (name, latitude, longitude, radius, is_active, geofence_id)
        )
        
        conn.commit()
        conn.close()
        
        return True
    
    @staticmethod
    def delete(geofence_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM geofences WHERE id = ?', (geofence_id,))
        conn.commit()
        conn.close()
        
        return True

class Message:
    @staticmethod
    def send(sender_id, receiver_id, content):
        if len(content) > Config.MAX_MESSAGE_LENGTH:
            return None
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
            (sender_id, receiver_id, content)
        )
        
        conn.commit()
        message_id = cursor.lastrowid
        conn.close()
        
        return message_id
    
    @staticmethod
    def get_conversation(user1_id, user2_id, limit=50):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            '''
            SELECT * FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
            ORDER BY timestamp DESC LIMIT ?
            ''',
            (user1_id, user2_id, user2_id, user1_id, limit)
        )
        
        messages = cursor.fetchall()
        conn.close()
        
        return [dict(message) for message in messages]
    
    @staticmethod
    def mark_as_read(message_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('UPDATE messages SET is_read = 1 WHERE id = ?', (message_id,))
        conn.commit()
        conn.close()
        
        return True
    
    @staticmethod
    def get_unread_count(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0',
            (user_id,)
        )
        
        result = cursor.fetchone()
        conn.close()
        
        return result['count'] if result else 0

class Notification:
    @staticmethod
    def create(user_id, title, message):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
            (user_id, title, message)
        )
        
        conn.commit()
        notification_id = cursor.lastrowid
        conn.close()
        
        return notification_id
    
    @staticmethod
    def get_for_user(user_id, limit=20):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?',
            (user_id, limit)
        )
        
        notifications = cursor.fetchall()
        conn.close()
        
        return [dict(notification) for notification in notifications]
    
    @staticmethod
    def mark_as_read(notification_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('UPDATE notifications SET is_read = 1 WHERE id = ?', (notification_id,))
        conn.commit()
        conn.close()
        
        return True
