/* In-app guide and tips (English / Arabic). Each entry lists the roles it matters to; omitted = everyone. */
import type { Role } from '../types';

type T = [en: string, ar: string];
export interface GuideSection { id: string; icon: string; title: T; roles?: Role[]; steps: T[] }

const LEADS: Role[] = ['admin', 'manager'];

export const GUIDE: GuideSection[] = [
  {
    id: 'start', icon: 'info', title: ['Getting started', 'البداية'],
    steps: [
      ['Install the app: tap "Install" in the pop-up (Android / PC) or Share → "Add to Home Screen" (iPhone). It opens full-screen and works offline.', 'ثبّت التطبيق: اضغط "تثبيت" في النافذة المنبثقة (أندرويد / الحاسوب) أو مشاركة ← "إضافة إلى الشاشة الرئيسية" (آيفون). يفتح بملء الشاشة ويعمل بدون إنترنت.'],
      ['Switch between Arabic and English with the language button at the top.', 'بدّل بين العربية والإنجليزية من زر اللغة في الأعلى.'],
      ['Every cold run belongs to the yearly shutdown shown at the top of the Dashboard and Inspections.', 'كل اختبار تشغيل بارد يتبع التوقف السنوي الظاهر أعلى لوحة المتابعة والفحوصات.'],
      ['No network? Keep working. Changes are saved on the device and sync automatically when the connection returns.', 'لا يوجد إنترنت؟ تابع العمل. تُحفظ التغييرات على الجهاز وتُرفع تلقائياً عند عودة الاتصال.'],
    ],
  },
  {
    id: 'flow', icon: 'checklist', title: ['How the cold run works', 'كيف يسير اختبار التشغيل البارد'],
    steps: [
      ['New Inspection: find the equipment by its code (e.g. K1M011), name or a checklist item. The title is "code — name" and the checklist of your discipline is listed; remove or add items before creating it.', 'فحص جديد: ابحث عن المعدة برمزها (مثلاً K1M011) أو اسمها أو أحد بنود الفحص. العنوان هو "الرمز — الاسم" وتُدرج قائمة فحص اختصاصك؛ احذف أو أضف بنوداً قبل إنشائه.'],
      ['Waiting in your pool: your team checks every part and marks it OK or Not OK, then presses Submit.', 'بانتظار فريقك: يفحص فريقك كل جزء ويحدده سليم أو غير سليم، ثم يضغط إرسال.'],
      ['Active — Corrective maintenance: a work order number is required; parts that were Not OK are repaired and marked Fixed.', 'نشط — صيانة تصحيحية: رقم أمر العمل إلزامي؛ وتُصلح الأجزاء غير السليمة ويُؤشَّر عليها "تم الإصلاح".'],
      ['Active — Waiting approval: the Cold Run Test Manager or Administrator approves it, or sends it back with a reason.', 'نشط — بانتظار الموافقة: يعتمده مدير اختبار التشغيل البارد أو مدير النظام، أو يعيده مع ذكر السبب.'],
      ['Active — Approved. When every inspection of the shutdown is approved, "Close shutdown & archive" moves them all to Done and the count starts again from 0.', 'نشط — معتمد. عندما تُعتمد جميع فحوصات التوقف، ينقلها زر "إغلاق التوقف والأرشفة" إلى المنجز ويبدأ العدّ من الصفر.'],
    ],
  },
  {
    id: 'parts', icon: 'check', title: ['Checking parts', 'فحص الأجزاء'], roles: ['member', ...LEADS],
    steps: [
      ['Open the inspection from "Waiting in your pool". Each part has two buttons: ✓ OK and ✕ Not OK.', 'افتح الفحص من "بانتظار فريقك". لكل جزء زران: ✓ سليم و ✕ غير سليم.'],
      ['Not OK asks for a short description of the problem; add a photo — it saves time for the repair.', 'غير سليم يطلب وصفاً قصيراً للمشكلة؛ أضف صورة — توفر الوقت على الإصلاح.'],
      ['Chose wrongly? Tap the highlighted ✓ again to clear the part. A highlighted ✕ asks first, because it removes the note and photo.', 'اخترت خطأً؟ اضغط ✓ المؤشَّر مرة أخرى لإلغاء الجزء. أما ✕ المؤشَّر فيطلب التأكيد لأنه يحذف الملاحظة والصورة.'],
      ['Colleagues of the same discipline and department can share the work on one inspection.', 'يمكن لزملاء الاختصاص والقسم نفسه تقاسم العمل على الفحص الواحد.'],
      ['When every part is checked, press Submit inspection. With Not OK parts you must enter the work order number for the repair.', 'عند فحص جميع الأجزاء اضغط إرسال الفحص. مع وجود أجزاء غير سليمة يجب إدخال رقم أمر العمل الخاص بالإصلاح.'],
      ['During corrective maintenance, open each Not OK part, press Mark fixed and write what was done. The last fix sends it for approval.', 'أثناء الصيانة التصحيحية افتح كل جزء غير سليم واضغط "تم الإصلاح" واكتب ما تم. آخر إصلاح يرسل الفحص للموافقة.'],
    ],
  },
  {
    id: 'approve', icon: 'shield', title: ['Approving and closing the shutdown', 'الاعتماد وإغلاق التوقف'], roles: LEADS,
    steps: [
      ['Inspections → Active → Waiting approval lists what needs you. Open one, review the parts and press Approve or Send back.', 'الفحوصات ← نشط ← بانتظار الموافقة تعرض ما ينتظرك. افتح الفحص، راجع الأجزاء، ثم اعتمد أو أعِد.'],
      ['Approval notifies the report recipients and, when the e-mail service is connected, sends them the Excel file.', 'الاعتماد يبلّغ مستلمي التقارير، ويرسل لهم ملف Excel عند ربط خدمة البريد.'],
      ['When all inspections are approved, press "Close shutdown & archive" on the shutdown card. Everything moves to Done and the next shutdown starts.', 'عند اعتماد جميع الفحوصات اضغط "إغلاق التوقف والأرشفة" في بطاقة التوقف. ينتقل كل شيء إلى المنجز ويبدأ التوقف التالي.'],
      ['Approval documents readiness only. It never authorizes operation, bypasses interlocks or replaces LOTO and permits.', 'الاعتماد يوثّق الجاهزية فقط، ولا يخوّل التشغيل ولا يتجاوز الحمايات ولا يحل محل العزل (LOTO) وتصاريح العمل.'],
    ],
  },
  {
    id: 'equipment', icon: 'factory', title: ['Equipment and parts', 'المعدات والأجزاء'], roles: LEADS,
    steps: [
      ['Equipment → Download CSV. Open it in Excel and fill one row per checklist item: Department, Code, Equipment, Part type (Mechanical, Electrical, Instrumentation or Production), Part. The code identifies the equipment.', 'المعدات ← تنزيل CSV. افتحه في Excel واملأ صفاً لكل بند فحص: القسم، الرمز، المعدة، نوع الجزء (ميكانيك، كهرباء، سيطرة، إنتاج)، الجزء. الرمز يحدد المعدة.'],
      ['Save it as CSV and press Upload CSV. Check the preview, then Import. Equipment in the file get exactly the parts listed; others are not touched.', 'احفظه بصيغة CSV واضغط رفع CSV. راجع المعاينة ثم استيراد. المعدات الموجودة في الملف تأخذ الأجزاء المدرجة بالضبط؛ ولا تتغير غيرها.'],
      ['For a single change use the pencil next to the equipment: one part per line.', 'لتعديل واحد استخدم القلم بجانب المعدة: جزء في كل سطر.'],
    ],
  },
  {
    id: 'admin', icon: 'users', title: ['People and access (administrator)', 'الأشخاص والصلاحيات (مدير النظام)'], roles: ['admin'],
    steps: [
      ['Users → Add user: name, e-mail and role. Team members also get a discipline and a department.', 'المستخدمون ← إضافة مستخدم: الاسم والبريد والدور. ولعضو الفريق اختصاص وقسم أيضاً.'],
      ['They receive an e-mail to set a password, or simply use "Sign in with Google" with the same e-mail.', 'يصلهم بريد لتعيين كلمة المرور، أو يدخلون مباشرة بـ"الدخول بحساب Google" بالبريد نفسه.'],
      ['When someone leaves, press Deactivate. Their history stays.', 'عند مغادرة شخص اضغط تعطيل. يبقى سجله.'],
      ['Devices: revoke a lost or shared phone — it is signed out immediately.', 'الأجهزة: ألغِ هاتفاً مفقوداً أو مشتركاً — يُسجَّل خروجه فوراً.'],
      ['Rename a shutdown or project, or correct its year: Edit on the shutdown card, or Settings → Shutdowns & projects for past ones.', 'لإعادة تسمية توقف أو مشروع أو تصحيح سنته: تعديل في بطاقة التوقف، أو الإعدادات ← التوقفات والمشاريع للسابقة منها.'],
      ['Delete an inspection made by mistake: open it and press Delete. Its photos are removed too and the deletion is kept in the audit log.', 'لحذف فحص أُنشئ بالخطأ: افتحه واضغط حذف. تُحذف صوره أيضاً ويبقى الحذف مسجلاً في سجل التدقيق.'],
      ['Closing a shutdown starts the next one with the same year — set the new year and name with Edit on the shutdown card.', 'إغلاق التوقف يبدأ التوقف التالي بالسنة نفسها — حدّد السنة الجديدة والاسم بزر تعديل في بطاقة التوقف.'],
      ['Settings → Departments: rename, reorder, add or retire departments.', 'الإعدادات ← الأقسام: غيّر الأسماء أو الترتيب أو أضف أقساماً أو أوقفها.'],
      ['Settings → Plan & billing shows today\'s use of the free limits. Administrators are e-mailed at 25%, 50%, 75%, 90% and 100%; add a payment method there if limits are reached often.', 'الإعدادات ← الخطة والدفع تعرض استخدام اليوم من الحدود المجانية. يصل لمديري النظام بريد عند 25% و50% و75% و90% و100%؛ وأضف وسيلة دفع من هناك إذا تكرر الوصول إلى الحدود.'],
    ],
  },
  {
    id: 'reports', icon: 'chart', title: ['Reports and Excel', 'التقارير وملفات Excel'], roles: LEADS,
    steps: [
      ['Reports: overview by department or discipline, Not OK parts, equipment not started, all inspections and work per person.', 'التقارير: نظرة عامة حسب القسم أو الاختصاص، الأجزاء غير السليمة، المعدات التي لم تبدأ، كل الفحوصات، والعمل لكل شخص.'],
      ['Choose the shutdown and filters, then Export Excel — the file holds exactly what you see.', 'اختر التوقف والتصفية ثم تصدير Excel — يحتوي الملف ما تراه بالضبط.'],
      ['Every inspection also has Export Excel and a printable PDF report.', 'ولكل فحص أيضاً تصدير Excel وتقرير PDF قابل للطباعة.'],
    ],
  },
];

