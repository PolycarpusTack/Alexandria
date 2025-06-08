"""Ollama AI provider implementation."""

import aiohttp
import asyncio
import json
import logging
from typing import List, AsyncIterator, Optional
from urllib.parse import urljoin

from ..base import AIProvider, AIRequest, AIResponse

logger = logging.getLogger(__name__)


class OllamaProvider(AIProvider):
    """Ollama AI provider implementation."""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self._session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session
        
    async def close(self):
        """Close the session."""
        if self._session and not self._session.closed:
            await self._session.close()
            
    async def list_models(self) -> List[str]:
        """List available models."""
        try:
            session = await self._get_session()
            url = urljoin(self.base_url, "/api/tags")
            
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return [model["name"] for model in data.get("models", [])]
                else:
                    logger.error(f"Failed to list models: {response.status}")
                    return []
                    
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []
            
    async def generate(self, request: AIRequest) -> AIResponse:
        """Generate a response (non-streaming)."""
        try:
            session = await self._get_session()
            url = urljoin(self.base_url, "/api/generate")
            
            payload = {
                "model": request.model,
                "prompt": self._build_prompt(request),
                "stream": False,
                "options": {
                    "temperature": request.temperature
                }
            }
            
            if request.max_tokens:
                payload["options"]["num_predict"] = request.max_tokens
                
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    return AIResponse(
                        content=data["response"],
                        model=request.model,
                        metadata={
                            "total_duration": data.get("total_duration"),
                            "load_duration": data.get("load_duration"),
                            "eval_count": data.get("eval_count")
                        }
                    )
                else:
                    error_text = await response.text()
                    raise Exception(f"Generation failed: {error_text}")
                    
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            raise
            
    async def generate_stream(self, request: AIRequest) -> AsyncIterator[str]:
        """Generate a streaming response."""
        try:
            session = await self._get_session()
            url = urljoin(self.base_url, "/api/generate")
            
            payload = {
                "model": request.model,
                "prompt": self._build_prompt(request),
                "stream": True,
                "options": {
                    "temperature": request.temperature
                }
            }
            
            if request.max_tokens:
                payload["options"]["num_predict"] = request.max_tokens
                
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    async for line in response.content:
                        if line:
                            try:
                                data = json.loads(line)
                                if "response" in data:
                                    yield data["response"]
                                if data.get("done", False):
                                    break
                            except json.JSONDecodeError:
                                continue
                else:
                    error_text = await response.text()
                    raise Exception(f"Generation failed: {error_text}")
                    
        except Exception as e:
            logger.error(f"Error in streaming generation: {e}")
            raise
            
    async def health_check(self) -> bool:
        """Check if the provider is healthy."""
        try:
            models = await self.list_models()
            return len(models) > 0
        except Exception:
            return False
            
    def _build_prompt(self, request: AIRequest) -> str:
        """Build the full prompt including context."""
        parts = []
        
        if request.context:
            parts.append("Context:")
            parts.append(request.context)
            parts.append("")
            
        parts.append(request.prompt)
        
        return "\n".join(parts)
        
    @property
    def name(self) -> str:
        """Provider name."""
        return "Ollama"
        
    @property
    def default_model(self) -> str:
        """Default model name."""
        return "deepseek-coder:latest"