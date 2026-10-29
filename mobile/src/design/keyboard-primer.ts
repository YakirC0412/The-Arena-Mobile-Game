import { Platform } from 'react-native';

// iPhone Safari only opens the keyboard when an input is focused inside a
// tap. A duel screen mounts after the "start duel" tap has finished, so its
// own focus() call would be ignored. Calling primeWebKeyboard() inside that
// tap focuses a hidden input right away (the keyboard opens); when the duel's
// answer field then takes focus, Safari keeps the keyboard up.
let primer: HTMLInputElement | null = null;

export function primeWebKeyboard() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (!primer) {
    primer = document.createElement('input');
    primer.type = 'text';
    primer.setAttribute('aria-hidden', 'true');
    primer.tabIndex = -1;
    // 16px avoids Safari's zoom-on-focus; it sits off to the side, invisible.
    primer.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;';
    document.body.appendChild(primer);
  }
  primer.focus();
}
