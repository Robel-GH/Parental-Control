import os
import secrets

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
    DATABASE_PATH = 'parental_control.db'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or secrets.token_hex(32)
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hour
    # Geo-fencing settings
    DEFAULT_GEOFENCE_RADIUS = 500  # meters
    # Messaging settings
    MAX_MESSAGE_LENGTH = 1000
