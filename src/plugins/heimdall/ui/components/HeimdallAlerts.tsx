/**
 * Heimdall Alerts Component
 * Manage log-based alerts and notifications
 */

import React, { useState } from 'react';
import { Card } from '@/client/components/ui/card';
import { Button } from '@/client/components/ui/button';
import { Badge } from '@/client/components/ui/badge';
import {  Bell, Plus  } from 'lucide-react';

const HeimdallAlerts: React.FC = () => {
  const [alerts] = useState([
    {
      id: '1',
      name: 'High Error Rate',
      condition: 'Error rate > 5%',
      enabled: true,
      lastTriggered: '2 hours ago'
    },
    {
      id: '2',
      name: 'Service Down',
      condition: 'No logs from auth service > 5 min',
      enabled: true,
      lastTriggered: 'Never'
    },
    {
      id: '3',
      name: 'Anomaly Detection',
      condition: 'ML anomaly score > 0.8',
      enabled: false,
      lastTriggered: '1 day ago'
    }
  ]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Alerts</h1>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Alert
        </Button>
      </div>
      
      <div className="space-y-4">
        {alerts.map(alert => (
          <Card key={alert.id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{alert.name}</h3>
                  <Badge variant={alert.enabled ? 'default' : 'secondary'}>
                    {alert.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Condition: {alert.condition}
                </p>
                <p className="text-sm text-muted-foreground">
                  Last triggered: {alert.lastTriggered}
                </p>
              </div>
              <Button variant="ghost" size="sm">
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default HeimdallAlerts;