/** Short tips for the dashboard card, by role. */
export const TIPS: { roles?: Role[]; text: T }[] = [
  { roles: ['member'], text: ['Start each day from "Waiting in your pool" — it lists your team\'s inspections and the equipment not started yet.', 'ابدأ يومك من "بانتظار فريقك" — تعرض فحوصات فريقك والمعدات التي لم تبدأ بعد.'] },
  { roles: ['member'], text: ['Add a photo to every Not OK part — the repair goes faster.', 'أضف صورة لكل جزء غير سليم — يصبح الإصلاح أسرع.'] },
  { text: ['Working in an area with no signal? Carry on: everything syncs when you are back online.', 'تعمل في منطقة بلا تغطية؟ تابع: كل شيء يُزامن عند عودة الاتصال.'] },
  { roles: LEADS, text: ['Inspections → Active → Waiting approval shows what needs your decision.', 'الفحوصات ← نشط ← بانتظار الموافقة تعرض ما ينتظر قرارك.'] },
  { roles: LEADS, text: ['Fill the equipment list in Excel: Equipment → Download CSV, then Upload CSV.', 'املأ قائمة المعدات في Excel: المعدات ← تنزيل CSV ثم رفع CSV.'] },
  { roles: LEADS, text: ['The archive button appears on the shutdown card once every inspection is approved.', 'يظهر زر الأرشفة في بطاقة التوقف عند اعتماد جميع الفحوصات.'] },
  { text: ['Install the app on your phone for one-tap access and offline use.', 'ثبّت التطبيق على هاتفك للوصول بلمسة واحدة والعمل بدون إنترنت.'] },
];
