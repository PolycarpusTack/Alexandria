import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createLogger } from './logger';

const execAsync = promisify(exec);
const logger = createLogger({
  serviceName: 'network-monitor',
  level: 'info',
  format: 'simple'
});

interface NetworkStats {
  interface: string;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
}

interface NetworkMetrics {
  in: number;  // bytes per second
  out: number; // bytes per second
  interfaces: NetworkStats[];
}

// Cache for previous readings
let previousStats: Map<string, NetworkStats> = new Map();
let lastReadTime: number = Date.now();

/**
 * Get network statistics for all interfaces
 */
async function getNetworkStats(): Promise<NetworkStats[]> {
  const stats: NetworkStats[] = [];
  
  try {
    if (process.platform === 'win32') {
      // Windows: Use netstat or Get-NetAdapterStatistics
      const { stdout } = await execAsync('wmic path Win32_PerfRawData_Tcpip_NetworkInterface get Name,BytesReceivedPerSec,BytesSentPerSec,PacketsReceivedPerSec,PacketsSentPerSec /format:csv');
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      
      // Skip header lines
      for (let i = 2; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 6) {
          const name = parts[2];
          // Skip internal/virtual interfaces
          if (name && !name.includes('isatap') && !name.includes('Teredo')) {
            stats.push({
              interface: name,
              bytesReceived: parseInt(parts[1]) || 0,
              bytesSent: parseInt(parts[0]) || 0,
              packetsReceived: parseInt(parts[4]) || 0,
              packetsSent: parseInt(parts[3]) || 0
            });
          }
        }
      }
    } else if (process.platform === 'linux') {
      // Linux: Parse /proc/net/dev
      const fs = require('fs').promises;
      const data = await fs.readFile('/proc/net/dev', 'utf-8');
      const lines = data.trim().split('\n').slice(2); // Skip headers
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 10) {
          const iface = parts[0].replace(':', '');
          stats.push({
            interface: iface,
            bytesReceived: parseInt(parts[1]) || 0,
            bytesSent: parseInt(parts[9]) || 0,
            packetsReceived: parseInt(parts[2]) || 0,
            packetsSent: parseInt(parts[10]) || 0
          });
        }
      }
    } else if (process.platform === 'darwin') {
      // macOS: Use netstat
      const { stdout } = await execAsync('netstat -ibn');
      const lines = stdout.trim().split('\n');
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 11 && parts[0] !== 'Name') {
          stats.push({
            interface: parts[0],
            bytesReceived: parseInt(parts[6]) || 0,
            bytesSent: parseInt(parts[9]) || 0,
            packetsReceived: parseInt(parts[4]) || 0,
            packetsSent: parseInt(parts[7]) || 0
          });
        }
      }
    }
  } catch (error) {
    logger.error('Failed to get network stats', {
      error: error instanceof Error ? error.message : String(error),
      platform: process.platform
    });
  }
  
  return stats;
}

/**
 * Calculate network metrics (bytes per second)
 */
export async function getNetworkMetrics(): Promise<NetworkMetrics> {
  const currentStats = await getNetworkStats();
  const currentTime = Date.now();
  const timeDiff = (currentTime - lastReadTime) / 1000; // Convert to seconds
  
  let totalIn = 0;
  let totalOut = 0;
  
  // Calculate rates only if we have previous readings
  if (previousStats.size > 0 && timeDiff > 0) {
    for (const stat of currentStats) {
      const prev = previousStats.get(stat.interface);
      if (prev) {
        const bytesInDiff = stat.bytesReceived - prev.bytesReceived;
        const bytesOutDiff = stat.bytesSent - prev.bytesSent;
        
        // Only count positive differences (handle counter resets)
        if (bytesInDiff > 0) {
          totalIn += bytesInDiff / timeDiff;
        }
        if (bytesOutDiff > 0) {
          totalOut += bytesOutDiff / timeDiff;
        }
      }
    }
  }
  
  // Update cache
  previousStats.clear();
  for (const stat of currentStats) {
    previousStats.set(stat.interface, stat);
  }
  lastReadTime = currentTime;
  
  return {
    in: Math.round(totalIn),
    out: Math.round(totalOut),
    interfaces: currentStats
  };
}

/**
 * Get active network interfaces
 */
export function getActiveInterfaces(): number {
  const interfaces = os.networkInterfaces();
  return Object.values(interfaces)
    .flat()
    .filter(iface => iface && !iface.internal && iface.family === 'IPv4')
    .length;
}

/**
 * Initialize network monitoring
 * This should be called on startup to establish baseline readings
 */
export async function initializeNetworkMonitoring(): Promise<void> {
  logger.info('Initializing network monitoring');
  await getNetworkMetrics(); // Get initial baseline
}