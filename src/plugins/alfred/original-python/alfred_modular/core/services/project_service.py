"""Project management service."""

import uuid
import logging
from pathlib import Path
from typing import List, Optional, Dict
from datetime import datetime

from ..models import Project
from ..events import event_bus, Event, Events
from .persistence import PersistenceService

logger = logging.getLogger(__name__)


class ProjectService:
    """Service for managing projects."""
    
    def __init__(self, persistence: PersistenceService):
        self.persistence = persistence
        self._projects: Dict[str, Project] = {}
        self._current_project: Optional[Project] = None
        self._load_projects()
        
    def _load_projects(self) -> None:
        """Load all projects from disk."""
        project_files = self.persistence.list_files(
            self.persistence.projects_dir, 
            "*.json"
        )
        
        for file in project_files:
            try:
                data = self.persistence.load_json(file)
                if data:
                    project = Project.from_dict(data)
                    self._projects[project.id] = project
            except Exception as e:
                logger.error(f"Failed to load project from {file}: {e}")
                
        logger.info(f"Loaded {len(self._projects)} projects")
        
    def create_project(self, name: str, path: str) -> Project:
        """Create a new project."""
        project_id = str(uuid.uuid4())
        project = Project(
            id=project_id,
            name=name,
            path=Path(path)
        )
        
        # Create project directory if needed
        project.path.mkdir(parents=True, exist_ok=True)
        
        # Save project
        self._projects[project.id] = project
        self._save_project(project)
        
        # Emit event
        event_bus.emit(Event(Events.PROJECT_CREATED, project))
        
        logger.info(f"Created project: {project.name} at {project.path}")
        return project
        
    def open_project(self, project_id: str) -> Optional[Project]:
        """Open a project."""
        project = self._projects.get(project_id)
        if project:
            self._current_project = project
            self._save_last_project_id(project_id)
            
            # Emit event
            event_bus.emit(Event(Events.PROJECT_OPENED, project))
            
            logger.info(f"Opened project: {project.name}")
            return project
            
        logger.warning(f"Project not found: {project_id}")
        return None
        
    def close_project(self) -> None:
        """Close the current project."""
        if self._current_project:
            # Emit event
            event_bus.emit(Event(Events.PROJECT_CLOSED, self._current_project))
            
            logger.info(f"Closed project: {self._current_project.name}")
            self._current_project = None
            
    def delete_project(self, project_id: str) -> bool:
        """Delete a project."""
        project = self._projects.get(project_id)
        if not project:
            return False
            
        # Remove from memory
        del self._projects[project_id]
        
        # Delete from disk
        project_file = self.persistence.get_project_file(project_id)
        self.persistence.delete(project_file)
        
        # Delete associated chats
        for chat_id in project.chat_sessions:
            chat_file = self.persistence.get_chat_file(chat_id)
            self.persistence.delete(chat_file)
            
        logger.info(f"Deleted project: {project.name}")
        return True
        
    def update_project(self, project: Project) -> bool:
        """Update a project."""
        if project.id not in self._projects:
            return False
            
        project.updated_at = datetime.now()
        self._projects[project.id] = project
        self._save_project(project)
        
        # Emit event
        event_bus.emit(Event(Events.PROJECT_SAVED, project))
        
        return True
        
    def get_project(self, project_id: str) -> Optional[Project]:
        """Get a project by ID."""
        return self._projects.get(project_id)
        
    def list_projects(self) -> List[Project]:
        """List all projects."""
        return sorted(
            self._projects.values(),
            key=lambda p: p.updated_at,
            reverse=True
        )
        
    @property
    def current_project(self) -> Optional[Project]:
        """Get the current project."""
        return self._current_project
        
    def _save_project(self, project: Project) -> bool:
        """Save a project to disk."""
        project_file = self.persistence.get_project_file(project.id)
        return self.persistence.save_json(project.to_dict(), project_file)
        
    def _save_last_project_id(self, project_id: str) -> None:
        """Save the last opened project ID."""
        config_file = self.persistence.get_config_file("last_project")
        self.persistence.save_json({"project_id": project_id}, config_file)
        
    def get_last_project_id(self) -> Optional[str]:
        """Get the last opened project ID."""
        config_file = self.persistence.get_config_file("last_project")
        data = self.persistence.load_json(config_file)
        return data.get("project_id") if data else None
        
    def open_last_project(self) -> Optional[Project]:
        """Open the last opened project."""
        project_id = self.get_last_project_id()
        if project_id:
            return self.open_project(project_id)
        return None