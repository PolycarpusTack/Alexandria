#!/usr/bin/env python3
"""
ALFRED Web UI - Modern web-based interface for ALFRED
Using FastAPI backend and modern web frontend
"""

import os
import json
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import hashlib

from fastapi import FastAPI, WebSocket, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import core Alfred components
from alfred import ChatMessage, ChatSession, Project, OllamaClient
from alfred_security_fixes import safe_json_load, safe_json_save, sanitize_filename
from alfred_validators import sanitize_input
from alfred_logger import get_logger

# Create FastAPI app
app = FastAPI(title="ALFRED Web API", version="2.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state (in production, use proper state management)
projects: Dict[str, Project] = {}
ollama_client = OllamaClient()
logger = get_logger()
active_connections: List[WebSocket] = []


# Pydantic models for API
class ProjectCreate(BaseModel):
    name: str
    path: str
    project_type: str = "general"


class MessageSend(BaseModel):
    content: str
    project_id: str
    session_id: str
    model: str = "deepseek-coder:latest"


class ProjectResponse(BaseModel):
    id: str
    name: str
    path: str
    created_at: str
    chat_sessions: Dict[str, Any]
    project_type: Optional[str]


# API Routes
@app.get("/")
async def root():
    """Serve the web UI"""
    return HTMLResponse(content=WEB_UI_HTML)


@app.get("/api/status")
async def get_status():
    """Get system status"""
    try:
        models = ollama_client.list_models()
        return {
            "status": "online",
            "ollama_connected": len(models) > 0,
            "models": models,
            "projects_count": len(projects)
        }
    except Exception as e:
        return {
            "status": "error",
            "ollama_connected": False,
            "error": str(e)
        }


@app.post("/api/projects", response_model=ProjectResponse)
async def create_project(project: ProjectCreate):
    """Create a new project"""
    try:
        # Create project instance
        proj = Project(
            name=sanitize_input(project.name),
            path=project.path,
            project_type=project.project_type
        )
        
        # Create default chat session
        session_id = hashlib.md5(f"main-{datetime.now().isoformat()}".encode()).hexdigest()[:8]
        main_session = ChatSession(id=session_id, name="Main Chat")
        proj.chat_sessions[session_id] = main_session
        proj.active_session_id = session_id
        
        # Store project
        proj_id = hashlib.md5(proj.name.encode()).hexdigest()[:8]
        projects[proj_id] = proj
        
        # Save to disk
        save_project(proj)
        
        return ProjectResponse(
            id=proj_id,
            name=proj.name,
            path=proj.path,
            created_at=proj.created_at.isoformat(),
            chat_sessions={k: v.to_dict() for k, v in proj.chat_sessions.items()},
            project_type=proj.project_type
        )
        
    except Exception as e:
        logger.log_error("Failed to create project", error=e)
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/projects")
async def list_projects():
    """List all projects"""
    return [
        {
            "id": proj_id,
            "name": proj.name,
            "path": proj.path,
            "created_at": proj.created_at.isoformat(),
            "project_type": proj.project_type
        }
        for proj_id, proj in projects.items()
    ]


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time chat"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            
            if data["type"] == "chat":
                # Process chat message
                response = await process_chat_message(data)
                
                # Send response
                await websocket.send_json({
                    "type": "response",
                    "content": response,
                    "timestamp": datetime.now().isoformat()
                })
                
            elif data["type"] == "status":
                # Send status update
                status = await get_status()
                await websocket.send_json({
                    "type": "status",
                    "data": status
                })
                
    except Exception as e:
        logger.log_error("WebSocket error", error=e)
    finally:
        active_connections.remove(websocket)


async def process_chat_message(data: Dict) -> str:
    """Process chat message with Ollama"""
    try:
        project_id = data.get("project_id")
        session_id = data.get("session_id")
        content = sanitize_input(data.get("content", ""))
        model = data.get("model", "deepseek-coder:latest")
        
        if project_id not in projects:
            return "Error: Project not found"
            
        project = projects[project_id]
        session = project.chat_sessions.get(session_id)
        
        if not session:
            return "Error: Session not found"
        
        # Add user message
        user_msg = ChatMessage(role="user", content=content)
        session.messages.append(user_msg)
        
        # Generate response
        response = ollama_client.generate(
            prompt=content,
            model=model,
            context=session.context_files
        )
        
        # Add assistant message
        assistant_msg = ChatMessage(role="assistant", content=response)
        session.messages.append(assistant_msg)
        
        # Save project
        save_project(project)
        
        return response
        
    except Exception as e:
        logger.log_error("Failed to process chat message", error=e)
        return f"Error: {str(e)}"


def save_project(project: Project):
    """Save project to disk"""
    projects_dir = Path.home() / ".alfred" / "projects"
    projects_dir.mkdir(parents=True, exist_ok=True)
    
    filename = sanitize_filename(project.name) + ".json"
    filepath = projects_dir / filename
    
    safe_json_save(project.to_dict(), str(filepath))


# Modern Web UI HTML
WEB_UI_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ALFRED - AI Development Assistant</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .chat-message { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body class="bg-gray-900 text-gray-100">
    <div id="app" class="h-screen flex flex-col">
        <!-- Header -->
        <header class="bg-gray-800 border-b border-gray-700 px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        ALFRED
                    </h1>
                    <span class="text-sm text-gray-400">AI Development Assistant</span>
                </div>
                <div class="flex items-center space-x-4">
                    <span v-if="connected" class="flex items-center text-green-400">
                        <span class="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                        Connected
                    </span>
                    <span v-else class="flex items-center text-red-400">
                        <span class="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                        Disconnected
                    </span>
                    <select v-model="selectedModel" class="bg-gray-700 px-3 py-1 rounded">
                        <option v-for="model in models" :value="model">{{ model }}</option>
                    </select>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <div class="flex-1 flex overflow-hidden">
            <!-- Sidebar -->
            <aside class="w-64 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
                <button @click="showNewProject = true" 
                        class="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded mb-4 transition">
                    New Project
                </button>
                
                <h3 class="text-sm font-semibold text-gray-400 mb-2">Projects</h3>
                <div v-for="project in projects" :key="project.id"
                     @click="selectProject(project)"
                     class="cursor-pointer p-2 rounded hover:bg-gray-700 transition"
                     :class="{ 'bg-gray-700': currentProject?.id === project.id }">
                    <div class="font-medium">{{ project.name }}</div>
                    <div class="text-xs text-gray-400">{{ project.project_type }}</div>
                </div>
            </aside>

            <!-- Chat Area -->
            <main class="flex-1 flex flex-col bg-gray-850">
                <!-- Chat Messages -->
                <div class="flex-1 overflow-y-auto p-6" ref="chatContainer">
                    <div v-if="!currentProject" class="text-center text-gray-500 mt-20">
                        Select or create a project to start
                    </div>
                    <div v-else>
                        <div v-for="message in messages" :key="message.timestamp" 
                             class="chat-message mb-4">
                            <div v-if="message.role === 'user'" class="flex justify-end">
                                <div class="bg-blue-600 rounded-lg px-4 py-2 max-w-2xl">
                                    {{ message.content }}
                                </div>
                            </div>
                            <div v-else class="flex justify-start">
                                <div class="bg-gray-700 rounded-lg px-4 py-2 max-w-2xl">
                                    <pre class="whitespace-pre-wrap font-mono text-sm">{{ message.content }}</pre>
                                </div>
                            </div>
                        </div>
                        <div v-if="thinking" class="flex justify-start">
                            <div class="bg-gray-700 rounded-lg px-4 py-2">
                                <span class="animate-pulse">AI is thinking...</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Input Area -->
                <div class="border-t border-gray-700 p-4">
                    <div class="flex space-x-4">
                        <textarea v-model="inputMessage"
                                  @keydown.ctrl.enter="sendMessage"
                                  :disabled="!currentProject || thinking"
                                  class="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 resize-none focus:outline-none focus:border-blue-500"
                                  rows="3"
                                  placeholder="Type your message... (Ctrl+Enter to send)"></textarea>
                        <button @click="sendMessage"
                                :disabled="!currentProject || !inputMessage.trim() || thinking"
                                class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 px-6 py-2 rounded-lg transition">
                            Send
                        </button>
                    </div>
                </div>
            </main>
        </div>

        <!-- New Project Modal -->
        <div v-if="showNewProject" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-gray-800 rounded-lg p-6 w-96">
                <h2 class="text-xl font-semibold mb-4">New Project</h2>
                <input v-model="newProject.name" 
                       class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-3"
                       placeholder="Project Name">
                <input v-model="newProject.path"
                       class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-3"
                       placeholder="Project Path">
                <select v-model="newProject.type"
                        class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 mb-4">
                    <option value="general">General</option>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="web">Web</option>
                </select>
                <div class="flex space-x-3">
                    <button @click="createProject"
                            class="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition">
                        Create
                    </button>
                    <button @click="showNewProject = false"
                            class="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded transition">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const { createApp } = Vue;

        createApp({
            data() {
                return {
                    connected: false,
                    ws: null,
                    projects: [],
                    currentProject: null,
                    messages: [],
                    inputMessage: '',
                    thinking: false,
                    models: ['deepseek-coder:latest'],
                    selectedModel: 'deepseek-coder:latest',
                    showNewProject: false,
                    newProject: {
                        name: '',
                        path: '',
                        type: 'general'
                    }
                }
            },
            mounted() {
                this.connectWebSocket();
                this.loadProjects();
            },
            methods: {
                connectWebSocket() {
                    this.ws = new WebSocket('ws://localhost:8000/ws');
                    
                    this.ws.onopen = () => {
                        this.connected = true;
                        this.ws.send(JSON.stringify({ type: 'status' }));
                    };
                    
                    this.ws.onmessage = (event) => {
                        const data = JSON.parse(event.data);
                        
                        if (data.type === 'response') {
                            this.messages.push({
                                role: 'assistant',
                                content: data.content,
                                timestamp: data.timestamp
                            });
                            this.thinking = false;
                            this.scrollToBottom();
                        } else if (data.type === 'status') {
                            this.models = data.data.models || ['deepseek-coder:latest'];
                        }
                    };
                    
                    this.ws.onclose = () => {
                        this.connected = false;
                        setTimeout(() => this.connectWebSocket(), 5000);
                    };
                },
                
                async loadProjects() {
                    try {
                        const response = await fetch('/api/projects');
                        this.projects = await response.json();
                    } catch (error) {
                        console.error('Failed to load projects:', error);
                    }
                },
                
                selectProject(project) {
                    this.currentProject = project;
                    this.messages = [];
                    // Load project messages here
                },
                
                sendMessage() {
                    if (!this.inputMessage.trim() || !this.currentProject || this.thinking) return;
                    
                    this.messages.push({
                        role: 'user',
                        content: this.inputMessage,
                        timestamp: new Date().toISOString()
                    });
                    
                    this.thinking = true;
                    
                    this.ws.send(JSON.stringify({
                        type: 'chat',
                        project_id: this.currentProject.id,
                        session_id: 'main',
                        content: this.inputMessage,
                        model: this.selectedModel
                    }));
                    
                    this.inputMessage = '';
                    this.scrollToBottom();
                },
                
                async createProject() {
                    try {
                        const response = await fetch('/api/projects', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: this.newProject.name,
                                path: this.newProject.path,
                                project_type: this.newProject.type
                            })
                        });
                        
                        const project = await response.json();
                        this.projects.push(project);
                        this.selectProject(project);
                        this.showNewProject = false;
                        this.newProject = { name: '', path: '', type: 'general' };
                    } catch (error) {
                        console.error('Failed to create project:', error);
                    }
                },
                
                scrollToBottom() {
                    this.$nextTick(() => {
                        this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight;
                    });
                }
            }
        }).mount('#app');
    </script>
</body>
</html>
"""


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)