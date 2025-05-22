# Hyperion Resource Monitor

An enterprise-grade resource monitoring and management system with multi-environment optimization, resilience patterns, and extensive integrations.

## Features

### Core Capabilities
- **Intelligent Resource Monitoring**: Advanced metrics collection across multiple environments
- **Cross-Environment Detection**: Automatic detection and optimization for cloud, server, laptop, and container environments
- **Adaptive Resource Management**: Dynamic resource allocation based on system load and constraints
- **Resilience Patterns**: Circuit breakers, rate limiters, adaptive backoff, and fault tolerance
- **Security**: Role-based access control, secure configuration, and encryption
- **Observability**: Distributed tracing, structured logging, and error context tracking

### Advanced Features
- **Energy Efficiency**: Battery-aware operation with progressive power management
- **Machine Learning Integration**: Predictive scaling with resource usage forecasting
- **Cloud Integration**: Provider-specific optimizations for AWS, GCP, and Azure
- **Container Awareness**: cgroup limit detection and orchestrator-specific optimizations
- **Visualization**: Interactive dashboards and charts for metrics and resource usage
- **External Integrations**: Connections to monitoring platforms, alerting systems, and log aggregators

### Enterprise Enhancements
- **Plugin System**: Extendable architecture with dynamic plugin loading
- **Lifecycle Management**: Coordinated startup and graceful shutdown capabilities
- **Dynamic Configuration**: Live configuration updates with validation and notification
- **Enhanced Metrics**: Custom metric types, derived metrics, and aggregations
- **Secure Communication**: Message signing, validation, and encrypted data transfer

## Architecture

Hyperion follows a modular architecture with clear separation of concerns:

```
hyperion/
├── core.py               # Core monitoring capabilities
├── adaptation.py         # Adaptive resource management
├── resilience.py         # Resilience patterns (circuit breakers, etc.)
├── config.py             # Dynamic configuration management
├── metrics.py            # Advanced metrics collection
├── lifecycle.py          # Application lifecycle management
├── observability.py      # Distributed tracing and logging
├── security.py           # Authentication and authorization
├── cloud.py              # Cloud provider integrations
├── container.py          # Container environment awareness
├── energy.py             # Power management and energy efficiency
├── ml.py                 # Machine learning for prediction
├── integration.py        # External system integrations
├── visualization.py      # Data visualization capabilities
├── enhancer.py           # Plugin system and extensions
└── decorators.py         # Function decorators for controlled execution
```

## Installation

```bash
pip install hyperion-monitor
```

### Optional Dependencies

```bash
# For machine learning features
pip install hyperion-monitor[ml]  # numpy, scikit-learn

# For visualization capabilities
pip install hyperion-monitor[viz]  # matplotlib

# For complete functionality
pip install hyperion-monitor[full]  # All optional dependencies
```

## Quick Start

### Basic Monitoring

```python
import asyncio
from hyperion import Hyperion, trace

@trace("app.process_data")
async def process_data(data):
    # Your processing logic here
    return result

async def main():
    # Initialize Hyperion
    hyperion = await Hyperion.initialize()
    
    # Access system status
    print(hyperion.status)
    
    # Create a circuit breaker
    circuit = hyperion.create_circuit_breaker("data_processor")
    
    # Process with circuit breaker protection
    try:
        result = await circuit.execute(process_data, large_dataset)
    except Exception as e:
        print(f"Circuit open: {e}")
    
    # Shutdown gracefully
    await hyperion.shutdown()

if __name__ == "__main__":
    asyncio.run(main())
```

### Function Decorators

```python
from hyperion import monitor, with_resource_control, with_adaptive_timeout

# Control resource usage
@with_resource_control(monitor)
async def process_batch(items, **kwargs):
    # Access optimized parameters
    batch_size = kwargs.get('batch_size')
    chunk_size = kwargs.get('chunk_size')
    
    # Process with controlled resources...
    return results

# Add adaptive timeout
@with_adaptive_timeout(monitor)
async def fetch_data(url, **kwargs):
    # Automatic timeout based on content size and system load
    timeout = kwargs.get('timeout')
    
    # Use the timeout...
    return data
```

