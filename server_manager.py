import os
import sys
import subprocess
import signal
import json
import logging
import psutil
from pathlib import Path

logger = logging.getLogger(__name__)

class ServerManager:
    def __init__(self):
        self.pid_file = "server.pid"
        self.process = None
        self.python_executable = sys.executable
        
    def is_running(self):
        """Check if the server is running by checking the PID file and process"""
        if os.path.exists(self.pid_file):
            try:
                with open(self.pid_file, 'r') as f:
                    pid = int(f.read().strip())
                # Check if process is actually running
                process = psutil.Process(pid)
                return process.is_running() and "python" in process.name().lower()
            except (OSError, ValueError, psutil.NoSuchProcess):
                self._cleanup_pid_file()
        return False
        
    def start(self):
        """Start the server process"""
        if self.is_running():
            logger.info("Server is already running")
            return True
            
        try:
            # Start the server as a subprocess
            server_script = os.path.join(os.getcwd(), 'archive_server.py')
            
            # Use pythonw.exe on Windows to avoid console window
            if sys.platform == 'win32':
                python_exe = self.python_executable.replace('python.exe', 'pythonw.exe')
            else:
                python_exe = self.python_executable

            self.process = subprocess.Popen(
                [python_exe, server_script],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            )
            
            # Save PID to file
            with open(self.pid_file, 'w') as f:
                f.write(str(self.process.pid))
            
            logger.info(f"Server started with PID {self.process.pid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start server: {str(e)}")
            return False
            
    def stop(self):
        """Stop the server process"""
        if not self.is_running():
            logger.info("Server is not running")
            return True
            
        try:
            with open(self.pid_file, 'r') as f:
                pid = int(f.read().strip())
            
            # Try to terminate the process gracefully
            process = psutil.Process(pid)
            process.terminate()
            
            # Wait for the process to terminate
            try:
                process.wait(timeout=5)
            except psutil.TimeoutExpired:
                # Force kill if graceful termination fails
                process.kill()
            
            self._cleanup_pid_file()
            logger.info(f"Server stopped (PID: {pid})")
            return True
            
        except (OSError, ValueError, psutil.NoSuchProcess) as e:
            logger.error(f"Error stopping server: {str(e)}")
            self._cleanup_pid_file()
            return False
            
    def status(self):
        """Get the current server status"""
        is_running = self.is_running()
        pid = None
        
        if is_running:
            try:
                with open(self.pid_file, 'r') as f:
                    pid = int(f.read().strip())
            except (OSError, ValueError):
                pass
                
        return {
            'running': is_running,
            'pid': pid
        }
        
    def _cleanup_pid_file(self):
        """Remove the PID file"""
        try:
            if os.path.exists(self.pid_file):
                os.remove(self.pid_file)
        except OSError as e:
            logger.error(f"Error cleaning up PID file: {str(e)}") 