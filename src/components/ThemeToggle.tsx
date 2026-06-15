'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  const buttonClass =
    theme === 'dark'
      ? 'border-gray-700 bg-gray-950 text-gray-300 hover:bg-gray-800 hover:text-gray-100'
      : 'border-gray-800 bg-gray-950 text-gray-300 hover:bg-gray-900';

  return (
    <button
      onClick={toggleTheme}
      className={`flex items-center justify-center rounded-lg border p-1 transition-colors ${buttonClass}`}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
};

export default ThemeToggle;
