import { useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';

export default function usePageTitle(title) {
  const theme = useTheme();
  
  useEffect(() => {
    if (title) {
      document.title = `${title} - ${theme.name}`;
    } else {
      document.title = theme.name;
    }
    
    // Cleanup: reset to app name when component unmounts
    return () => {
      document.title = theme.name;
    };
  }, [title, theme.name]);
}