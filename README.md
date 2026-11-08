# The-Arena-Mobile-Game

**THE ARENA – הזירה** · A Hebrew visual-trivia game for the phone browser: 16 contestants, one 4×4 arena, timed picture duels until one champion remains.


**▶ Play: https://yakirc0412.github.io/The-Arena-Mobile-Game/** (single player vs 15 bots; the online mode needs the Arena server)

**▶ לשחק: https://yakirc0412.github.io/The-Arena-Mobile-Game/** (משחק יחיד מול 15 בוטים; המשחק המקוון דורש את שרת הזירה)

משחק טריוויה חזותי בעברית: 16 מתמודדים, לוח 4×4, דו-קרבות זיהוי תמונות נגד השעון.
המשחק נבנה כאפליקציית ווב שנפתחת בדפדפן של הטלפון.

## איך מריצים
הדרך הפשוטה: לבקש מ-Claude "תפעיל את המשחק", והוא ייפתח בחלון הדפדפן שליד השיחה.

ידנית, מתוך התיקייה `mobile`:

```bash
npx.cmd expo start --web --port 8090
```

ואז לפתוח בדפדפן: http://localhost:8090

(ב-Windows משתמשים ב-`npx.cmd` ולא ב-`npx`, כי PowerShell חוסם הרצת סקריפטים במחשב הזה.)

## איפה נמצא מה
| תיקייה | מה יש בה |
|---|---|
| `docs/` | חוקי המשחק, יומן החלטות, מפת דרכים, PRD ומסמך עיצוב |
| `mobile/` | קוד המשחק |
| `mobile/src/features/` | המסכים, לפי חלקי המשחק: הרשמה, זירה, דו-קרב, גמר |
| `mobile/src/game/` | מנוע החוקים |
| `mobile/src/content/` | קטגוריות, פריטים ודמויות |
| `archive/` | קבצים ישנים שלא נמחקו (לא נשמרים ב-git) |
| `CLAUDE.md` | כל מה ש-Claude צריך לדעת על הפרויקט |
