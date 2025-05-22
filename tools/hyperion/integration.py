"""
Hyperion Resource Monitor - Integration Module

Provides integration capabilities with external systems, monitoring platforms,
and cloud services.
"""

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import time
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union

logger = logging.getLogger(__name__)

# Optional dependencies
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


class IntegrationType(Enum):
    """Types of supported integrations"""
    PROMETHEUS = "prometheus"
    GRAFANA = "grafana"
    OPENTELEMETRY = "opentelemetry"
    DATADOG = "datadog"
    NEW_RELIC = "new_relic"
    SLACK = "slack"
    PAGERDUTY = "pagerduty"
    ELASTICSEARCH = "elasticsearch"
    CLOUDWATCH = "cloudwatch"
    STACKDRIVER = "stackdriver"
    CUSTOM = "custom"


class IntegrationManager:
    """
    Central manager for external integrations
    
    Coordinates the different integrations and provides a unified interface
    for sending metrics, logs, and alerts to external systems.
    """
    
    def __init__(self):
        """Initialize integration manager"""
        self.integrations = {}
        self.default_tags = {}
    
    def register_integration(
        self,
        name: str,
        integration_type: IntegrationType,
        config: Dict[str, Any]
    ) -> bool:
        """
        Register a new integration
        
        Args:
            name: Integration instance name
            integration_type: Type of integration
            config: Integration configuration
            
        Returns:
            True if registered successfully
        """
        try:
            # Create integration based on type
            if integration_type == IntegrationType.PROMETHEUS:
                integration = PrometheusIntegration(name, config)
            elif integration_type == IntegrationType.GRAFANA:
                integration = GrafanaIntegration(name, config)
            elif integration_type == IntegrationType.OPENTELEMETRY:
                integration = OpenTelemetryIntegration(name, config)
            elif integration_type == IntegrationType.DATADOG:
                integration = DatadogIntegration(name, config)
            elif integration_type == IntegrationType.NEW_RELIC:
                integration = NewRelicIntegration(name, config)
            elif integration_type == IntegrationType.SLACK:
                integration = SlackIntegration(name, config)
            elif integration_type == IntegrationType.PAGERDUTY:
                integration = PagerDutyIntegration(name, config)
            elif integration_type == IntegrationType.ELASTICSEARCH:
                integration = ElasticsearchIntegration(name, config)
            elif integration_type == IntegrationType.CLOUDWATCH:
                integration = CloudWatchIntegration(name, config)
            elif integration_type == IntegrationType.STACKDRIVER:
                integration = StackdriverIntegration(name, config)
            elif integration_type == IntegrationType.CUSTOM:
                integration = CustomIntegration(name, config)
            else:
                raise ValueError(f"Unsupported integration type: {integration_type}")
                
            # Store integration
            self.integrations[name] = integration
            logger.info(f"Registered {integration_type.value} integration: {name}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to register integration {name}: {str(e)}", exc_info=True)
            return False
    
    def remove_integration(self, name: str) -> bool:
        """
        Remove an integration
        
        Args:
            name: Integration name
            
        Returns:
            True if removed
        """
        if name in self.integrations:
            # Call shutdown method if exists
            integration = self.integrations[name]
            if hasattr(integration, 'shutdown') and callable(integration.shutdown):
                try:
                    integration.shutdown()
                except Exception as e:
                    logger.warning(f"Error shutting down integration {name}: {str(e)}")
            
            # Remove integration
            del self.integrations[name]
            logger.info(f"Removed integration: {name}")
            return True
            
        return False
    
    def get_integration(self, name: str) -> Optional[Any]:
        """
        Get an integration by name
        
        Args:
            name: Integration name
            
        Returns:
            Integration instance or None
        """
        return self.integrations.get(name)
    
    def get_integrations_by_type(self, integration_type: IntegrationType) -> List[Any]:
        """
        Get all integrations of a specific type
        
        Args:
            integration_type: Type of integration
            
        Returns:
            List of matching integrations
        """
        return [
            integration for integration in self.integrations.values()
            if integration.integration_type == integration_type
        ]
    
    def set_default_tags(self, tags: Dict[str, str]) -> None:
        """
        Set default tags for all integrations
        
        Args:
            tags: Dictionary of tags
        """
        self.default_tags = tags
    
    async def send_metrics(
        self,
        metrics: Dict[str, Any],
        integration_names: Optional[List[str]] = None,
        tags: Optional[Dict[str, str]] = None
    ) -> Dict[str, bool]:
        """
        Send metrics to integrations
        
        Args:
            metrics: Dictionary of metrics to send
            integration_names: Optional list of integration names (all if None)
            tags: Optional additional tags
            
        Returns:
            Dictionary of integration name -> success status
        """
        # Combine tags
        combined_tags = {**self.default_tags}
        if tags:
            combined_tags.update(tags)
            
        # Determine target integrations
        targets = []
        if integration_names:
            targets = [self.integrations[name] for name in integration_names if name in self.integrations]
        else:
            targets = list(self.integrations.values())
            
        # Send to each integration
        results = {}
        for integration in targets:
            if hasattr(integration, 'send_metrics') and callable(integration.send_metrics):
                try:
                    success = await integration.send_metrics(metrics, combined_tags)
                    results[integration.name] = success
                except Exception as e:
                    logger.error(
                        f"Error sending metrics to {integration.name}: {str(e)}",
                        exc_info=True
                    )
                    results[integration.name] = False
                    
        return results
    
    async def send_alert(
        self,
        alert: Dict[str, Any],
        integration_names: Optional[List[str]] = None,
        tags: Optional[Dict[str, str]] = None
    ) -> Dict[str, bool]:
        """
        Send alert to integrations
        
        Args:
            alert: Alert information
            integration_names: Optional list of integration names (all alerting integrations if None)
            tags: Optional additional tags
            
        Returns:
            Dictionary of integration name -> success status
        """
        # Combine tags
        combined_tags = {**self.default_tags}
        if tags:
            combined_tags.update(tags)
            
        # Determine target integrations
        if integration_names:
            targets = [self.integrations[name] for name in integration_names if name in self.integrations]
        else:
            # Only send to alerting integrations by default
            alerting_types = [
                IntegrationType.SLACK,
                IntegrationType.PAGERDUTY
            ]
            targets = [
                integration for integration in self.integrations.values()
                if integration.integration_type in alerting_types
            ]
            
        # Send to each integration
        results = {}
        for integration in targets:
            if hasattr(integration, 'send_alert') and callable(integration.send_alert):
                try:
                    success = await integration.send_alert(alert, combined_tags)
                    results[integration.name] = success
                except Exception as e:
                    logger.error(
                        f"Error sending alert to {integration.name}: {str(e)}",
                        exc_info=True
                    )
                    results[integration.name] = False
                    
        return results
    
    async def send_logs(
        self,
        logs: List[Dict[str, Any]],
        integration_names: Optional[List[str]] = None,
        tags: Optional[Dict[str, str]] = None
    ) -> Dict[str, bool]:
        """
        Send logs to integrations
        
        Args:
            logs: List of log entries
            integration_names: Optional list of integration names (all logging integrations if None)
            tags: Optional additional tags
            
        Returns:
            Dictionary of integration name -> success status
        """
        # Combine tags
        combined_tags = {**self.default_tags}
        if tags:
            combined_tags.update(tags)
            
        # Determine target integrations
        if integration_names:
            targets = [self.integrations[name] for name in integration_names if name in self.integrations]
        else:
            # Only send to logging integrations by default
            logging_types = [
                IntegrationType.ELASTICSEARCH,
                IntegrationType.CLOUDWATCH,
                IntegrationType.STACKDRIVER,
                IntegrationType.DATADOG
            ]
            targets = [
                integration for integration in self.integrations.values()
                if integration.integration_type in logging_types
            ]
            
        # Send to each integration
        results = {}
        for integration in targets:
            if hasattr(integration, 'send_logs') and callable(integration.send_logs):
                try:
                    success = await integration.send_logs(logs, combined_tags)
                    results[integration.name] = success
                except Exception as e:
                    logger.error(
                        f"Error sending logs to {integration.name}: {str(e)}",
                        exc_info=True
                    )
                    results[integration.name] = False
                    
        return results
    
    async def shutdown_all(self) -> None:
        """Shutdown all integrations"""
        for name, integration in list(self.integrations.items()):
            if hasattr(integration, 'shutdown') and callable(integration.shutdown):
                try:
                    integration.shutdown()
                    logger.info(f"Shutdown integration: {name}")
                except Exception as e:
                    logger.warning(f"Error shutting down integration {name}: {str(e)}")


