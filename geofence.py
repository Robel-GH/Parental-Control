from models import Geofence
import math

def haversine_distance(lat1, lon1, lat2, lon2):
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
    r = 6371000  # Radius of earth in meters
    return c * r

def check_geofence_violations(user_id, latitude, longitude):
    """
    Check if a user's location violates any geofences.
    Returns a list of violated geofences.
    """
    geofences = Geofence.get_by_child(user_id)
    violations = []
    
    for geofence in geofences:
        distance = haversine_distance(
            float(latitude), float(longitude),
            float(geofence['latitude']), float(geofence['longitude'])
        )
        
        # If the distance is greater than the radius, the user is outside the geofence
        if distance > float(geofence['radius']):
            violations.append(geofence)
    
    return violations

def is_inside_geofence(latitude, longitude, geofence):
    """
    Check if a location is inside a specific geofence.
    Returns True if inside, False otherwise.
    """
    distance = haversine_distance(
        float(latitude), float(longitude),
        float(geofence['latitude']), float(geofence['longitude'])
    )
    
    # If the distance is less than or equal to the radius, the user is inside the geofence
    return distance <= float(geofence['radius'])
