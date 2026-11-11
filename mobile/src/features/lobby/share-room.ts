import { Platform, Share } from 'react-native';

// "Copy and share" for a private room: puts a ready message with the room code on the clipboard (web) or opens the
// phone's share sheet (native), so the host can paste it to friends.
export type ShareResult = 'copied' | 'shared' | 'failed';

export const roomInviteText = (roomName: string, code: string) => `בואו לשחק איתי ב־THE ARENA! חדר: ${roomName} · קוד הכניסה: ${code}`;

export async function shareRoomInvite(roomName: string, code: string): Promise<ShareResult> {
  const message = roomInviteText(roomName, code);
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(message);
          return 'copied';
        } catch {
          // blocked: try the older way below
        }
      }
      // Over plain http (the home network) the modern clipboard and share APIs do not exist: copy through a hidden field.
      if (copyWithHiddenField(message)) return 'copied';
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ text: message });
        return 'shared';
      }
      return 'failed';
    }
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'failed';
  }
}

// The classic copy: select a hidden text field and run the browser's copy command (works inside a tap on iPhone Safari).
function copyWithHiddenField(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
  document.body.appendChild(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(field);
  return ok;
}
