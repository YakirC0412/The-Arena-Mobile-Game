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
| `mobile/` | האפליקציה: קוד המשחק, התמונות, הצלילים והבדיקות |
| `mobile/src/features/` | המסכים, לפי חלקי המשחק: הרשמה, בית, לובי, זירה, דו-קרב, משחק מקוון, גמר |
| `mobile/src/game/` | מנוע החוקים (בלי React) |
| `mobile/src/design/` | צבעים, כפתורים ורכיבי עיצוב כלליים |
| `mobile/src/hooks/` | צליל ורטט, מקלדת באייפון, תנועה מופחתת |
| `mobile/src/content/` | קטגוריות, פריטים ודמויות |
| `server/` | שרת המשחק המקוון (רב-משתתפים) |
| `admin/` | **לוח הניהול**: עריכת קטגוריות, פריטים ותמונות (ראו `admin/README.md`) |
| `docs/` | חוקי המשחק, יומן החלטות, מפת דרכים, יומן עבודה; `docs/archive/` = מסמכים ישנים |
| `.claude/` | הגדרות הרצה וכלי העזר של Claude (סקילים) |
| `archive/` | קבצים ישנים שלא נמחקו (לא נשמרים ב-git, כדאי לגבות בעצמכם) |
| `CLAUDE.md` | כל מה ש-Claude צריך לדעת על הפרויקט |

## הרצה של כל חלק
| מה | פקודה | כתובת |
|---|---|---|
| המשחק (פיתוח) | `npx.cmd expo start --web --port 8090` מתוך `mobile` | http://localhost:8090 |
| לוח הניהול | `npm.cmd run admin` מתוך `mobile` | http://localhost:8095 |
| שרת רב-משתתפים | `npm.cmd run start` מתוך `server` | פורט 2567 |
