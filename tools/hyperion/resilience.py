"""
Hyperion Resource Monitor - Resilience Module

Provides resilience patterns like circuit breakers, retry mechanisms, 
and adaptive backoff strategies for robust operation.
"""

import asyncio
import logging
import random
import time
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)


# Custom exceptions for resilience patterns
class CircuitOpenError(Exception):
    """Exception raised when a circuit breaker is open"""
    pass


class RateLimitError(Exception):
    """Exception raised when a rate limit is exceeded"""
    pass


class TransientError(Exception):
    """Base class for errors that are transient and may be retried"""
    pass


class AdaptiveBackoff:
    """
    Smart exponential backoff with jitter for retry operations
    
    Provides adaptive retry logic with exponential backoff and jitter to prevent
    thundering herd problems. Tracks backoff times per operation for more intelligent
    retry management.
    """
    
    def __init__(
        self, 
        initial: float = 0.1, 
        maximum: float = 30.0, 
        factor: float = 2.0,
        max_attempts: int = 10
    ):
        """
        Initialize the backoff strategy
        
        Args:
            initial: Initial backoff delay in seconds
            maximum: Maximum backoff delay in seconds
            factor: Multiplicative factor for backoff increase
            max_attempts: Maximum number of retry attempts
        """
        self.initial = initial
        self.maximum = maximum
        self.factor = factor
        self.max_attempts = max_attempts
        
        # State tracking
        self.backoff_times = {}  # per-operation backoff times
        self.attempt_counts = {}  # per-operation attempt counts
    
    async def execute_with_backoff(
        self, 
        func: Callable,
        *args,
        retry_exceptions: Tuple[Exception] = (TransientError, RateLimitError, ConnectionError),
        operation_id: Optional[str] = None,
        **kwargs
    ) -> Any:
        """
        Execute a function with backoff retry logic
        
        Args:
            func: Async function to execute
            *args: Positional arguments to pass to func
            retry_exceptions: Tuple of exception types to retry on
            operation_id: Optional identifier for the operation (for tracking)
            **kwargs: Keyword arguments to pass to func
            
        Returns:
            The result of the function execution
            
        Raises:
            Exception: If max attempts reached or non-retryable exception
        """
        # Generate operation ID if not provided
        if operation_id is None:
            operation_id = f"{func.__name__}_{id(func)}"
        
        # Initialize tracking for this operation if not seen before
        if operation_id not in self.backoff_times:
            self.backoff_times[operation_id] = self.initial
            self.attempt_counts[operation_id] = 0
        
        # Execute with retry logic
        while True:
            try:
                # Increment attempt counter
                self.attempt_counts[operation_id] += 1
                current_attempt = self.attempt_counts[operation_id]
                
                # Check if max attempts exceeded
                if current_attempt > self.max_attempts:
                    logger.error(
                        f"Operation {operation_id} failed after {current_attempt-1} attempts"
                    )
                    raise Exception(
                        f"Max retry attempts ({self.max_attempts}) exceeded for operation"
                    )
                
                # Execute function
                return await func(*args, **kwargs)
                
            except retry_exceptions as e:
                # Calculate delay with jitter
                current_backoff = self.backoff_times[operation_id]
                jitter = random.random() * 0.2  # +/- 20% jitter
                delay = min(current_backoff * (1.0 + jitter), self.maximum)
                
                # Log retry information
                logger.warning(
                    f"Operation {operation_id} failed with error '{str(e)}', "
                    f"retry {current_attempt}/{self.max_attempts} in {delay:.2f}s"
                )
                
                # Increase backoff for next attempt
                self.backoff_times[operation_id] = min(
                    current_backoff * self.factor,
                    self.maximum
                )
                
                # Wait before retry
                await asyncio.sleep(delay)
                
            except Exception as e:
                # Non-retryable error, reset counters and re-raise
                logger.error(
                    f"Operation {operation_id} failed with non-retryable error: {str(e)}"
                )
                self.reset(operation_id)
                raise
    
    def reset(self, operation_id: str) -> None:
        """
        Reset backoff state for a specific operation
        
        Args:
            operation_id: Identifier for the operation to reset
        """
        if operation_id in self.backoff_times:
            self.backoff_times[operation_id] = self.initial
            self.attempt_counts[operation_id] = 0


