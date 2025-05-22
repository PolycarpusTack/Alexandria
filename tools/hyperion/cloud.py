"""
Hyperion Resource Monitor - Cloud Module

Provides cloud-specific monitoring and adaptation capabilities.
"""

import json
import logging
import os
from typing import Any, Dict, Optional

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

logger = logging.getLogger(__name__)


class CloudIntegration:
    """
    Cloud provider integration for enhanced monitoring and scaling
    
    Provides cloud-specific functionality including:
    - Cloud metadata retrieval
    - Instance type awareness
    - Spot/preemptible instance detection
    - Cloud quota monitoring
    """
    
    def __init__(self, provider: Optional[str] = None):
        self.provider = provider
        self.metadata = {}
        self.instance_type = None
        self.is_spot = False
        self.region = None
        self.zone = None
        
        if provider:
            self._init_provider()
    
    def _init_provider(self):
        """Initialize provider-specific components"""
        if self.provider:
            self.metadata = self._fetch_metadata()
            self._extract_instance_info()
            logger.info(
                f"Cloud integration initialized: provider={self.provider}, "
                f"instance_type={self.instance_type}, spot={self.is_spot}"
            )
    
    def _fetch_metadata(self) -> Dict[str, Any]:
        """Fetch cloud provider metadata"""
        if not HAS_REQUESTS:
            return {}
            
        # Provider-specific metadata endpoints and headers
        endpoints = {
            'aws': {
                'url': 'http://169.254.169.254/latest/dynamic/instance-identity/document',
                'headers': {}
            },
            'gcp': {
                'url': 'http://metadata.google.internal/computeMetadata/v1/instance/?recursive=true',
                'headers': {'Metadata-Flavor': 'Google'}
            },
            'azure': {
                'url': 'http://169.254.169.254/metadata/instance?api-version=2021-02-01',
                'headers': {'Metadata': 'true'}
            }
        }
        
        # Get the appropriate endpoint config
        config = endpoints.get(self.provider)
        if not config:
            return {}
            
        try:
            response = requests.get(
                config['url'], 
                headers=config['headers'], 
                timeout=1.0
            )
            if response.status_code < 400:
                return response.json()
        except Exception as e:
            logger.warning(f"Failed to fetch cloud metadata: {str(e)}")
            
        return {}
    
    def _extract_instance_info(self):
        """Extract useful information from metadata"""
        if not self.metadata:
            return
            
        # Provider-specific extraction
        if self.provider == 'aws':
            self.instance_type = self.metadata.get('instanceType')
            self.region = self.metadata.get('region')
            # Check if spot instance
            try:
                spot_url = 'http://169.254.169.254/latest/meta-data/spot/instance-action'
                response = requests.get(spot_url, timeout=0.5)
                self.is_spot = response.status_code < 400
            except Exception:
                self.is_spot = False
                
        elif self.provider == 'gcp':
            self.instance_type = self.metadata.get('machineType', '').split('/')[-1]
            self.zone = self.metadata.get('zone', '').split('/')[-1]
            # Check for preemptible
            self.is_spot = bool(self.metadata.get('scheduling', {}).get('preemptible'))
            
        elif self.provider == 'azure':
            compute = self.metadata.get('compute', {})
            self.instance_type = compute.get('vmSize')
            self.region = compute.get('location')
            # Check for spot
            self.is_spot = compute.get('evictionPolicy') in ['Deallocate', 'Delete']
    
    def get_quota_limits(self) -> Dict[str, float]:
        """
        Retrieve service quota limits for the current account
        
        Returns:
            Dictionary of service quotas and their usage percentages
        """
        quotas = {}
        
        if not HAS_REQUESTS or not self.provider:
            return quotas
            
        # Provider-specific quota retrieval
        try:
            if self.provider == 'aws':
                quotas = self._get_aws_quotas()
            elif self.provider == 'gcp':
                quotas = self._get_gcp_quotas()
            elif self.provider == 'azure':
                quotas = self._get_azure_quotas()
        except Exception as e:
            logger.warning(f"Failed to fetch quota information: {str(e)}")
            
        return quotas
    
    def _get_aws_quotas(self) -> Dict[str, float]:
        """Get AWS service quotas"""
        # This would typically use boto3, but we'll return placeholder data
        return {
            'ec2_instances': 0.45,  # 45% used
            'ebs_volume_storage': 0.32,
            'vpc_security_groups': 0.18
        }
    
    def _get_gcp_quotas(self) -> Dict[str, float]:
        """Get GCP quota information"""
        # Would typically use GCP API client
        return {
            'cpus': 0.38,
            'in_use_addresses': 0.22,
            'instance_groups': 0.15
        }
    
    def _get_azure_quotas(self) -> Dict[str, float]:
        """Get Azure quota information"""
        # Would typically use Azure SDK
        return {
            'cores': 0.41,
            'virtual_machines': 0.29,
            'network_interfaces': 0.17
        }
    
    def get_instance_recommendations(self) -> Dict[str, Any]:
        """
        Get recommendations for instance optimization
        
        Returns:
            Dictionary of recommendations
        """
        if not self.provider or not self.instance_type:
            return {}
            
        # Base recommendations
        recommendations = {
            'cpu_optimization': None,
            'memory_optimization': None,
            'network_optimization': None,
            'cost_saving': None
        }
        
        # Provider and instance type specific recommendations
        if self.provider == 'aws':
            if self.instance_type.startswith('t'):
                # T-series instances are burstable
                recommendations['cpu_optimization'] = "Consider enabling T2/T3 Unlimited for consistent performance"
                recommendations['cost_saving'] = "Monitor CPU credit balance to avoid overage charges"
            elif self.instance_type.startswith('m'):
                # M-series are general purpose
                recommendations['memory_optimization'] = "Enable memory compression for better efficiency"
            elif self.instance_type.startswith('c'):
                # C-series are compute optimized
                recommendations['cpu_optimization'] = "Set CPU governor to performance mode"
                
        elif self.provider == 'gcp':
            if self.instance_type.startswith('e2'):
                # E2 instances are cost-optimized
                recommendations['cost_saving'] = "Consider using committed use discounts for stable workloads"
            elif self.instance_type.startswith('n2'):
                # N2 instances are balanced
                recommendations['memory_optimization'] = "Enable compute-optimized memory access"
                
        return recommendations
    
    def get_scaling_recommendations(self, cpu_usage: float, memory_usage: float) -> Dict[str, Any]:
        """
        Get scaling recommendations based on usage patterns and instance type
        
        Args:
            cpu_usage: Current CPU usage (0-1)
            memory_usage: Current memory usage (0-1)
            
        Returns:
            Scaling recommendations
        """
        recommendations = {
            'action': None,
            'reason': None,
            'suggested_type': None
        }
        
        # Spot/preemptible instance specific guidance
        if self.is_spot:
            # Conservative with spot instances - save work frequently
            if cpu_usage > 0.7 or memory_usage > 0.8:
                recommendations['action'] = 'checkpoint'
                recommendations['reason'] = 'High resource usage on preemptible instance'
            return recommendations
            
        # Regular instances
        if cpu_usage > 0.8 and memory_usage < 0.5:
            # CPU bound
            recommendations['action'] = 'scale_up'
            recommendations['reason'] = 'CPU-bound workload'
            recommendations['suggested_type'] = self._suggest_cpu_optimized()
        elif memory_usage > 0.8 and cpu_usage < 0.5:
            # Memory bound
            recommendations['action'] = 'scale_up'
            recommendations['reason'] = 'Memory-bound workload'
            recommendations['suggested_type'] = self._suggest_memory_optimized()
        elif cpu_usage < 0.3 and memory_usage < 0.3:
            # Underutilized
            recommendations['action'] = 'scale_down'
            recommendations['reason'] = 'Underutilized instance'
            recommendations['suggested_type'] = self._suggest_smaller_instance()
            
        return recommendations
    
    def _suggest_cpu_optimized(self) -> str:
        """Suggest a CPU-optimized instance type"""
        if self.provider == 'aws':
            return 'c6g.xlarge'  # Graviton CPU-optimized
        elif self.provider == 'gcp':
            return 'c2-standard-8'  # Compute-optimized
        elif self.provider == 'azure':
            return 'Standard_F8s_v2'  # Compute-optimized
        return 'cpu-optimized'
    
    def _suggest_memory_optimized(self) -> str:
        """Suggest a memory-optimized instance type"""
        if self.provider == 'aws':
            return 'r6g.xlarge'  # Graviton memory-optimized
        elif self.provider == 'gcp':
            return 'm1-megamem-96'  # Memory-optimized
        elif self.provider == 'azure':
            return 'Standard_E8_v3'  # Memory-optimized
        return 'memory-optimized'
    
    def _suggest_smaller_instance(self) -> str:
        """Suggest a smaller instance type"""
        # This would typically analyze the current instance type and suggest one tier down
        if self.provider == 'aws':
            return 't4g.medium'  # Smaller burstable instance
        elif self.provider == 'gcp':
            return 'e2-standard-2'  # Smaller general instance
        elif self.provider == 'azure':
            return 'Standard_B2s'  # Burstable smaller instance
        return 'smaller-instance'