### Observability and Tracing

```python
from hyperion import observability

async def fetch_and_process():
    # Create a trace context
    async with observability.trace_context("fetch_and_process") as (trace, span):
        # Add metadata to span
        span.add_metadata("priority", "high")
        
        # Create child span
        process_span = trace.create_span("process_data")
        
        try:
            # Process data
            result = process_data()
            
            # End child span
            process_span.end()
            return result
        except Exception as e:
            # Capture exception with context
            error_id = observability.capture_exception(e)
            process_span.end(error=e)
            return None
```

### Visualization

```python
from hyperion import visualization

async def generate_dashboard():
    # Create CPU usage chart data
    cpu_data = {
        'x': time_series,
        'series': [
            {'name': 'System CPU', 'data': cpu_values}
        ]
    }
    
    # Create a line chart visualization
    result = await visualization.create_visualization(
        cpu_data, 
        visualization_type='line_chart',
        options={'title': 'CPU Usage', 'save': True}
    )
    
    return result['file_path']
```

### Security and Configuration

```python
from hyperion import security, config

# Check permissions
if security.check_permission(username, Permission.READ_METRICS):
    # Access metrics
    metrics = get_metrics()

# Get configuration with live updates
config.subscribe('max_workers', on_max_workers_changed)
current_max = config.get('max_workers', 4)
```

### External Integrations

```python
from hyperion import integration
from hyperion.integration import IntegrationType

# Register Prometheus integration
await integration.register_integration(
    "prometheus", 
    IntegrationType.PROMETHEUS,
    {
        'endpoint': 'http://localhost:9091/metrics/job/',
        'job_name': 'myapp'
    }
)

# Send metrics to all integrations
await integration.send_metrics(
    {'cpu': 0.45, 'memory': 0.6},
    tags={'service': 'api', 'instance': 'web-01'}
)

# Send an alert to Slack
await integration.send_alert({
    'title': 'High CPU Usage',
    'message': 'CPU usage exceeds threshold: 85%',
    'severity': 'warning'
}, integration_names=['slack'])
```

## Command-Line Interface

```bash
# Start monitoring with default settings
python -m hyperion monitor

# Run a 30-second system profile
python -m hyperion profile --duration 30

# Show current system status
python -m hyperion status

# Monitor with additional features
python -m hyperion monitor --ml --cloud --energy

# Export metrics to Prometheus format
python -m hyperion monitor --format prometheus --output metrics.prom
```

## Advanced Configuration

Hyperion can be configured through a JSON configuration file or environment variables:

```json
{
  "check_interval": 5.0,
  "max_workers": 8,
  "environment": "auto",
  "auto_recover": true,
  "adaptive_scaling": true,
  "metrics_history_size": 1000,
  "circuit_breaker_threshold": 5,
  "energy_saver_threshold": 0.2,
  "feature_flags": {
    "ml_predictions": true,
    "detailed_logging": true
  }
}
```

## Extending Hyperion

### Creating a Plugin

```python
# plugins/custom_monitor.py

PLUGIN_INFO = {
    'name': 'Custom Monitor',
    'version': '1.0.0',
    'author': 'Your Name',
    'description': 'Custom monitoring plugin'
}

# Define extension for a specific extension point
class CustomMetricHandler:
    EXTENSION_POINT = 'metric_handler'
    
    def collect_metrics(self):
        return {'custom_metric': get_my_custom_metric()}

# Define hook implementation
def pre_collect_metrics():
    # Called before metrics collection
    prepare_custom_resources()
pre_collect_metrics.HOOK = 'pre_collect_metrics'

# Plugin lifecycle
def initialize():
    # Called when plugin is loaded
    setup_resources()

def shutdown():
    # Called when plugin is unloaded
    cleanup_resources()
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
