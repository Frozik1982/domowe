import { useEffect } from 'react';

export function useDarkMode() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('expense-dark-mode', 'true');
  }, []);

  return { isDark: true, toggle: () => {} };
}
