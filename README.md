# منصة محاضرات قسم المحاسبة

منصة جامعية لتصفح وقراءة وتحميل محاضرات قسم المحاسبة المرتبطة بمجلد Google Drive الرسمي لجميع المراحل الدراسية، مع دعم التثبيت كتطبيق هاتف (PWA)، الوضع الليلي، روابط المشاركة المباشرة، وتتبع تقدم الدراسة محلياً.

## التشغيل محلياً

```bash
npm install
npm run dev
```

سيعمل الموقع على الرابط `http://localhost:3000`.

## البناء والتشغيل للإنتاج

```bash
npm run build
npm start
```

## النشر على GitHub Pages مجاناً (تصفح وقراءة وتحميل المحاضرات)

1. ارفع المشروع بالكامل إلى مستودع على **GitHub** (بما في ذلك مجلد `.github/workflows/deploy.yml`).
2. افتح إعدادات المستودع: **Settings** ← **Pages**.
3. من خانة **Build and deployment** ← **Source** اختر **GitHub Actions** (مهم جداً: لا تختر `Deploy from a branch` لأن ملفات React تحتاج للبناء أولاً وإلا ستظهر صفحة بيضاء).
4. سيتم بناء الموقع ونشره تلقائياً خلال دقيقة واحدة على رابط `https://<username>.github.io/<repo-name>/`.

## النشر الكامل على Render.com (يشمل التحديث التلقائي من Drive + المساعد الذكي Gemini AI)

1. ارفع هذا المشروع إلى مستودع في حسابك على **GitHub** (مع التأكد من عدم رفع `node_modules` أو `.env` — ملف `.gitignore` جاهز بالفعل).
2. سجّل الدخول إلى [Render.com](https://render.com) عبر حساب GitHub.
3. اختر **New +** ← **Web Service** وحدد المستودع.
4. اضبط الإعدادات التالية (أو استخدم ملف `render.yaml` الجاهز):
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:** `NODE_ENV=production` و `GEMINI_API_KEY=<مفتاح Gemini AI الخاص بك>` (لتفعيل المساعد الذكي لشرح المحاضرات بأمان من الخادم).
5. اضغط **Create Web Service** وخلال دقائق سيكون لديك رابط عام دائم يمكن لجميع الطلبة الدخول إليه من الهاتف أو الحاسوب، وتثبيته كتطبيق على الشاشة الرئيسية.
