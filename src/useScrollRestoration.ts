import { useEffect } from 'react';

export const useScrollRestoration = (key: string) => {
  useEffect(() => {
    // Restore saved scroll position or start at top
    const saved = sessionStorage.getItem(`scroll-${key}`);
    if (saved) {
      // Delay slightly to ensure DOM is fully painted
      setTimeout(() => window.scrollTo(0, parseInt(saved, 10)), 10);
    } else {
      window.scrollTo(0, 0);
    }

    // Save scroll position continuously
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        sessionStorage.setItem(`scroll-${key}`, window.scrollY.toString());
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
      // Save one last time on unmount just in case
      sessionStorage.setItem(`scroll-${key}`, window.scrollY.toString());
    };
  }, [key]);
};
