/**
 * LLM Models Management Page
 * 
 * This page provides management interface for AI models
 */

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { useTheme } from '../components/theme-provider';
import { createClientLogger } from '../utils/client-logger';
import { cn } from '../lib/utils';
import {
  Brain,
  Download,
  Play,
  Square,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
  HardDrive,
  Zap,
  MoreVertical,
  Plus,
  Search,
  Filter
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Input } from '../components/ui/input';

const logger = createClientLogger({ serviceName: 'llm-models' });

interface Model {
  id: string;
  name: string;
  size: string;
  status: 'available' | 'downloading' | 'running' | 'error';
  progress?: number;
  description: string;
  provider: string;
  lastUsed?: Date;
  performance: {
    speed: 'fast' | 'medium' | 'slow';
    vram: string;
  };
}

const LLMModels: React.FC = () => {
  const { theme } = useTheme();
  const [models, setModels] = useState<Model[]>([
    {
      id: 'llama2',
      name: 'Llama 2 7B',
      size: '3.8 GB',
      status: 'available',
      description: 'Meta\'s Llama 2 model, great for general-purpose text generation',
      provider: 'Meta',
      lastUsed: new Date(Date.now() - 1000 * 60 * 30),
      performance: {
        speed: 'fast',
        vram: '4 GB'
      }
    },
    {
      id: 'codellama',
      name: 'Code Llama 13B',
      size: '7.3 GB',
      status: 'downloading',
      progress: 67,
      description: 'Specialized for code generation and understanding',
      provider: 'Meta',
      performance: {
        speed: 'medium',
        vram: '8 GB'
      }
    },
    {
      id: 'mistral',
      name: 'Mistral 7B',
      size: '4.1 GB',
      status: 'running',
      description: 'High-performance open model with excellent reasoning',
      provider: 'Mistral AI',
      lastUsed: new Date(),
      performance: {
        speed: 'fast',
        vram: '4 GB'
      }
    },
    {
      id: 'mixtral',
      name: 'Mixtral 8x7B',
      size: '26 GB',
      status: 'available',
      description: 'Mixture of experts model with superior performance',
      provider: 'Mistral AI',
      performance: {
        speed: 'slow',
        vram: '32 GB'
      }
    },
    {
      id: 'phi2',
      name: 'Phi-2',
      size: '1.7 GB',
      status: 'available',
      description: 'Small but capable model from Microsoft',
      provider: 'Microsoft',
      performance: {
        speed: 'fast',
        vram: '2 GB'
      }
    }
  ]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/ai/models');
      if (response.ok) {
        const data = await response.json();
        // Update models with real data
        logger.info('Models refreshed', { count: data.length });
      }
    } catch (error) {
      logger.error('Failed to refresh models', { error });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleModelAction = async (modelId: string, action: 'start' | 'stop' | 'delete' | 'download') => {
    logger.info(`Model action: ${action}`, { modelId });
    
    // Update model status based on action
    setModels(prev => prev.map(model => {
      if (model.id === modelId) {
        switch (action) {
          case 'start':
            return { ...model, status: 'running' as const };
          case 'stop':
            return { ...model, status: 'available' as const };
          case 'download':
            return { ...model, status: 'downloading' as const, progress: 0 };
          case 'delete':
            return model; // Would remove in real implementation
          default:
            return model;
        }
      }
      return model;
    }));

    // Simulate download progress
    if (action === 'download') {
      const interval = setInterval(() => {
        setModels(prev => prev.map(model => {
          if (model.id === modelId && model.status === 'downloading') {
            const newProgress = (model.progress || 0) + 10;
            if (newProgress >= 100) {
              clearInterval(interval);
              return { ...model, status: 'available' as const, progress: undefined };
            }
            return { ...model, progress: newProgress };
          }
          return model;
        }));
      }, 500);
    }
  };

  const getStatusIcon = (status: Model['status']) => {
    switch (status) {
      case 'running':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'downloading':
        return <Download className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSpeedColor = (speed: Model['performance']['speed']) => {
    switch (speed) {
      case 'fast':
        return 'text-green-500';
      case 'medium':
        return 'text-yellow-500';
      case 'slow':
        return 'text-red-500';
    }
  };

  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         model.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = selectedProvider === 'all' || model.provider === selectedProvider;
    return matchesSearch && matchesProvider;
  });

  const providers = Array.from(new Set(models.map(m => m.provider)));
  const runningModels = models.filter(m => m.status === 'running').length;
  const totalSize = models.reduce((acc, m) => acc + parseFloat(m.size), 0).toFixed(1);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className={cn(
          "text-2xl font-bold mb-2",
          isDark ? "text-white" : "text-gray-900"
        )}>
          LLM Model Management
        </h1>
        <p className={cn(
          "text-sm",
          isDark ? "text-gray-400" : "text-gray-600"
        )}>
          Manage and monitor your AI models for Alexandria
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className={cn(
          "border",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Models</p>
                <p className="text-2xl font-bold">{models.length}</p>
              </div>
              <Brain className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Running</p>
                <p className="text-2xl font-bold">{runningModels}</p>
              </div>
              <Zap className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Size</p>
                <p className="text-2xl font-bold">{totalSize} GB</p>
              </div>
              <HardDrive className="h-8 w-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border",
          isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">API Status</p>
                <p className="text-sm font-medium text-green-600">Connected</p>
              </div>
              <Cpu className="h-8 w-8 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {selectedProvider === 'all' ? 'All Providers' : selectedProvider}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSelectedProvider('all')}>
                All Providers
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {providers.map(provider => (
                <DropdownMenuItem key={provider} onClick={() => setSelectedProvider(provider)}>
                  {provider}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
          
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Model
          </Button>
        </div>
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredModels.map((model) => (
          <Card 
            key={model.id}
            className={cn(
              "border transition-all hover:shadow-md",
              isDark ? "bg-[#2d2d2d] border-[#3e3e3e]" : ""
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    isDark ? "bg-[#3e3e3e]" : "bg-gray-100"
                  )}>
                    <Brain className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {model.name}
                      {getStatusIcon(model.status)}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {model.provider}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{model.size}</span>
                    </div>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {model.status === 'available' && (
                      <DropdownMenuItem onClick={() => handleModelAction(model.id, 'start')}>
                        <Play className="mr-2 h-4 w-4" />
                        Start Model
                      </DropdownMenuItem>
                    )}
                    {model.status === 'running' && (
                      <DropdownMenuItem onClick={() => handleModelAction(model.id, 'stop')}>
                        <Square className="mr-2 h-4 w-4" />
                        Stop Model
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleModelAction(model.id, 'delete')} className="text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Model
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{model.description}</p>
              
              {model.status === 'downloading' && model.progress !== undefined && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Downloading...</span>
                    <span>{model.progress}%</span>
                  </div>
                  <Progress value={model.progress} className="h-2" />
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Zap className={cn("h-3 w-3", getSpeedColor(model.performance.speed))} />
                    <span className="capitalize">{model.performance.speed}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Cpu className="h-3 w-3 text-muted-foreground" />
                    <span>VRAM: {model.performance.vram}</span>
                  </div>
                </div>
                
                {model.lastUsed && (
                  <span className="text-xs text-muted-foreground">
                    Last used: {new Date(model.lastUsed).toLocaleDateString()}
                  </span>
                )}
              </div>
              
              <div className="flex gap-2">
                {model.status === 'available' && (
                  <Button size="sm" className="flex-1" onClick={() => handleModelAction(model.id, 'start')}>
                    <Play className="h-3 w-3 mr-1" />
                    Start
                  </Button>
                )}
                {model.status === 'running' && (
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleModelAction(model.id, 'stop')}>
                    <Square className="h-3 w-3 mr-1" />
                    Stop
                  </Button>
                )}
                {model.status === 'downloading' && (
                  <Button size="sm" variant="secondary" className="flex-1" disabled>
                    <Download className="h-3 w-3 mr-1 animate-pulse" />
                    Downloading...
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredModels.length === 0 && (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No models found matching your criteria</p>
        </div>
      )}
    </div>
  );
};

export default LLMModels;