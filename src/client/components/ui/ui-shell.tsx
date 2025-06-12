/**
 * UI Shell Component for the Alexandria Platform
 *
 * This component provides the main layout structure for the application.
 */

import React from 'react';
import { useUI } from '../../context/ui-context';

interface UIShellProps {
  children: React.ReactNode;
  uiRegistry?: any;
}

const UIShell: React.FC<UIShellProps> = ({ children, uiRegistry }) => {
  const { darkMode, toggleDarkMode } = useUI();

  // Get components to render by position
  const headerComponents = uiRegistry?.getComponentsByPosition('header') || [];
  const sidebarComponents = uiRegistry?.getComponentsByPosition('sidebar') || [];
  const footerComponents = uiRegistry?.getComponentsByPosition('footer') || [];

  return (
    <div
      className={`min-h-screen flex flex-col ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-white text-gray-900'}`}
    >
      {/* Header */}
      <header
        className={`px-4 py-2 ${darkMode ? 'bg-gray-800' : 'bg-blue-600 text-white'} shadow-md flex items-center justify-between`}
      >
        <div className='flex items-center'>
          <h1 className='text-xl font-semibold'>Alexandria Platform</h1>
        </div>

        <div className='flex items-center space-x-4'>
          {/* Render header components */}
          {headerComponents.map((component: any) => {
            const Component = component.component;
            return <Component key={component.id} {...component.props} />;
          })}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className='p-2 rounded-full hover:bg-opacity-20 hover:bg-gray-700'
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className='flex flex-1'>
        {/* Sidebar */}
        {sidebarComponents.length > 0 && (
          <aside className={`w-64 p-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            {sidebarComponents.map((component: any) => {
              const Component = component.component;
              return <Component key={component.id} {...component.props} />;
            })}
          </aside>
        )}

        {/* Main content */}
        <main className='flex-1 p-6'>{children}</main>
      </div>

      {/* Footer */}
      {footerComponents.length > 0 && (
        <footer className={`px-4 py-2 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          {footerComponents.map((component: any) => {
            const Component = component.component;
            return <Component key={component.id} {...component.props} />;
          })}
        </footer>
      )}
    </div>
  );
};

export default UIShell;
