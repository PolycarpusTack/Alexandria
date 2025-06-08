"""
Enterprise Code Factory 9000 Pro - AI Logger Module
---------------------------------------------------
Logging system for AI interactions with enhanced features
for enterprise-level tracking, analysis, and compliance.

Author: Enhanced by Claude
Date: April 10, 2025
"""

import json
import logging
import hashlib
import uuid
import os
import sys
import datetime
import time
import threading
import re
import gzip
import shutil
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Union, Any, Set, Tuple
from dataclasses import dataclass, field, asdict
from contextlib import contextmanager
import concurrent.futures

# Set up module logger
logger = logging.getLogger(__name__)


class LogLevel(Enum):
    """Log levels for AI interactions"""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ReviewStatus(Enum):
    """Review status options for AI interactions"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    MODIFIED = "modified"
    NEEDS_REVIEW = "needs_review"


@dataclass
class AIInteraction:
    """Structured representation of an AI interaction"""
    prompt: str
    response: str
    timestamp: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    interaction_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    model: str = ""
    files_affected: List[str] = field(default_factory=list)
    quality_checks: List[Dict[str, Any]] = field(default_factory=list)
    review_status: str = "pending"
    review_comment: str = ""
    reviewed_by: str = ""
    review_timestamp: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    session_id: str = ""
    duration_ms: int = 0
    token_count: int = 0
    token_input_count: int = 0
    token_output_count: int = 0
    user: str = ""
    client_info: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AIInteraction':
        """Create instance from dictionary"""
        # Filter only the fields that exist in the dataclass
        valid_fields = {k: v for k, v in data.items() if k in cls.__annotations__}
        return cls(**valid_fields)


class LogRotationPolicy:
    """Policies for log file rotation"""
    
    @staticmethod
    def should_rotate_by_size(file_path: Path, max_size_mb: float = 10.0) -> bool:
        """Check if file should be rotated based on size"""
        if not file_path.exists():
            return False
        
        size_mb = file_path.stat().st_size / (1024 * 1024)
        return size_mb >= max_size_mb
    
    @staticmethod
    def should_rotate_by_time(file_path: Path, max_age_days: int = 7) -> bool:
        """Check if file should be rotated based on age"""
        if not file_path.exists():
            return False
        
        file_time = datetime.datetime.fromtimestamp(file_path.stat().st_mtime)
        current_time = datetime.datetime.now()
        age_days = (current_time - file_time).days
        
        return age_days >= max_age_days
    
    @staticmethod
    def rotate_file(file_path: Path, compress: bool = True, 
                  max_backups: int = 5) -> Optional[Path]:
        """
        Rotate a log file
        
        Args:
            file_path: Path to the file to rotate
            compress: Whether to compress the rotated file
            max_backups: Maximum number of backup files to keep
            
        Returns:
            Path to the rotated file or None on failure
        """
        if not file_path.exists():
            return None
        
        try:
            # Generate rotated filename with timestamp
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            rotated_path = file_path.with_suffix(f".{timestamp}{file_path.suffix}")
            
            # Rename current file to rotated name
            shutil.copy2(file_path, rotated_path)
            
            # Compress if requested
            if compress:
                compressed_path = rotated_path.with_suffix(".gz")
                with open(rotated_path, 'rb') as f_in:
                    with gzip.open(compressed_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                
                # Remove uncompressed rotated file
                rotated_path.unlink()
                rotated_path = compressed_path
            
            # Truncate original file
            with open(file_path, 'w') as f:
                pass
            
            # Clean up old backups if needed
            backup_pattern = f"{file_path.stem}.*{file_path.suffix}"
            if file_path.suffix == ".gz":
                backup_pattern = f"{file_path.stem}.*"
            
            backups = sorted(file_path.parent.glob(backup_pattern))
            
            if len(backups) > max_backups:
                for old_backup in backups[:-max_backups]:
                    old_backup.unlink()
            
            return rotated_path
        except Exception as e:
            logger.error(f"Error rotating log file {file_path}: {str(e)}")
            return None


class AILogger:
    """
    Enhanced logging system for AI interactions with advanced features for 
    enterprise-level tracking, analysis, and compliance.
    """
    
    def __init__(self, project_root: Union[str, Path], 
               session_id: Optional[str] = None,
               user: str = "",
               compress_logs: bool = False,
               encryption_key: Optional[str] = None,
               max_log_size_mb: float = 10.0,
               auto_rotate: bool = True):
        """
        Initialize the AI Logger
        
        Args:
            project_root: Root directory of the project
            session_id: Optional session ID (auto-generated if None)
            user: User identifier
            compress_logs: Whether to compress logs
            encryption_key: Optional key for encrypting sensitive data
            max_log_size_mb: Maximum log file size before rotation
            auto_rotate: Whether to automatically rotate logs
        """
        self.project_root = Path(project_root)
        self.log_dir = self.project_root / "logs"
        self.log_dir.mkdir(exist_ok=True, parents=True)
        
        # Create sessions directory
        self.sessions_dir = self.log_dir / "sessions"
        self.sessions_dir.mkdir(exist_ok=True)
        
        # Create additional log directories
        self.analytics_dir = self.log_dir / "analytics"
        self.analytics_dir.mkdir(exist_ok=True)
        
        self.archive_dir = self.log_dir / "archive"
        self.archive_dir.mkdir(exist_ok=True)
        
        # Generate or use provided session ID
        self.session_id = session_id or f"s{uuid.uuid4().hex[:12]}"
        
        # Set up session file
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_file = self.sessions_dir / f"session_{self.session_id}_{timestamp}.jsonl"
        
        # Set up the main log file (for aggregated logs)
        self.main_log_file = self.log_dir / "ai_interactions.jsonl"
        
        # Configuration
        self.user = user
        self.compress_logs = compress_logs
        self.encryption_key = encryption_key
        self.max_log_size_mb = max_log_size_mb
        self.auto_rotate = auto_rotate
        
        # Thread lock for thread safety
        self._lock = threading.RLock()
        
        # Set up thread pool for async operations
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        
        # Initialize counters
        self.interaction_count = 0
        self.session_start_time = datetime.datetime.now()
        
        logger.info(f"AILogger initialized with session ID: {self.session_id}")
        
        # Create session start marker
        self._log_session_event("session_start")
    
    def log_interaction(self, prompt: str, response: str, files_affected: List[str],
                      model: str = "", duration_ms: int = 0, 
                      token_count: int = 0, quality_checks: Optional[List[Dict[str, Any]]] = None,
                      tags: Optional[List[str]] = None,
                      metadata: Optional[Dict[str, Any]] = None,
                      level: LogLevel = LogLevel.INFO) -> str:
        """
        Log an AI interaction with detailed tracking
        
        Args:
            prompt: User input prompt
            response: AI-generated response
            files_affected: List of files affected by the interaction
            model: AI model used
            duration_ms: Response time in milliseconds
            token_count: Total token count
            quality_checks: List of quality check results
            tags: List of tags for categorization
            metadata: Additional metadata to include
            level: Log level for the interaction
            
        Returns:
            Interaction ID
        """
        # Check if log directory exists
        if not self.log_dir.exists():
            self.log_dir.mkdir(exist_ok=True, parents=True)
            self.sessions_dir.mkdir(exist_ok=True)
        
        # Create interaction object with all metadata
        interaction = AIInteraction(
            prompt=prompt,
            response=response,
            timestamp=datetime.datetime.now().isoformat(),
            interaction_id=str(uuid.uuid4()),
            model=model,
            files_affected=files_affected,
            quality_checks=quality_checks or [],
            tags=tags or [],
            session_id=self.session_id,
            duration_ms=duration_ms,
            token_count=token_count,
            user=self.user,
            client_info=self._get_client_info()
        )
        
        # Add custom metadata if provided
        if metadata:
            interaction_dict = interaction.to_dict()
            interaction_dict.update(metadata)
            interaction = AIInteraction.from_dict(interaction_dict)
        
        # Log the interaction to files
        with self._lock:
            # Check if we need to rotate logs
            if self.auto_rotate:
                self._rotate_logs_if_needed()
            
            # Write to session file
            interaction_json = json.dumps(interaction.to_dict())
            self._write_to_log(self.session_file, interaction_json)
            
            # Also write to main log file
            self._write_to_log(self.main_log_file, interaction_json)
            
            # Track analytics
            self._update_analytics(interaction)
            
            # Increment counter
            self.interaction_count += 1
        
        # Log to Python logger as well based on level
        log_message = f"AI Interaction: {interaction.interaction_id[:8]} - Prompt: {prompt[:50]}..."
        if level == LogLevel.DEBUG:
            logger.debug(log_message)
        elif level == LogLevel.INFO:
            logger.info(log_message)
        elif level == LogLevel.WARNING:
            logger.warning(log_message)
        elif level == LogLevel.ERROR:
            logger.error(log_message)
        elif level == LogLevel.CRITICAL:
            logger.critical(log_message)
        
        return interaction.interaction_id
    
    def log_interaction_async(self, prompt: str, response: str, files_affected: List[str],
                           **kwargs) -> concurrent.futures.Future:
        """
        Log an interaction asynchronously
        
        Args:
            prompt: User prompt
            response: AI response
            files_affected: Affected files
            **kwargs: Additional arguments for log_interaction
            
        Returns:
            Future object with interaction ID as result
        """
        return self._executor.submit(
            self.log_interaction, 
            prompt, 
            response, 
            files_affected, 
            **kwargs
        )
    
    def get_review_history(self, limit: int = 100, 
                         session_only: bool = True, 
                         review_status: Optional[str] = None,
                         tags: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Get history of AI interactions with filtering options
        
        Args:
            limit: Maximum number of interactions to return
            session_only: Whether to limit to current session
            review_status: Filter by review status
            tags: Filter by tags
            
        Returns:
            List of interaction dictionaries
        """
        try:
            # Choose which log file to read
            log_file = self.session_file if session_only else self.main_log_file
            
            if not log_file.exists():
                return []
            
            interactions = []
            
            with open(log_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        interaction = json.loads(line)
                        
                        # Apply filters
                        if review_status and interaction.get("review_status") != review_status:
                            continue
                        
                        if tags:
                            interaction_tags = set(interaction.get("tags", []))
                            if not all(tag in interaction_tags for tag in tags):
                                continue
                        
                        # Only include actual interactions (not session events)
                        if "prompt" in interaction and "response" in interaction:
                            interactions.append(interaction)
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON in log file: {line[:50]}...")
            
            # Sort by timestamp (newest first) and limit
            interactions.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            return interactions[:limit]
        except Exception as e:
            logger.error(f"Error reading interaction history: {str(e)}")
            return []
    
    def get_interaction_by_id(self, interaction_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific interaction by ID
        
        Args:
            interaction_id: The ID of the interaction to retrieve
            
        Returns:
            Interaction dictionary or None if not found
        """
        # Try session file first
        interaction = self._find_interaction_in_log(self.session_file, interaction_id)
        
        # If not found, try main log file
        if not interaction and self.main_log_file.exists():
            interaction = self._find_interaction_in_log(self.main_log_file, interaction_id)
        
        return interaction
    
    def update_review_status(self, interaction_id: str, status: Union[str, ReviewStatus], 
                           comment: str = "", reviewer: str = "") -> bool:
        """
        Update the review status of an interaction
        
        Args:
            interaction_id: ID of the interaction to update
            status: New review status
            comment: Review comment
            reviewer: Reviewer identifier
            
        Returns:
            True if update was successful, False otherwise
        """
        if isinstance(status, ReviewStatus):
            status_value = status.value
        else:
            try:
                status_value = ReviewStatus(status).value
            except ValueError:
                status_value = status
        
        # Find the interaction
        interaction = self.get_interaction_by_id(interaction_id)
        if not interaction:
            logger.warning(f"Interaction not found: {interaction_id}")
            return False
        
        # Update the fields
        updated_interaction = interaction.copy()
        updated_interaction["review_status"] = status_value
        updated_interaction["review_comment"] = comment
        updated_interaction["reviewed_by"] = reviewer
        updated_interaction["review_timestamp"] = datetime.datetime.now().isoformat()
        
        # Write changes to both log files
        with self._lock:
            session_updated = self._update_interaction_in_log(
                self.session_file, interaction_id, updated_interaction
            )
            
            main_updated = self._update_interaction_in_log(
                self.main_log_file, interaction_id, updated_interaction
            )
        
        return session_updated or main_updated
    
    def add_tags(self, interaction_id: str, tags: List[str]) -> bool:
        """
        Add tags to an interaction
        
        Args:
            interaction_id: ID of the interaction
            tags: List of tags to add
            
        Returns:
            True if successful, False otherwise
        """
        interaction = self.get_interaction_by_id(interaction_id)
        if not interaction:
            logger.warning(f"Interaction not found: {interaction_id}")
            return False
        
        # Update tags
        current_tags = set(interaction.get("tags", []))
        updated_tags = list(current_tags.union(tags))
        
        # Update the interaction
        updated_interaction = interaction.copy()
        updated_interaction["tags"] = updated_tags
        
        # Write changes to both log files
        with self._lock:
            session_updated = self._update_interaction_in_log(
                self.session_file, interaction_id, updated_interaction
            )
            
            main_updated = self._update_interaction_in_log(
                self.main_log_file, interaction_id, updated_interaction
            )
        
        return session_updated or main_updated
    
    def get_session_stats(self) -> Dict[str, Any]:
        """
        Get statistics for the current session
        
        Returns:
            Dictionary with session statistics
        """
        stats = {
            "session_id": self.session_id,
            "start_time": self.session_start_time.isoformat(),
            "duration_seconds": (datetime.datetime.now() - self.session_start_time).total_seconds(),
            "interaction_count": self.interaction_count,
            "user": self.user,
            "project": self.project_root.name
        }
        
        # Get more detailed stats from log file
        if self.session_file.exists():
            try:
                interactions = self.get_review_history(limit=1000, session_only=True)
                
                # Calculate statistics
                if interactions:
                    total_duration_ms = sum(i.get("duration_ms", 0) for i in interactions)
                    total_tokens = sum(i.get("token_count", 0) for i in interactions)
                    
                    stats.update({
                        "total_duration_ms": total_duration_ms,
                        "avg_duration_ms": total_duration_ms / len(interactions) if interactions else 0,
                        "total_tokens": total_tokens,
                        "avg_tokens": total_tokens / len(interactions) if interactions else 0,
                        "files_affected": len(set(f for i in interactions for f in i.get("files_affected", []))),
                        "models_used": list(set(i.get("model", "") for i in interactions if i.get("model"))),
                        "review_status_counts": self._count_review_statuses(interactions)
                    })
            except Exception as e:
                logger.error(f"Error calculating session stats: {str(e)}")
        
        return stats
    
    def export_session_log(self, output_path: Optional[Path] = None, 
                         format: str = "jsonl",
                         include_responses: bool = True) -> Optional[Path]:
        """
        Export session log to a file
        
        Args:
            output_path: Path to export to (default: project_root/exports)
            format: Export format ('jsonl', 'json', or 'csv')
            include_responses: Whether to include full AI responses
            
        Returns:
            Path to exported file or None on failure
        """
        if not self.session_file.exists():
            logger.warning(f"Session file does not exist: {self.session_file}")
            return None
        
        # Create exports directory if not specified
        if output_path is None:
            exports_dir = self.project_root / "exports"
            exports_dir.mkdir(exist_ok=True)
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = exports_dir / f"session_export_{self.session_id}_{timestamp}.{format}"
        
        try:
            interactions = self.get_review_history(limit=10000, session_only=True)
            
            # Process interactions (remove or truncate responses if needed)
            if not include_responses:
                for interaction in interactions:
                    interaction["response"] = "[RESPONSE EXCLUDED]"
            
            if format == "jsonl":
                with open(output_path, "w") as f:
                    for interaction in interactions:
                        f.write(json.dumps(interaction) + "\n")
            
            elif format == "json":
                with open(output_path, "w") as f:
                    json.dump(interactions, f, indent=2)
            
            elif format == "csv":
                import csv
                
                # Flatten the structure for CSV
                flattened = []
                for interaction in interactions:
                    flat_interaction = {
                        "interaction_id": interaction.get("interaction_id", ""),
                        "timestamp": interaction.get("timestamp", ""),
                        "prompt": interaction.get("prompt", ""),
                        "model": interaction.get("model", ""),
                        "duration_ms": interaction.get("duration_ms", 0),
                        "token_count": interaction.get("token_count", 0),
                        "review_status": interaction.get("review_status", ""),
                        "files_affected": ",".join(interaction.get("files_affected", [])),
                        "tags": ",".join(interaction.get("tags", []))
                    }
                    
                    if include_responses:
                        flat_interaction["response"] = interaction.get("response", "")
                    
                    flattened.append(flat_interaction)
                
                with open(output_path, "w", newline="") as f:
                    if flattened:
                        writer = csv.DictWriter(f, fieldnames=flattened[0].keys())
                        writer.writeheader()
                        writer.writerows(flattened)
            
            logger.info(f"Session log exported to: {output_path}")
            return output_path
        
        except Exception as e:
            logger.error(f"Error exporting session log: {str(e)}")
            return None
    
    def end_session(self) -> Dict[str, Any]:
        """
        End the current logging session and return stats
        
        Returns:
            Session statistics
        """
        # Log session end event
        self._log_session_event("session_end")
        
        # Get final stats
        stats = self.get_session_stats()
        
        # Write stats to analytics file
        analytics_file = self.analytics_dir / "session_stats.jsonl"
        with open(analytics_file, "a") as f:
            f.write(json.dumps(stats) + "\n")
        
        logger.info(f"Session {self.session_id} ended with {stats['interaction_count']} interactions")
        
        # Clean up resources
        if hasattr(self, "_executor"):
            self._executor.shutdown(wait=True)
        
        return stats
    
    def compress_old_logs(self, days_threshold: int = 7) -> int:
        """
        Compress logs older than the specified threshold
        
        Args:
            days_threshold: Age in days after which logs should be compressed
            
        Returns:
            Number of files compressed
        """
        compressed_count = 0
        
        try:
            # Find all .jsonl files in log directories
            log_files = list(self.log_dir.rglob("*.jsonl"))
            log_files += list(self.sessions_dir.rglob("*.jsonl"))
            
            current_time = datetime.datetime.now()
            threshold = current_time - datetime.timedelta(days=days_threshold)
            
            for file_path in log_files:
                if not file_path.exists():
                    continue
                
                # Check file modification time
                mod_time = datetime.datetime.fromtimestamp(file_path.stat().st_mtime)
                
                if mod_time < threshold:
                    # Compress the file
                    compressed_path = file_path.with_suffix(".jsonl.gz")
                    
                    with open(file_path, 'rb') as f_in:
                        with gzip.open(compressed_path, 'wb') as f_out:
                            shutil.copyfileobj(f_in, f_out)
                    
                    # Remove original file
                    file_path.unlink()
                    compressed_count += 1
                    
                    logger.info(f"Compressed old log file: {file_path}")
            
            return compressed_count
        
        except Exception as e:
            logger.error(f"Error compressing old logs: {str(e)}")
            return compressed_count
    
    def _write_to_log(self, log_file: Path, content: str) -> bool:
        """
        Write content to a log file
        
        Args:
            log_file: Path to log file
            content: Content to write
            
        Returns:
            True on success, False on failure
        """
        try:
            # Ensure parent directory exists
            log_file.parent.mkdir(exist_ok=True, parents=True)
            
            # Write content (append mode)
            with open(log_file, "a") as f:
                f.write(content + "\n")
            
            return True
        except Exception as e:
            logger.error(f"Error writing to log file {log_file}: {str(e)}")
            return False
    
    def _encrypt_sensitive_data(self, data: str) -> str:
        """
        Encrypt sensitive data if encryption key is available
        
        Args:
            data: Data to encrypt
            
        Returns:
            Encrypted or original data
        """
        if not self.encryption_key:
            return data
        
        try:
            # Simple XOR encryption (in a real system, use proper encryption)
            key_bytes = self.encryption_key.encode()
            data_bytes = data.encode()
            
            # Ensure key is at least as long as data by repeating if needed
            key_repeated = key_bytes * (len(data_bytes) // len(key_bytes) + 1)
            key_repeated = key_repeated[:len(data_bytes)]
            
            # XOR encryption
            encrypted_bytes = bytes(a ^ b for a, b in zip(data_bytes, key_repeated))
            
            # Convert to hex string for storage
            return encrypted_bytes.hex()
        except Exception as e:
            logger.error(f"Encryption error: {str(e)}")
            return data
    
    def _decrypt_sensitive_data(self, encrypted_data: str) -> str:
        """
        Decrypt sensitive data
        
        Args:
            encrypted_data: Encrypted data (hex string)
            
        Returns:
            Decrypted or original data
        """
        if not self.encryption_key or not encrypted_data:
            return encrypted_data
        
        try:
            # Convert hex string back to bytes
            encrypted_bytes = bytes.fromhex(encrypted_data)
            
            # Key processing
            key_bytes = self.encryption_key.encode()
            key_repeated = key_bytes * (len(encrypted_bytes) // len(key_bytes) + 1)
            key_repeated = key_repeated[:len(encrypted_bytes)]
            
            # XOR decryption (same as encryption)
            decrypted_bytes = bytes(a ^ b for a, b in zip(encrypted_bytes, key_repeated))
            
            return decrypted_bytes.decode()
        except Exception as e:
            logger.error(f"Decryption error: {str(e)}")
            return encrypted_data
    
    def _rotate_logs_if_needed(self) -> None:
        """Check and rotate logs if needed based on size or age"""
        # Check session file
        if (self.session_file.exists() and
            LogRotationPolicy.should_rotate_by_size(self.session_file, self.max_log_size_mb)):
            LogRotationPolicy.rotate_file(self.session_file, self.compress_logs)
        
        # Check main log file
        if (self.main_log_file.exists() and
            LogRotationPolicy.should_rotate_by_size(self.main_log_file, self.max_log_size_mb)):
            LogRotationPolicy.rotate_file(self.main_log_file, self.compress_logs)
    
    def _find_interaction_in_log(self, log_file: Path, 
                               interaction_id: str) -> Optional[Dict[str, Any]]:
        """
        Find an interaction in a log file by its ID
        
        Args:
            log_file: Path to log file
            interaction_id: ID to search for
            
        Returns:
            Interaction dictionary or None if not found
        """
        if not log_file.exists():
            return None
        
        try:
            with open(log_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        interaction = json.loads(line)
                        if interaction.get("interaction_id") == interaction_id:
                            return interaction
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            logger.error(f"Error searching log file: {str(e)}")
        
        return None
    
    def _update_interaction_in_log(self, log_file: Path, 
                                interaction_id: str, 
                                updated_interaction: Dict[str, Any]) -> bool:
        """
        Update an interaction in a log file
        
        Args:
            log_file: Path to log file
            interaction_id: ID of interaction to update
            updated_interaction: Updated interaction data
            
        Returns:
            True on success, False on failure
        """
        if not log_file.exists():
            return False
        
        try:
            # Read all lines
            with open(log_file, "r") as f:
                lines = f.readlines()
            
            # Find and update the matching interaction
            updated = False
            for i, line in enumerate(lines):
                try:
                    interaction = json.loads(line)
                    if interaction.get("interaction_id") == interaction_id:
                        lines[i] = json.dumps(updated_interaction) + "\n"
                        updated = True
                except json.JSONDecodeError:
                    continue
            
            # Write back if updated
            if updated:
                with open(log_file, "w") as f:
                    f.writelines(lines)
            
            return updated
        except Exception as e:
            logger.error(f"Error updating interaction in log: {str(e)}")
            return False
    
    def _update_analytics(self, interaction: AIInteraction) -> None:
        """
        Update analytics data
        
        Args:
            interaction: Interaction to process for analytics
        """
        try:
            # Update daily stats
            date_str = datetime.datetime.now().strftime("%Y%m%d")
            daily_stats_file = self.analytics_dir / f"daily_stats_{date_str}.json"
            
            stats = {}
            if daily_stats_file.exists():
                try:
                    with open(daily_stats_file, "r") as f:
                        stats = json.load(f)
                except json.JSONDecodeError:
                    stats = {}
            
            # Initialize if needed
            if "interaction_count" not in stats:
                stats["interaction_count"] = 0
            if "total_tokens" not in stats:
                stats["total_tokens"] = 0
            if "total_duration_ms" not in stats:
                stats["total_duration_ms"] = 0
            if "models" not in stats:
                stats["models"] = {}
            
            # Update stats
            stats["interaction_count"] += 1
            stats["total_tokens"] += interaction.token_count
            stats["total_duration_ms"] += interaction.duration_ms
            
            # Update model stats
            if interaction.model:
                if interaction.model not in stats["models"]:
                    stats["models"][interaction.model] = 0
                stats["models"][interaction.model] += 1
            
            # Save updated stats
            with open(daily_stats_file, "w") as f:
                json.dump(stats, f, indent=2)
        
        except Exception as e:
            logger.error(f"Error updating analytics: {str(e)}")
    
    def _log_session_event(self, event_type: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Log a session event
        
        Args:
            event_type: Type of event ('session_start', 'session_end', etc.)
            metadata: Additional metadata
        """
        event = {
            "event_type": event_type,
            "timestamp": datetime.datetime.now().isoformat(),
            "session_id": self.session_id,
            "user": self.user
        }
        
        if metadata:
            event.update(metadata)
        
        # Write to session file
        self._write_to_log(self.session_file, json.dumps(event))
    
    def _get_client_info(self) -> Dict[str, Any]:
        """
        Get information about the client system
        
        Returns:
            Dictionary with client information
        """
        info = {
            "platform": sys.platform,
            "python_version": sys.version.split()[0],
            "hostname": os.environ.get("COMPUTERNAME", os.environ.get("HOSTNAME", "unknown"))
        }
        
        # Sanitize hostname to avoid any privacy issues
        info["hostname"] = hashlib.md5(info["hostname"].encode()).hexdigest()[:8]
        
        return info
    
    def _count_review_statuses(self, interactions: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Count occurrences of each review status
        
        Args:
            interactions: List of interactions
            
        Returns:
            Dictionary with counts for each status
        """
        counts = {}
        for interaction in interactions:
            status = interaction.get("review_status", "pending")
            counts[status] = counts.get(status, 0) + 1
        
        return counts
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        # Try to end the session cleanly
        try:
            if hasattr(self, "session_id"):
                self._log_session_event("session_terminated")
            
            if hasattr(self, "_executor") and self._executor:
                self._executor.shutdown(wait=False)
        except Exception:
            pass


# Factory function to create a logger
def create_ai_logger(project_root: Union[str, Path], 
                   session_id: Optional[str] = None,
                   user: str = "",
                   compress_logs: bool = False) -> AILogger:
    """
    Create an AI Logger instance with default settings
    
    Args:
        project_root: Root directory of the project
        session_id: Optional session ID
        user: User identifier
        compress_logs: Whether to compress logs
        
    Returns:
        Configured AILogger instance
    """
    # Set up logging if not already configured
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    # Create and return logger
    return AILogger(
        project_root=project_root,
        session_id=session_id,
        user=user,
        compress_logs=compress_logs
    )