#!/usr/bin/env python3
"""
Project Tree Cache for ALFRED
Provides fast, cached access to project file structures
"""

import os
import time
import threading
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import hashlib
import json
import pickle
from collections import defaultdict
from alfred_logger import get_logger


@dataclass
class FileNode:
    """Represents a file or directory in the project tree"""
    path: Path
    name: str
    is_dir: bool
    size: int = 0
    modified: float = 0
    children: List['FileNode'] = field(default_factory=list)
    parent: Optional['FileNode'] = None
    _hash: Optional[str] = None
    
    def __post_init__(self):
        if self.modified == 0 and self.path.exists():
            self.modified = self.path.stat().st_mtime
            if not self.is_dir:
                self.size = self.path.stat().st_size
    
    @property
    def hash(self) -> str:
        """Get hash of this node (cached)"""
        if self._hash is None:
            content = f"{self.name}:{self.is_dir}:{self.size}:{self.modified}"
            if self.is_dir and self.children:
                # Include child hashes for directories
                child_hashes = sorted([c.hash for c in self.children])
                content += ":" + ":".join(child_hashes)
            self._hash = hashlib.md5(content.encode()).hexdigest()[:8]
        return self._hash
    
    def find(self, path: Path) -> Optional['FileNode']:
        """Find a node by path"""
        if self.path == path:
            return self
        
        for child in self.children:
            if path.is_relative_to(child.path):
                result = child.find(path)
                if result:
                    return result
        
        return None
    
    def get_size_recursive(self) -> int:
        """Get total size including all children"""
        if not self.is_dir:
            return self.size
        
        total = 0
        for child in self.children:
            total += child.get_size_recursive()
        return total


@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    root_path: Path
    tree: FileNode
    created: datetime
    last_accessed: datetime
    scan_time: float  # Time taken to scan
    file_count: int
    dir_count: int
    total_size: int
    ignore_patterns: List[str]
    
    def is_stale(self, max_age: timedelta = timedelta(minutes=5)) -> bool:
        """Check if cache entry is stale"""
        return datetime.now() - self.created > max_age
    
    def touch(self):
        """Update last access time"""
        self.last_accessed = datetime.now()


