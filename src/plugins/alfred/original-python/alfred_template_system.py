#!/usr/bin/env python3
"""
Project template system for ALFRED
Provides built-in and custom project templates with wizard support
"""

import os
import json
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field, asdict
from datetime import datetime
import subprocess

from alfred_exceptions import TemplateError


@dataclass
class TemplateFile:
    """Represents a file in a template"""
    path: str  # Relative path within project
    content: str  # File content (can include variables)
    binary: bool = False  # Whether this is a binary file
    permissions: Optional[int] = None  # Unix file permissions
    
    def render(self, variables: Dict[str, Any]) -> str:
        """Render file content with variables"""
        if self.binary:
            return self.content
        
        # Simple variable substitution
        rendered = self.content
        for key, value in variables.items():
            rendered = rendered.replace(f"{{{{ {key} }}}}", str(value))
        
        return rendered


@dataclass
class TemplateConfig:
    """Template configuration"""
    name: str
    category: str
    description: str
    author: str = "ALFRED"
    version: str = "1.0.0"
    icon: str = "📁"  # Emoji icon
    
    # Variables that can be customized
    variables: List[Dict[str, Any]] = field(default_factory=list)
    
    # Dependencies to install
    dependencies: Dict[str, List[str]] = field(default_factory=dict)
    
    # Post-creation hooks
    post_create_commands: List[str] = field(default_factory=list)
    
    # Required tools
    required_tools: List[str] = field(default_factory=list)
    
    # Tags for searching
    tags: List[str] = field(default_factory=list)


@dataclass
class ProjectTemplate:
    """Complete project template"""
    config: TemplateConfig
    files: List[TemplateFile]
    directories: List[str] = field(default_factory=list)
    
    def validate(self) -> bool:
        """Validate template structure"""
        # Check for required fields
        if not self.config.name or not self.config.category:
            return False
        
        # Check for at least one file
        if not self.files and not self.directories:
            return False
        
        return True
    
    def get_variable_defaults(self) -> Dict[str, Any]:
        """Get default values for all variables"""
        defaults = {
            "project_name": "my_project",
            "author": os.getenv("USER", "developer"),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "year": datetime.now().year
        }
        
        # Add template-specific variables
        for var in self.config.variables:
            if "default" in var:
                defaults[var["name"]] = var["default"]
        
        return defaults


