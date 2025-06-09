import { PluginContext } from '../../../core/plugin-registry/interfaces';
import { UIComponentDefinition, UIComponentType, UIComponentPosition, UIComponentPriority } from '../../../ui/interfaces';
import { CrashAnalyzerService } from '../src/services/crash-analyzer-service';
import { EnhancedCrashAnalyzerService } from '../src/services/enhanced-crash-analyzer-service';
import { Dashboard } from './components/Dashboard';
import { CrashLogDetail } from './components/CrashLogDetail';
import { UploadCrashLog } from './components/UploadCrashLog';
import { SecurityScanResults } from './components/SecurityScanResults';
import { CodeSnippetUpload } from './components/CodeSnippetUpload';
import { CodeSnippetDetail } from './components/CodeSnippetDetail';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';

/**
 * Create and return the UI components for the Crash Analyzer plugin
 */
export function createUIComponents(
  crashAnalyzerService: CrashAnalyzerService | EnhancedCrashAnalyzerService, 
  context: PluginContext
): UIComponentDefinition[] {
  // We'll need to dynamically import these components in a real implementation
  // This is a simplified version for TypeScript checks to pass
  
  // Determine if we have the enhanced service with security capabilities
  const hasSecurityFeatures = 'scanFileForSecurityIssues' in crashAnalyzerService;
  // Check if analytics service is available in context
  const analyticsService = context.services?.get('analytics');
  
  const components: UIComponentDefinition[] = [
    {
      id: 'crash-analyzer-dashboard',
      type: UIComponentType.NAVIGATION,
      position: UIComponentPosition.SIDEBAR,
      component: Dashboard,
      props: { 
        crashAnalyzerService 
      },
      priority: UIComponentPriority.MEDIUM,
      pluginId: 'alexandria-crash-analyzer'
    },
    {
      id: 'crash-log-detail',
      type: UIComponentType.CONTENT,
      position: UIComponentPosition.MAIN,
      component: CrashLogDetail,
      props: { 
        crashAnalyzerService 
      },
      priority: UIComponentPriority.MEDIUM,
      pluginId: 'alexandria-crash-analyzer'
    },
    {
      id: 'crash-analyzer-upload',
      type: UIComponentType.MODAL,
      component: UploadCrashLog,
      props: { 
        crashAnalyzerService 
      },
      priority: UIComponentPriority.MEDIUM,
      pluginId: 'alexandria-crash-analyzer'
    }
  ];
  
  // Add security component if enhanced service is available
  if (hasSecurityFeatures) {
    components.push({
      id: 'crash-analyzer-security',
      type: UIComponentType.CONTENT,
      position: UIComponentPosition.MAIN,
      component: SecurityScanResults,
      props: { 
        crashAnalyzerService 
      },
      priority: UIComponentPriority.MEDIUM,
      pluginId: 'alexandria-crash-analyzer'
    });
    
    // Add code snippet components for enhanced service
    components.push({
      id: 'crash-analyzer-code-snippet-upload',
      type: UIComponentType.MODAL,
      component: CodeSnippetUpload,
      props: { 
        crashAnalyzerService 
      },
      priority: UIComponentPriority.MEDIUM,
      pluginId: 'alexandria-crash-analyzer'
    });
    
    components.push({
      id: 'crash-analyzer-code-snippet-detail',
      type: UIComponentType.CONTENT,
      position: UIComponentPosition.MAIN,
      component: CodeSnippetDetail,
      props: { 
        crashAnalyzerService 
      },
      priority: UIComponentPriority.MEDIUM,
      pluginId: 'alexandria-crash-analyzer'
    });
  }
  
  // Add analytics dashboard if analytics service is available
  if (analyticsService) {
    components.push({
      id: 'crash-analyzer-analytics',
      type: UIComponentType.NAVIGATION,
      position: UIComponentPosition.SIDEBAR,
      component: AnalyticsDashboard,
      props: { 
        analyticsService,
        crashAnalyzerService 
      },
      priority: UIComponentPriority.MEDIUM,
      pluginId: 'alexandria-crash-analyzer'
    });
  }
  
  return components;
}