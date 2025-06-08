"""
Enterprise Code Factory 9000 Pro - Ollama AI Integration
--------------------------------------------------------
Provides integration with local Ollama models for AI-powered code analysis,
suggestions, and auto-fixes with enterprise-grade reliability.

Author: Enhanced by Claude
Date: April 10, 2025
"""

import requests
import json
import logging
import threading
import time
import tkinter as tk
import re
from tkinter import ttk, StringVar
from typing import Dict, List, Optional, Any, Callable, Union
from functools import lru_cache
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Set up module logger
logger = logging.getLogger(__name__)

class OllamaClientError(Exception):
    """Base exception for Ollama client errors"""
    pass

class OllamaConnectionError(OllamaClientError):
    """Network-related errors"""
    pass

class OllamaAPIError(OllamaClientError):
    """API response errors"""
    pass

class OllamaClient:
    """Enterprise-grade client for interacting with local Ollama API"""
    
    DEFAULT_URL = "http://localhost:11434/api"
    DEFAULT_TIMEOUT = 60  # Increased timeout for slower models
    MAX_RETRIES = 2
    RETRY_STATUS_CODES = {429, 500, 502, 503, 504}
    
    def __init__(self, base_url: str = None, timeout: int = None, retries: int = None):
        """Initialize Ollama client with enterprise-grade configuration"""
        self.base_url = base_url or self.DEFAULT_URL
        self.timeout = timeout or self.DEFAULT_TIMEOUT
        self.retries = retries or self.MAX_RETRIES
        self._models_cache = None
        self._models_cache_time = 0
        
        # Configure session with retry policy
        self.session = requests.Session()
        retry = Retry(
            total=self.retries,
            backoff_factor=0.3,
            status_forcelist=self.RETRY_STATUS_CODES,
            allowed_methods=['GET', 'POST']
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)
        
        # Log initialization
        logger.info(f"OllamaClient initialized with URL: {self.base_url}, timeout: {self.timeout}s")
    
    def _request(self, endpoint: str, method: str = "GET", data: Dict = None, 
                stream: bool = False) -> requests.Response:
        """
        Send a robust enterprise-grade request to the Ollama API
        with enhanced error handling and logging
        """
        url = f"{self.base_url}/{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        # Sanitize logging data
        loggable_data = None
        if data and logger.isEnabledFor(logging.INFO):
            loggable_data = {k: v for k, v in data.items() if k not in ('prompt', 'system')}
            if 'prompt' in data:
                loggable_data['prompt_length'] = len(data['prompt'])
                loggable_data['prompt_preview'] = data['prompt'][:50] + "..." if len(data['prompt']) > 50 else data['prompt']
            if 'system' in data:
                loggable_data['system_length'] = len(data['system'])
        
        logger.info(f"Sending {method} request to {url}")
        if loggable_data:
            logger.debug(f"Request payload: {json.dumps(loggable_data, indent=2)}")
        
        try:
            response = None
            request_args = {
                'headers': headers,
                'timeout': self.timeout,
                'stream': stream
            }
            
            if method == "GET":
                response = self.session.get(url, **request_args)
            elif method == "POST":
                request_args['json'] = data
                response = self.session.post(url, **request_args)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            # Log response summary
            logger.info(f"Received response: {response.status_code} ({response.reason})")
            logger.debug(f"Response headers: {dict(response.headers)}")
            
            # Log limited response content
            if not stream and response.text:
                content = response.text
                logger.debug(f"Response content (first 1KB): {content[:1024]}")
                
            return response
            
        except requests.Timeout as e:
            logger.error(f"Request timed out after {self.timeout}s: {str(e)}")
            raise OllamaConnectionError(f"Request timed out: {str(e)}") from e
        except requests.ConnectionError as e:
            logger.error(f"Connection failed: {str(e)}")
            raise OllamaConnectionError(f"Connection failed: {str(e)}") from e
        except requests.RequestException as e:
            logger.error(f"Request failed: {str(e)}")
            raise OllamaAPIError(f"Request failed: {str(e)}") from e
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            raise OllamaClientError(f"Unexpected error: {str(e)}") from e
        finally:
            if response is not None:
                try:
                    response.close()
                except Exception as e:
                    logger.warning(f"Error closing response: {str(e)}")
    
    def list_models(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Get list of available Ollama models with enhanced error handling
        
        Args:
            force_refresh: Force a refresh of the model cache
            
        Returns:
            List of model info dictionaries
        """
        # Use cached models if available and recent (less than 60 seconds old)
        cache_age = time.time() - self._models_cache_time
        if not force_refresh and self._models_cache is not None and cache_age < 60:
            return self._models_cache
        
        try:
            response = self._request("tags")
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                # Update cache
                self._models_cache = models
                self._models_cache_time = time.time()
                return models
            else:
                error_msg = f"API Error: {response.status_code} - {response.text[:200]}"
                logger.error(error_msg)
                raise OllamaAPIError(error_msg)
        except json.JSONDecodeError as e:
            error_msg = "Failed to parse models response"
            logger.error(f"{error_msg}: {str(e)}")
            raise OllamaAPIError(error_msg) from e
        except OllamaClientError:
            # Re-raise custom exceptions
            raise
        except Exception as e:
            error_msg = f"Exception fetching models: {str(e)}"
            logger.error(error_msg)
            raise OllamaClientError(error_msg) from e
    
    def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model"""
        try:
            models = self.list_models()
            for model in models:
                if model.get("name") == model_name:
                    return model
            return None
        except OllamaClientError:
            # Just propagate the exception
            raise
        except Exception as e:
            error_msg = f"Error getting model info: {str(e)}"
            logger.error(error_msg)
            raise OllamaClientError(error_msg) from e
    
    def generate(self, model: str, prompt: str, system: str = None, 
                temperature: float = 0.7, max_tokens: int = 2048) -> str:
        """
        Generate a completion using an Ollama model with updated API format
        
        Args:
            model: Name of the model to use
            prompt: User prompt
            system: Optional system prompt
            temperature: Sampling temperature (0.0 to 1.0)
            max_tokens: Maximum tokens to generate
            
        Returns:
            Generated text
        """
        # Updated API format based on Ollama documentation
        data = {
            "model": model,
            "prompt": prompt,
            "stream": False,  # Explicitly disable streaming to get a single response
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens
            }
        }
        
        if system:
            data["system"] = system
            
        try:
            response = self._request("generate", method="POST", data=data)
            if response.status_code == 200:
                # Log the full response for debugging
                logger.debug(f"Full response content: {response.text[:1000]}...")
                
                try:
                    # First try parsing as JSON
                    return response.json().get("response", "")
                except json.JSONDecodeError as e:
                    # Log the parsing error
                    logger.warning(f"JSON decode error: {str(e)}")
                    
                    # Check if it's a newline-delimited JSON format (NDJSON)
                    if '\n' in response.text:
                        try:
                            # Try to parse the first line as JSON
                            first_line = response.text.strip().split('\n')[0]
                            first_json = json.loads(first_line)
                            return first_json.get("response", "")
                        except (json.JSONDecodeError, IndexError) as e2:
                            logger.warning(f"Failed to parse as NDJSON: {str(e2)}")
                    
                    # Try to extract response field with regex
                    try:
                        response_match = re.search(r'"response"\s*:\s*"([^"]*)"', response.text)
                        if response_match:
                            return response_match.group(1)
                    except Exception as e3:
                        logger.warning(f"Failed to extract response with regex: {str(e3)}")
                    
                    # If all parsing fails, return the raw text
                    logger.warning("Returning raw response text")
                    return response.text
            else:
                error_msg = f"Error generating completion: {response.status_code} - {response.text[:200]}"
                logger.error(error_msg)
                raise OllamaAPIError(error_msg)
        except OllamaClientError:
            # Re-raise custom exceptions
            raise
        except Exception as e:
            error_msg = f"Exception in generate: {str(e)}"
            logger.error(error_msg)
            raise OllamaClientError(error_msg) from e
    
    def generate_code_suggestion(self, model: str, code: str, issue_description: str) -> str:
        """
        Generate a code suggestion for fixing an issue
        
        Args:
            model: Name of the model to use
            code: The original code
            issue_description: Description of the issue to fix
            
        Returns:
            Suggested fixed code
        """
        system = "You are an expert code assistant. Your task is to fix issues in code snippets."
        prompt = f"""
Here is a code snippet with an issue:

```
{code}
```

The issue is: {issue_description}

Please provide only the fixed code without any explanation. 
Do not include markdown formatting or code blocks.
"""
        
        try:
            return self.generate(model, prompt, system, temperature=0.2)
        except OllamaClientError as e:
            logger.error(f"Failed to generate code suggestion: {str(e)}")
            return f"Error generating suggestion: {str(e)}"
    
    def analyze_code_quality(self, model: str, code: str, language: str) -> List[Dict[str, Any]]:
        """
        Analyze code quality using AI
        
        Args:
            model: Name of the model to use
            code: The code to analyze
            language: Programming language of the code
            
        Returns:
            List of code issues
        """
        system = """You are an expert static code analyzer. Analyze the provided code and identify issues.
For each issue, provide a JSON object with these fields:
- line: Line number (integer)
- message: Description of the issue (string)
- severity: One of "info", "warning", "error", "critical" (string)
- suggestion: How to fix the issue (string)

Format your response as a JSON array of issue objects. Do not include any explanations or markdown.
"""
        
        prompt = f"""
Analyze this {language} code for issues:

```
{code}
```

Focus on: code smell, security issues, performance issues, bugs, and best practices.
"""
        
        try:
            response = self.generate(model, prompt, system, temperature=0.3)
            
            # Extract JSON array from response (handle potential text wrapping)
            try:
                # Try to parse as direct JSON
                issues = json.loads(response)
                if not isinstance(issues, list):
                    issues = []
            except json.JSONDecodeError:
                # Try to extract JSON array using regex
                json_match = re.search(r'\[\s*{.+}\s*\]', response, re.DOTALL)
                if json_match:
                    try:
                        issues = json.loads(json_match.group(0))
                    except json.JSONDecodeError:
                        issues = []
                else:
                    issues = []
            
            return issues
        except OllamaClientError as e:
            logger.error(f"Error in AI code analysis: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error in code analysis: {str(e)}")
            return []


