"""
ALFRED Logging System
Comprehensive logging with rotation and detailed tracking
"""

import logging
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, List
import threading
import traceback
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
import time


class AlfredLogger:
    """Enhanced logger for ALFRED with detailed tracking"""
    
    def __init__(self, log_dir: Optional[str] = None):
        # Set up log directory
        if log_dir:
            self.log_dir = Path(log_dir)
        else:
            self.log_dir = Path.home() / ".alfred" / "logs"
        
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Create different loggers for different purposes
        self.main_logger = self._setup_logger("alfred_main", "alfred.log")
        self.request_logger = self._setup_logger("alfred_requests", "requests.log")
        self.error_logger = self._setup_logger("alfred_errors", "errors.log")
        self.performance_logger = self._setup_logger("alfred_performance", "performance.log")
        
        # Session tracking
        self.session_id = self._generate_session_id()
        self.request_counter = 0
        self.request_lock = threading.Lock()
        
        # Start cleanup thread
        self._start_cleanup_thread()
        
        self.log_info("ALFRED Logger initialized", {"session_id": self.session_id})
    
    def _setup_logger(self, name: str, filename: str) -> logging.Logger:
        """Set up individual logger with rotation"""
        logger = logging.getLogger(name)
        logger.setLevel(logging.DEBUG)
        
        # Remove existing handlers
        logger.handlers = []
        
        # File handler with rotation (10MB per file, keep 10 files)
        file_handler = RotatingFileHandler(
            self.log_dir / filename,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=10,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        
        # Detailed formatter
        formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S.%f'[:-3]
        )
        file_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        
        # Also add console handler for errors
        if name == "alfred_errors":
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.ERROR)
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)
        
        return logger
    
    def _generate_session_id(self) -> str:
        """Generate unique session ID"""
        import uuid
        return str(uuid.uuid4())[:8]
    
    def _get_request_id(self) -> str:
        """Generate unique request ID"""
        with self.request_lock:
            self.request_counter += 1
            return f"{self.session_id}-{self.request_counter:04d}"
    
    def log_info(self, message: str, data: Optional[Dict[str, Any]] = None):
        """Log general information"""
        log_entry = self._create_log_entry(message, data)
        self.main_logger.info(json.dumps(log_entry))
    
    def log_warning(self, message: str, data: Optional[Dict[str, Any]] = None):
        """Log warning"""
        log_entry = self._create_log_entry(message, data)
        self.main_logger.warning(json.dumps(log_entry))
    
    def log_error(self, message: str, error: Optional[Exception] = None, 
                  data: Optional[Dict[str, Any]] = None):
        """Log error with full traceback"""
        error_data = data or {}
        
        if error:
            error_data.update({
                "error_type": type(error).__name__,
                "error_message": str(error),
                "traceback": traceback.format_exc()
            })
        
        log_entry = self._create_log_entry(message, error_data)
        self.error_logger.error(json.dumps(log_entry))
    
    def log_request_start(self, request_type: str, model: str, 
                         prompt_preview: str, context_files: List[str] = None) -> str:
        """Log start of request to Ollama"""
        request_id = self._get_request_id()
        
        data = {
            "request_id": request_id,
            "request_type": request_type,
            "model": model,
            "prompt_preview": prompt_preview[:200] + "..." if len(prompt_preview) > 200 else prompt_preview,
            "prompt_length": len(prompt_preview),
            "context_files_count": len(context_files) if context_files else 0,
            "context_files": context_files or [],
            "stage": "START"
        }
        
        log_entry = self._create_log_entry(f"Request started: {request_type}", data)
        self.request_logger.info(json.dumps(log_entry))
        
        # Also log performance start
        self.performance_logger.info(json.dumps({
            "request_id": request_id,
            "start_time": datetime.now().isoformat(),
            "stage": "START"
        }))
        
        return request_id
    
    def log_request_progress(self, request_id: str, stage: str, details: Dict[str, Any]):
        """Log progress of request"""
        data = {
            "request_id": request_id,
            "stage": stage,
            **details
        }
        
        log_entry = self._create_log_entry(f"Request progress: {stage}", data)
        self.request_logger.info(json.dumps(log_entry))
    
    def log_request_end(self, request_id: str, success: bool, 
                       response_preview: Optional[str] = None,
                       error: Optional[str] = None,
                       duration: Optional[float] = None):
        """Log end of request"""
        data = {
            "request_id": request_id,
            "success": success,
            "stage": "END",
            "duration_seconds": duration
        }
        
        if success and response_preview:
            data["response_preview"] = response_preview[:200] + "..." if len(response_preview) > 200 else response_preview
            data["response_length"] = len(response_preview)
        elif error:
            data["error"] = error
        
        log_entry = self._create_log_entry(
            f"Request {'completed' if success else 'failed'}", data
        )
        self.request_logger.info(json.dumps(log_entry))
        
        # Log performance
        self.performance_logger.info(json.dumps({
            "request_id": request_id,
            "end_time": datetime.now().isoformat(),
            "duration_seconds": duration,
            "success": success,
            "stage": "END"
        }))
    
    def log_connection_status(self, status: str, details: Dict[str, Any]):
        """Log connection status changes"""
        data = {
            "connection_status": status,
            **details
        }
        
        log_entry = self._create_log_entry(f"Connection status: {status}", data)
        self.main_logger.info(json.dumps(log_entry))
    
    def _create_log_entry(self, message: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create structured log entry"""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "session_id": self.session_id,
            "message": message
        }
        
        if data:
            entry["data"] = data
        
        return entry
    
    def _start_cleanup_thread(self):
        """Start background thread for log cleanup"""
        def cleanup_old_logs():
            while True:
                try:
                    # Run cleanup once per day
                    time.sleep(86400)  # 24 hours
                    self._cleanup_old_logs()
                except Exception as e:
                    self.log_error("Error in log cleanup", error=e)
        
        cleanup_thread = threading.Thread(target=cleanup_old_logs, daemon=True)
        cleanup_thread.start()
    
    def _cleanup_old_logs(self):
        """Remove logs older than 3 days"""
        cutoff_time = datetime.now() - timedelta(days=3)
        
        for log_file in self.log_dir.glob("*.log*"):
            try:
                # Check file modification time
                mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
                if mtime < cutoff_time:
                    log_file.unlink()
                    self.log_info(f"Deleted old log file: {log_file.name}")
            except Exception as e:
                self.log_error(f"Error deleting log file: {log_file}", error=e)
    
    def get_recent_errors(self, hours: int = 1) -> List[Dict[str, Any]]:
        """Get recent errors for diagnostics"""
        errors = []
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        try:
            error_log = self.log_dir / "errors.log"
            if error_log.exists():
                with open(error_log, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            # Parse log line
                            if " | ERROR " in line:
                                parts = line.split(" | ", 3)
                                if len(parts) >= 4:
                                    timestamp_str = parts[0]
                                    timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')
                                    
                                    if timestamp > cutoff_time:
                                        # Parse JSON data
                                        json_data = json.loads(parts[3])
                                        errors.append(json_data)
                        except:
                            continue
        except Exception as e:
            self.log_error("Error reading error log", error=e)
        
        return errors
    
    def get_request_history(self, hours: int = 1) -> List[Dict[str, Any]]:
        """Get recent request history"""
        requests = []
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        try:
            request_log = self.log_dir / "requests.log"
            if request_log.exists():
                with open(request_log, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            if " | INFO " in line:
                                parts = line.split(" | ", 3)
                                if len(parts) >= 4:
                                    timestamp_str = parts[0]
                                    timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S.%f')
                                    
                                    if timestamp > cutoff_time:
                                        json_data = json.loads(parts[3])
                                        requests.append(json_data)
                        except:
                            continue
        except Exception as e:
            self.log_error("Error reading request log", error=e)
        
        return requests
    
    def analyze_recent_failures(self) -> Dict[str, Any]:
        """Analyze recent failures for patterns"""
        errors = self.get_recent_errors(hours=24)
        requests = self.get_request_history(hours=24)
        
        # Count failures by type
        failure_types = {}
        timeout_count = 0
        connection_errors = 0
        
        for error in errors:
            if 'data' in error and 'error_type' in error['data']:
                error_type = error['data']['error_type']
                failure_types[error_type] = failure_types.get(error_type, 0) + 1
                
                if 'timeout' in str(error['data'].get('error_message', '')).lower():
                    timeout_count += 1
                if error_type == 'ConnectionError':
                    connection_errors += 1
        
        # Analyze request patterns
        total_requests = 0
        failed_requests = 0
        
        for req in requests:
            if 'data' in req and 'stage' in req['data']:
                if req['data']['stage'] == 'START':
                    total_requests += 1
                elif req['data']['stage'] == 'END' and not req['data'].get('success', True):
                    failed_requests += 1
        
        return {
            "summary": {
                "total_errors": len(errors),
                "timeout_errors": timeout_count,
                "connection_errors": connection_errors,
                "total_requests": total_requests,
                "failed_requests": failed_requests,
                "success_rate": ((total_requests - failed_requests) / total_requests * 100) if total_requests > 0 else 0
            },
            "error_types": failure_types,
            "recent_errors": errors[-5:] if errors else []
        }


# Global logger instance
_logger_instance = None

def get_logger() -> AlfredLogger:
    """Get or create logger instance"""
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = AlfredLogger()
    return _logger_instance