class ProjectTreeCache:
    """Intelligent caching system for project file trees"""
    
    def __init__(self, cache_dir: Optional[Path] = None, max_cache_size: int = 100):
        """
        Initialize project tree cache
        
        Args:
            cache_dir: Directory to store persistent cache files
            max_cache_size: Maximum number of trees to keep in memory
        """
        self.logger = get_logger()
        self.memory_cache: Dict[str, CacheEntry] = {}
        self.max_cache_size = max_cache_size
        self._lock = threading.RLock()
        
        # Statistics
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        
        # Persistent cache directory
        if cache_dir:
            self.cache_dir = Path(cache_dir)
        else:
            self.cache_dir = Path.home() / ".alfred" / "tree_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # File watchers for invalidation
        self.watchers: Dict[str, float] = {}  # path -> last_modified
        
        # Default ignore patterns
        self.default_ignore = [
            ".git", "__pycache__", "*.pyc", ".DS_Store", "node_modules",
            ".venv", "venv", "env", ".env", "dist", "build", ".idea",
            ".vscode", "*.egg-info", ".pytest_cache", ".mypy_cache"
        ]
        
        # Start background thread for cache maintenance
        self._running = True
        self._maintenance_thread = threading.Thread(
            target=self._maintenance_loop,
            daemon=True
        )
        self._maintenance_thread.start()
    
    def get_tree(self, path: Path, ignore_patterns: Optional[List[str]] = None,
                 force_refresh: bool = False) -> Tuple[FileNode, CacheEntry]:
        """
        Get project tree with caching
        
        Args:
            path: Root path to scan
            ignore_patterns: Patterns to ignore (uses defaults if None)
            force_refresh: Force cache refresh
            
        Returns:
            Tuple of (FileNode tree, CacheEntry metadata)
        """
        path = path.resolve()
        cache_key = self._get_cache_key(path, ignore_patterns)
        
        with self._lock:
            # Check memory cache
            if not force_refresh and cache_key in self.memory_cache:
                entry = self.memory_cache[cache_key]
                if not entry.is_stale() and self._is_valid(entry):
                    self.hits += 1
                    entry.touch()
                    self.logger.log_debug("Tree cache hit", {
                        "path": str(path),
                        "files": entry.file_count,
                        "dirs": entry.dir_count
                    })
                    return entry.tree, entry
            
            # Check persistent cache
            if not force_refresh:
                entry = self._load_from_disk(cache_key)
                if entry and not entry.is_stale() and self._is_valid(entry):
                    self.hits += 1
                    entry.touch()
                    self._add_to_memory_cache(cache_key, entry)
                    self.logger.log_debug("Tree cache hit (disk)", {
                        "path": str(path),
                        "files": entry.file_count
                    })
                    return entry.tree, entry
            
            # Cache miss - scan directory
            self.misses += 1
            self.logger.log_debug("Tree cache miss", {"path": str(path)})
            
            tree, entry = self._scan_directory(path, ignore_patterns)
            self._add_to_memory_cache(cache_key, entry)
            self._save_to_disk(cache_key, entry)
            
            return tree, entry
    
    def invalidate(self, path: Path):
        """Invalidate cache for a path and its parents"""
        path = path.resolve()
        
        with self._lock:
            # Find all cache entries that contain this path
            to_remove = []
            for key, entry in self.memory_cache.items():
                if path.is_relative_to(entry.root_path) or entry.root_path.is_relative_to(path):
                    to_remove.append(key)
            
            # Remove from memory cache
            for key in to_remove:
                self.memory_cache.pop(key, None)
                self.logger.log_debug("Invalidated cache", {"key": key})
            
            # Remove from disk cache
            for cache_file in self.cache_dir.glob("*.cache"):
                try:
                    with open(cache_file, 'rb') as f:
                        entry = pickle.load(f)
                    if path.is_relative_to(entry.root_path) or entry.root_path.is_relative_to(path):
                        cache_file.unlink()
                except:
                    pass
    
    def get_stats(self) -> Dict:
        """Get cache statistics"""
        with self._lock:
            total_memory_size = sum(e.total_size for e in self.memory_cache.values())
            hit_rate = self.hits / (self.hits + self.misses) if (self.hits + self.misses) > 0 else 0
            
            return {
                "memory_entries": len(self.memory_cache),
                "memory_size": total_memory_size,
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": hit_rate,
                "evictions": self.evictions,
                "disk_cache_files": len(list(self.cache_dir.glob("*.cache")))
            }
    
    def clear(self):
        """Clear all caches"""
        with self._lock:
            self.memory_cache.clear()
            self.watchers.clear()
            
            # Clear disk cache
            for cache_file in self.cache_dir.glob("*.cache"):
                try:
                    cache_file.unlink()
                except:
                    pass
            
            self.logger.log_info("Cache cleared")
    
    def stop(self):
        """Stop the cache system"""
        self._running = False
        self.logger.log_info("Tree cache stopped", self.get_stats())
    
    def _get_cache_key(self, path: Path, ignore_patterns: Optional[List[str]]) -> str:
        """Generate cache key for path and patterns"""
        patterns = ignore_patterns or self.default_ignore
        content = f"{path}:{':'.join(sorted(patterns))}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _scan_directory(self, root_path: Path, ignore_patterns: Optional[List[str]]) -> Tuple[FileNode, CacheEntry]:
        """Scan directory and build tree"""
        start_time = time.time()
        patterns = ignore_patterns or self.default_ignore
        
        file_count = 0
        dir_count = 0
        total_size = 0
        
        def should_ignore(path: Path) -> bool:
            """Check if path should be ignored"""
            name = path.name
            for pattern in patterns:
                if pattern.startswith("*") and name.endswith(pattern[1:]):
                    return True
                elif pattern.endswith("*") and name.startswith(pattern[:-1]):
                    return True
                elif pattern in name:
                    return True
            return False
        
        def scan_recursive(path: Path, parent: Optional[FileNode] = None) -> FileNode:
            """Recursively scan directory"""
            nonlocal file_count, dir_count, total_size
            
            node = FileNode(
                path=path,
                name=path.name,
                is_dir=path.is_dir(),
                parent=parent
            )
            
            if path.is_dir():
                dir_count += 1
                try:
                    for child_path in sorted(path.iterdir()):
                        if not should_ignore(child_path):
                            child = scan_recursive(child_path, node)
                            node.children.append(child)
                except PermissionError:
                    pass
            else:
                file_count += 1
                total_size += node.size
            
            return node
        
        # Scan the tree
        tree = scan_recursive(root_path)
        scan_time = time.time() - start_time
        
        # Create cache entry
        entry = CacheEntry(
            root_path=root_path,
            tree=tree,
            created=datetime.now(),
            last_accessed=datetime.now(),
            scan_time=scan_time,
            file_count=file_count,
            dir_count=dir_count,
            total_size=total_size,
            ignore_patterns=patterns
        )
        
        self.logger.log_info("Directory scanned", {
            "path": str(root_path),
            "files": file_count,
            "dirs": dir_count,
            "size_mb": total_size / (1024 * 1024),
            "scan_time": f"{scan_time:.2f}s"
        })
        
        return tree, entry
    
    def _is_valid(self, entry: CacheEntry) -> bool:
        """Check if cache entry is still valid"""
        # Quick check - does root still exist?
        if not entry.root_path.exists():
            return False
        
        # Check if any watched paths have changed
        # (More sophisticated validation could be added here)
        return True
    
    def _add_to_memory_cache(self, key: str, entry: CacheEntry):
        """Add entry to memory cache with LRU eviction"""
        with self._lock:
            # Evict oldest entries if at capacity
            if len(self.memory_cache) >= self.max_cache_size:
                # Find least recently used
                oldest_key = min(
                    self.memory_cache.keys(),
                    key=lambda k: self.memory_cache[k].last_accessed
                )
                del self.memory_cache[oldest_key]
                self.evictions += 1
            
            self.memory_cache[key] = entry
    
    def _save_to_disk(self, key: str, entry: CacheEntry):
        """Save cache entry to disk"""
        cache_file = self.cache_dir / f"{key}.cache"
        try:
            with open(cache_file, 'wb') as f:
                pickle.dump(entry, f)
        except Exception as e:
            self.logger.log_error("Failed to save cache to disk", error=e)
    
    def _load_from_disk(self, key: str) -> Optional[CacheEntry]:
        """Load cache entry from disk"""
        cache_file = self.cache_dir / f"{key}.cache"
        if not cache_file.exists():
            return None
        
        try:
            with open(cache_file, 'rb') as f:
                return pickle.load(f)
        except Exception as e:
            self.logger.log_error("Failed to load cache from disk", error=e)
            # Remove corrupted cache file
            try:
                cache_file.unlink()
            except:
                pass
            return None
    
    def _maintenance_loop(self):
        """Background maintenance thread"""
        while self._running:
            try:
                # Clean up stale entries every 5 minutes
                time.sleep(300)
                
                with self._lock:
                    # Remove stale memory entries
                    stale_keys = [
                        k for k, v in self.memory_cache.items()
                        if v.is_stale(timedelta(minutes=30))
                    ]
                    for key in stale_keys:
                        del self.memory_cache[key]
                    
                    if stale_keys:
                        self.logger.log_debug("Cleaned stale entries", {
                            "count": len(stale_keys)
                        })
                
                # Clean up old disk cache files
                cutoff = datetime.now() - timedelta(hours=24)
                for cache_file in self.cache_dir.glob("*.cache"):
                    try:
                        if datetime.fromtimestamp(cache_file.stat().st_mtime) < cutoff:
                            cache_file.unlink()
                    except:
                        pass
                        
            except Exception as e:
                self.logger.log_error("Maintenance loop error", error=e)