class OllamaModelSelector:
    """UI component for selecting and configuring Ollama models"""
    
    def __init__(self, parent, ollama_client=None):
        """Initialize model selector with parent widget and optional client"""
        self.parent = parent
        self.frame = ttk.LabelFrame(parent, text="AI Model Selection")
        self.ollama_client = ollama_client or OllamaClient()
        self.selected_model = StringVar()
        self.is_enabled = tk.BooleanVar(value=True)
        
        # Setup UI components
        self._setup_ui()
        
        # Load models
        self._load_models()
    
    def _setup_ui(self):
        """Set up the UI components"""
        # Enable/disable checkbox
        self.enable_check = ttk.Checkbutton(
            self.frame, 
            text="Enable AI Analysis", 
            variable=self.is_enabled,
            command=self._toggle_enabled
        )
        self.enable_check.grid(row=0, column=0, sticky="w", padx=5, pady=5)
        
        # Model selection dropdown
        model_frame = ttk.Frame(self.frame)
        model_frame.grid(row=1, column=0, sticky="ew", padx=5, pady=5)
        
        ttk.Label(model_frame, text="Model:").pack(side=tk.LEFT, padx=(0, 5))
        
        self.model_combo = ttk.Combobox(
            model_frame, 
            textvariable=self.selected_model,
            state="readonly",
            width=30
        )
        self.model_combo.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # Refresh button
        self.refresh_button = ttk.Button(
            model_frame, 
            text="↻", 
            width=3,
            command=self._refresh_models
        )
        self.refresh_button.pack(side=tk.LEFT, padx=(5, 0))
        
        # Status indicator
        self.status_label = ttk.Label(self.frame, text="Status: Checking...", foreground="blue")
        self.status_label.grid(row=2, column=0, sticky="w", padx=5, pady=5)
        
        # Configure grid
        self.frame.columnconfigure(0, weight=1)
    
    def _load_models(self):
        """Load available models in a background thread"""
        self.status_label.config(text="Status: Loading models...", foreground="blue")
        
        def load_thread():
            try:
                models = self.ollama_client.list_models()
                model_names = [model.get("name") for model in models]
                
                # Update UI in main thread
                self.parent.after(0, lambda: self._update_models(model_names))
                
            except OllamaConnectionError as e:
                logger.error(f"Connection error loading models: {str(e)}")
                # Update UI in main thread - connection error
                self.parent.after(0, lambda: self._update_status(f"Cannot connect to Ollama service", "red"))
            except OllamaAPIError as e:
                logger.error(f"API error loading models: {str(e)}")
                # Update UI in main thread - API error
                self.parent.after(0, lambda: self._update_status(f"Ollama API error", "red"))
            except Exception as e:
                logger.error(f"Error loading models: {str(e)}")
                # Update UI in main thread - general error
                self.parent.after(0, lambda: self._update_status(f"Error: {str(e)}", "red"))
        
        # Start background thread
        thread = threading.Thread(target=load_thread)
        thread.daemon = True
        thread.start()
    
    def _update_models(self, model_names):
        """Update the model dropdown with available models"""
        if not model_names:
            self._update_status("No models found. Install models with 'ollama pull model_name'", "orange")
            return
            
        self.model_combo["values"] = model_names
        
        # Select first model
        if model_names and not self.selected_model.get():
            self.selected_model.set(model_names[0])
            
        # Prioritize code-specific models if available
        for name in model_names:
            if "deepseek-coder" in name or "deepcoder" in name or "codellama" in name:
                self.selected_model.set(name)
                break
        
        self._update_status(f"Found {len(model_names)} models", "green")
    
    def _update_status(self, text, color="black"):
        """Update the status label"""
        self.status_label.config(text=f"Status: {text}", foreground=color)
    
    def _refresh_models(self):
        """Refresh the model list"""
        self._load_models()
    
    def _toggle_enabled(self):
        """Handle enable/disable toggle"""
        enabled = self.is_enabled.get()
        state = "normal" if enabled else "disabled"
        
        # Update UI components
        self.model_combo.config(state="readonly" if enabled else "disabled")
        self.refresh_button.config(state=state)
    
    def get_selected_model(self) -> Optional[str]:
        """Get the currently selected model"""
        if not self.is_enabled.get():
            return None
        return self.selected_model.get() or None