class TemplateRegistry:
    """Registry of available templates"""
    
    def __init__(self, templates_dir: Optional[Path] = None):
        self.templates_dir = templates_dir or Path.home() / ".alfred" / "templates"
        self.templates_dir.mkdir(parents=True, exist_ok=True)
        
        self.builtin_templates: Dict[str, ProjectTemplate] = {}
        self.custom_templates: Dict[str, ProjectTemplate] = {}
        
        # Load built-in templates
        self._load_builtin_templates()
        
        # Load custom templates
        self._load_custom_templates()
    
    def _load_builtin_templates(self):
        """Load built-in templates"""
        # Python Web Application
        self.builtin_templates["python-web"] = self._create_python_web_template()
        
        # Python CLI Application
        self.builtin_templates["python-cli"] = self._create_python_cli_template()
        
        # Python Data Science
        self.builtin_templates["python-datascience"] = self._create_python_datascience_template()
        
        # JavaScript/Node.js Web App
        self.builtin_templates["nodejs-web"] = self._create_nodejs_web_template()
        
        # React Application
        self.builtin_templates["react-app"] = self._create_react_app_template()
        
        # Python FastAPI
        self.builtin_templates["python-fastapi"] = self._create_fastapi_template()
        
        # Python Flask
        self.builtin_templates["python-flask"] = self._create_flask_template()
        
        # Machine Learning Project
        self.builtin_templates["ml-project"] = self._create_ml_project_template()
        
        # Microservice
        self.builtin_templates["microservice"] = self._create_microservice_template()
        
        # Documentation Site
        self.builtin_templates["docs-site"] = self._create_docs_site_template()
    
    def _create_python_web_template(self) -> ProjectTemplate:
        """Create Python web application template"""
        config = TemplateConfig(
            name="Python Web Application",
            category="Web Development",
            description="Modern Python web application with Flask/FastAPI",
            icon="🌐",
            variables=[
                {
                    "name": "framework",
                    "type": "choice",
                    "label": "Web Framework",
                    "choices": ["flask", "fastapi", "django"],
                    "default": "fastapi"
                },
                {
                    "name": "database",
                    "type": "choice",
                    "label": "Database",
                    "choices": ["sqlite", "postgresql", "mysql", "none"],
                    "default": "sqlite"
                },
                {
                    "name": "include_docker",
                    "type": "boolean",
                    "label": "Include Docker configuration",
                    "default": True
                }
            ],
            dependencies={
                "pip": ["flask", "flask-cors", "python-dotenv", "gunicorn"]
            },
            post_create_commands=[
                "python -m venv venv",
                "pip install -r requirements.txt"
            ],
            tags=["python", "web", "api", "backend"]
        )
        
        files = [
            TemplateFile(
                path="app.py",
                content='''from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({
        "message": "Welcome to {{ project_name }}",
        "version": "1.0.0"
    })

@app.route('/api/health')
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=True, port=port)
'''
            ),
            TemplateFile(
                path="requirements.txt",
                content='''flask==2.3.2
flask-cors==4.0.0
python-dotenv==1.0.0
gunicorn==21.2.0
pytest==7.4.0
pytest-cov==4.1.0
'''
            ),
            TemplateFile(
                path=".env.example",
                content='''# Environment variables
PORT=5000
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///app.db
'''
            ),
            TemplateFile(
                path="README.md",
                content='''# {{ project_name }}

{{ description }}

## Getting Started

1. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Run the application:
   ```bash
   python app.py
   ```

## API Endpoints

- `GET /` - Home endpoint
- `GET /api/health` - Health check

## Development

Created with ALFRED on {{ date }}
'''
            ),
            TemplateFile(
                path=".gitignore",
                content='''# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# Database
*.db
*.sqlite3

# Logs
*.log

# OS
.DS_Store
Thumbs.db
'''
            )
        ]
        
        directories = ["static", "templates", "tests"]
        
        return ProjectTemplate(config=config, files=files, directories=directories)
    
    def _create_python_cli_template(self) -> ProjectTemplate:
        """Create Python CLI application template"""
        config = TemplateConfig(
            name="Python CLI Application",
            category="Command Line",
            description="Command-line application with Click framework",
            icon="⌨️",
            variables=[
                {
                    "name": "cli_name",
                    "type": "string",
                    "label": "CLI command name",
                    "default": "mycli"
                }
            ],
            dependencies={
                "pip": ["click", "colorama", "rich"]
            },
            tags=["python", "cli", "terminal"]
        )
        
        files = [
            TemplateFile(
                path="cli.py",
                content='''#!/usr/bin/env python3
"""
{{ project_name }} - {{ description }}
"""

import click
from rich.console import Console
from rich.table import Table

console = Console()

@click.group()
@click.version_option(version='1.0.0')
def cli():
    """{{ description }}"""
    pass

@cli.command()
@click.option('--name', prompt='Your name', help='The person to greet.')
def hello(name):
    """Simple greeting command"""
    console.print(f"[bold green]Hello {name}![/bold green]")

@cli.command()
def info():
    """Show information about the CLI"""
    table = Table(title="{{ project_name }} Info")
    table.add_column("Property", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("Version", "1.0.0")
    table.add_row("Author", "{{ author }}")
    table.add_row("Created", "{{ date }}")
    
    console.print(table)

if __name__ == '__main__':
    cli()
'''
            ),
            TemplateFile(
                path="setup.py",
                content='''from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="{{ project_name }}",
    version="1.0.0",
    author="{{ author }}",
    description="{{ description }}",
    long_description=long_description,
    long_description_content_type="text/markdown",
    py_modules=['cli'],
    install_requires=[
        'click',
        'colorama',
        'rich',
    ],
    entry_points={
        'console_scripts': [
            '{{ cli_name }}=cli:cli',
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.7',
)
'''
            ),
            TemplateFile(
                path="README.md",
                content='''# {{ project_name }}

{{ description }}

## Installation

```bash
pip install -e .
```

## Usage

```bash
{{ cli_name }} --help
{{ cli_name }} hello --name="World"
{{ cli_name }} info
```

## Development

```bash
# Install in development mode
pip install -e .

# Run tests
pytest
```
'''
            )
        ]
        
        return ProjectTemplate(config=config, files=files, directories=["tests"])
    
    def _create_python_datascience_template(self) -> ProjectTemplate:
        """Create Python data science template"""
        config = TemplateConfig(
            name="Python Data Science Project",
            category="Data Science",
            description="Jupyter notebooks with data analysis setup",
            icon="📊",
            variables=[
                {
                    "name": "include_ml",
                    "type": "boolean",
                    "label": "Include machine learning libraries",
                    "default": True
                }
            ],
            dependencies={
                "pip": [
                    "jupyter", "pandas", "numpy", "matplotlib", 
                    "seaborn", "plotly", "scikit-learn"
                ]
            },
            post_create_commands=[
                "jupyter notebook"
            ],
            tags=["python", "datascience", "jupyter", "analysis"]
        )
        
        files = [
            TemplateFile(
                path="notebooks/01_exploration.ipynb",
                content=json.dumps({
                    "cells": [
                        {
                            "cell_type": "markdown",
                            "metadata": {},
                            "source": [
                                "# {{ project_name }} - Data Exploration\\n",
                                "\\n",
                                "Created: {{ date }}\\n",
                                "Author: {{ author }}"
                            ]
                        },
                        {
                            "cell_type": "code",
                            "execution_count": None,
                            "metadata": {},
                            "outputs": [],
                            "source": [
                                "import pandas as pd\\n",
                                "import numpy as np\\n",
                                "import matplotlib.pyplot as plt\\n",
                                "import seaborn as sns\\n",
                                "\\n",
                                "# Configure visualization\\n",
                                "plt.style.use('seaborn-v0_8')\\n",
                                "%matplotlib inline"
                            ]
                        }
                    ],
                    "metadata": {
                        "kernelspec": {
                            "display_name": "Python 3",
                            "language": "python",
                            "name": "python3"
                        }
                    },
                    "nbformat": 4,
                    "nbformat_minor": 4
                }, indent=2)
            ),
            TemplateFile(
                path="requirements.txt",
                content='''jupyter==1.0.0
pandas==2.0.3
numpy==1.24.3
matplotlib==3.7.1
seaborn==0.12.2
plotly==5.15.0
scikit-learn==1.3.0
scipy==1.11.1
'''
            ),
            TemplateFile(
                path="README.md",
                content='''# {{ project_name }}

{{ description }}

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Usage

Start Jupyter:
```bash
jupyter notebook
```

## Project Structure

```
├── data/
│   ├── raw/         # Original data
│   ├── processed/   # Cleaned data
│   └── external/    # External datasets
├── notebooks/       # Jupyter notebooks
├── src/            # Source code
├── reports/        # Generated reports
└── models/         # Trained models
```
'''
            )
        ]
        
        directories = [
            "data/raw", "data/processed", "data/external",
            "notebooks", "src", "reports", "models"
        ]
        
        return ProjectTemplate(config=config, files=files, directories=directories)
    
    def _create_nodejs_web_template(self) -> ProjectTemplate:
        """Create Node.js web application template"""
        config = TemplateConfig(
            name="Node.js Web Application",
            category="Web Development",
            description="Express.js web application with modern setup",
            icon="🟢",
            variables=[
                {
                    "name": "use_typescript",
                    "type": "boolean",
                    "label": "Use TypeScript",
                    "default": True
                }
            ],
            dependencies={
                "npm": ["express", "cors", "dotenv", "nodemon"]
            },
            post_create_commands=[
                "npm install",
                "npm run dev"
            ],
            required_tools=["node", "npm"],
            tags=["javascript", "nodejs", "express", "web"]
        )
        
        files = [
            TemplateFile(
                path="server.js",
                content='''const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to {{ project_name }}',
        version: '1.0.0'
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy' });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
'''
            ),
            TemplateFile(
                path="package.json",
                content='''{
  "name": "{{ project_name }}",
  "version": "1.0.0",
  "description": "{{ description }}",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest"
  },
  "author": "{{ author }}",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.6.1"
  }
}
'''
            ),
            TemplateFile(
                path=".env.example",
                content='''PORT=3000
NODE_ENV=development
'''
            )
        ]
        
        directories = ["src", "public", "tests"]
        
        return ProjectTemplate(config=config, files=files, directories=directories)
    
    def _create_react_app_template(self) -> ProjectTemplate:
        """Create React application template"""
        config = TemplateConfig(
            name="React Application",
            category="Web Development",
            description="Modern React app with Vite",
            icon="⚛️",
            variables=[
                {
                    "name": "use_typescript",
                    "type": "boolean",
                    "label": "Use TypeScript",
                    "default": True
                },
                {
                    "name": "ui_library",
                    "type": "choice",
                    "label": "UI Library",
                    "choices": ["none", "material-ui", "chakra-ui", "tailwind"],
                    "default": "none"
                }
            ],
            post_create_commands=[
                "npm create vite@latest . -- --template react",
                "npm install",
                "npm run dev"
            ],
            required_tools=["node", "npm"],
            tags=["javascript", "react", "frontend", "spa"]
        )
        
        # For React, we'll use Vite's template
        files = [
            TemplateFile(
                path="README.md",
                content='''# {{ project_name }}

{{ description }}

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Preview Production Build

```bash
npm run preview
```

Created with ALFRED on {{ date }}
'''
            )
        ]
        
        return ProjectTemplate(config=config, files=files)
    
    def _create_fastapi_template(self) -> ProjectTemplate:
        """Create FastAPI template"""
        config = TemplateConfig(
            name="FastAPI Application",
            category="Web Development",
            description="Modern async API with FastAPI",
            icon="⚡",
            dependencies={
                "pip": ["fastapi", "uvicorn", "pydantic", "python-multipart"]
            },
            tags=["python", "fastapi", "api", "async"]
        )
        
        files = [
            TemplateFile(
                path="main.py",
                content='''from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI(
    title="{{ project_name }}",
    description="{{ description }}",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Item(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    price: float
    is_available: bool = True

# Routes
@app.get("/")
async def root():
    return {
        "message": "Welcome to {{ project_name }}",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/items/")
async def create_item(item: Item):
    # Add your logic here
    return {"item": item, "message": "Item created successfully"}

@app.get("/items/{item_id}")
async def read_item(item_id: int):
    # Add your logic here
    if item_id < 1:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"item_id": item_id, "name": "Sample Item"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
'''
            ),
            TemplateFile(
                path="requirements.txt",
                content='''fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
python-multipart==0.0.6
python-dotenv==1.0.0
pytest==7.4.3
httpx==0.25.2
'''
            )
        ]
        
        directories = ["app", "tests", "docs"]
        
        return ProjectTemplate(config=config, files=files, directories=directories)
    
    def _create_flask_template(self) -> ProjectTemplate:
        """Create Flask template"""
        config = TemplateConfig(
            name="Flask Application",
            category="Web Development",
            description="Flask web application with blueprints",
            icon="🧪",
            dependencies={
                "pip": ["flask", "flask-sqlalchemy", "flask-migrate", "flask-login"]
            },
            tags=["python", "flask", "web"]
        )
        
        files = [
            TemplateFile(
                path="app.py",
                content='''from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
import os

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///app.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    
    # Routes
    @app.route('/')
    def index():
        return render_template('index.html', title='{{ project_name }}')
    
    @app.route('/about')
    def about():
        return render_template('about.html', title='About')
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)
'''
            ),
            TemplateFile(
                path="templates/base.html",
                content='''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}{{ title }} - {{ project_name }}{% endblock %}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand" href="/">{{ project_name }}</a>
            <div class="navbar-nav">
                <a class="nav-link" href="/">Home</a>
                <a class="nav-link" href="/about">About</a>
            </div>
        </div>
    </nav>
    
    <main class="container my-5">
        {% block content %}{% endblock %}
    </main>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
'''
            ),
            TemplateFile(
                path="templates/index.html",
                content='''{% extends "base.html" %}

{% block content %}
<h1>Welcome to {{ project_name }}</h1>
<p>{{ description }}</p>
{% endblock %}
'''
            )
        ]
        
        directories = ["static/css", "static/js", "templates", "models", "routes"]
        
        return ProjectTemplate(config=config, files=files, directories=directories)
    
    def _create_ml_project_template(self) -> ProjectTemplate:
        """Create machine learning project template"""
        config = TemplateConfig(
            name="Machine Learning Project",
            category="Data Science",
            description="Complete ML project structure with training pipeline",
            icon="🤖",
            dependencies={
                "pip": [
                    "scikit-learn", "tensorflow", "torch", "pandas", "numpy",
                    "matplotlib", "seaborn", "jupyter", "mlflow", "optuna"
                ]
            },
            tags=["python", "ml", "ai", "datascience"]
        )
        
        files = [
            TemplateFile(
                path="src/train.py",
                content='''"""
Training pipeline for {{ project_name }}
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report
import joblib
import mlflow
import mlflow.sklearn

def load_data(path):
    """Load and return dataset"""
    # TODO: Implement data loading
    pass

def preprocess_data(X, y):
    """Preprocess features and targets"""
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    return X_scaled, y, scaler

def train_model(X_train, y_train):
    """Train and return model"""
    # TODO: Implement model training
    pass

def evaluate_model(model, X_test, y_test):
    """Evaluate model and log metrics"""
    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    
    print(f"Accuracy: {accuracy:.4f}")
    print("\\nClassification Report:")
    print(classification_report(y_test, predictions))
    
    return accuracy

def main():
    # MLflow tracking
    mlflow.set_experiment("{{ project_name }}")
    
    with mlflow.start_run():
        # Load data
        X, y = load_data("data/processed/train.csv")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Preprocess
        X_train, y_train, scaler = preprocess_data(X_train, y_train)
        X_test = scaler.transform(X_test)
        
        # Train model
        model = train_model(X_train, y_train)
        
        # Evaluate
        accuracy = evaluate_model(model, X_test, y_test)
        
        # Log to MLflow
        mlflow.log_metric("accuracy", accuracy)
        mlflow.sklearn.log_model(model, "model")
        
        # Save model and scaler
        joblib.dump(model, "models/model.pkl")
        joblib.dump(scaler, "models/scaler.pkl")

if __name__ == "__main__":
    main()
'''
            ),
            TemplateFile(
                path="src/predict.py",
                content='''"""
Prediction pipeline for {{ project_name }}
"""

import joblib
import pandas as pd
import numpy as np

class Predictor:
    def __init__(self, model_path="models/model.pkl", scaler_path="models/scaler.pkl"):
        self.model = joblib.load(model_path)
        self.scaler = joblib.load(scaler_path)
    
    def predict(self, X):
        """Make predictions on new data"""
        X_scaled = self.scaler.transform(X)
        predictions = self.model.predict(X_scaled)
        return predictions
    
    def predict_proba(self, X):
        """Get prediction probabilities"""
        X_scaled = self.scaler.transform(X)
        if hasattr(self.model, 'predict_proba'):
            return self.model.predict_proba(X_scaled)
        else:
            return None

if __name__ == "__main__":
    # Example usage
    predictor = Predictor()
    
    # Load test data
    # X_new = pd.read_csv("data/new_data.csv")
    # predictions = predictor.predict(X_new)
    # print(predictions)
'''
            ),
            TemplateFile(
                path="config/config.yaml",
                content='''# Configuration for {{ project_name }}

data:
  raw_data_path: "data/raw/"
  processed_data_path: "data/processed/"
  train_test_split: 0.2
  random_state: 42

model:
  type: "random_forest"  # Options: random_forest, xgboost, neural_network
  hyperparameters:
    n_estimators: 100
    max_depth: 10
    min_samples_split: 2

training:
  batch_size: 32
  epochs: 50
  learning_rate: 0.001
  early_stopping: true
  patience: 5

evaluation:
  metrics:
    - accuracy
    - precision
    - recall
    - f1_score
    - roc_auc
'''
            )
        ]
        
        directories = [
            "data/raw", "data/processed", "data/external",
            "notebooks/exploration", "notebooks/modeling",
            "src/data", "src/features", "src/models", "src/evaluation",
            "models", "reports/figures", "config", "tests"
        ]
        
        return ProjectTemplate(config=config, files=files, directories=directories)
    
    def _create_microservice_template(self) -> ProjectTemplate:
        """Create microservice template"""
        config = TemplateConfig(
            name="Microservice",
            category="Backend",
            description="Docker-ready microservice with health checks",
            icon="🐳",
            dependencies={
                "pip": ["fastapi", "uvicorn", "prometheus-client", "redis"]
            },
            tags=["microservice", "docker", "api", "cloud"]
        )
        
        files = [
            TemplateFile(
                path="Dockerfile",
                content='''FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
'''
            ),
            TemplateFile(
                path="docker-compose.yml",
                content='''version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379
      - ENV=development
    depends_on:
      - redis
    volumes:
      - ./logs:/app/logs
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - app-network

  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
'''
            ),
            TemplateFile(
                path="main.py",
                content='''from fastapi import FastAPI, status
from prometheus_client import Counter, Histogram, generate_latest
from prometheus_client.core import CollectorRegistry
from starlette.responses import Response
import redis
import os
import time
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics
registry = CollectorRegistry()
request_count = Counter('app_requests_total', 'Total requests', registry=registry)
request_duration = Histogram('app_request_duration_seconds', 'Request duration', registry=registry)

app = FastAPI(title="{{ project_name }}", version="1.0.0")

# Redis connection
redis_client = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))

@app.middleware("http")
async def add_metrics(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    request_count.inc()
    request_duration.observe(duration)
    
    return response

@app.get("/")
async def root():
    return {
        "service": "{{ project_name }}",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    try:
        # Check Redis connection
        redis_client.ping()
        return {"status": "healthy", "redis": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}, status.HTTP_503_SERVICE_UNAVAILABLE

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(registry), media_type="text/plain")

@app.post("/process")
async def process_data(data: dict):
    # Add your processing logic here
    result = {"processed": True, "data": data}
    
    # Cache result in Redis
    redis_client.setex(f"result:{data.get('id', 'unknown')}", 3600, str(result))
    
    return result
'''
            )
        ]
        
        return ProjectTemplate(config=config, files=files, directories=["logs", "config"])
    
    def _create_docs_site_template(self) -> ProjectTemplate:
        """Create documentation site template"""
        config = TemplateConfig(
            name="Documentation Site",
            category="Documentation",
            description="MkDocs documentation site with Material theme",
            icon="📚",
            dependencies={
                "pip": ["mkdocs", "mkdocs-material", "pymdown-extensions"]
            },
            post_create_commands=[
                "mkdocs serve"
            ],
            tags=["documentation", "mkdocs", "static-site"]
        )
        
        files = [
            TemplateFile(
                path="mkdocs.yml",
                content='''site_name: {{ project_name }}
site_description: {{ description }}
site_author: {{ author }}

theme:
  name: material
  palette:
    - scheme: default
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - scheme: slate
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-4
        name: Switch to light mode
  features:
    - navigation.tabs
    - navigation.sections
    - navigation.expand
    - navigation.top
    - search.suggest
    - search.highlight
    - content.tabs.link
    - content.code.annotation
    - content.code.copy

plugins:
  - search
  - tags

markdown_extensions:
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.inlinehilite
  - pymdownx.snippets
  - pymdownx.superfences
  - pymdownx.tabbed:
      alternate_style: true
  - admonition
  - pymdownx.details
  - pymdownx.mark
  - attr_list
  - md_in_html

nav:
  - Home: index.md
  - Getting Started:
    - Installation: getting-started/installation.md
    - Quick Start: getting-started/quickstart.md
  - User Guide:
    - Overview: guide/overview.md
    - Features: guide/features.md
  - API Reference:
    - Introduction: api/introduction.md
  - About:
    - License: about/license.md
    - Contributing: about/contributing.md
'''
            ),
            TemplateFile(
                path="docs/index.md",
                content='''# Welcome to {{ project_name }}

{{ description }}

## Features

- ✨ Feature 1
- 🚀 Feature 2
- 💡 Feature 3

## Quick Start

```bash
pip install {{ project_name }}
```

## Documentation

- [Getting Started](getting-started/installation.md)
- [User Guide](guide/overview.md)
- [API Reference](api/introduction.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](about/contributing.md).

---

Created with ❤️ using ALFRED
'''
            ),
            TemplateFile(
                path="docs/getting-started/installation.md",
                content='''# Installation

## Requirements

- Python 3.8+
- pip

## Install from PyPI

```bash
pip install {{ project_name }}
```

## Install from Source

```bash
git clone https://github.com/yourusername/{{ project_name }}.git
cd {{ project_name }}
pip install -e .
```

## Verify Installation

```python
import {{ project_name }}
print({{ project_name }}.__version__)
```
'''
            )
        ]
        
        directories = [
            "docs/getting-started", "docs/guide", "docs/api", "docs/about",
            "docs/assets/images", "docs/assets/css"
        ]
        
        return ProjectTemplate(config=config, files=files, directories=directories)
    
    def _load_custom_templates(self):
        """Load custom templates from disk"""
        custom_dir = self.templates_dir / "custom"
        if not custom_dir.exists():
            return
        
        for template_file in custom_dir.glob("*.json"):
            try:
                with open(template_file, 'r') as f:
                    data = json.load(f)
                
                # Reconstruct template
                config = TemplateConfig(**data['config'])
                files = [TemplateFile(**f) for f in data['files']]
                directories = data.get('directories', [])
                
                template = ProjectTemplate(
                    config=config,
                    files=files,
                    directories=directories
                )
                
                if template.validate():
                    self.custom_templates[template_file.stem] = template
                    
            except Exception as e:
                print(f"Failed to load template {template_file}: {e}")
    
    def get_all_templates(self) -> Dict[str, ProjectTemplate]:
        """Get all available templates"""
        templates = {}
        templates.update(self.builtin_templates)
        templates.update(self.custom_templates)
        return templates
    
    def get_template(self, template_id: str) -> Optional[ProjectTemplate]:
        """Get a specific template"""
        return self.get_all_templates().get(template_id)
    
    def get_templates_by_category(self) -> Dict[str, List[ProjectTemplate]]:
        """Get templates organized by category"""
        by_category = {}
        for template in self.get_all_templates().values():
            category = template.config.category
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(template)
        return by_category
    
    def search_templates(self, query: str) -> List[ProjectTemplate]:
        """Search templates by name, description, or tags"""
        query = query.lower()
        results = []
        
        for template in self.get_all_templates().values():
            if (query in template.config.name.lower() or
                query in template.config.description.lower() or
                any(query in tag.lower() for tag in template.config.tags)):
                results.append(template)
        
        return results
    
    def save_custom_template(self, template: ProjectTemplate) -> bool:
        """Save a custom template"""
        try:
            custom_dir = self.templates_dir / "custom"
            custom_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate unique ID
            template_id = template.config.name.lower().replace(" ", "-")
            template_file = custom_dir / f"{template_id}.json"
            
            # Serialize template
            data = {
                'config': asdict(template.config),
                'files': [asdict(f) for f in template.files],
                'directories': template.directories
            }
            
            with open(template_file, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Add to registry
            self.custom_templates[template_id] = template
            
            return True
            
        except Exception as e:
            print(f"Failed to save template: {e}")
            return False


class TemplateEngine:
    """Engine for creating projects from templates"""
    
    def __init__(self, registry: TemplateRegistry):
        self.registry = registry
    
    def create_project(self, template_id: str, project_path: Path, 
                      variables: Dict[str, Any]) -> bool:
        """Create a project from a template"""
        template = self.registry.get_template(template_id)
        if not template:
            raise TemplateError(f"Template '{template_id}' not found")
        
        try:
            # Ensure project directory exists
            project_path.mkdir(parents=True, exist_ok=True)
            
            # Merge with default variables
            all_variables = template.get_variable_defaults()
            all_variables.update(variables)
            
            # Create directories
            for directory in template.directories:
                dir_path = project_path / directory
                dir_path.mkdir(parents=True, exist_ok=True)
            
            # Create files
            for file_template in template.files:
                file_path = project_path / file_template.path
                file_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Render content
                content = file_template.render(all_variables)
                
                # Write file
                if file_template.binary:
                    file_path.write_bytes(content.encode())
                else:
                    file_path.write_text(content)
                
                # Set permissions if specified
                if file_template.permissions:
                    os.chmod(file_path, file_template.permissions)
            
            # Run post-creation commands
            for command in template.config.post_create_commands:
                self._run_command(command, project_path)
            
            return True
            
        except Exception as e:
            raise TemplateError(f"Failed to create project: {e}")
    
    def _run_command(self, command: str, cwd: Path):
        """Run a command in the project directory"""
        try:
            # Use subprocess for better security
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(cwd),
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                print(f"Command failed: {command}")
                print(f"Error: {result.stderr}")
        except Exception as e:
            print(f"Failed to run command '{command}': {e}")
    
    def validate_requirements(self, template: ProjectTemplate) -> List[str]:
        """Check if required tools are available"""
        missing = []
        
        for tool in template.config.required_tools:
            if not shutil.which(tool):
                missing.append(tool)
        
        return missing