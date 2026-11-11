# התחברות עם Google (דרך Firebase Authentication)

הקוד מוכן. כדי שהכפתור "התחברות עם Google" יעבוד צריך לעשות **פעם אחת** את הצעדים האלה ב־Firebase Console
(https://console.firebase.google.com, הפרויקט `the-arena-game-v1`).

## מה לעשות
1. **Build → Authentication → Get started** (אם עוד לא לחצת).
2. לשונית **Sign-in method** → **Google** → **Enable**. תבחר אימייל תמיכה (האימייל שלך) → **Save**.
3. לשונית **Settings → Authorized domains**: הדומיין `localhost` כבר שם כברירת מחדל. זה מה שנבדק עליו במחשב.
4. (מומלץ) ב־Google Cloud Console → APIs & Services → Credentials → ה־Browser key של הפרויקט → **Application restrictions: Websites**
   והוספת `http://localhost:8090/*`. זה מגביל מי יכול להשתמש במפתח (המפתח הזה ציבורי בכל אפליקציית ווב, וההגבלה היא ההגנה).

## איפה ההגדרות
- `mobile/.env`: `EXPO_PUBLIC_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._PROJECT_ID`, `..._APP_ID`.
- `server/.env`: `FIREBASE_PROJECT_ID` (השרת בודק שהאישור שייך לפרויקט הזה).
- שני הקבצים לא עולים ל־git. אחרי שינוי: להפעיל מחדש את השרת ואת האתר (`npx.cmd expo start --web --port 8090 --clear`).

## איך זה עובד
1. לחיצה על הכפתור פותחת חלון Google (Firebase). בסיום האתר מקבל **ID token**.
2. האתר שולח אותו לשרת (`POST /api/firebase-login`). השרת בודק את החתימה מול התעודות של Google, את הפרויקט, את התוקף ואת האימייל המאומת.
3. חשבון חדש: צריך לבחור כינוי, דמות ומין (ל־Google אין אותם), ואז `POST /api/profile`.
4. אימייל שכבר קיים בחשבון סיסמה מתחבר לאותו חשבון. חשבון Google לא יכול להתחבר עם סיסמה.
5. מולטי משתמש בחשבון של השרת, כך שניצחונות נרשמים עליו.

## הגבלות
- Google ו־Firebase מקבלים רק `localhost` או כתובת https: **באייפון דרך `http://10.0.0.44` זה לא יעבוד**. נבדק באייפון אחרי אירוח עם https (שלב 6).
- ה־SDK נטען מה־CDN של Google ולא מ־npm, כי npm לא יכול להרחיב את התיקייה של pnpm. כשיהיה pnpm מחליפים ב־`firebase`.
