import React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '../../../../ui/components/ui/popover';
import { Button } from '../../../../ui/components/button';
import { Label } from '../../../../ui/components/ui/label';
import { Switch } from '../../../../ui/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '../../../../ui/components/ui/radio-group';
import { Settings2, Palette } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../ui/components/ui/select';

interface ChartCustomizationProps {
  chartType: 'line' | 'bar' | 'area';
  onChartTypeChange: (type: 'line' | 'bar' | 'area') => void;
  showDataLabels: boolean;
  onShowDataLabelsChange: (show: boolean) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  smoothLines: boolean;
  onSmoothLinesChange: (smooth: boolean) => void;
  colorScheme?: string;
  onColorSchemeChange?: (scheme: string) => void;
}

export const ChartCustomization: React.FC<ChartCustomizationProps> = ({
  chartType,
  onChartTypeChange,
  showDataLabels,
  onShowDataLabelsChange,
  showGrid,
  onShowGridChange,
  smoothLines,
  onSmoothLinesChange,
  colorScheme = 'default',
  onColorSchemeChange
}) => {
  const colorSchemes = [
    { value: 'default', label: 'Default', colors: ['#3b82f6', '#10b981', '#f59e0b'] },
    { value: 'vibrant', label: 'Vibrant', colors: ['#ef4444', '#8b5cf6', '#06b6d4'] },
    { value: 'pastel', label: 'Pastel', colors: ['#93c5fd', '#86efac', '#fde68a'] },
    { value: 'monochrome', label: 'Monochrome', colors: ['#1f2937', '#6b7280', '#d1d5db'] }
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1" />
          Customize
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-3">Chart Customization</h4>
          </div>

          {/* Chart Type */}
          <div className="space-y-2">
            <Label>Chart Type</Label>
            <RadioGroup value={chartType} onValueChange={(value) => onChartTypeChange(value as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="line" id="line" />
                <Label htmlFor="line" className="font-normal cursor-pointer">
                  Line Chart
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bar" id="bar" />
                <Label htmlFor="bar" className="font-normal cursor-pointer">
                  Bar Chart
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="area" id="area" />
                <Label htmlFor="area" className="font-normal cursor-pointer">
                  Area Chart
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Display Options */}
          <div className="space-y-3">
            <Label>Display Options</Label>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="data-labels" className="text-sm font-normal">
                Show Data Labels
              </Label>
              <Switch
                id="data-labels"
                checked={showDataLabels}
                onCheckedChange={onShowDataLabelsChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="grid" className="text-sm font-normal">
                Show Grid
              </Label>
              <Switch
                id="grid"
                checked={showGrid}
                onCheckedChange={onShowGridChange}
              />
            </div>

            {chartType === 'line' && (
              <div className="flex items-center justify-between">
                <Label htmlFor="smooth" className="text-sm font-normal">
                  Smooth Lines
                </Label>
                <Switch
                  id="smooth"
                  checked={smoothLines}
                  onCheckedChange={onSmoothLinesChange}
                />
              </div>
            )}
          </div>

          {/* Color Scheme */}
          {onColorSchemeChange && (
            <div className="space-y-2">
              <Label>Color Scheme</Label>
              <Select value={colorScheme} onValueChange={onColorSchemeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorSchemes.map((scheme) => (
                    <SelectItem key={scheme.value} value={scheme.value}>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {scheme.colors.map((color, idx) => (
                            <div
                              key={idx}
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <span>{scheme.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};