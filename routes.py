from flask import Blueprint, render_template, request, jsonify, redirect, url_for, session, g
import sqlite3
from models import (
    User, AppUsage, BrowsingHistory, 
    LocationService, Geofence, Message, Notification
)
from auth import login_required, is_parent
import json
from datetime import datetime

# Will be imported later to avoid circular imports
handle_client_location = None

main_bp = Blueprint('main', __name__)

@main_bp.before_request
def load_logged_in_user():
    user_id = session.get('user_id')
    if user_id is None:
        g.user = None
    else:
        g.user = User.get_by_id(user_id)

@main_bp.route('/')
def index():
    if g.user:
        if g.user['role'] == 'parent':
            return redirect(url_for('main.parent_dashboard'))
        else:
            return redirect(url_for('main.child_home'))
    return redirect(url_for('auth.login'))

# Parent routes
@main_bp.route('/parent/dashboard')
@login_required
@is_parent
def parent_dashboard():
    children = User.get_children(g.user['id'])
    return render_template('parent/dashboard.html', user=g.user, children=children)

@main_bp.route('/parent/location')
@login_required
@is_parent
def parent_location():
    children = User.get_children(g.user['id'])
    return render_template('parent/location.html', user=g.user, children=children)

@main_bp.route('/parent/messaging')
@login_required
@is_parent
def parent_messaging():
    children = User.get_children(g.user['id'])
    return render_template('parent/messaging.html', user=g.user, children=children)

@main_bp.route('/parent/settings')
@login_required
@is_parent
def parent_settings():
    children = User.get_children(g.user['id'])
    return render_template('parent/settings.html', user=g.user, children=children)

# Child routes
@main_bp.route('/child/home')
@login_required
def child_home():
    return render_template('child/home.html', user=g.user)

@main_bp.route('/child/messaging')
@login_required
def child_messaging():
    parent = User.get_by_id(g.user['parent_id'])
    return render_template('child/messaging.html', user=g.user, parent=parent)

# API Routes
@main_bp.route('/api/usage/log', methods=['POST'])
@login_required
def log_app_usage():
    data = request.json
    app_name = data.get('app_name')
    usage_time = data.get('usage_time')  # in seconds
    
    if not app_name or not usage_time:
        return jsonify({'error': 'Missing required fields'}), 400
    
    AppUsage.log_usage(g.user['id'], app_name, usage_time)
    return jsonify({'success': True})

