"""
Enterprise Code Factory 9000 Pro - Project Tree Manager
------------------------------------------------------
Manages project tree visualization with lazy loading and optimization
for improved performance with large projects.

Author: Claude (Enhanced)
Date: April 10, 2025
"""

import os
import time
import logging
import tkinter as tk
from tkinter import ttk
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any, Callable
from datetime import datetime
import threading

logger = logging.getLogger(__name__)

class ProjectTreeManager:
    """
    Manages project tree visualization with lazy loading for optimal performance
    """
    
    def __init__(self, tree_widget: ttk.Treeview):
        """
        Initialize the project tree manager
        
        Args:
            tree_widget: The Treeview widget to manage
        """
        self.tree = tree_widget
        self.loading_lock = threading.RLock()
        self.expanded_nodes: Set[str] = set()
        self.visible_items: Set[str] = set()
        self.cached_items: Dict[str, Dict[str, Any]] = {}
        self.path_to_id: Dict[str, str] = {}
        self.id_to_path: Dict[str, str] = {}
        self.current_project: Optional[Path] = None
        self.filter_text: str = ""
        
        # Configure virtual event handlers
        self.tree.bind("<<TreeviewOpen>>", self._on_node_expanded)
        self.tree.bind("<<TreeviewClose>>", self._on_node_collapsed)
        self.tree.bind("<Map>", lambda e: self._update_visible_items())
        self.tree.bind("<Configure>", lambda e: self._update_visible_items())
        
        # Default file icons based on extension
        self.file_icons = {
            "py": "🐍",
            "js": "📜",
            "html": "🌐",
            "css": "🎨",
            "md": "📝",
            "json": "📊",
            "yml": "⚙️",
            "yaml": "⚙️",
            "txt": "📄",
            "csv": "📈",
            "db": "🗃️",
            "sql": "🔍",
            "png": "🖼️",
            "jpg": "🖼️",
            "svg": "🖼️",
            "pdf": "📑",
            "zip": "📦",
            "exe": "⚡",
            "sh": "🔧",
            "bat": "🔧",
            "dir": "📁"
        }
    
    def set_project(self, project_path: Path) -> None:
        """
        Set the current project
        
        Args:
            project_path: Path to the project root
        """
        self.current_project = project_path
        self.clear()
    
    def clear(self) -> None:
        """Clear the tree and reset caches"""
        with self.loading_lock:
            # Clear tree
            for item in self.tree.get_children():
                self.tree.delete(item)
            
            # Reset caches
            self.expanded_nodes.clear()
            self.visible_items.clear()
            self.cached_items.clear()
            self.path_to_id.clear()
            self.id_to_path.clear()
    
    def load_project(self, filter_text: str = "") -> None:
        """
        Load the current project into the tree with optional filtering
        
        Args:
            filter_text: Optional text to filter files/folders by name
        """
        if not self.current_project or not self.current_project.exists():
            logger.warning(f"No valid project to load")
            return
        
        self.filter_text = filter_text.lower()
        
        with self.loading_lock:
            # Clear existing items
            self.clear()
            
            # Add project root
            project_name = self.current_project.name
            root_id = self.tree.insert("", tk.END, text=f"{self.file_icons['dir']} {project_name}", 
                                     open=True, values=("dir", ""))
            
            # Record the root node mapping
            root_path = str(self.current_project)
            self.path_to_id[root_path] = root_id
            self.id_to_path[root_id] = root_path
            self.expanded_nodes.add(root_id)
            
            # Load first level
            self._load_children(root_id)
            
            # Expand first level for better UX
            self.tree.item(root_id, open=True)
    
    def refresh(self) -> None:
        """Refresh the current tree view while maintaining expanded state"""
        if not self.current_project:
            return
            
        # Remember expanded nodes by path
        expanded_paths = {self.id_to_path[node_id] for node_id in self.expanded_nodes 
                          if node_id in self.id_to_path}
        
        # Reload the project
        self.load_project(self.filter_text)
        
        # Re-expand previously expanded nodes
        for path in expanded_paths:
            if path in self.path_to_id:
                node_id = self.path_to_id[path]
                self.tree.item(node_id, open=True)
                # Load children if needed
                self._load_children(node_id)
    
    def _load_children(self, parent_id: str) -> None:
        """
        Load immediate children of a tree node
        
        Args:
            parent_id: ID of the parent node
        """
        if parent_id not in self.id_to_path:
            return
            
        parent_path = Path(self.id_to_path[parent_id])
        if not parent_path.exists() or not parent_path.is_dir():
            return
        
        try:
            # Remove any placeholder items
            for child in self.tree.get_children(parent_id):
                if "Loading" in self.tree.item(child, "text"):
                    self.tree.delete(child)

            # Get sorted items (directories first, then files)
            items = sorted(parent_path.iterdir(), 
                          key=lambda p: (not p.is_dir(), p.name.lower()))
            
            for item_path in items:
                # Skip hidden files unless specifically requested
                if item_path.name.startswith('.') and not self.filter_text:
                    continue
                
                # Check filter
                if self.filter_text and self.filter_text not in item_path.name.lower():
                    # For directories, we need a deeper check
                    if item_path.is_dir():
                        # Only include if it has matching children
                        if not self._has_matching_children(item_path):
                            continue
                    else:
                        # Skip non-matching files
                        continue
                
                # Get file info
                is_dir = item_path.is_dir()
                try:
                    mod_time = datetime.fromtimestamp(item_path.stat().st_mtime).strftime("%Y-%m-%d")
                except:
                    mod_time = ""
                
                # Determine icon and type
                if is_dir:
                    icon = self.file_icons["dir"]
                    item_type = "dir"
                else:
                    ext = item_path.suffix.lower()[1:] if item_path.suffix else ""
                    icon = self.file_icons.get(ext, "📄")
                    item_type = ext or "file"
                
                # Insert into tree
                item_id = self.tree.insert(parent_id, tk.END, 
                                         text=f"{icon} {item_path.name}",
                                         values=(item_type, mod_time))
                
                # Add to mapping
                str_path = str(item_path)
                self.path_to_id[str_path] = item_id
                self.id_to_path[item_id] = str_path
                
                # If directory, add a dummy item to enable expansion
                if is_dir:
                    # Check if the directory has any visible items according to filter
                    has_children = any(True for _ in item_path.iterdir() 
                                   if not _.name.startswith('.') or self.filter_text)
                    if has_children:
                        self.tree.insert(item_id, tk.END, text="Loading...", values=("", ""))
        
        except PermissionError:
            self.tree.insert(parent_id, tk.END, text="⚠️ Permission denied", values=("error", ""))
        except Exception as e:
            logger.error(f"Error loading children for {parent_path}: {str(e)}")
            self.tree.insert(parent_id, tk.END, text=f"⚠️ Error: {str(e)}", values=("error", ""))
    
    def _has_matching_children(self, dir_path: Path) -> bool:
        """
        Check if a directory has children that match the filter text
        
        Args:
            dir_path: Path to the directory
            
        Returns:
            True if there are matching children, False otherwise
        """
        if not self.filter_text:
            return True
            
        try:
            for path in dir_path.rglob("*"):
                if self.filter_text in path.name.lower():
                    return True
            return False
        except Exception:
            return False
    
    def _on_node_expanded(self, event) -> None:
        """Handle node expansion event"""
        try:
            item_id = self.tree.focus()
            if not item_id:
                return
                
            # Mark as expanded
            self.expanded_nodes.add(item_id)
            
            # Check if this is a placeholder
            children = self.tree.get_children(item_id)
            if len(children) == 1 and "Loading" in self.tree.item(children[0], "text"):
                # Remove placeholder
                self.tree.delete(children[0])
                # Load real children
                self._load_children(item_id)
            
            # Update visible items
            self._update_visible_items()
        except Exception as e:
            logger.error(f"Error in node expansion: {str(e)}")
    
    def _on_node_collapsed(self, event) -> None:
        """Handle node collapse event"""
        try:
            item_id = self.tree.focus()
            if item_id and item_id in self.expanded_nodes:
                self.expanded_nodes.remove(item_id)
            
            # Update visible items
            self._update_visible_items()
        except Exception as e:
            logger.error(f"Error in node collapse: {str(e)}")
    
    def _update_visible_items(self) -> None:
        """Update the set of currently visible items"""
        visible = set()
        
        def _check_visibility(item_id, depth=0, max_depth=100):
            if depth > max_depth:  # Prevent infinite recursion
                return
                
            visible.add(item_id)
            
            # Check if expanded
            if self.tree.item(item_id, "open"):
                for child_id in self.tree.get_children(item_id):
                    _check_visibility(child_id, depth + 1, max_depth)
        
        for item_id in self.tree.get_children():
            _check_visibility(item_id)
        
        # Update visible items
        self.visible_items = visible
    
    def get_path_for_id(self, item_id: str) -> Optional[str]:
        """
        Get the file system path for a tree item ID
        
        Args:
            item_id: Tree item ID
            
        Returns:
            Path string or None if not found
        """
        return self.id_to_path.get(item_id)
    
    def get_id_for_path(self, path: str) -> Optional[str]:
        """
        Get the tree item ID for a file system path
        
        Args:
            path: File system path
            
        Returns:
            Tree item ID or None if not found
        """
        return self.path_to_id.get(path)
    
    def select_path(self, path: str) -> bool:
        """
        Select a tree item by its file system path
        
        Args:
            path: File system path to select
            
        Returns:
            True if found and selected, False otherwise
        """
        # Ensure path exists in our mapping
        if path not in self.path_to_id:
            # Try to find parent directories and load them
            parts = Path(path).parts
            current = parts[0]
            
            # For Windows paths starting with drive letter
            if os.name == 'nt' and len(parts) > 1:
                current = os.path.join(parts[0], parts[1])
                parts = parts[1:]
            
            for part in parts[1:]:
                current = os.path.join(current, part)
                if os.path.isdir(current) and current not in self.path_to_id:
                    # Try to find parent
                    parent_path = os.path.dirname(current)
                    if parent_path in self.path_to_id:
                        parent_id = self.path_to_id[parent_path]
                        self.tree.item(parent_id, open=True)
                        self._load_children(parent_id)
        
        # Check if now in mapping
        if path in self.path_to_id:
            item_id = self.path_to_id[path]
            self.tree.selection_set(item_id)
            self.tree.focus(item_id)
            self.tree.see(item_id)
            return True
        
        return False
    
    def highlight_item(self, item_path: str, color: str = "#e6f7ff") -> None:
        """
        Highlight a specific item in the tree
        
        Args:
            item_path: Path of the item to highlight
            color: Background color to use for highlighting
        """
        # Ensure the item is in the tree
        if not self.select_path(item_path):
            return
            
        # Get the item ID
        item_id = self.get_id_for_path(item_path)
        if not item_id:
            return
            
        # Apply highlighting
        self.tree.tag_configure("highlight", background=color)
        self.tree.item(item_id, tags=("highlight",))
        
        # Schedule removal of highlight after a delay
        self.tree.after(3000, lambda: self.tree.item(item_id, tags=()))
    
    def update_file(self, file_path: str) -> None:
        """
        Update a specific file in the tree (e.g., after saving)
        
        Args:
            file_path: Path to the file that was updated
        """
        try:
            # Check if the file is in our mapping
            if file_path in self.path_to_id:
                item_id = self.path_to_id[file_path]
                
                # Update modified timestamp
                file_path_obj = Path(file_path)
                if file_path_obj.exists():
                    mod_time = datetime.fromtimestamp(file_path_obj.stat().st_mtime).strftime("%Y-%m-%d")
                    values = list(self.tree.item(item_id, "values"))
                    if len(values) >= 2:
                        values[1] = mod_time
                        self.tree.item(item_id, values=values)
                    
                    # Flash highlight effect
                    self.highlight_item(file_path)
        except Exception as e:
            logger.error(f"Error updating file in tree: {str(e)}")