class BaseIntegration:
    """
    Base class for integrations
    
    Provides common functionality for all integration types.
    """
    
    def __init__(
        self,
        name: str,
        config: Dict[str, Any],
        integration_type: IntegrationType
    ):
        """
        Initialize base integration
        
        Args:
            name: Integration name
            config: Integration configuration
            integration_type: Type of integration
        """
        self.name = name
        self.config = config
        self.integration_type = integration_type
        self.enabled = config.get('enabled', True)
        self.last_error = None
        self.last_success = None
    
    def is_enabled(self) -> bool:
        """Check if integration is enabled"""
        return self.enabled
    
    def enable(self) -> None:
        """Enable the integration"""
        self.enabled = True
    
    def disable(self) -> None:
        """Disable the integration"""
        self.enabled = False
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get integration status
        
        Returns:
            Dictionary with status information
        """
        return {
            'name': self.name,
            'type': self.integration_type.value,
            'enabled': self.enabled,
            'last_error': self.last_error,
            'last_success': self.last_success,
            'config': self._redact_sensitive_config()
        }
    
    def shutdown(self) -> None:
        """Shutdown the integration"""
        pass
    
    def _redact_sensitive_config(self) -> Dict[str, Any]:
        """
        Create a copy of config with sensitive fields redacted
        
        Returns:
            Redacted config dictionary
        """
        sensitive_fields = [
            'api_key', 'token', 'secret', 'password', 'key',
            'auth', 'credential', 'private'
        ]
        
        redacted = {}
        for key, value in self.config.items():
            # Check if key contains sensitive information
            contains_sensitive = any(field in key.lower() for field in sensitive_fields)
            
            if contains_sensitive and isinstance(value, str):
                redacted[key] = '********'
            else:
                redacted[key] = value
                
        return redacted


class PrometheusIntegration(BaseIntegration):
    """Integration with Prometheus monitoring system"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize Prometheus integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - endpoint: Prometheus endpoint
                - job_name: Job name for metrics
        """
        super().__init__(name, config, IntegrationType.PROMETHEUS)
        self.endpoint = config.get('endpoint', 'http://localhost:9091/metrics/job/')
        self.job_name = config.get('job_name', 'hyperion')
        self.push_endpoint = f"{self.endpoint}/{self.job_name}"
        
        if not HAS_REQUESTS:
            logger.warning("Requests library not available, Prometheus integration will be disabled")
            self.enabled = False
    
    async def send_metrics(
        self,
        metrics: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send metrics to Prometheus Pushgateway
        
        Args:
            metrics: Dictionary of metrics to send
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Convert to Prometheus format
            prometheus_metrics = self._format_prometheus(metrics, tags)
            
            # Create endpoint with tags
            endpoint = self.push_endpoint
            if tags:
                tag_parts = [f"{k}/{v}" for k, v in tags.items()]
                if tag_parts:
                    endpoint = f"{endpoint}/{'/'.join(tag_parts)}"
            
            # Send to Pushgateway
            response = requests.post(
                endpoint,
                data=prometheus_metrics,
                headers={'Content-Type': 'text/plain'}
            )
            
            success = response.status_code == 200
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send metrics to Prometheus: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending metrics to Prometheus: {str(e)}", exc_info=True)
            return False
    
    def _format_prometheus(
        self,
        metrics: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Format metrics in Prometheus text format
        
        Args:
            metrics: Metrics dictionary
            tags: Optional tags
            
        Returns:
            Prometheus text format metrics
        """
        lines = []
        timestamp_ms = int(time.time() * 1000)
        
        # Process each metric
        for key, value in metrics.items():
            # Skip non-numeric values
            if not isinstance(value, (int, float)):
                continue
                
            # Create metric name
            metric_name = key.replace('.', '_').replace('-', '_')
            
            # Add tags if any
            tags_str = ''
            if tags:
                tag_parts = [f'{k}="{v}"' for k, v in tags.items()]
                if tag_parts:
                    tags_str = '{' + ','.join(tag_parts) + '}'
            
            # Add metric line
            lines.append(f"{metric_name}{tags_str} {value} {timestamp_ms}")
            
        return '\n'.join(lines)


