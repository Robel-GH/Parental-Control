from flask_socketio import emit, join_room, leave_room
from flask import request
from datetime import datetime
import math
import json

# Import app-related items at the module level
from models import User, Geofence, Notification, LocationService
from geofence import check_geofence_violations

# Make handle_client_location available to other modules
__all__ = ['handle_client_location']

connected_clients = {}  # Store connected websocket clients by user_id

# Will be imported from app.py to avoid circular imports
socketio = None

def init_socketio(socketio_instance):
    global socketio
    socketio = socketio_instance
    
    # Register event handlers
    socketio.on_event('connect', handle_connect)
    socketio.on_event('disconnect', handle_disconnect)
    socketio.on_event('register', handle_register)
    socketio.on_event('location_update', handle_location_update)
    socketio.on_event('message_sent', handle_message_sent)
    socketio.on_event('sos_alert', handle_sos_alert)

def handle_connect():
    print("Client connected")

def handle_disconnect():
    for user_id, sid in list(connected_clients.items()):
        if sid == request.sid:
            del connected_clients[user_id]
            break
    print("Client disconnected")

def handle_register(data):
    user_id = data.get('user_id')
    if user_id:
        connected_clients[user_id] = request.sid
        # Join a room specific to this user
        join_room(f"user_{user_id}")
        print(f"User {user_id} registered")

def handle_location_update(data):
    user_id = data.get('user_id')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    
    if user_id and latitude and longitude:
        # Update location in database
        LocationService.update_location(user_id, latitude, longitude)
        
        # Check geofences
        handle_client_location(user_id, latitude, longitude)

def handle_client_location(user_id, latitude, longitude):
    # Get user details
    user = User.get_by_id(user_id)
    if not user or user['role'] != 'child':
        return
    
    # Get parent ID
    parent_id = user['parent_id']
    if not parent_id:
        return
    
    # Check if parent is connected
    if parent_id in connected_clients:
        # Send location update to parent
        emit('child_location_update', {
            'child_id': user_id,
            'latitude': latitude,
            'longitude': longitude,
            'timestamp': str(datetime.now())
        }, room=f"user_{parent_id}")
    
    # Check geofence violations
    violations = check_geofence_violations(user_id, latitude, longitude)
    
    for violation in violations:
        # Create notification
        notification_id = Notification.create(
            parent_id,
            f"Geofence Alert: {user['username']}",
            f"{user['username']} has left the {violation['name']} geofence area"
        )
        
        # Send real-time notification if parent is connected
        if parent_id in connected_clients:
            emit('geofence_violation', {
                'child_id': user_id,
                'child_name': user['username'],
                'geofence_id': violation['id'],
                'geofence_name': violation['name'],
                'latitude': latitude,
                'longitude': longitude
            }, room=f"user_{parent_id}")

def handle_message_sent(data):
    sender_id = data.get('sender_id')
    receiver_id = data.get('receiver_id')
    content = data.get('content')
    message_id = data.get('message_id')
    
    # Notify receiver if they're connected
    if receiver_id in connected_clients:
        sender = User.get_by_id(sender_id)
        emit('new_message', {
            'sender_id': sender_id,
            'sender_name': sender['username'],
            'content': content,
            'message_id': message_id,
            'timestamp': str(datetime.now())
        }, room=f"user_{receiver_id}")

def handle_sos_alert(data):
    child_id = data.get('child_id')
    
    # Get user details
    user = User.get_by_id(child_id)
    if not user or user['role'] != 'child':
        return
    
    # Get parent ID
    parent_id = user['parent_id']
    if not parent_id:
        return
    
    # Get current location
    location = LocationService.get_current_location(child_id)
    
    # Notify parent if connected
    if parent_id in connected_clients:
        sos_data = {
            'child_id': child_id,
            'child_name': user['username'],
            'timestamp': str(datetime.now())
        }
        
        if location:
            sos_data.update({
                'latitude': location['latitude'],
                'longitude': location['longitude']
            })
        
        emit('sos_emergency', sos_data, room=f"user_{parent_id}")
