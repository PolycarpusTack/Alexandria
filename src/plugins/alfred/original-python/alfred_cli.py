#!/usr/bin/env python3
"""
ALFRED CLI - Command-line interface for ALFRED
AI-Linked Framework for Rapid Engineering Development
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from alfred import (
    ChatMessage, ChatSession, Project,
    TKINTER_AVAILABLE
)
import requests
from typing import List, Optional


class OllamaClient:
    """Simplified Ollama client"""
    
    def __init__(self, base_url: str = "http://localhost:11434", timeout: int = 600):
        self.base_url = base_url
        self.timeout = timeout  # Default 10 minutes
        
    def generate(self, prompt: str, model: str = "deepseek-coder:latest", 
                 context: Optional[List[str]] = None) -> str:
        """Generate response from model"""
        try:
            # Add context files to prompt if provided
            if context:
                context_content = "\n\n".join([
                    f"=== File: {file} ===\n{self._read_file(file)}"
                    for file in context if os.path.exists(file)
                ])
                if context_content:
                    prompt = f"Context files:\n{context_content}\n\nUser request:\n{prompt}"
            
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                    }
                },
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                return response.json().get("response", "")
            else:
                return f"Error: {response.status_code} - {response.text}"
                
        except requests.exceptions.ConnectionError:
            return "Error: Cannot connect to Ollama. Ensure it's running at http://localhost:11434"
        except requests.exceptions.ReadTimeout:
            return f"Error: Request timed out. Try a shorter prompt or increase the timeout. Current timeout: {self.timeout}s"
        except Exception as e:
            return f"Error: {str(e)}"
    
    def _read_file(self, filepath: str) -> str:
        """Read file content with error handling"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return f"Error reading file: {str(e)}"
    
    def list_models(self) -> List[str]:
        """List available models"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            if response.status_code == 200:
                models = response.json().get("models", [])
                return [model["name"] for model in models]
            return []
        except:
            return []


class AlfredCLI:
    """Command-line interface for ALFRED"""
    
    def __init__(self):
        self.ollama_client = OllamaClient(timeout=600)  # 10 minute timeout
        self.current_project = None
        self.projects_dir = Path.home() / ".alfred" / "projects"
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.model = "deepseek-coder:latest"
        
    def run(self):
        """Main CLI loop"""
        print("=== ALFRED CLI ===")
        print("AI-Linked Framework for Rapid Engineering Development")
        print("Type 'help' for commands\n")
        
        # Load last project
        self.load_last_project()
        
        while True:
            try:
                prompt = self._get_prompt()
                command = input(prompt).strip()
                
                if not command:
                    continue
                    
                if command.lower() in ['exit', 'quit', 'q']:
                    print("Goodbye!")
                    break
                    
                self.process_command(command)
                
            except KeyboardInterrupt:
                print("\nUse 'exit' to quit")
            except Exception as e:
                print(f"Error: {e}")
    
    def _get_prompt(self):
        """Get command prompt"""
        if self.current_project:
            session = None
            if self.current_project.active_session_id:
                session = self.current_project.chat_sessions.get(
                    self.current_project.active_session_id
                )
            
            if session:
                return f"[{self.current_project.name}/{session.name}]> "
            else:
                return f"[{self.current_project.name}]> "
        return "> "
    
    def process_command(self, command):
        """Process user command"""
        parts = command.split(maxsplit=1)
        cmd = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""
        
        commands = {
            'help': self.show_help,
            'new': self.new_project,
            'open': self.open_project,
            'list': self.list_projects,
            'chat': self.new_chat,
            'chats': self.list_chats,
            'switch': self.switch_chat,
            'context': self.manage_context,
            'model': self.set_model,
            'models': self.list_models,
            'timeout': self.set_timeout,
            'clear': self.clear_screen,
            'history': self.show_history,
        }
        
        if cmd in commands:
            commands[cmd](args)
        else:
            # Treat as message to AI
            self.send_message(command)
    
    def show_help(self, args=""):
        """Show help"""
        print("""
Commands:
  help          - Show this help
  new [name]    - Create new project
  open [name]   - Open existing project
  list          - List all projects
  chat [name]   - Create new chat session
  chats         - List chat sessions
  switch [name] - Switch to different chat
  context       - Manage context files
  model [name]  - Set model (default: deepseek-coder:latest)
  models        - List available models
  timeout [sec] - Set timeout in seconds (default: 600)
  history       - Show chat history
  clear         - Clear screen
  exit/quit     - Exit program
  
