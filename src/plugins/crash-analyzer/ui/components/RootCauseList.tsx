import React, { useState } from 'react';
import { Card, Badge } from '../../../../ui/components';
import { RootCause } from '../../src/interfaces';

interface RootCauseListProps {
  rootCauses: RootCause[];
}

export const RootCauseList: React.FC<RootCauseListProps> = ({ rootCauses }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  const toggleExpand = (index: number) => {
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else {
      setExpandedIndex(index);
    }
  };
  
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) {
      return <Badge color="green">{(confidence * 100).toFixed(0)}% Confidence</Badge>;
    } else if (confidence >= 0.4) {
      return <Badge color="yellow">{(confidence * 100).toFixed(0)}% Confidence</Badge>;
    } else {
      return <Badge color="red">{(confidence * 100).toFixed(0)}% Confidence</Badge>;
    }
  };
  
  const getCategoryBadge = (category?: string) => {
    if (!category) return null;
    
    const categoryColors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'gray'> = {
      'memory': 'purple',
      'network': 'blue',
      'permission': 'warning', // changed from 'orange'
      'resources': 'yellow',
      'third-party': 'info', // changed from 'indigo'
      'configuration': 'success', // changed from 'teal'
      'database': 'blue', // changed from 'cyan'
      'threading': 'danger' // changed from 'pink'
    };
    
    const color = categoryColors[category.toLowerCase()] || 'gray';
    
    return <Badge color={color}>{category}</Badge>;
  };
  
  if (!rootCauses || rootCauses.length === 0) {
    return (
      <Card className="mt-4">
        <h2 className="text-lg font-medium mb-2">Potential Root Causes</h2>
        <p className="text-gray-500 italic">No root causes identified.</p>
      </Card>
    );
  }
  
  return (
    <Card className="mt-4">
      <h2 className="text-lg font-medium mb-2">Potential Root Causes</h2>
      <div className="space-y-4">
        {rootCauses.map((rootCause, index) => (
          <div
            key={index}
            className={`border rounded-lg overflow-hidden ${
              expandedIndex === index ? 'border-blue-300' : 'border-gray-200'
            }`}
          >
            <div
              className={`p-4 flex justify-between items-center cursor-pointer ${
                expandedIndex === index ? 'bg-blue-50' : 'bg-gray-50'
              }`}
              onClick={() => toggleExpand(index)}
            >
              <div className="flex-grow">
                <h3 className="font-medium text-gray-900">{rootCause.cause}</h3>
              </div>
              <div className="flex items-center space-x-2">
                {getCategoryBadge(rootCause.category)}
                {getConfidenceBadge(rootCause.confidence)}
                <span className="text-gray-400">
                  {expandedIndex === index ? '▼' : '▶'}
                </span>
              </div>
            </div>
            
            {expandedIndex === index && (
              <div className="p-4 border-t border-gray-200">
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-1 text-gray-700">Explanation:</h4>
                  <p className="text-gray-800">{rootCause.explanation}</p>
                </div>
                
                {rootCause.supportingEvidence &&
                 rootCause.supportingEvidence.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-gray-700">Supporting Evidence:</h4>
                    <div className="space-y-2">
                      {rootCause.supportingEvidence.map((evidence, evidenceIndex) => (
                        <div
                          key={evidenceIndex}
                          className="bg-gray-50 border border-gray-200 rounded p-3"
                        >
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            {evidence.description}
                          </p>
                          <p className="text-xs text-gray-500 mb-1">
                            Location: {evidence.location}
                          </p>
                          {evidence.snippet && (
                            <div className="mt-1 p-2 bg-gray-100 rounded-sm font-mono text-xs overflow-x-auto">
                              {evidence.snippet}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};