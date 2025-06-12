import useState from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useTheme } from '../components/theme-provider';

export default function CCIDashboard() {
  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [activity, setActivity] = useState([
    { time: '10:05 AM', message: 'Selected LLM model: vicuna-13b' },
    { time: '09:47 AM', message: 'Crash Analyzer found 3 new issues' },
    { time: '09:30 AM', message: 'System started successfully' },
    { time: '09:28 AM', message: 'User admin logged in' }
  ]);

  const [plugins, setPlugins] = useState([
    { id: 'crash-analyzer', name: 'Crash Analyzer', status: 'green' },
    { id: 'metrics', name: 'Metrics Plugin', status: 'red' },
    { id: 'sample', name: 'Sample Plugin', status: 'green' },
    { id: 'logs', name: 'Log Visualization', status: 'yellow' }
  ]);

  return (
    <div className='grid grid-cols-[2fr_1fr] gap-5'>
      <div className='space-y-5'>
        <Card className={`p-5 shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : ''}`}>
          <h2 className='text-lg font-medium text-[var(--primary-color)] mb-3'>Announcements</h2>
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            No new announcements.
          </p>
        </Card>

        <Card className={`p-5 shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : ''}`}>
          <h2 className='text-lg font-medium text-[var(--primary-color)] mb-3'>Plugins Overview</h2>
          <ul
            className={`list-none p-0 m-0 divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}
          >
            {plugins.map((plugin) => (
              <li key={plugin.id} className='flex items-center py-3'>
                <i className='fa-solid fa-microchip mr-2 text-[var(--primary-color)]'></i>
                {plugin.name}
                <span
                  className={`h-2 w-2 bg-${plugin.status}-500 rounded-full inline-block mx-2`}
                ></span>
                <div className='ml-auto'>
                  <Button size='sm' variant='outline' className='text-xs'>
                    <i className='fa-solid fa-arrow-right mr-1'></i>
                    View
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div>
        <Card className={`p-5 shadow-sm ${isDark ? 'bg-gray-800 border-gray-700' : ''}`}>
          <h2 className='text-lg font-medium text-[var(--primary-color)] mb-3'>Activity Stream</h2>
          <ul
            className={`list-none p-0 m-0 divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}
          >
            {activity.map((item, index) => (
              <li key={index} className='flex items-center py-3'>
                <i className='fa-regular fa-clock mr-2 text-[var(--primary-color)]'></i>
                <span className='text-sm'>
                  <strong>{item.time}</strong> — {item.message}
                </span>
              </li>
            ))}
          </ul>

          <div className='mt-4 text-center'>
            <Button size='sm' variant='outline' className='text-xs'>
              View All Activity
            </Button>
          </div>
        </Card>

        <Card className={`p-5 shadow-sm mt-5 ${isDark ? 'bg-gray-800 border-gray-700' : ''}`}>
          <h2 className='text-lg font-medium text-[var(--primary-color)] mb-3'>System Status</h2>
          <div className='space-y-3'>
            <div className='flex justify-between items-center'>
              <span className='text-sm'>CPU Usage</span>
              <span className='text-sm font-medium'>23%</span>
            </div>
            <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
              <div className='bg-green-500 h-2 rounded-full' style={{ width: '23%' }}></div>
            </div>

            <div className='flex justify-between items-center'>
              <span className='text-sm'>Memory Usage</span>
              <span className='text-sm font-medium'>47%</span>
            </div>
            <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
              <div className='bg-green-500 h-2 rounded-full' style={{ width: '47%' }}></div>
            </div>

            <div className='flex justify-between items-center'>
              <span className='text-sm'>Disk Usage</span>
              <span className='text-sm font-medium'>68%</span>
            </div>
            <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
              <div className='bg-yellow-500 h-2 rounded-full' style={{ width: '68%' }}></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
