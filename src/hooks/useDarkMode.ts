import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('expense-dark-mode');
    return stored !== null
      ? stored === 'true'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('expense-dark-mode', String(isDark));
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(d => !d) };
}
