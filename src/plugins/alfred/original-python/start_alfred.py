#!/usr/bin/env python3
"""
Quick start script for ALFRED
AI-Linked Framework for Rapid Engineering Development
"""

import subprocess
import sys
import os
import requests
import time


def check_ollama():
    """Check if Ollama is running"""
    try:
        response = requests.get("http://localhost:11434/api/tags")
        return response.status_code == 200
    except:
        return False


def check_model(model_name="deepseek-coder:latest"):
    """Check if DeepSeekCoder model is available"""
    try:
        response = requests.get("http://localhost:11434/api/tags")
        if response.status_code == 200:
            models = [m["name"] for m in response.json().get("models", [])]
            return model_name in models
        return False
    except:
        return False


def pull_model(model_name="deepseek-coder:latest"):
    """Pull DeepSeekCoder model"""
    print(f"Pulling {model_name}... This may take a while...")
    try:
        subprocess.run(["ollama", "pull", model_name], check=True)
        return True
    except:
        return False


def main():
    print("=== ALFRED Startup ===")
    print("AI-Linked Framework for Rapid Engineering Development\n")
    
    # Check Ollama
    if not check_ollama():
        print("❌ Ollama is not running!")
        print("Please start Ollama first:")
        print("  - On Windows: Run 'ollama serve' in a separate terminal")
        print("  - On Mac/Linux: Ollama should auto-start, or run 'ollama serve'")
        sys.exit(1)
    
    print("✅ Ollama is running")
    
    # Check DeepSeekCoder model
    if not check_model():
        print("⚠️  DeepSeekCoder model not found")
        response = input("Would you like to download it now? (y/n): ")
        if response.lower() == 'y':
            if pull_model():
                print("✅ DeepSeekCoder model installed")
            else:
                print("❌ Failed to install model")
                print("Try running: ollama pull deepseek-coder:latest")
                sys.exit(1)
        else:
            print("\nYou can install it later with: ollama pull deepseek-coder:latest")
            print("The app will work with other models too.")
    else:
        print("✅ DeepSeekCoder model is available")
    
    # Check for other recommended models
    print("\n📋 Checking other recommended models for agentic tasks:")
    recommended = {
        "mixtral:latest": "Excellent for reasoning and agentic tasks",
        "llama3.1:latest": "Strong tool use capabilities",
        "qwen2.5-coder:latest": "Good balance of coding and agency",
        "codellama:latest": "Decent for code-focused agent tasks"
    }
    
    for model, description in recommended.items():
        if check_model(model):
            print(f"  ✅ {model} - {description}")
        else:
            print(f"  ⬜ {model} - {description}")
    
    print("\n🚀 Starting ALFRED...\n")
    
    # Check if tkinter is available
    try:
        import tkinter
        use_gui = True
    except ImportError:
        use_gui = False
        print("⚠️  tkinter not available - will use CLI interface")
        print("To install tkinter:")
        print("  Ubuntu/Debian: sudo apt-get install python3-tk")
        print("  Fedora: sudo dnf install python3-tkinter")
        print("  macOS: tkinter should be included with Python\n")
    
    # Start the appropriate version
    try:
        if use_gui:
            subprocess.run([sys.executable, "alfred.py"])
        else:
            subprocess.run([sys.executable, "alfred_cli.py"])
    except KeyboardInterrupt:
        print("\n\nGoodbye!")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()