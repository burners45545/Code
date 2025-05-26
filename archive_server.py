from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import os
import logging
from logging.handlers import RotatingFileHandler
import json
import signal
import sys
import traceback
import requests
from urllib.parse import urlparse, urljoin
import time

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Configure logging
if not os.path.exists('logs'):
    os.makedirs('logs')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            os.path.join('logs', 'archive_server.log'),
            maxBytes=10485760,  # 10MB
            backupCount=3
        ),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Server status tracking
server_status = {
    'status': 'stopped',
    'pid': None,
    'error': None
}

def create_archive(url):
    """Create an archive.ph snapshot of a URL"""
    try:
        # First, try to submit the URL to archive.ph
        archive_url = "https://archive.ph/submit/"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        data = {'url': url}
        
        response = requests.post(archive_url, headers=headers, data=data, allow_redirects=True)
        
        # If we get redirected, that's the archive URL
        if response.history:
            return response.url
        else:
            logger.error(f"Failed to create archive for {url}: No redirect received")
            return None
    except Exception as e:
        logger.error(f"Error creating archive for {url}: {str(e)}")
        return None

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info("Received shutdown signal")
    server_status.update({
        'status': 'stopped',
        'pid': None,
        'error': None
    })
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/health')
def health_check():
    try:
        return jsonify({
            'status': 'healthy',
            'server_status': server_status['status'],
            'pid': server_status['pid']
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/api/server/status', methods=['GET'])
def get_server_status():
    try:
        if server_status['status'] == 'stopped':
            # Check if we should update status to running
            server_status.update({
                'status': 'running',
                'pid': os.getpid(),
                'error': None
            })
        return jsonify(server_status), 200
    except Exception as e:
        logger.error(f"Error getting server status: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/api/server/start', methods=['POST'])
def start_server():
    try:
        if server_status['status'] == 'stopped':
            server_status.update({
                'status': 'running',
                'pid': os.getpid(),
                'error': None
            })
            logger.info("Server started")
        return jsonify(server_status), 200
    except Exception as e:
        logger.error(f"Error starting server: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/api/server/stop', methods=['POST'])
def stop_server():
    try:
        server_status.update({
            'status': 'stopped',
            'pid': None,
            'error': None
        })
        logger.info("Server stopped")
        return jsonify(server_status), 200
    except Exception as e:
        logger.error(f"Error stopping server: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500

@app.route('/api/archive', methods=['POST'])
def archive_url():
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({'error': 'No URL provided'}), 400
        
        url = data['url']
        if not url:
            return jsonify({'error': 'Empty URL provided'}), 400
        
        # Create archive
        archive_url = create_archive(url)
        if archive_url:
            return jsonify({
                'status': 'success',
                'archive_url': archive_url
            }), 200
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to create archive'
            }), 500
    except Exception as e:
        logger.error(f"Error in archive_url endpoint: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.errorhandler(Exception)
def handle_error(error):
    logger.error(f"Unhandled error: {str(error)}\n{traceback.format_exc()}")
    return jsonify({
        'error': str(error),
        'status': 'error'
    }), 500

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

if __name__ == '__main__':
    try:
        logger.info("Starting URL Counter Tool server...")
        server_status.update({
            'status': 'running',
            'pid': os.getpid(),
            'error': None
        })
        # Add a startup message to console
        print("Starting server on http://localhost:5000")
        print("Press Ctrl+C to stop the server")
        app.run(host='0.0.0.0', port=5000, debug=False)
    except Exception as e:
        error_msg = f"Failed to start server: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_msg)
        server_status.update({
            'status': 'error',
            'error': str(e)
        })
        print(error_msg)
        sys.exit(1) 