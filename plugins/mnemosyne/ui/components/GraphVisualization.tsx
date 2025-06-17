import React, { useEffect, useRef, useState } from 'react';
import { GitBranch, ZoomIn, ZoomOut, Maximize2, Loader2, AlertCircle } from 'lucide-react';
import { mnemosyneAPI } from '../api/client';

// Simple D3-like visualization using Canvas
interface GraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

const GraphVisualization: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const animationRef = useRef<number>();

  useEffect(() => {
    loadGraphData();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const loadGraphData = async () => {
    try {
      setLoading(true);
      const data = await mnemosyneAPI.getGraphData(undefined, 3);
      
      // Initialize node positions
      const nodes = data.nodes.map((node, i) => ({
        ...node,
        x: Math.random() * 800,
        y: Math.random() * 600,
        vx: 0,
        vy: 0
      }));
      
      setGraphData({ nodes, edges: data.edges });
      setError(null);
    } catch (err) {
      setError('Failed to load graph data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!graphData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Simple force simulation
    const simulate = () => {
      const { nodes, edges } = graphData;
      
      // Apply forces
      nodes.forEach((node, i) => {
        // Repulsion between nodes
        nodes.forEach((other, j) => {
          if (i === j) return;
          const dx = node.x! - other.x!;
          const dy = node.y! - other.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 50 / (dist * dist);
          node.vx! += (dx / dist) * force;
          node.vy! += (dy / dist) * force;
        });

        // Attraction for connected nodes
        edges.forEach(edge => {
          let other: GraphNode | undefined;
          if (edge.source === node.id) {
            other = nodes.find(n => n.id === edge.target);
          } else if (edge.target === node.id) {
            other = nodes.find(n => n.id === edge.source);
          }
          
          if (other) {
            const dx = other.x! - node.x!;
            const dy = other.y! - node.y!;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = dist * 0.01;
            node.vx! += dx * force;
            node.vy! += dy * force;
          }
        });

        // Center gravity
        node.vx! += (canvas.width / 2 - node.x!) * 0.01;
        node.vy! += (canvas.height / 2 - node.y!) * 0.01;

        // Damping
        node.vx! *= 0.85;
        node.vy! *= 0.85;

        // Update position
        node.x! += node.vx!;
        node.y! += node.vy!;

        // Bounds
        node.x! = Math.max(30, Math.min(canvas.width - 30, node.x!));
        node.y! = Math.max(30, Math.min(canvas.height - 30, node.y!));
      });

      // Clear and redraw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw edges
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      edges.forEach(edge => {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x! * zoom, source.y! * zoom);
          ctx.lineTo(target.x! * zoom, target.y! * zoom);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        ctx.fillStyle = node.id === selectedNodeId ? '#3b82f6' : 
                       node.type === 'folder' ? '#10b981' : '#6366f1';
        ctx.beginPath();
        ctx.arc(node.x! * zoom, node.y! * zoom, 8 * zoom, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw label
        ctx.fillStyle = '#374151';
        ctx.font = `${12 * zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x! * zoom, (node.y! + 25) * zoom);
      });

      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();
  }, [graphData, selectedNodeId, zoom]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!graphData || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    // Find clicked node
    const clicked = graphData.nodes.find(node => {
      const dx = node.x! - x;
      const dy = node.y! - y;
      return Math.sqrt(dx * dx + dy * dy) < 15;
    });
    
    if (clicked) {
      setSelectedNodeId(clicked.id);
      // Navigate to node
      window.location.href = `/mnemosyne/nodes/${clicked.id}`;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-gray-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading knowledge graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 dark:text-gray-100 font-semibold mb-2">Failed to load graph</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{error}</p>
          <button
            onClick={loadGraphData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Knowledge Graph
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setZoom(Math.min(zoom * 1.2, 3))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setZoom(Math.max(zoom * 0.8, 0.5))}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setZoom(1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Graph Container */}
      <div ref={containerRef} className="flex-1 relative bg-gray-50 dark:bg-gray-900">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onClick={handleCanvasClick}
          className="absolute inset-0 w-full h-full cursor-pointer"
          style={{ imageRendering: 'crisp-edges' }}
        />
        {graphData && graphData.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No connections yet
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Create nodes and link them together to see the graph
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphVisualization;