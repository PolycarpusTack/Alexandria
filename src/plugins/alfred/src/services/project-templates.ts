/**
 * Project Templates Service
 *
 * Ported from original Alfred's template system
 * Contains built-in project templates for scaffolding
 */

import { ProjectTemplate, TemplateFile } from '../../ui/components/TemplateWizard';
import { Globe, Database, Cpu } from 'lucide-react';

export class ProjectTemplatesService {
  private templates: Map<string, ProjectTemplate> = new Map();

  constructor() {
    this.registerBuiltInTemplates();
  }

  /**
   * Register all built-in templates from original Alfred
   */
  private registerBuiltInTemplates(): void {
    // Python Web Application
    this.registerTemplate({
      id: 'python-web-app',
      name: 'Python Web Application',
      description: 'Flask or FastAPI web application with Docker support',
      category: 'web',
      icon: Globe,
      technologies: ['Python', 'Flask/FastAPI', 'Docker', 'PostgreSQL'],
      variables: [
        {
          name: 'project_name',
          label: 'Project Name',
          type: 'text',
          required: true,
          validation: (value) => {
            if (!value) return 'Project name is required';
            if (!/^[a-zA-Z0-9_-]+$/.test(value))
              return 'Use letters, numbers, hyphens, and underscores only';
            return null;
          }
        },
        {
          name: 'framework',
          label: 'Web Framework',
          type: 'select',
          default: 'fastapi',
          options: [
            { value: 'fastapi', label: 'FastAPI' },
            { value: 'flask', label: 'Flask' }
          ]
        },
        {
          name: 'include_docker',
          label: 'Include Docker?',
          type: 'boolean',
          default: true
        },
        {
          name: 'include_database',
          label: 'Include Database?',
          type: 'boolean',
          default: true
        }
      ],
      files: [
        {
          path: 'requirements.txt',
          content: `{{#if (eq framework "fastapi")}}fastapi==0.104.1
uvicorn[standard]==0.24.0
{{else}}flask==3.0.0
gunicorn==21.2.0
{{/if}}
{{#if include_database}}sqlalchemy==2.0.23
alembic==1.12.1
psycopg2-binary==2.9.9{{/if}}
python-dotenv==1.0.0
pytest==7.4.3
black==23.11.0
flake8==6.1.0`
        },
        {
          path: 'app.py',
          content: `{{#if (eq framework "fastapi")}}from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
{{#if include_database}}from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker{{/if}}
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="{{project_name}}")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

{{#if include_database}}
# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/{{project_name}}")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
{{/if}}

@app.get("/")
async def root():
    return {"message": "Welcome to {{project_name}}"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
{{else}}from flask import Flask, jsonify
{{#if include_database}}from flask_sqlalchemy import SQLAlchemy{{/if}}
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
{{#if include_database}}
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost/{{project_name}}')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
{{/if}}

@app.route('/')
def index():
    return jsonify({"message": "Welcome to {{project_name}}"})

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    app.run(debug=True)
{{/if}}`
        },
        {
          path: 'Dockerfile',
          condition: (vars) => vars.include_docker,
          content: `FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

{{#if (eq framework "fastapi")}}
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
{{else}}
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "app:app"]
{{/if}}`
        },
        {
          path: 'docker-compose.yml',
          condition: (vars) => vars.include_docker,
          content: `version: '3.8'

services:
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/{{project_name}}
    {{#if include_database}}depends_on:
      - db{{/if}}
    volumes:
      - .:/app
  
  {{#if include_database}}db:
    image: postgres:16
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB={{project_name}}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:{{/if}}`
        },
        {
          path: '.env.example',
          content: `SECRET_KEY=your-secret-key-here
{{#if include_database}}DATABASE_URL=postgresql://user:password@localhost/{{project_name}}{{/if}}
DEBUG=True`
        },
        {
          path: 'README.md',
          content: `# {{project_name}}

A {{#if (eq framework "fastapi")}}FastAPI{{else}}Flask{{/if}} web application.

## Setup

1. Create virtual environment:
   \`\`\`bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

3. Copy environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. Run the application:
   \`\`\`bash
   {{#if (eq framework "fastapi")}}uvicorn app:app --reload{{else}}python app.py{{/if}}
   \`\`\`

{{#if include_docker}}
## Docker

Run with Docker Compose:
\`\`\`bash
docker-compose up
\`\`\`
{{/if}}

## Testing

Run tests with pytest:
\`\`\`bash
pytest
\`\`\``
        }
      ]
    });

    // React Application
    this.registerTemplate({
      id: 'react-app-modern',
      name: 'React Application',
      description: 'Modern React app with TypeScript, Vite, and Tailwind CSS',
      category: 'web',
      icon: Globe,
      technologies: ['React', 'TypeScript', 'Vite', 'Tailwind CSS'],
      variables: [
        {
          name: 'project_name',
          label: 'Project Name',
          type: 'text',
          required: true
        },
        {
          name: 'include_router',
          label: 'Include React Router?',
          type: 'boolean',
          default: true
        },
        {
          name: 'state_management',
          label: 'State Management',
          type: 'select',
          default: 'none',
          options: [
            { value: 'none', label: 'None' },
            { value: 'zustand', label: 'Zustand' },
            { value: 'redux', label: 'Redux Toolkit' },
            { value: 'mobx', label: 'MobX' }
          ]
        },
        {
          name: 'include_testing',
          label: 'Include Testing?',
          type: 'boolean',
          default: true
        }
      ],
      files: [
        {
          path: 'package.json',
          content: `{
  "name": "{{project_name}}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"{{#if include_testing}},
    "test": "vitest",
    "test:ui": "vitest --ui"{{/if}}
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"{{#if include_router}},
    "react-router-dom": "^6.20.0"{{/if}}{{#if (eq state_management "zustand")}},
    "zustand": "^4.4.7"{{/if}}{{#if (eq state_management "redux")}},
    "@reduxjs/toolkit": "^2.0.1",
    "react-redux": "^9.0.0"{{/if}}{{#if (eq state_management "mobx")}},
    "mobx": "^6.12.0",
    "mobx-react-lite": "^4.0.5"{{/if}}
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"{{#if include_testing}},
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1",
    "vitest": "^1.0.0"{{/if}}
  }
}`
        },
        {
          path: 'src/App.tsx',
          content: `{{#if include_router}}import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
{{/if}}import './App.css';

function App() {
  return (
    {{#if include_router}}<Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-lg">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between">
              <div className="flex space-x-7">
                <div className="flex items-center py-4 px-2">
                  <span className="font-semibold text-gray-500 text-lg">{{project_name}}</span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Link to="/" className="py-2 px-2 font-medium text-gray-500 rounded hover:bg-green-500 hover:text-white transition duration-300">Home</Link>
                <Link to="/about" className="py-2 px-2 font-medium text-gray-500 rounded hover:bg-green-500 hover:text-white transition duration-300">About</Link>
              </div>
            </div>
          </div>
        </nav>
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
    </Router>{{else}}<div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-800">Welcome to {{project_name}}</h1>
        <p className="mt-4 text-gray-600">Get started by editing src/App.tsx</p>
      </div>
    </div>{{/if}}
  );
}

{{#if include_router}}function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center text-gray-800">Welcome to {{project_name}}</h1>
      <p className="mt-4 text-center text-gray-600">A modern React application with TypeScript and Vite</p>
    </div>
  );
}

function About() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-center text-gray-800">About</h1>
      <p className="mt-4 text-center text-gray-600">This is the about page</p>
    </div>
  );
}
{{/if}}
export default App;`
        },
        {
          path: 'vite.config.ts',
          content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
});`
        },
        {
          path: 'tailwind.config.js',
          content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`
        }
      ]
    });

    // Machine Learning Project
    this.registerTemplate({
      id: 'ml-project',
      name: 'Machine Learning Project',
      description: 'Complete ML pipeline with notebooks, scripts, and MLflow tracking',
      category: 'library',
      icon: Cpu,
      technologies: ['Python', 'scikit-learn', 'pandas', 'MLflow', 'Jupyter'],
      variables: [
        {
          name: 'project_name',
          label: 'Project Name',
          type: 'text',
          required: true
        },
        {
          name: 'ml_framework',
          label: 'ML Framework',
          type: 'select',
          default: 'sklearn',
          options: [
            { value: 'sklearn', label: 'scikit-learn' },
            { value: 'tensorflow', label: 'TensorFlow' },
            { value: 'pytorch', label: 'PyTorch' },
            { value: 'xgboost', label: 'XGBoost' }
          ]
        },
        {
          name: 'include_mlflow',
          label: 'Include MLflow?',
          type: 'boolean',
          default: true
        }
      ],
      files: [
        {
          path: 'requirements.txt',
          content: `numpy==1.24.3
pandas==2.1.3
scikit-learn==1.3.2
matplotlib==3.8.0
seaborn==0.13.0
jupyter==1.0.0
jupyterlab==4.0.9
{{#if (eq ml_framework "tensorflow")}}tensorflow==2.15.0{{/if}}
{{#if (eq ml_framework "pytorch")}}torch==2.1.0
torchvision==0.16.0{{/if}}
{{#if (eq ml_framework "xgboost")}}xgboost==2.0.0{{/if}}
{{#if include_mlflow}}mlflow==2.8.0{{/if}}`
        },
        {
          path: 'src/train.py',
          content: `import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
{{#if (eq ml_framework "sklearn")}}from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report{{/if}}
{{#if (eq ml_framework "tensorflow")}}import tensorflow as tf
from tensorflow import keras{{/if}}
{{#if (eq ml_framework "pytorch")}}import torch
import torch.nn as nn
import torch.optim as optim{{/if}}
{{#if (eq ml_framework "xgboost")}}import xgboost as xgb{{/if}}
{{#if include_mlflow}}import mlflow
import mlflow.sklearn{{/if}}

def load_data():
    """Load and prepare your dataset"""
    # TODO: Load your data here
    # For demo, creating synthetic data
    X = np.random.randn(1000, 10)
    y = np.random.randint(0, 2, 1000)
    return X, y

def train_model(X_train, y_train):
    """Train the model"""
    {{#if (eq ml_framework "sklearn")}}model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train){{/if}}
    {{#if (eq ml_framework "tensorflow")}}model = keras.Sequential([
        keras.layers.Dense(64, activation='relu', input_shape=(X_train.shape[1],)),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(32, activation='relu'),
        keras.layers.Dense(1, activation='sigmoid')
    ])
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    model.fit(X_train, y_train, epochs=10, batch_size=32, validation_split=0.2){{/if}}
    {{#if (eq ml_framework "xgboost")}}model = xgb.XGBClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train){{/if}}
    return model

def evaluate_model(model, X_test, y_test):
    """Evaluate the model"""
    {{#if (eq ml_framework "sklearn")}}predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"Accuracy: {accuracy:.4f}")
    print("\\nClassification Report:")
    print(classification_report(y_test, predictions)){{/if}}
    return accuracy

def main():
    {{#if include_mlflow}}# Start MLflow run
    mlflow.start_run(){{/if}}
    
    # Load data
    X, y = load_data()
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Scale features
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)
    
    # Train model
    model = train_model(X_train, y_train)
    
    # Evaluate model
    accuracy = evaluate_model(model, X_test, y_test)
    
    {{#if include_mlflow}}# Log to MLflow
    mlflow.log_metric("accuracy", accuracy)
    mlflow.sklearn.log_model(model, "model")
    mlflow.end_run(){{/if}}

if __name__ == "__main__":
    main()`
        },
        {
          path: 'notebooks/exploration.ipynb',
          content: `{
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# {{project_name}} - Data Exploration\\n",
    "\\n",
    "This notebook contains exploratory data analysis for the project."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": null,
   "metadata": {},
   "outputs": [],
   "source": [
    "import pandas as pd\\n",
    "import numpy as np\\n",
    "import matplotlib.pyplot as plt\\n",
    "import seaborn as sns\\n",
    "\\n",
    "# Set style\\n",
    "sns.set_style('whitegrid')\\n",
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
}`
        },
        {
          path: 'README.md',
          content: `# {{project_name}}

A machine learning project using {{ml_framework}}.

## Setup

1. Create virtual environment:
   \`\`\`bash
   python -m venv venv
   source venv/bin/activate
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

3. Run training:
   \`\`\`bash
   python src/train.py
   \`\`\`

{{#if include_mlflow}}## MLflow

View experiments:
\`\`\`bash
mlflow ui
\`\`\`
{{/if}}

## Project Structure

\`\`\`
{{project_name}}/
├── data/
│   ├── raw/
│   └── processed/
├── notebooks/
│   └── exploration.ipynb
├── src/
│   ├── train.py
│   └── predict.py
├── models/
└── requirements.txt
\`\`\``
        }
      ]
    });

    // Add more templates as needed...
  }

  /**
   * Register a template
   */
  registerTemplate(template: ProjectTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get all templates
   */
  getAllTemplates(): ProjectTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ProjectTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): ProjectTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.category === category);
  }

  /**
   * Process template files with variable substitution
   */
  processTemplateFiles(template: ProjectTemplate, variables: Record<string, any>): TemplateFile[] {
    return template.files
      .filter((file) => !file.condition || file.condition(variables))
      .map((file) => ({
        ...file,
        content: this.substituteVariables(file.content, variables)
      }));
  }

  /**
   * Substitute variables in template content
   * Supports Handlebars-like syntax
   */
  private substituteVariables(content: string, variables: Record<string, any>): string {
    // Simple variable substitution
    let result = content.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] || match;
    });

    // Conditional blocks
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, varName, block) => {
        return variables[varName] ? block : '';
      }
    );

    // Conditional with comparison
    result = result.replace(
      /\{\{#if\s+\(eq\s+(\w+)\s+"([^"]+)"\)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, varName, value, block) => {
        return variables[varName] === value ? block : '';
      }
    );

    // Else blocks
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, varName, ifBlock, elseBlock) => {
        return variables[varName] ? ifBlock : elseBlock;
      }
    );

    return result;
  }

  /**
   * Create project structure from template
   */
  async createProject(
    template: ProjectTemplate,
    variables: Record<string, any>,
    targetPath: string
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    const processedFiles = this.processTemplateFiles(template, variables);

    for (const file of processedFiles) {
      const fullPath = `${targetPath}/${file.path}`;
      files.set(fullPath, file.content);
    }

    return files;
  }
}
