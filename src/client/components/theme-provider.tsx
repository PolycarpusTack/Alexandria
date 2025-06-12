import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'alexandria-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);

      // Add CCI dark mode classes if needed
      if (systemTheme === 'dark') {
        root.style.setProperty('--background-color', '#1A1C23');
        root.style.setProperty('--text-color', '#F8F9FA');
        root.style.setProperty('--card-bg', '#2A2D3A');
      } else {
        root.style.setProperty('--background-color', '#F8F9FA');
        root.style.setProperty('--text-color', '#333333');
        root.style.setProperty('--card-bg', '#FFFFFF');
      }
      return;
    }

    root.classList.add(theme);

    // Add CCI dark mode classes if needed
    if (theme === 'dark') {
      root.style.setProperty('--background-color', '#1A1C23');
      root.style.setProperty('--text-color', '#F8F9FA');
      root.style.setProperty('--card-bg', '#2A2D3A');
    } else {
      root.style.setProperty('--background-color', '#F8F9FA');
      root.style.setProperty('--text-color', '#333333');
      root.style.setProperty('--card-bg', '#FFFFFF');
    }
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    }
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
