from datetime import datetime, timedelta
import math

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points
    on the earth (specified in decimal degrees)
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r

def is_point_in_geofence(lat, lon, fence_lat, fence_lon, radius_km):
    """Check if a point is within a circular geofence"""
    distance = calculate_distance(lat, lon, fence_lat, fence_lon)
    return distance <= radius_km

def format_duration(seconds):
    """Format seconds into a readable duration string"""
    if seconds < 60:
        return f"{seconds} seconds"
    
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} minutes"
    
    hours = minutes // 60
    minutes = minutes % 60
    if hours < 24:
        return f"{hours} hours, {minutes} minutes"
    
    days = hours // 24
    hours = hours % 24
    return f"{days} days, {hours} hours, {minutes} minutes"

def get_date_range(days):
    """Get a list of dates for the past N days"""
    today = datetime.utcnow().date()
    date_list = []
    
    for i in range(days):
        date = today - timedelta(days=i)
        date_list.append(date.strftime('%Y-%m-%d'))
    
    # Return in chronological order
    return date_list[::-1]

def validate_email(email):
    """Simple email validation"""
    import re
    pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """
    Validate password strength
    - At least 8 characters
    - Contains at least one digit
    - Contains at least one uppercase letter
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    
    if not any(char.isdigit() for char in password):
        return False, "Password must contain at least one digit"
    
    if not any(char.isupper() for char in password):
        return False, "Password must contain at least one uppercase letter"
    
    return True, "Password is valid"
