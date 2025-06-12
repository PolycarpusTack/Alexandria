/**
 * Settings Page
 *
 * This page provides system and user settings management
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useTheme } from '../components/theme-provider';
import { useLayout } from '../components/layout-selector';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import {
  Bell,
  Globe,
  Key,
  Monitor,
  Moon,
  Palette,
  Save,
  Shield,
  Sun,
  User,
  Zap,
  CheckCircle2,
  Settings as SettingsIcon,
  Layout,
  Code,
  Database,
  Lock
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { layoutMode, setLayoutMode } = useLayout();
  const auth = useAuth();
  const [saved, setSaved] = useState(false);

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [settings, setSettings] = useState({
    // General
    language: 'en',
    timezone: 'UTC',

    // Appearance
    fontSize: 'medium',

    // Notifications
    emailNotifications: true,
    desktopNotifications: true,

    // Security
    twoFactorEnabled: false,
    sessionTimeout: '30',

    // API
    apiKey: '',
    webhookUrl: '',

    // Performance
    cacheEnabled: true,
    debugMode: false
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className='p-6 max-w-4xl mx-auto'>
      {/* Header */}
      <div className='mb-6'>
        <h1 className={cn('text-2xl font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
          Settings
        </h1>
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
          Manage your account and application preferences
        </p>
      </div>

      {saved && (
        <Alert className='mb-6 border-green-500 bg-green-500/10'>
          <CheckCircle2 className='h-4 w-4 text-green-500' />
          <AlertDescription className='text-green-600 dark:text-green-400'>
            Settings saved successfully
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue='general' className='space-y-6'>
        <TabsList className='grid w-full grid-cols-5'>
          <TabsTrigger value='general'>General</TabsTrigger>
          <TabsTrigger value='appearance'>Appearance</TabsTrigger>
          <TabsTrigger value='notifications'>Notifications</TabsTrigger>
          <TabsTrigger value='security'>Security</TabsTrigger>
          <TabsTrigger value='developer'>Developer</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value='general' className='space-y-4'>
          <Card className={cn('border', isDark ? 'bg-[#2d2d2d] border-[#3e3e3e]' : '')}>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <Globe className='h-5 w-5' />
                General Settings
              </CardTitle>
              <CardDescription>Basic application preferences and regional settings</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Language</label>
                <Select
                  value={settings.language}
                  onValueChange={(value) => setSettings({ ...settings, language: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='en'>English</SelectItem>
                    <SelectItem value='es'>Spanish</SelectItem>
                    <SelectItem value='fr'>French</SelectItem>
                    <SelectItem value='de'>German</SelectItem>
                    <SelectItem value='zh'>Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Timezone</label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='UTC'>UTC</SelectItem>
                    <SelectItem value='America/New_York'>Eastern Time</SelectItem>
                    <SelectItem value='America/Chicago'>Central Time</SelectItem>
                    <SelectItem value='America/Denver'>Mountain Time</SelectItem>
                    <SelectItem value='America/Los_Angeles'>Pacific Time</SelectItem>
                    <SelectItem value='Europe/London'>London</SelectItem>
                    <SelectItem value='Europe/Paris'>Paris</SelectItem>
                    <SelectItem value='Asia/Tokyo'>Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value='appearance' className='space-y-4'>
          <Card className={cn('border', isDark ? 'bg-[#2d2d2d] border-[#3e3e3e]' : '')}>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <Palette className='h-5 w-5' />
                Appearance
              </CardTitle>
              <CardDescription>Customize how Alexandria looks and feels</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Theme</label>
                <div className='grid grid-cols-3 gap-2'>
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className='w-full'
                    onClick={() => setTheme('light')}
                  >
                    <Sun className='h-4 w-4 mr-2' />
                    Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className='w-full'
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className='h-4 w-4 mr-2' />
                    Dark
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    className='w-full'
                    onClick={() => setTheme('system')}
                  >
                    <Monitor className='h-4 w-4 mr-2' />
                    System
                  </Button>
                </div>
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Layout</label>
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    variant={layoutMode === 'enhanced' ? 'default' : 'outline'}
                    className='w-full'
                    onClick={() => setLayoutMode('enhanced')}
                  >
                    <Zap className='h-4 w-4 mr-2' />
                    Enhanced
                  </Button>
                  <Button
                    variant={layoutMode === 'enhanced-mockup' ? 'default' : 'outline'}
                    className='w-full'
                    onClick={() => setLayoutMode('enhanced-mockup')}
                  >
                    <Layout className='h-4 w-4 mr-2' />
                    Enhanced Mockup
                  </Button>
                  <Button
                    variant={layoutMode === 'mockup' ? 'default' : 'outline'}
                    className='w-full'
                    onClick={() => setLayoutMode('mockup')}
                  >
                    <Monitor className='h-4 w-4 mr-2' />
                    Mockup
                  </Button>
                  <Button
                    variant={layoutMode === 'modern' ? 'default' : 'outline'}
                    className='w-full'
                    onClick={() => setLayoutMode('modern')}
                  >
                    <Layout className='h-4 w-4 mr-2' />
                    Modern
                  </Button>
                  <Button
                    variant={layoutMode === 'classic' ? 'default' : 'outline'}
                    className='w-full'
                    onClick={() => setLayoutMode('classic')}
                  >
                    <Code className='h-4 w-4 mr-2' />
                    Classic
                  </Button>
                </div>
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Font Size</label>
                <Select
                  value={settings.fontSize}
                  onValueChange={(value) => setSettings({ ...settings, fontSize: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='small'>Small</SelectItem>
                    <SelectItem value='medium'>Medium</SelectItem>
                    <SelectItem value='large'>Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value='notifications' className='space-y-4'>
          <Card className={cn('border', isDark ? 'bg-[#2d2d2d] border-[#3e3e3e]' : '')}>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <Bell className='h-5 w-5' />
                Notifications
              </CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <label className='text-sm font-medium'>Email Notifications</label>
                  <p className='text-xs text-muted-foreground'>Receive updates via email</p>
                </div>
                <Button
                  variant={settings.emailNotifications ? 'default' : 'outline'}
                  size='sm'
                  onClick={() =>
                    setSettings({ ...settings, emailNotifications: !settings.emailNotifications })
                  }
                >
                  {settings.emailNotifications ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <label className='text-sm font-medium'>Desktop Notifications</label>
                  <p className='text-xs text-muted-foreground'>Show system notifications</p>
                </div>
                <Button
                  variant={settings.desktopNotifications ? 'default' : 'outline'}
                  size='sm'
                  onClick={() =>
                    setSettings({
                      ...settings,
                      desktopNotifications: !settings.desktopNotifications
                    })
                  }
                >
                  {settings.desktopNotifications ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value='security' className='space-y-4'>
          <Card className={cn('border', isDark ? 'bg-[#2d2d2d] border-[#3e3e3e]' : '')}>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <Shield className='h-5 w-5' />
                Security
              </CardTitle>
              <CardDescription>Manage your account security settings</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <label className='text-sm font-medium'>Two-Factor Authentication</label>
                  <p className='text-xs text-muted-foreground'>Add an extra layer of security</p>
                </div>
                <Button
                  variant={settings.twoFactorEnabled ? 'default' : 'outline'}
                  size='sm'
                  onClick={() =>
                    setSettings({ ...settings, twoFactorEnabled: !settings.twoFactorEnabled })
                  }
                >
                  {settings.twoFactorEnabled ? 'Enabled' : 'Enable'}
                </Button>
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Session Timeout (minutes)</label>
                <Input
                  type='number'
                  value={settings.sessionTimeout}
                  onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                  min='5'
                  max='120'
                />
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Change Password</label>
                <Button variant='outline' className='w-full'>
                  <Key className='h-4 w-4 mr-2' />
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Developer Settings */}
        <TabsContent value='developer' className='space-y-4'>
          <Card className={cn('border', isDark ? 'bg-[#2d2d2d] border-[#3e3e3e]' : '')}>
            <CardHeader>
              <CardTitle className='text-lg flex items-center gap-2'>
                <Code className='h-5 w-5' />
                Developer Settings
              </CardTitle>
              <CardDescription>Advanced settings for developers</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>API Key</label>
                <div className='flex gap-2'>
                  <Input
                    type='password'
                    value={settings.apiKey || 'sk-...'}
                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                    disabled
                  />
                  <Button variant='outline'>
                    <Key className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Webhook URL</label>
                <Input
                  type='url'
                  placeholder='https://your-webhook.com/endpoint'
                  value={settings.webhookUrl}
                  onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                />
              </div>

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <label className='text-sm font-medium'>Enable Cache</label>
                  <p className='text-xs text-muted-foreground'>Improve performance with caching</p>
                </div>
                <Button
                  variant={settings.cacheEnabled ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setSettings({ ...settings, cacheEnabled: !settings.cacheEnabled })}
                >
                  {settings.cacheEnabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              <div className='flex items-center justify-between'>
                <div className='space-y-0.5'>
                  <label className='text-sm font-medium'>Debug Mode</label>
                  <p className='text-xs text-muted-foreground'>Show detailed logs and errors</p>
                </div>
                <Button
                  variant={settings.debugMode ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setSettings({ ...settings, debugMode: !settings.debugMode })}
                >
                  {settings.debugMode ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className='mt-6 flex justify-end'>
        <Button onClick={handleSave}>
          <Save className='h-4 w-4 mr-2' />
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default Settings;
