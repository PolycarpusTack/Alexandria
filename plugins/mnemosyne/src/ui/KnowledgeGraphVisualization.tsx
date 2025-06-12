import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Play, 
  Pause, 
  Settings,
  Maximize,
  Download
} from 'lucide-react';

interface GraphNode {
  id: string;
  title: string;
  type: 'document' | 'concept' | 'template' | 'note' | 'tag';
  size: number;
  color?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'references' | 'tags' | 'related' | 'contains';
  strength: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface KnowledgeGraphVisualizationProps {
  data?: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
}

export const KnowledgeGraphVisualization: React.FC<KnowledgeGraphVisualizationProps> = ({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  onNodeHover
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [simulation, setSimulation] = useState<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [linkDistance, setLinkDistance] = useState([50]);
  const [chargeStrength, setChargeStrength] = useState([-300]);

  // Default data for demonstration
  const defaultData: GraphData = {
    nodes: [
      { id: '1', title: 'React Components', type: 'document', size: 20 },
      { id: '2', title: 'TypeScript', type: 'concept', size: 15 },
      { id: '3', title: 'API Design', type: 'template', size: 18 },
      { id: '4', title: 'Testing', type: 'note', size: 12 },
      { id: '5', title: 'Frontend', type: 'tag', size: 10 },
      { id: '6', title: 'Documentation', type: 'document', size: 14 },
      { id: '7', title: 'Performance', type: 'concept', size: 16 },
    ],
    links: [
      { source: '1', target: '2', type: 'references', strength: 0.8 },
      { source: '1', target: '5', type: 'tags', strength: 0.6 },
      { source: '2', target: '3', type: 'related', strength: 0.7 },
      { source: '4', target: '1', type: 'references', strength: 0.5 },
      { source: '6', target: '1', type: 'contains', strength: 0.9 },
      { source: '7', target: '1', type: 'related', strength: 0.4 },
    ]
  };

  const graphData = data || defaultData;

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'document': return '#3b82f6';
      case 'concept': return '#8b5cf6';
      case 'template': return '#10b981';
      case 'note': return '#f59e0b';
      case 'tag': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getLinkColor = (type: string) => {
    switch (type) {
      case 'references': return '#3b82f6';
      case 'tags': return '#f59e0b';
      case 'related': return '#8b5cf6';
      case 'contains': return '#10b981';
      default: return '#9ca3af';
    }
  };

  useEffect(() => {
    if (!svgRef.current || !graphData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        const { transform } = event;
        setZoomLevel(transform.k);
        container.attr('transform', transform);
      });

    svg.call(zoom);

    // Create container for graph elements
    const container = svg.append('g');

    // Create simulation
    const sim = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(graphData.links)
        .id(d => d.id)
        .distance(linkDistance[0])
        .strength(link => link.strength))
      .force('charge', d3.forceManyBody().strength(chargeStrength[0]))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.size + 5));

    setSimulation(sim);

    // Create links
    const link = container
      .append('g')
      .selectAll('line')
      .data(graphData.links)
      .enter()
      .append('line')
      .attr('stroke', d => getLinkColor(d.type))
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.sqrt(d.strength) * 3);

    // Create nodes
    const node = container
      .append('g')
      .selectAll('g')
      .data(graphData.nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Node circles
    node
      .append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => getNodeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Node labels
    node
      .append('text')
      .text(d => d.title)
      .attr('font-size', '12px')
      .attr('dx', d => d.size + 5)
      .attr('dy', 4)
      .attr('fill', '#374151');

    // Node interactions
    node
      .on('click', (event, d) => {
        setSelectedNode(d);
        onNodeClick?.(d);
      })
      .on('mouseenter', (event, d) => {
        onNodeHover?.(d);
        // Highlight connected nodes
        const connectedNodeIds = new Set();
        graphData.links.forEach(link => {
          if (link.source === d.id || (typeof link.source === 'object' && link.source.id === d.id)) {
            connectedNodeIds.add(typeof link.target === 'string' ? link.target : link.target.id);
          }
          if (link.target === d.id || (typeof link.target === 'object' && link.target.id === d.id)) {
            connectedNodeIds.add(typeof link.source === 'string' ? link.source : link.source.id);
          }
        });

        node.selectAll('circle')
          .attr('opacity', node => connectedNodeIds.has(node.id) || node.id === d.id ? 1 : 0.3);
        
        link.attr('opacity', link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return sourceId === d.id || targetId === d.id ? 1 : 0.1;
        });
      })
      .on('mouseleave', () => {
        onNodeHover?.(null);
        // Reset highlighting
        node.selectAll('circle').attr('opacity', 1);
        link.attr('opacity', 0.6);
      });

    // Update positions on tick
    sim.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
    };
  }, [graphData, linkDistance, chargeStrength, width, height]);

  const handleZoomIn = () => {
    if (svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .call(d3.zoom<SVGSVGElement, unknown>().scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .call(d3.zoom<SVGSVGElement, unknown>().scaleBy, 1 / 1.5);
    }
  };

  const handleReset = () => {
    if (svgRef.current) {
      d3.select(svgRef.current)
        .transition()
        .call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
    }
    if (simulation) {
      simulation.alpha(1).restart();
    }
  };

  const toggleSimulation = () => {
    if (simulation) {
      if (isRunning) {
        simulation.stop();
      } else {
        simulation.restart();
      }
      setIsRunning(!isRunning);
    }
  };

  const exportGraph = () => {
    if (svgRef.current) {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0);
        
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = 'knowledge-graph.png';
        downloadLink.href = pngFile;
        downloadLink.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  return (
    <Card className="knowledge-graph-container">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Knowledge Graph</CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={toggleSimulation}>
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={exportGraph}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="graph-controls mb-4 space-y-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">Link Distance:</label>
            <Slider
              value={linkDistance}
              onValueChange={setLinkDistance}
              max={200}
              min={10}
              step={10}
              className="flex-1 max-w-40"
            />
            <span className="text-sm text-gray-500">{linkDistance[0]}px</span>
          </div>
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">Charge Strength:</label>
            <Slider
              value={chargeStrength}
              onValueChange={setChargeStrength}
              max={-50}
              min={-500}
              step={25}
              className="flex-1 max-w-40"
            />
            <span className="text-sm text-gray-500">{chargeStrength[0]}</span>
          </div>
          <div className="text-sm text-gray-500">
            Zoom: {Math.round(zoomLevel * 100)}%
          </div>
        </div>

        <div className="graph-viewport border rounded-lg overflow-hidden">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="bg-white"
          />
        </div>

        {selectedNode && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium">{selectedNode.title}</h4>
            <p className="text-sm text-gray-600 capitalize">Type: {selectedNode.type}</p>
            <p className="text-sm text-gray-600">ID: {selectedNode.id}</p>
          </div>
        )}

        <div className="mt-4">
          <h4 className="font-medium mb-2">Legend</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Document</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span>Concept</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Template</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Note</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Tag</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};