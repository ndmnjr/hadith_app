# منصة كتب الحديث للشيخ يحيى اليحيى

تطبيق MVP عربي بالكامل وبتخطيط RTL لعرض كتب الحديث والبحث فيها وفهرسة أطرافها ومسند الرواة.

## التقنية

- HTML حقيقي داخل `public/*.html`
- CSS حقيقي داخل `public/css/styles.css`
- JavaScript حقيقي داخل `public/js/app.js`
- Supabase PostgreSQL + RPC
- Vercel Static + Serverless config endpoint

## التشغيل المحلي

1. انسخ `.env.example` إلى `.env`.
2. أضف مفاتيح Supabase وقيمة `SUPABASE_DB_URL`.
3. شغل:

```bash
npm install
npm start
```

ثم افتح:

```text
http://localhost:3000
```

## قاعدة البيانات

ملف الهجرة الرئيسي:

```text
supabase/migrations/20260608_mvp_schema_rpc.sql
```

لتطبيقه:

```bash
npm run apply:migration
```

## الصفحات

- `/index.html` الصفحة الرئيسية
- `/browse.html` عرض المجلدات والأحاديث
- `/search.html` البحث في الأحاديث
- `/hadith-index.html` فهرس أطراف الحديث
- `/narrators.html` البحث في الرواة
- `/musnad.html` مسند الرواة
- `/hadith.html?id=1` عرض حديث مفرد
