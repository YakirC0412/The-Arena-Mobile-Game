import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// How many pixels the on-screen keyboard covers at the bottom of the page, on
// the web. iPhone Safari does not resize the page when the keyboard opens; it
// only shrinks `visualViewport` and scrolls the page to the focused input.
// Screens pad their bottom by this inset so everything fits above the
// keyboard, and the page is scrolled back to the top so nothing jumps.
// Returns 0 on native (KeyboardAvoidingView handles it) and on browsers that
// resize the layout themselves (Android Chrome with interactive-widget).
export function useWebKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      // Ignore small differences such as Safari's collapsing toolbar.
      setInset(covered > 80 ? Math.round(covered) : 0);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
