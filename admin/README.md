# לוח הניהול של הזירה (Admin)

כלי מקומי לעריכת תוכן המשחק: קטגוריות, פריטים, תשובות ותמונות. הוא קורא וכותב את הקבצים האמיתיים של האפליקציה, ואין בו שרת חיצוני או התחברות. **הוא רץ רק במחשב שלך.**

## הפעלה
מהתיקייה `mobile`:
```
npm run admin
```
או מהשורש: `node admin/server.js`. פותחים בדפדפן את http://localhost:8095

## מה בתיקייה
| קובץ | תפקיד |
|---|---|
| `server.js` | השרת של הלוח (פורט 8095) ונקודות ה־API שלו |
| `store.js` | קריאה וכתיבה של הקבצים, ושמירה על עקביות בין פריט, תמונה, מקור וקרדיט |
| `format.js` | כתיבת `categories-data.json` בתבנית קבועה |
| `index.html` | הממשק של הלוח |
| `smoke-test.js` | בדיקה מקצה לקצה (הלוח חייב לרוץ): `node admin/smoke-test.js` |
| `image-sources.json` | מקורות התמונות לכל פריט. הלוח כותב אותו והסקיל `arena-images` קורא אותו |

## אילו קבצים הלוח משנה
- `mobile/src/content/categories-data.json`: כל הקטגוריות, הפריטים, התשובות והדרכים לשחק.
- `mobile/assets/items/<קטגוריה>/` ו־`credits.json`: התמונות והקרדיטים.
- `mobile/src/content/item-images.generated.ts` ו־`image-manifest.ts`: נוצרים מחדש אוטומטית (באמצעות `mobile/scripts/build-item-images.js`). לא עורכים אותם ביד.

כלל: **שום דבר לא נמחק**. קבצים שהוסרו עוברים ל־`archive/` בשורש הפרויקט.
