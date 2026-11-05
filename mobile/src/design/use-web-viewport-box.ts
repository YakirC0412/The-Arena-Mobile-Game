import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// The part of the page the player can actually see while the on-screen keyboard is up, on the web.
// iPhone Safari does not resize the page when the keyboard opens: it shrinks `visualViewport` and pans it up to
// the focused input, which pushed the top of the duel (header, mini-map) out of sight. A screen placed in a
// `position: fixed` box with exactly this top and height always fits the visible area, panned or not.
// Returns null when no keyboard covers the page (and on native), so screens keep their normal layout.
export type ViewportBox = { top: number; height: number };

export function useWebViewportBox(): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const update = () => {
      // Everything below the visible area is keyboard (with Safari's suggestion and ✓ bars). Small
      // differences such as Safari's collapsing toolbar are ignored.
      const covered = window.innerHeight - viewport.height;
      const next = covered > 80 ? { top: Math.round(viewport.offsetTop), height: Math.round(viewport.height) } : null;
      setBox((current) => (
        current?.top === next?.top && current?.height === next?.height ? current : next
      ));
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return box;
}
