"""Chat session management service."""

import uuid
import logging
from typing import List, Optional, Dict
from datetime import datetime

from ..models import ChatSession, Message, MessageType
from ..events import event_bus, Event, Events
from .persistence import PersistenceService

logger = logging.getLogger(__name__)


class ChatService:
    """Service for managing chat sessions."""
    
    def __init__(self, persistence: PersistenceService):
        self.persistence = persistence
        self._sessions: Dict[str, ChatSession] = {}
        self._current_session: Optional[ChatSession] = None
        
    def create_session(self, project_id: str, name: str) -> ChatSession:
        """Create a new chat session."""
        session_id = str(uuid.uuid4())
        session = ChatSession(
            id=session_id,
            project_id=project_id,
            name=name
        )
        
        # Save session
        self._sessions[session.id] = session
        self._save_session(session)
        
        # Emit event
        event_bus.emit(Event(Events.CHAT_CREATED, session))
        
        logger.info(f"Created chat session: {session.name}")
        return session
        
    def open_session(self, session_id: str) -> Optional[ChatSession]:
        """Open a chat session."""
        # Try to load from disk if not in memory
        if session_id not in self._sessions:
            session_file = self.persistence.get_chat_file(session_id)
            data = self.persistence.load_json(session_file)
            if data:
                try:
                    session = ChatSession.from_dict(data)
                    self._sessions[session.id] = session
                except Exception as e:
                    logger.error(f"Failed to load session {session_id}: {e}")
                    return None
                    
        session = self._sessions.get(session_id)
        if session:
            self._current_session = session
            logger.info(f"Opened chat session: {session.name}")
            return session
            
        logger.warning(f"Session not found: {session_id}")
        return None
        
    def close_session(self) -> None:
        """Close the current session."""
        if self._current_session:
            logger.info(f"Closed chat session: {self._current_session.name}")
            self._current_session = None
            
    def delete_session(self, session_id: str) -> bool:
        """Delete a chat session."""
        session = self._sessions.get(session_id)
        if not session:
            return False
            
        # Remove from memory
        del self._sessions[session_id]
        
        # Delete from disk
        session_file = self.persistence.get_chat_file(session_id)
        self.persistence.delete(session_file)
        
        logger.info(f"Deleted chat session: {session.name}")
        return True
        
    def add_message(self, session_id: str, content: str, 
                   message_type: MessageType) -> Optional[Message]:
        """Add a message to a session."""
        session = self._sessions.get(session_id)
        if not session:
            return None
            
        message = Message(
            id=str(uuid.uuid4()),
            type=message_type,
            content=content
        )
        
        session.add_message(message)
        self._save_session(session)
        
        # Emit event
        event_name = (Events.CHAT_MESSAGE_SENT if message_type == MessageType.USER 
                     else Events.CHAT_MESSAGE_RECEIVED)
        event_bus.emit(Event(event_name, {"session": session, "message": message}))
        
        return message
        
    def add_context_file(self, session_id: str, filepath: str) -> bool:
        """Add a context file to a session."""
        session = self._sessions.get(session_id)
        if not session:
            return False
            
        session.add_context_file(filepath)
        self._save_session(session)
        
        # Emit event
        event_bus.emit(Event(Events.CHAT_CONTEXT_ADDED, 
                           {"session": session, "filepath": filepath}))
        
        return True
        
    def remove_context_file(self, session_id: str, filepath: str) -> bool:
        """Remove a context file from a session."""
        session = self._sessions.get(session_id)
        if not session:
            return False
            
        session.remove_context_file(filepath)
        self._save_session(session)
        
        return True
        
    def update_session_model(self, session_id: str, model: str) -> bool:
        """Update the model for a session."""
        session = self._sessions.get(session_id)
        if not session:
            return False
            
        session.model = model
        session.updated_at = datetime.now()
        self._save_session(session)
        
        return True
        
    def get_session(self, session_id: str) -> Optional[ChatSession]:
        """Get a session by ID."""
        return self._sessions.get(session_id)
        
    def list_project_sessions(self, project_id: str) -> List[ChatSession]:
        """List all sessions for a project."""
        # Load all sessions for the project
        sessions = []
        for session in self._sessions.values():
            if session.project_id == project_id:
                sessions.append(session)
                
        # Sort by updated time
        sessions.sort(key=lambda s: s.updated_at, reverse=True)
        return sessions
        
    @property
    def current_session(self) -> Optional[ChatSession]:
        """Get the current session."""
        return self._current_session
        
    def _save_session(self, session: ChatSession) -> bool:
        """Save a session to disk."""
        session_file = self.persistence.get_chat_file(session.id)
        return self.persistence.save_json(session.to_dict(), session_file)
        
    def load_project_sessions(self, project_id: str) -> None:
        """Load all sessions for a project."""
        # This would typically be called when a project is opened
        chat_files = self.persistence.list_files(
            self.persistence.chats_dir,
            "*.json"
        )
        
        for file in chat_files:
            try:
                data = self.persistence.load_json(file)
                if data and data.get("project_id") == project_id:
                    session = ChatSession.from_dict(data)
                    self._sessions[session.id] = session
            except Exception as e:
                logger.error(f"Failed to load session from {file}: {e}")