class CircuitBreaker:
    """
    Implementation of the Circuit Breaker pattern
    
    Prevents cascading failures by failing fast when a service is degraded. 
    Automatically attempts recovery after a timeout period.
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        reset_timeout: float = 60.0,
        half_open_max_calls: int = 1
    ):
        """
        Initialize the circuit breaker
        
        Args:
            name: Identifier for this circuit breaker
            failure_threshold: Number of failures before opening circuit
            reset_timeout: Seconds before attempting recovery (half-open)
            half_open_max_calls: Maximum calls allowed in half-open state
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.half_open_max_calls = half_open_max_calls
        
        # State tracking
        self.failure_count = 0
        self.state = "closed"  # closed, open, half-open
        self.last_failure_time = 0
        self.success_count = 0
        self.half_open_calls = 0
        
        # Thread safety
        self.lock = asyncio.Lock()
        
        logger.info(
            f"Circuit breaker '{name}' initialized: "
            f"threshold={failure_threshold}, timeout={reset_timeout}s"
        )
    
    async def execute(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute a function with circuit breaker protection
        
        Args:
            func: Async function to execute
            *args: Positional arguments to pass to func
            **kwargs: Keyword arguments to pass to func
            
        Returns:
            The result of the function execution
            
        Raises:
            CircuitOpenError: If circuit is open
            Exception: Any exception raised by the function
        """
        # Check if circuit is open
        async with self.lock:
            if self.state == "open":
                # Check if reset timeout has elapsed
                if time.time() - self.last_failure_time > self.reset_timeout:
                    logger.info(f"Circuit '{self.name}' half-open, allowing test request")
                    self.state = "half-open"
                    self.half_open_calls = 0
                    self.success_count = 0
                else:
                    raise CircuitOpenError(
                        f"Circuit '{self.name}' is open until "
                        f"{time.time() - self.last_failure_time:.1f}s/"
                        f"{self.reset_timeout}s timeout elapses"
                    )
            
            # Check if we can make a call in half-open state
            if self.state == "half-open":
                if self.half_open_calls >= self.half_open_max_calls:
                    raise CircuitOpenError(
                        f"Circuit '{self.name}' is half-open with max calls exceeded"
                    )
                self.half_open_calls += 1
        
        # Execute function
        try:
            result = await func(*args, **kwargs)
            
            # Handle success
            async with self.lock:
                if self.state == "half-open":
                    self.success_count += 1
                    # Reset circuit after sufficient successful calls
                    if self.success_count >= self.failure_threshold:
                        logger.info(
                            f"Circuit '{self.name}' reset to closed after "
                            f"{self.success_count} successful executions"
                        )
                        self.state = "closed"
                        self.failure_count = 0
                        self.success_count = 0
                elif self.state == "closed":
                    # Reset failure count after successful execution
                    self.failure_count = max(0, self.failure_count - 1)
            
            return result
            
        except Exception as e:
            # Handle failure
            async with self.lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.state == "closed" and self.failure_count >= self.failure_threshold:
                    logger.warning(
                        f"Circuit '{self.name}' opened after {self.failure_count} failures"
                    )
                    self.state = "open"
                    
                if self.state == "half-open":
                    logger.warning(
                        f"Circuit '{self.name}' reopened after failure in half-open state"
                    )
                    self.state = "open"
            
            # Re-raise the exception
            raise
    
    def get_state(self) -> Dict[str, Any]:
        """
        Get current circuit breaker state
        
        Returns:
            Dictionary with current state information
        """
        state_info = {
            "name": self.name,
            "state": self.state,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
        }
        
        if self.state == "open":
            # Add time until reset
            time_since_failure = time.time() - self.last_failure_time
            time_until_reset = max(0, self.reset_timeout - time_since_failure)
            state_info["time_until_reset"] = time_until_reset
            
        if self.state == "half-open":
            state_info["success_count"] = self.success_count
            state_info["calls_allowed"] = self.half_open_max_calls - self.half_open_calls
            
        return state_info
    
    def reset(self) -> None:
        """
        Manually reset the circuit to closed state
        """
        asyncio.create_task(self._reset())
    
    async def _reset(self) -> None:
        """
        Internal async reset implementation
        """
        async with self.lock:
            self.state = "closed"
            self.failure_count = 0
            self.success_count = 0
            self.half_open_calls = 0
            logger.info(f"Circuit '{self.name}' manually reset to closed state")


class RateLimiter:
    """
    Rate limiter for controlling the rate of operations
    
    Implements token bucket algorithm for flexible rate limiting across
    different operations.
    """
    
    def __init__(
        self,
        name: str,
        rate: float,
        burst: int = 1,
        wait: bool = True
    ):
        """
        Initialize the rate limiter
        
        Args:
            name: Identifier for this rate limiter
            rate: Operations per second
            burst: Maximum burst size (tokens)
            wait: Whether to wait for tokens to become available
        """
        self.name = name
        self.rate = rate
        self.burst = burst
        self.wait = wait
        
        # Token bucket state
        self.tokens = burst
        self.last_refill = time.time()
        
        # Thread safety
        self.lock = asyncio.Lock()
        
        logger.info(
            f"Rate limiter '{name}' initialized: "
            f"rate={rate}/s, burst={burst}, wait={wait}"
        )
    
    async def acquire(self, tokens: int = 1) -> float:
        """
        Acquire tokens from the rate limiter
        
        Args:
            tokens: Number of tokens to acquire
            
        Returns:
            Time spent waiting for tokens
            
        Raises:
            RateLimitError: If tokens not available and wait=False
        """
        start_time = time.time()
        
        async with self.lock:
            # Refill tokens
            now = time.time()
            elapsed = now - self.last_refill
            self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
            self.last_refill = now
            
            # Check if we have enough tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                return 0.0
            
            # If not waiting, raise error
            if not self.wait:
                raise RateLimitError(
                    f"Rate limit exceeded for '{self.name}': "
                    f"needed {tokens}, available {self.tokens:.2f}"
                )
            
            # Calculate wait time
            tokens_needed = tokens - self.tokens
            wait_time = tokens_needed / self.rate
            
            # Update state
            self.tokens = 0
            self.last_refill = now + wait_time
        
        # Wait for tokens to become available
        logger.debug(
            f"Rate limiter '{self.name}' waiting {wait_time:.2f}s for tokens"
        )
        await asyncio.sleep(wait_time)
        
        return time.time() - start_time
    
    async def execute(self, func: Callable, *args, tokens: int = 1, **kwargs) -> Any:
        """
        Execute a function with rate limiting
        
        Args:
            func: Async function to execute
            *args: Positional arguments to pass to func
            tokens: Number of tokens to acquire
            **kwargs: Keyword arguments to pass to func
            
        Returns:
            The result of the function execution
            
        Raises:
            RateLimitError: If tokens not available and wait=False
        """
        # Acquire tokens
        wait_time = await self.acquire(tokens)
        
        # Execute function
        return await func(*args, **kwargs)


class FailureDetector:
    """
    Accrual failure detector for distributed systems
    
    Uses statistical methods to determine if a remote system is likely
    to be failed, based on response patterns over time.
    """
    
    def __init__(
        self,
        name: str,
        threshold: float = 0.8,
        window_size: int = 100,
        min_samples: int = 10
    ):
        """
        Initialize the failure detector
        
        Args:
            name: Identifier for this detector
            threshold: Phi threshold for failure detection (0.0-1.0)
            window_size: Maximum sample window size
            min_samples: Minimum samples required for detection
        """
        self.name = name
        self.threshold = threshold
        self.window_size = window_size
        self.min_samples = min_samples
        
        # Sample state
        self.samples = []
        self.last_sample_time = 0
        self.last_phi = 0.0
        
        logger.info(
            f"Failure detector '{name}' initialized: "
            f"threshold={threshold}, window={window_size}"
        )
    
    def record_heartbeat(self) -> None:
        """
        Record a successful heartbeat from the monitored system
        """
        now = time.time()
        
        if self.last_sample_time > 0:
            # Calculate interval
            interval = now - self.last_sample_time
            
            # Add to samples
            self.samples.append(interval)
            
            # Trim window if needed
            if len(self.samples) > self.window_size:
                self.samples = self.samples[-self.window_size:]
        
        self.last_sample_time = now
    
    def phi_value(self) -> float:
        """
        Calculate the current phi value based on heartbeat history
        
        Returns:
            Current phi value (0.0-1.0)
        """
        if len(self.samples) < self.min_samples:
            return 0.0
            
        now = time.time()
        elapsed = now - self.last_sample_time
        
        # Calculate mean and variance
        mean = sum(self.samples) / len(self.samples)
        variance = sum((s - mean) ** 2 for s in self.samples) / len(self.samples)
        
        # Calculate phi using cumulative distribution function approximation
        if variance == 0:
            return 1.0 if elapsed > mean else 0.0
            
        diff = elapsed - mean
        phi = min(1.0, max(0.0, diff / (mean + variance)))
        
        self.last_phi = phi
        return phi
    
    def is_available(self) -> bool:
        """
        Check if the monitored system is considered available
        
        Returns:
            True if system is likely available, False otherwise
        """
        return self.phi_value() < self.threshold
    
    def get_state(self) -> Dict[str, Any]:
        """
        Get current detector state
        
        Returns:
            Dictionary with current state information
        """
        phi = self.phi_value()
        return {
            "name": self.name,
            "available": phi < self.threshold,
            "phi": phi,
            "threshold": self.threshold,
            "samples": len(self.samples),
            "mean_interval": sum(self.samples) / len(self.samples) if self.samples else 0,
            "last_heartbeat_age": time.time() - self.last_sample_time if self.last_sample_time else 0
        }


class ResilienceManager:
    """
    Central manager for resilience components
    
    Provides unified management of circuit breakers, rate limiters,
    and failure detectors.
    """
    
    def __init__(self):
        """Initialize the resilience manager"""
        self.circuit_breakers = {}
        self.rate_limiters = {}
        self.failure_detectors = {}
        self.backoff_strategies = {}
    
    def create_circuit_breaker(self, name: str, **kwargs) -> CircuitBreaker:
        """
        Create and register a circuit breaker
        
        Args:
            name: Identifier for the circuit breaker
            **kwargs: Arguments to pass to CircuitBreaker constructor
            
        Returns:
            The created circuit breaker
        """
        if name in self.circuit_breakers:
            logger.warning(f"Circuit breaker '{name}' already exists, returning existing instance")
            return self.circuit_breakers[name]
            
        circuit_breaker = CircuitBreaker(name, **kwargs)
        self.circuit_breakers[name] = circuit_breaker
        return circuit_breaker
    
    def create_rate_limiter(self, name: str, **kwargs) -> RateLimiter:
        """
        Create and register a rate limiter
        
        Args:
            name: Identifier for the rate limiter
            **kwargs: Arguments to pass to RateLimiter constructor
            
        Returns:
            The created rate limiter
        """
        if name in self.rate_limiters:
            logger.warning(f"Rate limiter '{name}' already exists, returning existing instance")
            return self.rate_limiters[name]
            
        rate_limiter = RateLimiter(name, **kwargs)
        self.rate_limiters[name] = rate_limiter
        return rate_limiter
    
    def create_failure_detector(self, name: str, **kwargs) -> FailureDetector:
        """
        Create and register a failure detector
        
        Args:
            name: Identifier for the failure detector
            **kwargs: Arguments to pass to FailureDetector constructor
            
        Returns:
            The created failure detector
        """
        if name in self.failure_detectors:
            logger.warning(f"Failure detector '{name}' already exists, returning existing instance")
            return self.failure_detectors[name]
            
        failure_detector = FailureDetector(name, **kwargs)
        self.failure_detectors[name] = failure_detector
        return failure_detector
    
    def create_backoff_strategy(self, name: str, **kwargs) -> AdaptiveBackoff:
        """
        Create and register a backoff strategy
        
        Args:
            name: Identifier for the backoff strategy
            **kwargs: Arguments to pass to AdaptiveBackoff constructor
            
        Returns:
            The created backoff strategy
        """
        if name in self.backoff_strategies:
            logger.warning(f"Backoff strategy '{name}' already exists, returning existing instance")
            return self.backoff_strategies[name]
            
        backoff = AdaptiveBackoff(**kwargs)
        self.backoff_strategies[name] = backoff
        return backoff
    
    def get_circuit_breaker(self, name: str) -> Optional[CircuitBreaker]:
        """
        Get a registered circuit breaker by name
        
        Args:
            name: Identifier for the circuit breaker
            
        Returns:
            The circuit breaker or None if not found
        """
        return self.circuit_breakers.get(name)
    
    def get_rate_limiter(self, name: str) -> Optional[RateLimiter]:
        """
        Get a registered rate limiter by name
        
        Args:
            name: Identifier for the rate limiter
            
        Returns:
            The rate limiter or None if not found
        """
        return self.rate_limiters.get(name)
    
    def get_failure_detector(self, name: str) -> Optional[FailureDetector]:
        """
        Get a registered failure detector by name
        
        Args:
            name: Identifier for the failure detector
            
        Returns:
            The failure detector or None if not found
        """
        return self.failure_detectors.get(name)
    
    def get_backoff_strategy(self, name: str) -> Optional[AdaptiveBackoff]:
        """
        Get a registered backoff strategy by name
        
        Args:
            name: Identifier for the backoff strategy
            
        Returns:
            The backoff strategy or None if not found
        """
        return self.backoff_strategies.get(name)
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get status of all resilience components
        
        Returns:
            Dictionary with status information for all components
        """
        status = {
            "circuit_breakers": {},
            "rate_limiters": {},
            "failure_detectors": {}
        }
        
        # Circuit breakers
        for name, cb in self.circuit_breakers.items():
            status["circuit_breakers"][name] = cb.get_state()
            
        # Failure detectors
        for name, fd in self.failure_detectors.items():
            status["failure_detectors"][name] = fd.get_state()
            
        # Rate limiters - just report configured values
        for name, rl in self.rate_limiters.items():
            status["rate_limiters"][name] = {
                "name": name,
                "rate": rl.rate,
                "burst": rl.burst,
                "wait": rl.wait
            }
            
        return status
