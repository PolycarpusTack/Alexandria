"""Main Alfred application controller."""

import asyncio
import logging
from typing import Optional, Dict, Any, List
from pathlib import Path

from .services import ProjectService, ChatService, PersistenceService
from .models import Project, ChatSession, Message, MessageType
from .events import event_bus, Event, Events
from ..ai import AIProvider, AIRequest, ContextManager, CodeExtractor
from ..ai.providers import OllamaProvider
from ..utils import Config
from ..plugins import PluginManager

logger = logging.getLogger(__name__)


class AlfredApplication:
    """Main application controller."""
    
    def __init__(self, config: Optional[Config] = None):
        # Configuration
        self.config = config or Config()
        
        # Services
        self.persistence = PersistenceService(self.config.data_dir)
        self.project_service = ProjectService(self.persistence)
        self.chat_service = ChatService(self.persistence)
        
        # AI
        self.ai_provider: AIProvider = OllamaProvider(
            base_url=self.config.ollama_url
        )
        self.context_manager = ContextManager()
        self.code_extractor = CodeExtractor()
        
        # Plugins
        self.plugin_manager = PluginManager(self)
        
        # State
        self._running = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        
        # Subscribe to events
        self._setup_event_handlers()
        
    def _setup_event_handlers(self):
        """Setup event handlers."""
        event_bus.subscribe(Events.PROJECT_OPENED, self._on_project_opened)
        event_bus.subscribe(Events.PROJECT_CLOSED, self._on_project_closed)
        
    def _on_project_opened(self, event: Event):
        """Handle project opened event."""
        project = event.data
        # Load chat sessions for the project
        self.chat_service.load_project_sessions(project.id)
        
        # Update project in project service
        project.chat_sessions = [
            s.id for s in self.chat_service.list_project_sessions(project.id)
        ]
        self.project_service.update_project(project)
        
    def _on_project_closed(self, event: Event):
        """Handle project closed event."""
        # Close current chat session
        self.chat_service.close_session()
        
    async def initialize(self):
        """Initialize the application."""
        logger.info("Initializing Alfred...")
        
        # Check AI provider
        if not await self.ai_provider.health_check():
            logger.warning("AI provider health check failed")
            
        # Load plugins
        await self.plugin_manager.load_plugins()
        
        # Open last project if configured
        if self.config.auto_open_last_project:
            self.project_service.open_last_project()
            
        self._running = True
        logger.info("Alfred initialized successfully")
        
    async def shutdown(self):
        """Shutdown the application."""
        logger.info("Shutting down Alfred...")
        
        self._running = False
        
        # Unload plugins
        await self.plugin_manager.unload_plugins()
        
        # Close AI provider
        if hasattr(self.ai_provider, 'close'):
            await self.ai_provider.close()
            
        logger.info("Alfred shutdown complete")
        
    async def send_message(self, content: str) -> Optional[str]:
        """Send a message to the AI."""
        if not self.chat_service.current_session:
            logger.warning("No active chat session")
            return None
            
        session = self.chat_service.current_session
        
        # Add user message
        user_message = self.chat_service.add_message(
            session.id, 
            content, 
            MessageType.USER
        )
        
        if not user_message:
            return None
            
        try:
            # Build context
            context = session.get_context()
            
            # Create AI request
            request = AIRequest(
                prompt=content,
                model=session.model,
                context=context,
                temperature=self.config.ai_temperature,
                stream=True
            )
            
            # Emit request started event
            event_bus.emit(Event(Events.AI_REQUEST_STARTED, request))
            
            # Generate response
            response_parts = []
            async for chunk in self.ai_provider.generate_stream(request):
                response_parts.append(chunk)
                
            response = "".join(response_parts)
            
            # Add assistant message
            self.chat_service.add_message(
                session.id,
                response,
                MessageType.ASSISTANT
            )
            
            # Emit request completed event
            event_bus.emit(Event(Events.AI_REQUEST_COMPLETED, response))
            
            return response
            
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            
            # Add error message
            self.chat_service.add_message(
                session.id,
                f"Error: {str(e)}",
                MessageType.ERROR
            )
            
            # Emit request failed event
            event_bus.emit(Event(Events.AI_REQUEST_FAILED, str(e)))
            
            return None
            
    async def list_models(self) -> List[str]:
        """List available AI models."""
        try:
            return await self.ai_provider.list_models()
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []
            
    def extract_code(self, text: str):
        """Extract code blocks from text."""
        return self.code_extractor.extract_blocks(text)
        
    # Project management
    
    def create_project(self, name: str, path: str) -> Project:
        """Create a new project."""
        return self.project_service.create_project(name, path)
        
    def open_project(self, project_id: str) -> Optional[Project]:
        """Open a project."""
        return self.project_service.open_project(project_id)
        
    def list_projects(self) -> List[Project]:
        """List all projects."""
        return self.project_service.list_projects()
        
    @property
    def current_project(self) -> Optional[Project]:
        """Get current project."""
        return self.project_service.current_project
        
    # Chat management
    
    def create_chat_session(self, name: str) -> Optional[ChatSession]:
        """Create a new chat session."""
        if not self.current_project:
            logger.warning("No active project")
            return None
            
        session = self.chat_service.create_session(
            self.current_project.id,
            name
        )
        
        # Update project
        self.current_project.chat_sessions.append(session.id)
        self.project_service.update_project(self.current_project)
        
        return session
        
    def open_chat_session(self, session_id: str) -> Optional[ChatSession]:
        """Open a chat session."""
        return self.chat_service.open_session(session_id)
        
    def list_chat_sessions(self) -> List[ChatSession]:
        """List chat sessions for current project."""
        if not self.current_project:
            return []
        return self.chat_service.list_project_sessions(self.current_project.id)
        
    @property
    def current_chat_session(self) -> Optional[ChatSession]:
        """Get current chat session."""
        return self.chat_service.current_session
        
    # Context management
    
    def add_context_file(self, filepath: str) -> bool:
        """Add a file to the current chat context."""
        if not self.current_chat_session:
            return False
        return self.chat_service.add_context_file(
            self.current_chat_session.id,
            filepath
        )
        
    def remove_context_file(self, filepath: str) -> bool:
        """Remove a file from the current chat context."""
        if not self.current_chat_session:
            return False
        return self.chat_service.remove_context_file(
            self.current_chat_session.id,
            filepath
        )