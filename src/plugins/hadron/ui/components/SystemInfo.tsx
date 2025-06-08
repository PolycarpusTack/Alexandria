import React from 'react';
import { Card } from '../../../../ui/components';
import { SystemInfo as SystemInfoType } from '../../src/interfaces';

interface SystemInfoProps {
  systemInfo: SystemInfoType;
  metadata: Record<string, any>;
}

export const SystemInfo: React.FC<SystemInfoProps> = ({ systemInfo, metadata }) => {
  // Combine system info with metadata for display
  const combinedInfo = {
    // System info from parsed crash log
    ...systemInfo,
    // Override with metadata if available
    osType: metadata.osType || systemInfo.osType,
    osVersion: metadata.osVersion || systemInfo.osVersion,
    deviceModel: metadata.device || systemInfo.deviceModel,
    appVersion: metadata.appVersion || systemInfo.appVersion,
  };
  
  // Function to format the system info for display
  const formatSystemInfo = () => {
    const sections = [
      {
        title: 'Operating System',
        items: [
          { label: 'OS Type', value: combinedInfo.osType },
          { label: 'OS Version', value: combinedInfo.osVersion }
        ]
      },
      {
        title: 'Device',
        items: [
          { label: 'Device Model', value: combinedInfo.deviceModel },
          { label: 'Memory Usage', value: combinedInfo.memoryUsage },
          { label: 'CPU Usage', value: combinedInfo.cpuUsage }
        ]
      },
      {
        title: 'Application',
        items: [
          { label: 'App Version', value: combinedInfo.appVersion },
          { label: 'Source', value: metadata.source }
        ]
      }
    ];
    
    // Add other hardware info if available
    if (combinedInfo.otherHardwareInfo && Object.keys(combinedInfo.otherHardwareInfo).length > 0) {
      sections.push({
        title: 'Additional Hardware',
        items: Object.entries(combinedInfo.otherHardwareInfo).map(([key, value]) => ({
          label: key,
          value: value as string
        }))
      });
    }
    
    // Add other software info if available
    if (combinedInfo.otherSoftwareInfo && Object.keys(combinedInfo.otherSoftwareInfo).length > 0) {
      sections.push({
        title: 'Additional Software',
        items: Object.entries(combinedInfo.otherSoftwareInfo).map(([key, value]) => ({
          label: key,
          value: value as string
        }))
      });
    }
    
    // Add other metadata if available
    const otherMetadata = Object.entries(metadata).filter(
      ([key]) => !['osType', 'osVersion', 'device', 'appVersion', 'source'].includes(key)
    );
    
    if (otherMetadata.length > 0) {
      sections.push({
        title: 'Other Metadata',
        items: otherMetadata.map(([key, value]) => ({
          label: key,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value)
        }))
      });
    }
    
    return sections;
  };
  
  const infoSections = formatSystemInfo();
  
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {infoSections.map((section, index) => (
        <Card key={index}>
          <h2 className="text-lg font-medium mb-3">{section.title}</h2>
          <div className="space-y-2">
            {section.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex border-b border-gray-100 pb-2">
                <div className="w-1/3 font-medium text-gray-600">{item.label}:</div>
                <div className="w-2/3 text-gray-800 break-words">
                  {item.value ?? 'Not available'}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
};