# Convenience functions
def create_tree_cache() -> ProjectTreeCache:
    """Create a new project tree cache instance"""
    return ProjectTreeCache()


# Example integration with ALFRED
class CachedStructureViewer:
    """Example of using tree cache in UI"""
    
    def __init__(self, cache: ProjectTreeCache):
        self.cache = cache
        self.current_tree: Optional[FileNode] = None
        self.current_path: Optional[Path] = None
    
    def load_project(self, path: Path):
        """Load project with caching"""
        tree, metadata = self.cache.get_tree(path)
        self.current_tree = tree
        self.current_path = path
        
        # Return formatted info
        return {
            "files": metadata.file_count,
            "directories": metadata.dir_count,
            "size_mb": metadata.total_size / (1024 * 1024),
            "scan_time": metadata.scan_time,
            "cached": metadata.created != datetime.now()
        }
    
    def refresh(self):
        """Force refresh current project"""
        if self.current_path:
            tree, metadata = self.cache.get_tree(self.current_path, force_refresh=True)
            self.current_tree = tree
            return True
        return False
    
    def get_node(self, path: Path) -> Optional[FileNode]:
        """Get a specific node from the tree"""
        if self.current_tree:
            return self.current_tree.find(path)
        return None


if __name__ == "__main__":
    # Demo the tree cache
    import sys
    
    cache = create_tree_cache()
    
    # Test path
    test_path = Path.cwd() if len(sys.argv) < 2 else Path(sys.argv[1])
    
    print(f"Scanning {test_path}...")
    
    # First scan (miss)
    start = time.time()
    tree1, meta1 = cache.get_tree(test_path)
    time1 = time.time() - start
    
    print(f"\nFirst scan (cache miss):")
    print(f"  Time: {time1:.3f}s")
    print(f"  Files: {meta1.file_count}")
    print(f"  Directories: {meta1.dir_count}")
    print(f"  Total size: {meta1.total_size / (1024*1024):.1f} MB")
    
    # Second scan (hit)
    start = time.time()
    tree2, meta2 = cache.get_tree(test_path)
    time2 = time.time() - start
    
    print(f"\nSecond scan (cache hit):")
    print(f"  Time: {time2:.3f}s")
    print(f"  Speedup: {time1/time2:.1f}x")
    
    # Stats
    print(f"\nCache stats:")
    stats = cache.get_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    cache.stop()