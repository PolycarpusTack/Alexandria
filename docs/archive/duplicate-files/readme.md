# Hyperion Resource Monitor

An advanced resource monitoring and management system with multi-environment optimization.

Hyperion intelligently monitors and manages system resources across a variety of environments including cloud, server, laptop, and container deployments. It provides adaptive scaling, predictive resource allocation, and environment-specific optimizations.

## Features

- **Multi-Environment Detection**: Automatically detects cloud providers, containers, laptops, and servers
- **Adaptive Resource Management**: Adjusts resource usage based on system load and environment
- **Energy Efficiency**: Battery-aware operation for laptops and mobile devices
- **Cloud Integration**: Provider-specific optimizations for AWS, GCP, and Azure
- **Container Awareness**: Respects cgroup limits and container orchestrators
- **Predictive Scaling**: Trend analysis for anticipating resource needs
- **Machine Learning**: Optional ML-based predictions and anomaly detection
- **Comprehensive Metrics**: CPU, memory, network, disk usage tracking
- **Exportable Reports**: Prometheus, JSON, and human-readable formats

## Installation

```bash
pip install hyperion-monitor
```

### Optional Dependencies

```bash
# For machine learning features
pip install hyperion-monitor[ml]  # Installs numpy, scikit-learn

# For all features
pip install hyperion-monitor[full]  # Installs all optional dependencies
```

## Quick Start

### As a Library

```python
import asyncio
from hyperion import monitor, with_resource_control

# Start the global monitor
async def setup():
    await monitor.start()

# Use the decorator for resource-controlled functions
@with_resource_control(monitor)
async def process_data(data, **kwargs):
    # Access to adaptive parameters
    chunk_size = kwargs.get('chunk_size')
    batch_size = kwargs.get('batch_size')
    timeout = kwargs.get('timeout')
    
    # Process with adaptive resources
    # ...
    return result

# Example usage
async def main():
    await setup()
    result = await process_data(large_dataset)
    print(monitor.status)

if __name__ == "__main__":
    asyncio.run(main())
```

### As a Command-Line Tool

```bash
# Run continuous monitoring
python -m hyperion monitor

# Show current system status
python -m hyperion status

# Run a 30-second system profile
python -m hyperion profile

# Enable all features
python -m hyperion monitor --ml --cloud --container --energy
```

## Architecture

Hyperion is built with a modular architecture that separates core functionality from specialized features:

- **Core Module**: Base monitoring and adaptive control
- **Metrics Module**: Metrics collection and reporting
- **Decorators Module**: Function decorators for resource control
- **Cloud Module**: Cloud provider integrations
- **Container Module**: Container-specific monitoring
- **Energy Module**: Power-aware resource management
- **ML Module**: Machine learning for predictive scaling

## Environment-Specific Features

### Laptop Mode

- Conservative resource usage to preserve battery life
- Battery state monitoring with power-saving recommendations
- Gradual resource scaling based on battery level

### Cloud Environments

- Provider-specific metadata integration
- Spot/preemptible instance awareness
- Service quota monitoring
- Instance type recommendations

### Container Environments

- cgroup limit detection and enforcement
- OOM killer avoidance strategies
- Container orchestrator awareness
- Runtime parameter adjustment

## API Examples

### Custom Configuration

```python
from hyperion import create_monitor, with_adaptive_timeout

# Create a custom configured monitor
monitor = create_monitor({
    'check_interval': 5.0,
    'max_workers': 8,
    'adaptive_scaling': True
})

# Use timeout adaptation without worker control
@with_adaptive_timeout(monitor)
async def fetch_data(url, **kwargs):
    timeout = kwargs.get('timeout')
    # Use the adaptive timeout...
```

### Batch Processing

```python
from hyperion import monitor, with_batch_processing

@with_batch_processing(monitor)
async def process_items(items, **kwargs):
    batch_size = kwargs.get('batch_size')
    # Items will be automatically processed in batches
    return [item * 2 for item in items]
```

### Advanced Metrics

```python
from hyperion import monitor
from hyperion.metrics import MetricsCollector

# Create a metrics collector
metrics = MetricsCollector()

# Register a custom metric
def get_queue_length():
    return len(my_queue)

metrics.register_custom_metric('queue_length', get_queue_length)

# Update and export metrics
metrics.collect_all_metrics(monitor)
report = metrics.generate_report()
prom_metrics = metrics.export_prometheus()
```

## Configuration Options

Hyperion can be configured with various options:

| Option | Description | Default |
|--------|-------------|---------|
| `check_interval` | Monitoring interval in seconds | 3.0 |
| `max_workers` | Maximum concurrent workers | CPU count × environment factor |
| `environment` | Force specific environment (`auto`, `cloud`, `server`, `laptop`, `container`) | `auto` |
| `auto_recover` | Enable automatic resource recovery | `True` |
| `adaptive_scaling` | Enable predictive scaling | `True` |

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
