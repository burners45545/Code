import os
import sys
import subprocess
import webbrowser
from time import sleep

def run_redis():
    print("Starting Redis...")
    try:
        subprocess.Popen(['redis-server'])
        sleep(2)  # Wait for Redis to start
    except FileNotFoundError:
        print("Redis not found. Please install Redis first.")
        sys.exit(1)

def run_elasticsearch():
    print("Starting Elasticsearch...")
    try:
        subprocess.Popen(['elasticsearch'])
        sleep(10)  # Wait for Elasticsearch to start
    except FileNotFoundError:
        print("Elasticsearch not found. Please install Elasticsearch first.")
        sys.exit(1)

def run_celery():
    print("Starting Celery worker...")
    subprocess.Popen(['celery', '-A', 'tasks', 'worker', '--loglevel=info'])

def start_server():
    # Get the path to the Python executable in the virtual environment
    if sys.platform == 'win32':
        python_path = os.path.join('venv', 'Scripts', 'python.exe')
    else:
        python_path = os.path.join('venv', 'bin', 'python')

    # Set environment variables to disable optional services
    env = os.environ.copy()
    env['USE_REDIS'] = 'false'
    env['USE_ELASTICSEARCH'] = 'false'

    print("Starting Flask server...")
    
    # Start the Flask server
    server_process = subprocess.Popen(
        [python_path, 'archive_server.py'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == 'win32' else 0
    )
    
    # Wait a bit for the server to start
    sleep(2)
    
    # Open the web interface
    webbrowser.open('http://localhost:5000')
    
    return server_process

if __name__ == '__main__':
    try:
        # Start the server
        server = start_server()
        
        print("\nServer is running!")
        print("Access the application at: http://localhost:5000")
        print("\nPress Ctrl+C to stop the server")
        
        # Keep the script running
        server.wait()
    except KeyboardInterrupt:
        # Handle clean shutdown
        server.terminate()
        print("\nServer stopped.") 