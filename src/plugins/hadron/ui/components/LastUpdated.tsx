import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface LastUpdatedProps {
  timestamp: Date | null;
  isRefreshing?: boolean;
  className?: string;
}

export const LastUpdated: React.FC<LastUpdatedProps> = ({
  timestamp,
  isRefreshing = false,
  className = ''
}) => {
  const [relativeTime, setRelativeTime] = useState<string>('');

  useEffect(() => {
    if (!timestamp) {
      setRelativeTime('Never');
      return;
    }

    const updateRelativeTime = () => {
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (seconds < 60) {
        setRelativeTime('Just now');
      } else if (minutes < 60) {
        setRelativeTime(`${minutes} minute${minutes > 1 ? 's' : ''} ago`);
      } else if (hours < 24) {
        setRelativeTime(`${hours} hour${hours > 1 ? 's' : ''} ago`);
      } else {
        setRelativeTime(timestamp.toLocaleDateString());
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <Clock className="h-3 w-3" />
      <span>
        Last updated: {isRefreshing ? 'Updating...' : relativeTime}
      </span>
    </div>
  );
};