@main_bp.route('/api/usage/daily/<int:child_id>')
@login_required
@is_parent
def get_daily_usage(child_id):
    # Verify this child belongs to the parent
    child = User.get_by_id(child_id)
    if not child or child['parent_id'] != g.user['id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
    usage_data = AppUsage.get_daily_usage(child_id, date)
    
    return jsonify(usage_data)

@main_bp.route('/api/usage/weekly/<int:child_id>')
@login_required
@is_parent
def get_weekly_usage(child_id):
    # Verify this child belongs to the parent
    child = User.get_by_id(child_id)
    if not child or child['parent_id'] != g.user['id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    usage_data = AppUsage.get_weekly_usage(child_id)
    
    return jsonify(usage_data)

@main_bp.route('/api/browsing/log', methods=['POST'])
@login_required
def log_browsing():
    data = request.json
    url = data.get('url')
    title = data.get('title')
    
    if not url:
        return jsonify({'error': 'Missing required fields'}), 400
    
    BrowsingHistory.log_visit(g.user['id'], url, title)
    return jsonify({'success': True})

@main_bp.route('/api/browsing/history/<int:child_id>')
@login_required
@is_parent
def get_browsing_history(child_id):
    # Verify this child belongs to the parent
    child = User.get_by_id(child_id)
    if not child or child['parent_id'] != g.user['id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    limit = request.args.get('limit', 100, type=int)
    history = BrowsingHistory.get_history(child_id, limit)
    
    return jsonify(history)

@main_bp.route('/api/location/update', methods=['POST'])
@login_required
def update_location():
    data = request.json
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    
    if not latitude or not longitude:
        return jsonify({'error': 'Missing required fields'}), 400
    
    LocationService.update_location(g.user['id'], latitude, longitude)
    
    # Check geofences if user is a child
    if g.user['role'] == 'child' and handle_client_location is not None:
        handle_client_location(g.user['id'], latitude, longitude)
    
    return jsonify({'success': True})

@main_bp.route('/api/location/current/<int:child_id>')
@login_required
@is_parent
def get_current_location(child_id):
    # Verify this child belongs to the parent
    child = User.get_by_id(child_id)
    if not child or child['parent_id'] != g.user['id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    location = LocationService.get_current_location(child_id)
    
    if not location:
        return jsonify({'error': 'No location data available'}), 404
    
    return jsonify(location)

@main_bp.route('/api/location/history/<int:child_id>')
@login_required
@is_parent
def get_location_history(child_id):
    # Verify this child belongs to the parent
    child = User.get_by_id(child_id)
    if not child or child['parent_id'] != g.user['id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    limit = request.args.get('limit', 100, type=int)
    history = LocationService.get_location_history(child_id, limit)
    
    return jsonify(history)

@main_bp.route('/api/geofence/create', methods=['POST'])
@login_required
@is_parent
def create_geofence():
    data = request.json
    child_id = data.get('child_id')
    name = data.get('name')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    radius = data.get('radius')
    
    if not child_id or not name or not latitude or not longitude:
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Verify this child belongs to the parent
    child = User.get_by_id(child_id)
    if not child or child['parent_id'] != g.user['id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    geofence_id = Geofence.create(g.user['id'], child_id, name, latitude, longitude, radius)
    
    return jsonify({'success': True, 'geofence_id': geofence_id})

@main_bp.route('/api/geofence/list/<int:child_id>')
@login_required
def get_geofences(child_id):
    # Allow both parent and the child themselves to access
    if g.user['role'] == 'parent':
        # Verify this child belongs to the parent
        child = User.get_by_id(child_id)
        if not child or child['parent_id'] != g.user['id']:
            return jsonify({'error': 'Unauthorized'}), 403
    elif g.user['id'] != child_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    geofences = Geofence.get_by_child(child_id)
    
    return jsonify(geofences)

@main_bp.route('/api/geofence/update/<int:geofence_id>', methods=['POST'])
@login_required
@is_parent
def update_geofence(geofence_id):
    data = request.json
    name = data.get('name')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    radius = data.get('radius')
    is_active = data.get('is_active')
    
    success = Geofence.update(geofence_id, name, latitude, longitude, radius, is_active)
    
    if not success:
        return jsonify({'error': 'Geofence not found'}), 404
    
    return jsonify({'success': True})

@main_bp.route('/api/geofence/delete/<int:geofence_id>', methods=['POST'])
@login_required
@is_parent
def delete_geofence(geofence_id):
    success = Geofence.delete(geofence_id)
    
    if not success:
        return jsonify({'error': 'Geofence not found'}), 404
    
    return jsonify({'success': True})

@main_bp.route('/api/message/send', methods=['POST'])
@login_required
def send_message():
    data = request.json
    receiver_id = data.get('receiver_id')
    content = data.get('content')
    
    if not receiver_id or not content:
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Verify the receiver is related to this user
    receiver = User.get_by_id(receiver_id)
    if not receiver:
        return jsonify({'error': 'Receiver not found'}), 404
    
    if g.user['role'] == 'parent':
        # Parent can only message their children
        if receiver['parent_id'] != g.user['id']:
            return jsonify({'error': 'Unauthorized'}), 403
    else:
        # Child can only message their parent
        if receiver['id'] != g.user['parent_id']:
            return jsonify({'error': 'Unauthorized'}), 403
    
    message_id = Message.send(g.user['id'], receiver_id, content)
    
    # Create notification for the receiver
    sender_name = g.user['username']
    Notification.create(
        receiver_id, 
        f"New message from {sender_name}", 
        f"{sender_name}: {content[:50]}{'...' if len(content) > 50 else ''}"
    )
    
    return jsonify({'success': True, 'message_id': message_id})

@main_bp.route('/api/message/conversation/<int:other_id>')
@login_required
def get_conversation(other_id):
    # Verify the other user is related to this user
    other = User.get_by_id(other_id)
    if not other:
        return jsonify({'error': 'User not found'}), 404
    
    if g.user['role'] == 'parent':
        # Parent can only view conversations with their children
        if other['parent_id'] != g.user['id']:
            return jsonify({'error': 'Unauthorized'}), 403
    else:
        # Child can only view conversations with their parent
        if other['id'] != g.user['parent_id']:
            return jsonify({'error': 'Unauthorized'}), 403
    
    limit = request.args.get('limit', 50, type=int)
    messages = Message.get_conversation(g.user['id'], other_id, limit)
    
    # Mark messages as read
    for message in messages:
        if message['receiver_id'] == g.user['id'] and not message['is_read']:
            Message.mark_as_read(message['id'])
    
    return jsonify(messages)

@main_bp.route('/api/notification/list')
@login_required
def get_notifications():
    limit = request.args.get('limit', 20, type=int)
    notifications = Notification.get_for_user(g.user['id'], limit)
    
    return jsonify(notifications)

@main_bp.route('/api/notification/mark_read/<int:notification_id>', methods=['POST'])
@login_required
def mark_notification_read(notification_id):
    success = Notification.mark_as_read(notification_id)
    
    if not success:
        return jsonify({'error': 'Notification not found'}), 404
    
    return jsonify({'success': True})

@main_bp.route('/api/sos', methods=['POST'])
@login_required
def send_sos():
    if g.user['role'] != 'child':
        return jsonify({'error': 'Only children can send SOS alerts'}), 403
    
    parent_id = g.user['parent_id']
    if not parent_id:
        return jsonify({'error': 'No parent associated with this account'}), 400
    
    # Get current location
    location = LocationService.get_current_location(g.user['id'])
    
    # Create notification for parent
    message = f"EMERGENCY: {g.user['username']} has triggered an SOS alert!"
    if location:
        message += f" Last known location: {location['latitude']}, {location['longitude']}"
    
    notification_id = Notification.create(parent_id, "SOS EMERGENCY ALERT", message)
    
    # Also send a message to the parent
    Message.send(g.user['id'], parent_id, "SOS EMERGENCY: I need help!")
    
    return jsonify({'success': True, 'notification_id': notification_id})