class AICodeEnhancer:
    """Integration of AI models with code analysis"""
    
    def __init__(self, ollama_client=None, selected_model: str = None):
        """Initialize the AI code enhancer"""
        self.ollama_client = ollama_client or OllamaClient()
        self.model = selected_model
        self.default_models = {
            "code_analysis": "codellama:7b-instruct",  # Updated to more common model
            "code_suggestion": "codellama:7b-instruct", 
            "sql_analysis": "sqlcoder:7b",
            "general": "llama2:7b"  # Updated to more common model
        }
    
    def set_model(self, model: str):
        """Set the AI model to use"""
        self.model = model
    
    def get_model_for_task(self, task: str) -> str:
        """Get the appropriate model for a specific task"""
        if not self.model:
            # Use specialized models based on task if no main model is set
            return self.default_models.get(task, self.default_models["general"])
        return self.model
    
    def enhance_analysis(self, issues: List, code: str, language: str) -> List:
        """
        Enhance existing analysis with AI suggestions
        
        Args:
            issues: Existing code issues
            code: Source code
            language: Programming language
            
        Returns:
            Enhanced issues list
        """
        if not code.strip():
            return issues
            
        try:
            model = self.get_model_for_task("code_analysis")
            ai_issues = self.ollama_client.analyze_code_quality(model, code, language)
            
            # Convert AI issues to CodeIssue format and add to list
            for issue in ai_issues:
                if "line" in issue and "message" in issue:
                    from code_analyzer import CodeIssue
                    
                    new_issue = CodeIssue(
                        line=issue.get("line"),
                        column=1,  # Default column if not provided
                        message=issue.get("message", ""),
                        severity=issue.get("severity", "info"),
                        source="AI",
                        suggestion=issue.get("suggestion"),
                        code="AI001"
                    )
                    
                    issues.append(new_issue)
                    
            return issues
        except Exception as e:
            logger.error(f"Error in AI enhancement: {str(e)}")
            return issues
    
    def suggest_fix(self, code: str, issue_description: str, language: str) -> Optional[str]:
        """
        Suggest a fix for a code issue
        
        Args:
            code: Source code with the issue
            issue_description: Description of the issue
            language: Programming language
            
        Returns:
            Suggested fixed code or None
        """
        try:
            model = self.get_model_for_task("code_suggestion")
            suggestion = self.ollama_client.generate_code_suggestion(
                model, 
                code, 
                issue_description
            )
            return suggestion
        except Exception as e:
            logger.error(f"Error getting AI suggestion: {str(e)}")
            return None
    
    @lru_cache(maxsize=32)
    def explain_code(self, code: str, language: str) -> str:
        """
        Generate an explanation for a code snippet
        
        Args:
            code: Code to explain
            language: Programming language
            
        Returns:
            Explanation text
        """
        system = "You are a helpful coding assistant. Explain code clearly and concisely."
        prompt = f"""
Explain this {language} code:

```
{code}
```

Provide a clear, concise explanation of what this code does and how it works.
"""
        
        try:
            model = self.get_model_for_task("general")
            explanation = self.ollama_client.generate(model, prompt, system)
            return explanation
        except Exception as e:
            logger.error(f"Error generating explanation: {str(e)}")
            return f"Error generating explanation: {str(e)}"
    
    def optimize_code(self, code: str, language: str) -> Optional[str]:
        """
        Optimize code for performance or readability
        
        Args:
            code: Code to optimize
            language: Programming language
            
        Returns:
            Optimized code or None if optimization failed
        """
        system = """You are an expert code optimizer. Improve the given code for better performance
and readability without changing its functionality. Provide only the optimized code
without any explanations."""
        
        prompt = f"""
Optimize this {language} code:

```
{code}
```

Focus on:
1. Performance improvements
2. Readability
3. Code structure
4. Best practices for {language}

Return only the optimized code without explanations.
"""
        
        try:
            model = self.get_model_for_task("code_suggestion")
            optimized = self.ollama_client.generate(model, prompt, system, temperature=0.2)
            return optimized
        except Exception as e:
            logger.error(f"Error optimizing code: {str(e)}")
            return None


# Helper function to test Ollama availability
def is_ollama_available() -> bool:
    """Check if Ollama service is available"""
    try:
        client = OllamaClient()
        logger.info("Checking if Ollama service is available...")
        response = client.session.get(f"{client.base_url}/tags", timeout=2)
        result = response.status_code == 200
        logger.info(f"Ollama service available: {result}")
        return result
    except Exception as e:
        logger.info(f"Ollama service check failed: {str(e)}")
        return False