class GrafanaIntegration(BaseIntegration):
    """Integration with Grafana for dashboards and alerts"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize Grafana integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - url: Grafana API URL
                - api_key: API key for authentication
                - dashboard_uid: Dashboard UID to update
        """
        super().__init__(name, config, IntegrationType.GRAFANA)
        self.url = config.get('url')
        self.api_key = config.get('api_key')
        self.dashboard_uid = config.get('dashboard_uid')
        
        if not self.url or not self.api_key:
            logger.warning("Grafana URL or API key not provided, integration will be disabled")
            self.enabled = False
            
        if not HAS_REQUESTS:
            logger.warning("Requests library not available, Grafana integration will be disabled")
            self.enabled = False
    
    async def create_dashboard(self, dashboard_data: Dict[str, Any]) -> bool:
        """
        Create or update a Grafana dashboard
        
        Args:
            dashboard_data: Dashboard data
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Create dashboard payload
            payload = {
                "dashboard": dashboard_data,
                "overwrite": True
            }
            
            # Send to Grafana
            response = requests.post(
                f"{self.url}/api/dashboards/db",
                json=payload,
                headers={
                    'Authorization': f"Bearer {self.api_key}",
                    'Content-Type': 'application/json'
                }
            )
            
            success = response.status_code == 200
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to create Grafana dashboard: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error creating Grafana dashboard: {str(e)}", exc_info=True)
            return False
    
    async def send_alert(
        self,
        alert: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send alert to Grafana
        
        Args:
            alert: Alert information
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Create alert payload
            payload = {
                "title": alert.get('title', 'Hyperion Alert'),
                "message": alert.get('message', ''),
                "severity": alert.get('severity', 'warning'),
                "tags": tags or {}
            }
            
            # Send to Grafana
            response = requests.post(
                f"{self.url}/api/alerts",
                json=payload,
                headers={
                    'Authorization': f"Bearer {self.api_key}",
                    'Content-Type': 'application/json'
                }
            )
            
            success = response.status_code == 200
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send Grafana alert: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending Grafana alert: {str(e)}", exc_info=True)
            return False


class OpenTelemetryIntegration(BaseIntegration):
    """Integration with OpenTelemetry for metrics, traces, and logs"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize OpenTelemetry integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - collector_url: URL of OpenTelemetry collector
                - service_name: Service name for telemetry
        """
        super().__init__(name, config, IntegrationType.OPENTELEMETRY)
        self.collector_url = config.get('collector_url')
        self.service_name = config.get('service_name', 'hyperion')
        
        # Initialize OpenTelemetry - this is a placeholder for actual implementation
        # In a real implementation, would use the OpenTelemetry SDK
        self.initialized = self._initialize_otel()
    
    def _initialize_otel(self) -> bool:
        """
        Initialize OpenTelemetry SDK
        
        Returns:
            True if initialized
        """
        # In a real implementation, would initialize the OpenTelemetry SDK
        # Currently a placeholder
        if not self.collector_url:
            logger.warning("OpenTelemetry collector URL not provided, integration will be minimal")
            
        # For now, we'll still return True to allow minimal funcionality
        return True
    
    async def send_metrics(
        self,
        metrics: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send metrics to OpenTelemetry collector
        
        Args:
            metrics: Dictionary of metrics to send
            tags: Optional tags
            
        Returns:
            True if successful
        """
        # This is a placeholder implementation
        # In a real implementation, would use the OpenTelemetry SDK
        logger.info(f"OpenTelemetry metrics: {len(metrics)} metrics")
        self.last_success = time.time()
        return True
    
    async def record_span(
        self,
        name: str,
        start_time: float,
        end_time: float,
        attributes: Optional[Dict[str, Any]] = None,
        parent_span_id: Optional[str] = None
    ) -> bool:
        """
        Record a span in OpenTelemetry
        
        Args:
            name: Span name
            start_time: Start time (seconds since epoch)
            end_time: End time (seconds since epoch)
            attributes: Optional span attributes
            parent_span_id: Optional parent span ID
            
        Returns:
            True if successful
        """
        # This is a placeholder implementation
        # In a real implementation, would use the OpenTelemetry SDK
        logger.info(f"OpenTelemetry span: {name} ({end_time - start_time:.3f}s)")
        self.last_success = time.time()
        return True
    
    async def send_logs(
        self,
        logs: List[Dict[str, Any]],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send logs to OpenTelemetry collector
        
        Args:
            logs: List of log entries
            tags: Optional tags
            
        Returns:
            True if successful
        """
        # This is a placeholder implementation
        # In a real implementation, would use the OpenTelemetry SDK
        logger.info(f"OpenTelemetry logs: {len(logs)} entries")
        self.last_success = time.time()
        return True


class DatadogIntegration(BaseIntegration):
    """Integration with Datadog for metrics, logs, and APM"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize Datadog integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - api_key: Datadog API key
                - app_key: Datadog application key
                - site: Datadog site (us, eu, etc.)
        """
        super().__init__(name, config, IntegrationType.DATADOG)
        self.api_key = config.get('api_key')
        self.app_key = config.get('app_key')
        self.site = config.get('site', 'us')
        
        # Determine API URL based on site
        self.api_url = f"https://api.{self.site}.datadoghq.com/api/v1"
        
        if not self.api_key:
            logger.warning("Datadog API key not provided, integration will be disabled")
            self.enabled = False
            
        if not HAS_REQUESTS:
            logger.warning("Requests library not available, Datadog integration will be disabled")
            self.enabled = False
    
    async def send_metrics(
        self,
        metrics: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send metrics to Datadog
        
        Args:
            metrics: Dictionary of metrics to send
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Convert to Datadog format
            timestamp = int(time.time())
            metrics_payload = []
            
            for key, value in metrics.items():
                # Skip non-numeric values
                if not isinstance(value, (int, float)):
                    continue
                    
                # Create metric entry
                metric_entry = {
                    'metric': f"hyperion.{key}",
                    'points': [[timestamp, value]],
                    'type': 'gauge',
                    'host': os.environ.get('HOSTNAME', 'unknown')
                }
                
                # Add tags
                if tags:
                    metric_entry['tags'] = [f"{k}:{v}" for k, v in tags.items()]
                    
                metrics_payload.append(metric_entry)
            
            # Send to Datadog
            response = requests.post(
                f"{self.api_url}/series",
                json={'series': metrics_payload},
                headers={
                    'Content-Type': 'application/json',
                    'DD-API-KEY': self.api_key
                }
            )
            
            success = response.status_code == 202
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send metrics to Datadog: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending metrics to Datadog: {str(e)}", exc_info=True)
            return False
    
    async def send_logs(
        self,
        logs: List[Dict[str, Any]],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send logs to Datadog
        
        Args:
            logs: List of log entries
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Convert logs to Datadog format
            log_payload = []
            
            for log in logs:
                # Create log entry
                log_entry = {
                    'message': log.get('message', ''),
                    'status': log.get('level', 'info'),
                    'service': 'hyperion',
                    'ddsource': 'hyperion',
                    'hostname': os.environ.get('HOSTNAME', 'unknown'),
                    'timestamp': log.get('timestamp', int(time.time()))
                }
                
                # Add all log fields to attributes
                log_entry.update(
                    {k: v for k, v in log.items() if k not in ('message', 'level', 'timestamp')}
                )
                
                # Add tags
                if tags:
                    log_entry['ddtags'] = ','.join([f"{k}:{v}" for k, v in tags.items()])
                    
                log_payload.append(log_entry)
            
            # Send to Datadog
            response = requests.post(
                f"{self.api_url}/logs",
                json=log_payload,
                headers={
                    'Content-Type': 'application/json',
                    'DD-API-KEY': self.api_key
                }
            )
            
            success = response.status_code in (200, 202)
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send logs to Datadog: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending logs to Datadog: {str(e)}", exc_info=True)
            return False


class NewRelicIntegration(BaseIntegration):
    """Integration with New Relic for metrics and APM"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize New Relic integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - license_key: New Relic license key
                - app_name: Application name
        """
        super().__init__(name, config, IntegrationType.NEW_RELIC)
        self.license_key = config.get('license_key')
        self.app_name = config.get('app_name', 'Hyperion')
        
        # New Relic API endpoints
        self.metric_api_url = "https://metric-api.newrelic.com/metric/v1"
        self.event_api_url = "https://insights-collector.newrelic.com/v1/accounts"
        self.account_id = config.get('account_id')
        
        if not self.license_key:
            logger.warning("New Relic license key not provided, integration will be disabled")
            self.enabled = False
            
        if not HAS_REQUESTS:
            logger.warning("Requests library not available, New Relic integration will be disabled")
            self.enabled = False
    
    async def send_metrics(
        self,
        metrics: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send metrics to New Relic
        
        Args:
            metrics: Dictionary of metrics to send
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Convert to New Relic format
            timestamp = int(time.time())
            metrics_payload = []
            
            for key, value in metrics.items():
                # Skip non-numeric values
                if not isinstance(value, (int, float)):
                    continue
                    
                # Create metric entry
                attributes = {
                    'app.name': self.app_name,
                    'host.name': os.environ.get('HOSTNAME', 'unknown')
                }
                
                # Add tags
                if tags:
                    attributes.update(tags)
                    
                metrics_payload.append({
                    'name': f"hyperion.{key}",
                    'type': 'gauge',
                    'value': value,
                    'timestamp': timestamp,
                    'attributes': attributes
                })
            
            # Send to New Relic
            response = requests.post(
                f"{self.metric_api_url}",
                json=[{'metrics': metrics_payload}],
                headers={
                    'Content-Type': 'application/json',
                    'Api-Key': self.license_key
                }
            )
            
            success = response.status_code == 202
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send metrics to New Relic: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending metrics to New Relic: {str(e)}", exc_info=True)
            return False
    
    async def send_alert(
        self,
        alert: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send alert to New Relic as event
        
        Args:
            alert: Alert information
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS or not self.account_id:
            return False
            
        try:
            # Create event payload
            event_type = 'HyperionAlert'
            event_payload = {
                'eventType': event_type,
                'title': alert.get('title', 'Hyperion Alert'),
                'message': alert.get('message', ''),
                'severity': alert.get('severity', 'warning'),
                'timestamp': int(time.time()),
                'app.name': self.app_name,
                'host.name': os.environ.get('HOSTNAME', 'unknown')
            }
            
            # Add tags
            if tags:
                event_payload.update(tags)
                
            # Send to New Relic
            response = requests.post(
                f"{self.event_api_url}/{self.account_id}/events",
                json=[event_payload],
                headers={
                    'Content-Type': 'application/json',
                    'X-Insert-Key': self.license_key
                }
            )
            
            success = response.status_code == 200
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send event to New Relic: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending event to New Relic: {str(e)}", exc_info=True)
            return False


class SlackIntegration(BaseIntegration):
    """Integration with Slack for alerts and notifications"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize Slack integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - webhook_url: Slack webhook URL
                - channel: Slack channel
                - username: Bot username
        """
        super().__init__(name, config, IntegrationType.SLACK)
        self.webhook_url = config.get('webhook_url')
        self.channel = config.get('channel')
        self.username = config.get('username', 'Hyperion Monitor')
        
        if not self.webhook_url:
            logger.warning("Slack webhook URL not provided, integration will be disabled")
            self.enabled = False
            
        if not HAS_REQUESTS:
            logger.warning("Requests library not available, Slack integration will be disabled")
            self.enabled = False
    
    async def send_alert(
        self,
        alert: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send alert to Slack
        
        Args:
            alert: Alert information
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Determine color based on severity
            severity = alert.get('severity', 'warning').lower()
            color = {
                'critical': '#FF0000',  # Red
                'error': '#FF0000',     # Red
                'warning': '#FFA500',   # Orange
                'info': '#2196F3',      # Blue
                'success': '#4CAF50'    # Green
            }.get(severity, '#FFA500')
            
            # Create slack message
            message = {
                'channel': self.channel,
                'username': self.username,
                'icon_emoji': ':robot_face:',
                'attachments': [{
                    'fallback': alert.get('title', 'Hyperion Alert'),
                    'color': color,
                    'title': alert.get('title', 'Hyperion Alert'),
                    'text': alert.get('message', ''),
                    'fields': [
                        {
                            'title': 'Severity',
                            'value': severity.capitalize(),
                            'short': True
                        },
                        {
                            'title': 'Time',
                            'value': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                            'short': True
                        }
                    ],
                    'footer': f"Hyperion Monitor - {os.environ.get('HOSTNAME', 'unknown')}"
                }]
            }
            
            # Add tags as fields if provided
            if tags:
                for key, value in tags.items():
                    message['attachments'][0]['fields'].append({
                        'title': key,
                        'value': value,
                        'short': True
                    })
            
            # Send to Slack
            response = requests.post(
                self.webhook_url,
                json=message
            )
            
            success = response.status_code == 200
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send message to Slack: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending message to Slack: {str(e)}", exc_info=True)
            return False


class PagerDutyIntegration(BaseIntegration):
    """Integration with PagerDuty for alerts and incidents"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize PagerDuty integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - routing_key: PagerDuty Events API v2 integration key
                - service_id: PagerDuty service ID
        """
        super().__init__(name, config, IntegrationType.PAGERDUTY)
        self.routing_key = config.get('routing_key')
        self.service_id = config.get('service_id')
        
        # PagerDuty API endpoints
        self.events_api_url = "https://events.pagerduty.com/v2/enqueue"
        
        if not self.routing_key:
            logger.warning("PagerDuty routing key not provided, integration will be disabled")
            self.enabled = False
            
        if not HAS_REQUESTS:
            logger.warning("Requests library not available, PagerDuty integration will be disabled")
            self.enabled = False
    
    async def send_alert(
        self,
        alert: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send alert to PagerDuty
        
        Args:
            alert: Alert information
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Determine event action based on severity
            severity = alert.get('severity', 'warning').lower()
            
            # Map severity to PagerDuty severity
            pd_severity = {
                'critical': 'critical',
                'error': 'error',
                'warning': 'warning',
                'info': 'info',
                'success': 'info'
            }.get(severity, 'warning')
            
            # Create a unique deduplication key based on alert title and context
            source = os.environ.get('HOSTNAME', 'unknown')
            component = 'hyperion'
            title = alert.get('title', 'Hyperion Alert')
            
            dedup_key = self._generate_dedup_key(source, component, title)
            
            # Create payload
            payload = {
                'routing_key': self.routing_key,
                'event_action': 'trigger',
                'dedup_key': dedup_key,
                'payload': {
                    'summary': title,
                    'source': source,
                    'severity': pd_severity,
                    'component': component,
                    'custom_details': {
                        'message': alert.get('message', ''),
                        'timestamp': datetime.now().isoformat()
                    }
                }
            }
            
            # Add tags if provided
            if tags:
                payload['payload']['custom_details'].update(tags)
            
            # Send to PagerDuty
            response = requests.post(
                self.events_api_url,
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            success = response.status_code == 202
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send alert to PagerDuty: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending alert to PagerDuty: {str(e)}", exc_info=True)
            return False
    
    def _generate_dedup_key(self, source: str, component: str, title: str) -> str:
        """
        Generate a deduplication key for PagerDuty events
        
        Args:
            source: Event source
            component: Event component
            title: Event title
            
        Returns:
            Deduplication key
        """
        dedup_string = f"{source}:{component}:{title}"
        return hashlib.md5(dedup_string.encode()).hexdigest()
    
    async def resolve_alert(self, dedup_key: str) -> bool:
        """
        Resolve an alert in PagerDuty
        
        Args:
            dedup_key: Deduplication key for the alert
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Create payload
            payload = {
                'routing_key': self.routing_key,
                'event_action': 'resolve',
                'dedup_key': dedup_key
            }
            
            # Send to PagerDuty
            response = requests.post(
                self.events_api_url,
                json=payload,
                headers={'Content-Type': 'application/json'}
            )
            
            success = response.status_code == 202
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to resolve alert in PagerDuty: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error resolving alert in PagerDuty: {str(e)}", exc_info=True)
            return False


class ElasticsearchIntegration(BaseIntegration):
    """Integration with Elasticsearch for logs and metrics storage"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize Elasticsearch integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - url: Elasticsearch URL
                - username: Username for authentication
                - password: Password for authentication
                - index_prefix: Index prefix for logs and metrics
        """
        super().__init__(name, config, IntegrationType.ELASTICSEARCH)
        self.url = config.get('url')
        self.username = config.get('username')
        self.password = config.get('password')
        self.index_prefix = config.get('index_prefix', 'hyperion')
        
        if not self.url:
            logger.warning("Elasticsearch URL not provided, integration will be disabled")
            self.enabled = False
            
        if not HAS_REQUESTS:
            logger.warning("Requests library not available, Elasticsearch integration will be disabled")
            self.enabled = False
    
    async def send_logs(
        self,
        logs: List[Dict[str, Any]],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send logs to Elasticsearch
        
        Args:
            logs: List of log entries
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Create index name with date
            index_name = f"{self.index_prefix}-logs-{datetime.now().strftime('%Y.%m.%d')}"
            
            # Prepare bulk request
            bulk_data = []
            
            for log in logs:
                # Create index action
                action = {"index": {"_index": index_name}}
                bulk_data.append(json.dumps(action))
                
                # Add timestamp if not present
                if 'timestamp' not in log:
                    log['timestamp'] = datetime.now().isoformat()
                    
                # Add tags
                if tags:
                    log['tags'] = tags
                    
                bulk_data.append(json.dumps(log))
            
            # Add newline after each line
            bulk_body = '\n'.join(bulk_data) + '\n'
            
            # Build auth header if credentials provided
            auth = None
            if self.username and self.password:
                auth = (self.username, self.password)
            
            # Send to Elasticsearch
            response = requests.post(
                f"{self.url}/_bulk",
                data=bulk_body,
                headers={'Content-Type': 'application/x-ndjson'},
                auth=auth
            )
            
            success = response.status_code in (200, 201)
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send logs to Elasticsearch: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending logs to Elasticsearch: {str(e)}", exc_info=True)
            return False
    
    async def send_metrics(
        self,
        metrics: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send metrics to Elasticsearch
        
        Args:
            metrics: Dictionary of metrics to send
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not HAS_REQUESTS:
            return False
            
        try:
            # Create index name with date
            index_name = f"{self.index_prefix}-metrics-{datetime.now().strftime('%Y.%m.%d')}"
            
            # Prepare document
            timestamp = datetime.now().isoformat()
            document = {
                'timestamp': timestamp,
                'metrics': {}
            }
            
            # Add metrics
            for key, value in metrics.items():
                # Only include numeric metrics
                if isinstance(value, (int, float)):
                    document['metrics'][key] = value
            
            # Add tags
            if tags:
                document['tags'] = tags
                
            # Build auth header if credentials provided
            auth = None
            if self.username and self.password:
                auth = (self.username, self.password)
            
            # Send to Elasticsearch
            response = requests.post(
                f"{self.url}/{index_name}/_doc",
                json=document,
                headers={'Content-Type': 'application/json'},
                auth=auth
            )
            
            success = response.status_code in (200, 201)
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send metrics to Elasticsearch: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending metrics to Elasticsearch: {str(e)}", exc_info=True)
            return False


class CloudWatchIntegration(BaseIntegration):
    """Integration with AWS CloudWatch for metrics and logs"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize CloudWatch integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - region: AWS region
                - namespace: CloudWatch namespace
                - log_group: CloudWatch log group
        """
        super().__init__(name, config, IntegrationType.CLOUDWATCH)
        self.region = config.get('region', 'us-east-1')
        self.namespace = config.get('namespace', 'Hyperion')
        self.log_group = config.get('log_group', '/hyperion/logs')
        
        # This is a placeholder - in a real implementation, would use boto3
        logger.info(f"CloudWatch integration initialized for region {self.region}")
        
        # Flag for availability
        self.aws_sdk_available = False
    
    async def send_metrics(
        self,
        metrics: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send metrics to CloudWatch
        
        Args:
            metrics: Dictionary of metrics to send
            tags: Optional tags
            
        Returns:
            True if successful
        """
        # This is a placeholder - in a real implementation, would use boto3
        logger.info(f"CloudWatch metrics: {len(metrics)} metrics to {self.namespace}")
        self.last_success = time.time()
        return True
    
    async def send_logs(
        self,
        logs: List[Dict[str, Any]],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send logs to CloudWatch
        
        Args:
            logs: List of log entries
            tags: Optional tags
            
        Returns:
            True if successful
        """
        # This is a placeholder - in a real implementation, would use boto3
        logger.info(f"CloudWatch logs: {len(logs)} entries to {self.log_group}")
        self.last_success = time.time()
        return True


class StackdriverIntegration(BaseIntegration):
    """Integration with Google Cloud Stackdriver for metrics and logs"""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize Stackdriver integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - project_id: Google Cloud project ID
                - service_account_json: Service account JSON key (can be file path or JSON string)
        """
        super().__init__(name, config, IntegrationType.STACKDRIVER)
        self.project_id = config.get('project_id')
        self.service_account_json = config.get('service_account_json')
        
        # This is a placeholder - in a real implementation, would use google-cloud-monitoring
        logger.info(f"Stackdriver integration initialized for project {self.project_id}")
        
        # Flag for availability
        self.gcp_sdk_available = False
    
    async def send_metrics(
        self,
        metrics: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send metrics to Stackdriver
        
        Args:
            metrics: Dictionary of metrics to send
            tags: Optional tags
            
        Returns:
            True if successful
        """
        # This is a placeholder - in a real implementation, would use google-cloud-monitoring
        logger.info(f"Stackdriver metrics: {len(metrics)} metrics")
        self.last_success = time.time()
        return True
    
    async def send_logs(
        self,
        logs: List[Dict[str, Any]],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send logs to Stackdriver
        
        Args:
            logs: List of log entries
            tags: Optional tags
            
        Returns:
            True if successful
        """
        # This is a placeholder - in a real implementation, would use google-cloud-logging
        logger.info(f"Stackdriver logs: {len(logs)} entries")
        self.last_success = time.time()
        return True


class CustomIntegration(BaseIntegration):
    """
    Custom integration for user-defined endpoints
    
    Allows sending metrics, logs, and alerts to custom HTTP endpoints.
    """
    
    def __init__(self, name: str, config: Dict[str, Any]):
        """
        Initialize custom integration
        
        Args:
            name: Integration name
            config: Integration config with keys:
                - metrics_url: URL for sending metrics
                - logs_url: URL for sending logs
                - alerts_url: URL for sending alerts
                - auth_header: Optional authentication header
                - method: HTTP method to use (POST, PUT)
        """
        super().__init__(name, config, IntegrationType.CUSTOM)
        self.metrics_url = config.get('metrics_url')
        self.logs_url = config.get('logs_url')
        self.alerts_url = config.get('alerts_url')
        self.auth_header = config.get('auth_header')
        self.method = config.get('method', 'POST').upper()
        
        # Authentication header parsing
        self.auth = None
        if self.auth_header:
            if self.auth_header.startswith('Basic '):
                # Extract and parse Basic auth
                auth_data = self.auth_header[6:]
                try:
                    decoded = base64.b64decode(auth_data).decode('utf-8')
                    username, password = decoded.split(':', 1)
                    self.auth = (username, password)
                except Exception:
                    logger.warning("Failed to parse Basic auth header")
            else:
                # Use as-is for other auth types
                self.headers = {'Authorization': self.auth_header}
        
        if not any([self.metrics_url, self.logs_url, self.alerts_url]):
            logger.warning("No endpoint URLs provided for custom integration")
            self.enabled = False
            
        if not HAS_REQUESTS:
            logger.warning("Requests library not available, custom integration will be disabled")
            self.enabled = False
    
    async def send_metrics(
        self,
        metrics: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send metrics to custom endpoint
        
        Args:
            metrics: Dictionary of metrics to send
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not self.metrics_url or not HAS_REQUESTS:
            return False
            
        try:
            # Create payload
            payload = {
                'timestamp': int(time.time()),
                'metrics': metrics,
                'source': os.environ.get('HOSTNAME', 'unknown')
            }
            
            # Add tags
            if tags:
                payload['tags'] = tags
            
            # Prepare request
            headers = {'Content-Type': 'application/json'}
            if hasattr(self, 'headers'):
                headers.update(self.headers)
            
            # Send request
            if self.method == 'POST':
                response = requests.post(
                    self.metrics_url,
                    json=payload,
                    headers=headers,
                    auth=self.auth
                )
            elif self.method == 'PUT':
                response = requests.put(
                    self.metrics_url,
                    json=payload,
                    headers=headers,
                    auth=self.auth
                )
            else:
                self.last_error = f"Unsupported HTTP method: {self.method}"
                return False
            
            success = response.status_code in (200, 201, 202)
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send metrics to custom endpoint: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending metrics to custom endpoint: {str(e)}", exc_info=True)
            return False
    
    async def send_logs(
        self,
        logs: List[Dict[str, Any]],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send logs to custom endpoint
        
        Args:
            logs: List of log entries
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not self.logs_url or not HAS_REQUESTS:
            return False
            
        try:
            # Create payload
            payload = {
                'timestamp': int(time.time()),
                'logs': logs,
                'source': os.environ.get('HOSTNAME', 'unknown')
            }
            
            # Add tags
            if tags:
                payload['tags'] = tags
            
            # Prepare request
            headers = {'Content-Type': 'application/json'}
            if hasattr(self, 'headers'):
                headers.update(self.headers)
            
            # Send request
            if self.method == 'POST':
                response = requests.post(
                    self.logs_url,
                    json=payload,
                    headers=headers,
                    auth=self.auth
                )
            elif self.method == 'PUT':
                response = requests.put(
                    self.logs_url,
                    json=payload,
                    headers=headers,
                    auth=self.auth
                )
            else:
                self.last_error = f"Unsupported HTTP method: {self.method}"
                return False
            
            success = response.status_code in (200, 201, 202)
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send logs to custom endpoint: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending logs to custom endpoint: {str(e)}", exc_info=True)
            return False
    
    async def send_alert(
        self,
        alert: Dict[str, Any],
        tags: Optional[Dict[str, str]] = None
    ) -> bool:
        """
        Send alert to custom endpoint
        
        Args:
            alert: Alert information
            tags: Optional tags
            
        Returns:
            True if successful
        """
        if not self.enabled or not self.alerts_url or not HAS_REQUESTS:
            return False
            
        try:
            # Create payload
            payload = {
                'timestamp': int(time.time()),
                'alert': alert,
                'source': os.environ.get('HOSTNAME', 'unknown')
            }
            
            # Add tags
            if tags:
                payload['tags'] = tags
            
            # Prepare request
            headers = {'Content-Type': 'application/json'}
            if hasattr(self, 'headers'):
                headers.update(self.headers)
            
            # Send request
            if self.method == 'POST':
                response = requests.post(
                    self.alerts_url,
                    json=payload,
                    headers=headers,
                    auth=self.auth
                )
            elif self.method == 'PUT':
                response = requests.put(
                    self.alerts_url,
                    json=payload,
                    headers=headers,
                    auth=self.auth
                )
            else:
                self.last_error = f"Unsupported HTTP method: {self.method}"
                return False
            
            success = response.status_code in (200, 201, 202)
            if success:
                self.last_success = time.time()
                return True
            else:
                self.last_error = f"HTTP {response.status_code}: {response.text}"
                logger.warning(
                    f"Failed to send alert to custom endpoint: {self.last_error}"
                )
                return False
                
        except Exception as e:
            self.last_error = str(e)
            logger.error(f"Error sending alert to custom endpoint: {str(e)}", exc_info=True)
            return False
