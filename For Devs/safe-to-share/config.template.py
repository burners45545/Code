"""
Configuration template for URL Counter Tool
Replace these values with your actual configuration
DO NOT commit actual API keys or sensitive data
"""

# Server Configuration
SERVER_CONFIG = {
    'host': 'localhost',
    'port': 5000,
    'debug': False
}

# Database Configuration
DB_CONFIG = {
    'db_name': 'urls.db',
    'connection_string': 'sqlite:///urls.db'
}

# API Keys (Replace with your actual keys)
API_KEYS = {
    'archive_service': 'your_archive_service_key_here',
    'analytics_service': 'your_analytics_key_here'
}

# Feature Flags
FEATURES = {
    'enable_elasticsearch': False,
    'enable_redis': False,
    'enable_ml_analysis': True
}

# Logging Configuration
LOGGING = {
    'level': 'INFO',
    'file': 'logs/app.log',
    'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
}

# Cache Configuration
CACHE_CONFIG = {
    'type': 'file',
    'directory': 'cache',
    'max_size': 1000000  # 1MB
}

# Security Settings
SECURITY = {
    'allowed_origins': ['http://localhost:5000'],
    'rate_limit': 100,  # requests per minute
    'require_https': True
} 