"""
Hyperion Resource Monitor - Container Module

Provides container-specific monitoring and adaptation capabilities.
"""

import logging
import os
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class ContainerMonitor:
    """
    Container environment monitor and adapter
    
    Provides container-specific functionality including:
    - cgroup limits detection
    - Container orchestration awareness
    - Memory limit enforcement
    - OOM killer avoidance
    """
    
    def __init__(self):
        self.is_container = self._detect_container()
        self.orchestrator = self._detect_orchestrator()
        self.memory_limit = self._get_memory_limit()
        self.cpu_limit = self._get_cpu_limit()
        
        if self.is_container:
            logger.info(
                f"Container environment detected: orchestrator={self.orchestrator}, "
                f"memory_limit={self.memory_limit / (1024*1024):.1f}MB, "
                f"cpu_limit={self.cpu_limit}"
            )
    
    def _detect_container(self) -> bool:
        """Detect if running in a container environment"""
        indicators = [
            os.path.exists('/.dockerenv'),
            os.path.exists('/run/.containerenv'),
            os.path.exists('/sys/fs/cgroup/memory/memory.limit_in_bytes'),
            'container=' in ''.join(os.environ.keys()),
            'KUBERNETES_SERVICE_HOST' in os.environ
        ]
        return any(indicators)
    
    def _detect_orchestrator(self) -> Optional[str]:
        """Detect container orchestration system"""
        if 'KUBERNETES_SERVICE_HOST' in os.environ:
            return 'kubernetes'
        if 'ECS_CONTAINER_METADATA_URI' in os.environ:
            return 'ecs'
        if os.path.exists('/run/nomad'):
            return 'nomad'
        if os.path.exists('/mnt/mesos'):
            return 'mesos'
        if 'DOCKER_HOST' in os.environ:
            return 'docker'
        if self.is_container:
            return 'unknown'
        return None
    
    def _get_memory_limit(self) -> int:
        """Get container memory limit in bytes"""
        # Modern cgroups v2 path
        cgroup_v2_path = '/sys/fs/cgroup/memory.max'
        
        # Legacy cgroups v1 path
        cgroup_v1_path = '/sys/fs/cgroup/memory/memory.limit_in_bytes'
        
        # Try cgroups v2 first
        if os.path.exists(cgroup_v2_path):
            try:
                with open(cgroup_v2_path) as f:
                    limit = f.read().strip()
                    # "max" means no limit
                    if limit == "max":
                        return 0
                    return int(limit)
            except (IOError, ValueError):
                pass
                
        # Try cgroups v1
        if os.path.exists(cgroup_v1_path):
            try:
                with open(cgroup_v1_path) as f:
                    limit = int(f.read().strip())
                    # Very large values in cgroups v1 (~2^64) indicate no limit
                    if limit > 2**60:
                        return 0
                    return limit
            except (IOError, ValueError):
                pass
                
        # Kubernetes specific env var
        if 'KUBERNETES_SERVICE_HOST' in os.environ and 'MEMORY_LIMIT' in os.environ:
            try:
                return int(os.environ['MEMORY_LIMIT'])
            except ValueError:
                pass
                
        # Default - assume no explicit limit
        return 0
    
    def _get_cpu_limit(self) -> float:
        """Get container CPU limit (number of cores)"""
        # Modern cgroups v2 path
        cgroup_v2_quota_path = '/sys/fs/cgroup/cpu.max'
        
        # Legacy cgroups v1 paths
        cgroup_v1_quota_path = '/sys/fs/cgroup/cpu/cpu.cfs_quota_us'
        cgroup_v1_period_path = '/sys/fs/cgroup/cpu/cpu.cfs_period_us'
        
        # Try cgroups v2 first
        if os.path.exists(cgroup_v2_quota_path):
            try:
                with open(cgroup_v2_quota_path) as f:
                    quota_data = f.read().strip().split()
                    if quota_data[0] == 'max':
                        return 0  # No limit
                    quota = int(quota_data[0])
                    period = int(quota_data[1])
                    if period > 0:
                        return quota / period
            except (IOError, ValueError, IndexError):
                pass
                
        # Try cgroups v1
        if os.path.exists(cgroup_v1_quota_path) and os.path.exists(cgroup_v1_period_path):
            try:
                with open(cgroup_v1_quota_path) as f:
                    quota = int(f.read().strip())
                with open(cgroup_v1_period_path) as f:
                    period = int(f.read().strip())
                    
                # -1 indicates no limit in cgroups v1
                if quota <= 0 or period <= 0:
                    return 0
                    
                return quota / period
            except (IOError, ValueError):
                pass
                
        # Kubernetes specific env var
        if 'KUBERNETES_SERVICE_HOST' in os.environ and 'CPU_LIMIT' in os.environ:
            try:
                return float(os.environ['CPU_LIMIT'])
            except ValueError:
                pass
                
        # Default - assume no explicit limit
        return 0
    
    def check_resource_constraints(self) -> Dict[str, float]:
        """
        Check container resource constraints and usage
        
        Returns:
            Dictionary with resource utilization percentages
        """
        if not self.is_container:
            return {}
            
        result = {}
        
        # Memory usage and limit
        if self.memory_limit > 0:
            try:
                # Modern cgroups v2 path
                usage_path_v2 = '/sys/fs/cgroup/memory.current'
                
                # Legacy cgroups v1 path
                usage_path_v1 = '/sys/fs/cgroup/memory/memory.usage_in_bytes'
                
                # Try v2 first
                if os.path.exists(usage_path_v2):
                    with open(usage_path_v2) as f:
                        usage = int(f.read().strip())
                elif os.path.exists(usage_path_v1):
                    with open(usage_path_v1) as f:
                        usage = int(f.read().strip())
                else:
                    usage = 0
                    
                if usage > 0 and self.memory_limit > 0:
                    result['memory_percent'] = usage / self.memory_limit
            except (IOError, ValueError):
                pass
                
        # CPU usage
        # This requires more complex calculation with multiple readings,
        # so we'll skip it here for simplicity
        
        return result
    
    def get_health_recommendations(self) -> Dict[str, str]:
        """
        Get container-specific health recommendations
        
        Returns:
            Dictionary of recommendations
        """
        if not self.is_container:
            return {}
            
        recommendations = {}
        
        # Check memory constraints
        constraints = self.check_resource_constraints()
        memory_percent = constraints.get('memory_percent', 0)
        
        if memory_percent > 0.9:
            recommendations['critical'] = "Container using >90% of memory limit; reduce memory usage immediately"
        elif memory_percent > 0.8:
            recommendations['warning'] = "Container approaching memory limit; consider reducing batch sizes"
            
        # Orchestrator-specific recommendations
        if self.orchestrator == 'kubernetes':
            recommendations['kubernetes'] = "Use resource requests and limits for predictable performance"
        elif self.orchestrator == 'ecs':
            recommendations['ecs'] = "Monitor CloudWatch metrics for container insights"
            
        return recommendations
    
    def adaptive_parameters(self, system_state: str) -> Dict[str, float]:
        """
        Get container-optimized parameters based on system state
        
        Args:
            system_state: Current system state ('normal', 'high', 'critical')
            
        Returns:
            Dictionary of adaptive parameters
        """
        if not self.is_container:
            return {}
            
        # Base parameter adjustments
        parameters = {
            'worker_factor': 1.0,
            'chunk_factor': 1.0,
            'batch_factor': 1.0,
            'timeout_factor': 1.0
        }
        
        # Memory constraint based adjustment
        constraints = self.check_resource_constraints()
        memory_percent = constraints.get('memory_percent', 0)
        
        # Adjust based on memory pressure
        if memory_percent > 0.85:
            # Severe memory pressure - be very conservative
            parameters['worker_factor'] = 0.5
            parameters['chunk_factor'] = 0.5
            parameters['batch_factor'] = 0.5
            parameters['timeout_factor'] = 1.5
        elif memory_percent > 0.7:
            # Moderate memory pressure
            parameters['worker_factor'] = 0.7
            parameters['chunk_factor'] = 0.7
            parameters['batch_factor'] = 0.7
            parameters['timeout_factor'] = 1.2
            
        # Adjust based on orchestrator
        if self.orchestrator == 'kubernetes':
            # In Kubernetes, resource limits are enforced harshly
            parameters['worker_factor'] *= 0.9
            
        return parameters
    
    def force_memory_reduction(self) -> bool:
        """
        Force memory reduction to avoid OOM killer
        
        Returns:
            True if reduction was possible, False otherwise
        """
        if not self.is_container:
            return False
            
        constraints = self.check_resource_constraints()
        memory_percent = constraints.get('memory_percent', 0)
        
        if memory_percent <= 0.7:
            # Not needed
            return False
            
        try:
            # Try to force a garbage collection
            import gc
            gc.collect()
            
            # Try to release any cached memory
            if hasattr(os, 'malloc_trim'):
                os.malloc_trim(0)
                
            logger.warning("Forced memory reduction due to container pressure")
            return True
        except Exception as e:
            logger.error(f"Failed to reduce memory usage: {str(e)}")
            return False
