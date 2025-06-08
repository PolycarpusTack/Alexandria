"""
AI Manager - Handles interactions with various AI models
"""

import asyncio
import aiohttp
import logging
import json
from typing import Dict, Any, Optional, List, Union
from abc import ABC, abstractmethod
from datetime import datetime
# import backoff  # Optional dependency

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """Base class for AI providers"""
    
    @abstractmethod
    async def query(self, prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Send a query to the AI model"""
        pass
    
    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is available"""
        pass
    
    @abstractmethod
    def get_info(self) -> Dict[str, Any]:
        """Get provider information"""
        pass


class OllamaProvider(AIProvider):
    """Ollama AI provider"""
    
    def __init__(self, config: Dict[str, Any]):
        self.url = config.get("url", "http://localhost:11434")
        self.model = config.get("model", "llama2")
        self.timeout = config.get("timeout", 30)
        self.max_retries = config.get("max_retries", 3)
        self._session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
        
    async def query(self, prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Query Ollama model"""
        session = await self._get_session()
        
        # Build request payload
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False
        }
        
        # Add context if provided
        if context:
            if "system" in context:
                payload["system"] = context["system"]
            if "temperature" in context:
                payload["options"] = {"temperature": context["temperature"]}
                
        try:
            async with session.post(
                f"{self.url}/api/generate",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=self.timeout)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("response", "")
                else:
                    error_text = await response.text()
                    raise Exception(f"Ollama error: {response.status} - {error_text}")
                    
        except asyncio.TimeoutError:
            logger.error("Ollama request timed out")
            raise
        except Exception as e:
            logger.error(f"Ollama query failed: {e}")
            raise
            
    async def is_available(self) -> bool:
        """Check if Ollama is available"""
        try:
            session = await self._get_session()
            async with session.get(
                f"{self.url}/api/tags",
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                return response.status == 200
        except:
            return False
            
    def get_info(self) -> Dict[str, Any]:
        """Get Ollama provider info"""
        return {
            "provider": "ollama",
            "url": self.url,
            "model": self.model,
            "timeout": self.timeout
        }
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._session:
            await self._session.close()


class OpenAIProvider(AIProvider):
    """OpenAI API provider"""
    
    def __init__(self, config: Dict[str, Any]):
        self.api_key = config.get("api_key", "")
        self.model = config.get("model", "gpt-3.5-turbo")
        self.temperature = config.get("temperature", 0.7)
        self.max_tokens = config.get("max_tokens", 2000)
        self.base_url = config.get("base_url", "https://api.openai.com/v1")
        self._session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            self._session = aiohttp.ClientSession(headers=headers)
        return self._session
        
    async def query(self, prompt: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Query OpenAI model"""
        if not self.api_key:
            raise ValueError("OpenAI API key not configured")
            
        session = await self._get_session()
        
        # Build messages
        messages = []
        if context and "system" in context:
            messages.append({"role": "system", "content": context["system"]})
        messages.append({"role": "user", "content": prompt})
        
        # Build request payload
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": context.get("temperature", self.temperature) if context else self.temperature,
            "max_tokens": context.get("max_tokens", self.max_tokens) if context else self.max_tokens
        }
        
        try:
            async with session.post(
                f"{self.base_url}/chat/completions",
                json=payload
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    error_text = await response.text()
                    raise Exception(f"OpenAI error: {response.status} - {error_text}")
                    
        except Exception as e:
            logger.error(f"OpenAI query failed: {e}")
            raise
            
    async def is_available(self) -> bool:
        """Check if OpenAI is available"""
        return bool(self.api_key)
        
    def get_info(self) -> Dict[str, Any]:
        """Get OpenAI provider info"""
        return {
            "provider": "openai",
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "configured": bool(self.api_key)
        }
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._session:
            await self._session.close()


class AIManager:
    """Manages AI providers and queries"""
    
    def __init__(self, config):
        self.config = config
        self.providers: Dict[str, AIProvider] = {}
        self.default_provider: Optional[str] = None
        self._initialized = False
        
    async def initialize(self) -> None:
        """Initialize AI providers"""
        if self._initialized:
            return
            
        # Initialize Ollama provider
        ollama_config = self.config.get("ai.ollama", {})
        self.providers["ollama"] = OllamaProvider(ollama_config)
        
        # Initialize OpenAI provider if configured
        openai_config = self.config.get("ai.openai", {})
        if openai_config.get("api_key"):
            self.providers["openai"] = OpenAIProvider(openai_config)
            
        # Set default provider
        self.default_provider = self.config.get("ai.default_model", "ollama")
        
        # Check availability of default provider
        if self.default_provider in self.providers:
            if not await self.providers[self.default_provider].is_available():
                logger.warning(f"Default provider {self.default_provider} is not available")
                # Try to find an available provider
                for name, provider in self.providers.items():
                    if await provider.is_available():
                        self.default_provider = name
                        logger.info(f"Switched to available provider: {name}")
                        break
                        
        self._initialized = True
        logger.info(f"AI Manager initialized with provider: {self.default_provider}")
        
    async def query(
        self, 
        prompt: str, 
        context: Optional[Dict[str, Any]] = None,
        provider: Optional[str] = None
    ) -> str:
        """Query an AI model"""
        if not self._initialized:
            await self.initialize()
            
        # Select provider
        provider_name = provider or self.default_provider
        if provider_name not in self.providers:
            raise ValueError(f"Unknown provider: {provider_name}")
            
        provider_instance = self.providers[provider_name]
        
        # Check if provider is available
        if not await provider_instance.is_available():
            # Try fallback providers
            for name, fallback in self.providers.items():
                if name != provider_name and await fallback.is_available():
                    logger.warning(f"Provider {provider_name} unavailable, using {name}")
                    provider_instance = fallback
                    break
            else:
                raise RuntimeError("No AI providers available")
                
        # Execute query
        start_time = datetime.now()
        try:
            response = await provider_instance.query(prompt, context)
            duration = (datetime.now() - start_time).total_seconds()
            
            logger.info(f"AI query completed in {duration:.2f}s using {provider_name}")
            return response
            
        except Exception as e:
            logger.error(f"AI query failed: {e}")
            raise
            
    async def list_providers(self) -> List[Dict[str, Any]]:
        """List available AI providers"""
        providers = []
        for name, provider in self.providers.items():
            info = provider.get_info()
            info["name"] = name
            info["available"] = await provider.is_available()
            info["default"] = name == self.default_provider
            providers.append(info)
        return providers
        
    async def switch_provider(self, provider_name: str) -> None:
        """Switch default AI provider"""
        if provider_name not in self.providers:
            raise ValueError(f"Unknown provider: {provider_name}")
            
        if not await self.providers[provider_name].is_available():
            raise RuntimeError(f"Provider {provider_name} is not available")
            
        self.default_provider = provider_name
        logger.info(f"Switched default provider to: {provider_name}")
        
    async def shutdown(self) -> None:
        """Shutdown AI providers"""
        for provider in self.providers.values():
            if hasattr(provider, '__aexit__'):
                await provider.__aexit__(None, None, None)
        logger.info("AI Manager shutdown complete")