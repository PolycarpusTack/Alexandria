> how do I launch it?

● To launch the Alexandria Platform, follow these steps:

Prerequisites

First, ensure you have the required dependencies:

# Check Node.js version (requires >= 18.0.0)

node --version

# Install dependencies

npm install

Environment Setup

Create a .env file in the root directory with the required configuration:

# Required security configurations

JWT_SECRET=your-secure-jwt-secret-at-least-32-characters-long
ENCRYPTION_KEY=your-secure-encryption-key-at-least-32-characters

# Environment

NODE_ENV=development

# Optional configurations

PORT=4000
CLIENT_PORT=3000
LOG_LEVEL=info

# Database (if using PostgreSQL instead of in-memory)

# DB_TYPE=postgres

# DB_HOST=localhost

# DB_PORT=5432

# DB_NAME=alexandria

# DB_USER=your-db-user

# DB_PASSWORD=your-db-password

# File storage

STORAGE_PATH=./storage
QUARANTINE_PATH=./storage/quarantine

# Ollama configuration (for crash analyzer plugin)

OLLAMA_HOST=http://localhost:11434

Quick Start

Development Mode

# Run both server and client in development mode

npm run dev

This will start:

- Backend server on http://localhost:4000
- Frontend client on http://localhost:3000

Production Build

# Build the application

npm run build

# Start production server

npm start

Alternative Launch Methods

Server Only

node start-server-only.js

Client Only

node start-client.js

Windows Users

Use the provided batch files:

# Development mode

start-dev.bat

# QA mode

start-qa.bat

# Setup

setup-windows.bat

First Time Setup

1. Platform will create default admin user on first launch


    - Check server logs for the temporary password
    - Change it immediately after first login

2. Access the application


    - Open http://localhost:3000 in your browser
    - Login with admin credentials

3. For Crash Analyzer Plugin


    - Ensure Ollama is installed and running: https://ollama.ai
    - Pull a model: ollama pull llama2

Troubleshooting

Port Already in Use

# Kill processes on specific ports

# Linux/Mac

lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9

# Windows

netstat -ano | findstr :3000
taskkill /PID <PID> /F

Build Issues

# Clean and reinstall

rm -rf node_modules package-lock.json
npm install

# Run platform setup

npm run setup

Windows-Specific Issues

# Run the Windows fix script

windows-final-fix.ps1

# Or use the build scripts

build-windows.bat

Verify Installation

Once running, you should see:

🚀 Alexandria Platform Server
📍 Server running on http://localhost:4000
🔒 Security services initialized
🔌 Plugin system ready
📊 Database connected
✅ System ready

🎨 Client application available at http://localhost:3000

Default Credentials

- Username: admin
- Password: Check server logs for temporary password (change immediately)

Next Steps

1. Change the admin password
2. Create additional users
3. Install/activate plugins through the UI
4. Configure security settings
5. Set up proper database (PostgreSQL) for production

The platform should now be running successfully!
