import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../../../../ui/components/ui/dialog';
import { Button } from '../../../../ui/components/button';
import { Badge } from '../../../../ui/components/badge';
import { Card, CardContent } from '../../../../ui/components/card';
import { ArrowRight, Download, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DrillDownData {
  label: string;
  value: number;
  datasetLabel?: string;
  metadata?: any;
}

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DrillDownData | null;
  onApplyFilter?: (filter: any) => void;
}

export const DrillDownModal: React.FC<DrillDownModalProps> = ({
  isOpen,
  onClose,
  data,
  onApplyFilter
}) => {
  const navigate = useNavigate();

  if (!data) return null;

  const handleViewDetails = () => {
    // Navigate to detailed view with filters
    const params = new URLSearchParams({
      timestamp: data.label,
      ...(data.metadata || {})
    });
    navigate(`/crash-analyzer/details?${params.toString()}`);
    onClose();
  };

  const handleApplyFilter = () => {
    if (onApplyFilter) {
      onApplyFilter({
        timestamp: data.label,
        ...data.metadata
      });
    }
    onClose();
  };

  const handleExportData = () => {
    // Export drill-down data
    const exportData = {
      timestamp: new Date().toISOString(),
      drillDown: {
        label: data.label,
        value: data.value,
        dataset: data.datasetLabel,
        metadata: data.metadata
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drill-down-${data.label}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Data Point Details</DialogTitle>
          <DialogDescription>Detailed information about the selected data point</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <Card>
            <CardContent className='pt-6'>
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <span className='text-sm text-muted-foreground'>Timestamp</span>
                  <span className='font-medium'>{data.label}</span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className='text-sm text-muted-foreground'>Value</span>
                  <span className='font-medium text-lg'>{data.value.toLocaleString()}</span>
                </div>
                {data.datasetLabel && (
                  <div className='flex justify-between items-center'>
                    <span className='text-sm text-muted-foreground'>Series</span>
                    <Badge variant='outline'>{data.datasetLabel}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {data.metadata && Object.keys(data.metadata).length > 0 && (
            <Card>
              <CardContent className='pt-6'>
                <h4 className='text-sm font-medium mb-3'>Additional Information</h4>
                <div className='space-y-2'>
                  {Object.entries(data.metadata).map(([key, value]) => (
                    <div key={key} className='flex justify-between items-center'>
                      <span className='text-sm text-muted-foreground capitalize'>
                        {key.replace(/_/g, ' ')}
                      </span>
                      <span className='text-sm font-medium'>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' size='sm' onClick={handleExportData}>
            <Download className='h-4 w-4 mr-1' />
            Export
          </Button>
          <Button variant='outline' size='sm' onClick={handleApplyFilter}>
            <Filter className='h-4 w-4 mr-1' />
            Apply as Filter
          </Button>
          <Button size='sm' onClick={handleViewDetails}>
            View Details
            <ArrowRight className='h-4 w-4 ml-1' />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