Any other text will be sent as a message to the AI.
        """)
    
    def new_project(self, name):
        """Create new project"""
        if not name:
            name = input("Project name: ").strip()
            if not name:
                return
        
        path = input("Project path (or press Enter for current directory): ").strip()
        if not path:
            path = os.getcwd()
        
        # Create project
        self.current_project = Project(name=name, path=path)
        
        # Create initial chat
        session = ChatSession(id=self._generate_id(), name="Main")
        self.current_project.chat_sessions[session.id] = session
        self.current_project.active_session_id = session.id
        
        self.save_project()
        print(f"Created project: {name}")
    
    def open_project(self, name):
        """Open existing project"""
        if not name:
            self.list_projects()
            name = input("Project name: ").strip()
            if not name:
                return
        
        self.load_project(name)
    
    def list_projects(self, args=""):
        """List all projects"""
        projects = list(self.projects_dir.glob("*.json"))
        if not projects:
            print("No projects found.")
            return
        
        print("\nAvailable projects:")
        for p in projects:
            print(f"  - {p.stem}")
        print()
    
    def new_chat(self, name):
        """Create new chat session"""
        if not self.current_project:
            print("No project loaded. Use 'new' or 'open' first.")
            return
        
        if not name:
            name = input("Chat name: ").strip()
            if not name:
                return
        
        session = ChatSession(id=self._generate_id(), name=name)
        self.current_project.chat_sessions[session.id] = session
        self.current_project.active_session_id = session.id
        
        self.save_project()
        print(f"Created chat: {name}")
    
    def list_chats(self, args=""):
        """List chat sessions"""
        if not self.current_project:
            print("No project loaded.")
            return
        
        print("\nChat sessions:")
        for session in self.current_project.chat_sessions.values():
            marker = "*" if session.id == self.current_project.active_session_id else " "
            print(f"  {marker} {session.name} ({len(session.messages)} messages)")
        print()
    
    def switch_chat(self, name):
        """Switch to different chat"""
        if not self.current_project:
            print("No project loaded.")
            return
        
        if not name:
            self.list_chats()
            name = input("Chat name: ").strip()
            if not name:
                return
        
        for session in self.current_project.chat_sessions.values():
            if session.name.lower() == name.lower():
                self.current_project.active_session_id = session.id
                self.save_project()
                print(f"Switched to chat: {session.name}")
                return
        
        print(f"Chat not found: {name}")
    
    def manage_context(self, args=""):
        """Manage context files"""
        if not self.current_project or not self.current_project.active_session_id:
            print("No active chat session.")
            return
        
        session = self.current_project.chat_sessions[self.current_project.active_session_id]
        
        if not args:
            # Show current context files
            if session.context_files:
                print("\nContext files:")
                for i, file in enumerate(session.context_files):
                    print(f"  {i+1}. {file}")
            else:
                print("No context files.")
            
            print("\nOptions:")
            print("  context add [file]    - Add context file")
            print("  context remove [num]  - Remove context file")
            return
        
        parts = args.split(maxsplit=1)
        action = parts[0].lower()
        
        if action == "add":
            file_path = parts[1] if len(parts) > 1 else input("File path: ").strip()
            if file_path and os.path.exists(file_path):
                if file_path not in session.context_files:
                    session.context_files.append(file_path)
                    self.save_project()
                    print(f"Added context file: {file_path}")
                else:
                    print("File already in context.")
            else:
                print("File not found.")
        
        elif action == "remove":
            if len(parts) > 1 and parts[1].isdigit():
                idx = int(parts[1]) - 1
                if 0 <= idx < len(session.context_files):
                    removed = session.context_files.pop(idx)
                    self.save_project()
                    print(f"Removed: {removed}")
                else:
                    print("Invalid file number.")
            else:
                print("Usage: context remove [number]")
    
    def set_model(self, model_name):
        """Set the model to use"""
        if not model_name:
            print(f"Current model: {self.model}")
            return
        
        self.model = model_name
        print(f"Model set to: {self.model}")
    
    def list_models(self, args=""):
        """List available models"""
        models = self.ollama_client.list_models()
        if models:
            print("\nAvailable models:")
            for model in models:
                marker = "*" if model == self.model else " "
                print(f"  {marker} {model}")
        else:
            print("Could not retrieve models. Is Ollama running?")
    
    def set_timeout(self, timeout_str):
        """Set the timeout for Ollama requests"""
        if not timeout_str:
            print(f"Current timeout: {self.ollama_client.timeout} seconds")
            return
        
        try:
            timeout = int(timeout_str)
            if timeout < 1:
                print("Timeout must be at least 1 second")
                return
            
            self.ollama_client.timeout = timeout
            print(f"Timeout set to: {timeout} seconds")
        except ValueError:
            print("Invalid timeout value. Please provide a number in seconds.")
    
    def show_history(self, args=""):
        """Show chat history"""
        if not self.current_project or not self.current_project.active_session_id:
            print("No active chat session.")
            return
        
        session = self.current_project.chat_sessions[self.current_project.active_session_id]
        
        if not session.messages:
            print("No messages in this chat.")
            return
        
        print(f"\n=== Chat History: {session.name} ===\n")
        for msg in session.messages:
            print(f"{msg.role.upper()}: {msg.content}\n")
    
    def clear_screen(self, args=""):
        """Clear screen"""
        os.system('cls' if os.name == 'nt' else 'clear')
    
    def send_message(self, message):
        """Send message to AI"""
        if not self.current_project or not self.current_project.active_session_id:
            print("No active chat. Create a project and chat first.")
            return
        
        session = self.current_project.chat_sessions[self.current_project.active_session_id]
        
        # Add user message
        user_msg = ChatMessage(role="user", content=message)
        session.messages.append(user_msg)
        
        print("\nGenerating response...")
        
        # Build conversation history
        history = "\n\n".join([
            f"{msg.role.upper()}: {msg.content}"
            for msg in session.messages[-10:]  # Last 10 messages
        ])
        
        # Get response
        response = self.ollama_client.generate(
            prompt=history,
            model=self.model,
            context=session.context_files
        )
        
        # Add assistant message
        assistant_msg = ChatMessage(role="assistant", content=response)
        session.messages.append(assistant_msg)
        
        print(f"\nASSISTANT: {response}\n")
        
        self.save_project()
    
    def save_project(self):
        """Save current project"""
        if not self.current_project:
            return
        
        project_file = self.projects_dir / f"{self.current_project.name}.json"
        with open(project_file, 'w') as f:
            json.dump(self.current_project.to_dict(), f, indent=2)
        
        # Save last project
        last_project_file = self.projects_dir / ".last_project"
        with open(last_project_file, 'w') as f:
            f.write(self.current_project.name)
    
    def load_project(self, name):
        """Load project by name"""
        project_file = self.projects_dir / f"{name}.json"
        if not project_file.exists():
            print(f"Project not found: {name}")
            return
        
        with open(project_file, 'r') as f:
            data = json.load(f)
        
        # Reconstruct project
        self.current_project = Project(
            name=data['name'],
            path=data['path'],
            created_at=datetime.fromisoformat(data['created_at'])
        )
        
        # Reconstruct chat sessions
        for sid, sdata in data['chat_sessions'].items():
            session = ChatSession(
                id=sdata['id'],
                name=sdata['name'],
                created_at=datetime.fromisoformat(sdata['created_at']),
                context_files=sdata.get('context_files', [])
            )
            
            # Reconstruct messages
            for mdata in sdata['messages']:
                msg = ChatMessage(
                    role=mdata['role'],
                    content=mdata['content'],
                    timestamp=datetime.fromisoformat(mdata['timestamp'])
                )
                session.messages.append(msg)
            
            self.current_project.chat_sessions[sid] = session
        
        self.current_project.active_session_id = data.get('active_session_id')
        print(f"Loaded project: {name}")
    
    def load_last_project(self):
        """Load the last opened project"""
        last_project_file = self.projects_dir / ".last_project"
        if last_project_file.exists():
            with open(last_project_file, 'r') as f:
                last_project = f.read().strip()
            if last_project:
                self.load_project(last_project)
    
    def _generate_id(self):
        """Generate unique ID"""
        import hashlib
        return hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:8]


def main():
    cli = AlfredCLI()
    cli.run()


if __name__ == "__main__":
    main()