"""Logging configuration."""

import logging
import logging.handlers
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional


class ColoredFormatter(logging.Formatter):
    """Custom formatter with color support."""
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',    # Cyan
        'INFO': '\033[32m',     # Green
        'WARNING': '\033[33m',  # Yellow
        'ERROR': '\033[31m',    # Red
        'CRITICAL': '\033[35m', # Magenta
    }
    RESET = '\033[0m'
    
    def format(self, record):
        # Add color to level name if in terminal
        if hasattr(sys.stdout, 'isatty') and sys.stdout.isatty():
            levelname = record.levelname
            if levelname in self.COLORS:
                record.levelname = f"{self.COLORS[levelname]}{levelname}{self.RESET}"
                
        result = super().format(record)
        
        # Reset level name
        record.levelname = logging.getLevelName(record.levelno)
        
        return result


def setup_logging(
    level: int = logging.INFO,
    log_file: Optional[Path] = None,
    log_dir: Optional[Path] = None,
    app_name: str = "alfred"
) -> None:
    """Setup logging configuration."""
    
    # Create formatters
    console_formatter = ColoredFormatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s'
    )
    
    # Setup root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Remove existing handlers
    root_logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # File handler
    if log_file or log_dir:
        if log_file:
            file_path = log_file
        else:
            # Create log directory if needed
            log_dir = Path(log_dir)
            log_dir.mkdir(parents=True, exist_ok=True)
            
            # Create log file with timestamp
            timestamp = datetime.now().strftime("%Y%m%d")
            file_path = log_dir / f"{app_name}_{timestamp}.log"
            
        # Create rotating file handler
        file_handler = logging.handlers.RotatingFileHandler(
            file_path,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)  # Log everything to file
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)
        
    # Set levels for specific loggers
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("aiohttp").setLevel(logging.WARNING)
    
    # Log startup message
    logger = logging.getLogger(__name__)
    logger.info(f"Logging initialized - Level: {logging.getLevelName(level)}")
    if log_file or log_dir:
        logger.info(f"Log file: {file_path}")


class RequestLogger:
    """Logger for tracking AI requests."""
    
    def __init__(self, log_file: Optional[Path] = None):
        self.logger = logging.getLogger("alfred.requests")
        
        if log_file:
            handler = logging.FileHandler(log_file)
            handler.setFormatter(logging.Formatter(
                '%(asctime)s - %(message)s'
            ))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
            
    def log_request(self, request_id: str, prompt: str, model: str):
        """Log an AI request."""
        self.logger.info(f"Request {request_id} - Model: {model} - Prompt: {prompt[:100]}...")
        
    def log_response(self, request_id: str, response: str, duration: float):
        """Log an AI response."""
        self.logger.info(f"Response {request_id} - Duration: {duration:.2f}s - Response: {response[:100]}...")
        
    def log_error(self, request_id: str, error: str):
        """Log an error."""
        self.logger.error(f"Error {request_id} - {error}")