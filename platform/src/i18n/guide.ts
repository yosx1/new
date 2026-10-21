/* In-app guide and tips (English / Arabic). Each entry lists the roles it matters to; omitted = everyone. */
import type { Role } from '../types';

type T = [en: string, ar: string];
export interface GuideSection { id: string; icon: string; title: T; roles?: Role[]; steps: T[] }

const LEADS: Role[] = ['admin', 'supervisor', 'manager'];
const EXEC: Role[] = ['admin', 'supervisor', 'mechanical', 'electrical', 'instrumentation', 'production'];

export const GUIDE: GuideSection[] = [
  {
    id: 'start', icon: 'info', title: ['Getting started', 'البداية'],
    steps: [
      ['Install the app: tap "Install" in the pop-up (Android / PC) or Share → "Add to Home Screen" (iPhone). It opens full-screen and works offline.', 'ثبّت التطبيق: اضغط "تثبيت" في النافذة المنبثقة (أندرويد / الحاسوب) أو مشاركة ← "إضافة إلى الشاشة الرئيسية" (آيفون). يفتح بملء الشاشة ويعمل بدون إنترنت.'],
      ['Switch between Arabic and English with the language button at the top.', 'بدّل بين العربية والإنجليزية من زر اللغة في الأعلى.'],
      ['"My Tasks" shows everything waiting for you or your discipline — start your shift there.', '"مهامي" تعرض كل ما ينتظرك أو ينتظر اختصاصك — ابدأ وجبتك من هناك.'],
      ['The bell shows notifications, for example when you are added to an inspection or a defect is assigned to you.', 'الجرس يعرض الإشعارات، مثل إضافتك إلى فحص أو إسناد عيب إليك.'],
      ['No network? Keep working. Changes are saved on the device and sync automatically when the connection returns (the sync icon shows while it uploads).', 'لا يوجد إنترنت؟ تابع العمل. تُحفظ التغييرات على الجهاز وتُرفع تلقائياً عند عودة الاتصال (تظهر أيقونة المزامنة أثناء الرفع).'],
    ],
  },
  {
    id: 'flow', icon: 'checklist', title: ['How an inspection works', 'كيف يسير الفحص'],
    steps: [
      ['A supervisor or manager creates the inspection for a piece of equipment; the right checklist is picked automatically.', 'ينشئ مسؤول الوجبة أو مدير القسم الفحص لمعدة معيّنة، وتُختار قائمة الفحص المناسبة تلقائياً.'],
      ['Each discipline (mechanical, electrical, instrumentation, production) fills in its own section.', 'يملأ كل اختصاص (ميكانيك، كهرباء، سيطرة، إنتاج) القسم الخاص به.'],
      ['A failed item opens a defect, which must be repaired and verified before approval.', 'البند الفاشل يفتح عيباً يجب إصلاحه والتحقق منه قبل الموافقة.'],
      ['When every item is done, each required discipline signs off, then a lead gives the final approval.', 'عند اكتمال جميع البنود يوقّع كل اختصاص مطلوب، ثم يعطي المسؤول الموافقة النهائية.'],
    ],
  },
  {
    id: 'items', icon: 'check', title: ['Filling in checklist items', 'تعبئة بنود الفحص'], roles: EXEC,
    steps: [
      ['Open an item, choose Pass, Fail or N/A, and enter the reading when one is asked for. Out-of-range readings are flagged in red.', 'افتح البند واختر مطابق أو غير مطابق أو لا ينطبق، وأدخل القراءة عند طلبها. القراءات خارج الحدود تظهر باللون الأحمر.'],
      ['Read the guidance under each item — it explains how to check it.', 'اقرأ الإرشاد تحت كل بند — يشرح طريقة الفحص.'],
      ['Attach a photo for every failure: it saves time for the repair team.', 'أرفق صورة لكل حالة فشل: توفر الوقت على فريق الإصلاح.'],
      ['If a colleague saves the same item at the same moment, you are shown their result instead of overwriting it — check it and save again if needed.', 'إذا حفظ زميل البند نفسه في اللحظة ذاتها، تظهر لك نتيجته بدلاً من الكتابة فوقها — راجعها واحفظ مجدداً عند الحاجة.'],
    ],
  },
  {
    id: 'defects', icon: 'alert', title: ['Defects and repairs', 'العيوب والإصلاح'],
    steps: [
      ['New defects go to the discipline pool, so anyone on the shift can take one over.', 'تذهب العيوب الجديدة إلى مجموعة الاختصاص، فيستطيع أي شخص في الوجبة استلامها.'],
      ['Mark "Repair completed" with a short note of what was done.', 'اختر "اكتمل الإصلاح" مع ملاحظة قصيرة بما تم.'],
      ['A different person must verify the repair — you cannot verify your own work.', 'يجب أن يتحقق شخص آخر من الإصلاح — لا يمكنك التحقق من عملك بنفسك.'],
      ['Critical defects block final approval until they are closed.', 'العيوب الحرجة تمنع الموافقة النهائية حتى تُغلق.'],
    ],
  },
  {
    id: 'approve', icon: 'shield', title: ['Approvals', 'الموافقات'], roles: [...LEADS, 'mechanical', 'electrical', 'instrumentation', 'production'],
    steps: [
      ['The inspection page lists every blocker that still prevents approval — clear them one by one.', 'تعرض صفحة الفحص كل ما يمنع الموافقة — عالجها واحداً تلو الآخر.'],
      ['Sign off only your own discipline; managers can sign for their department.', 'وقّع لاختصاصك فقط؛ ويمكن لمدير القسم التوقيع عن قسمه.'],
      ['An override needs a written justification and is recorded in the audit log.', 'التجاوز يتطلب مبرراً مكتوباً ويُسجّل في سجل التدقيق.'],
      ['Approval documents readiness only. It never authorizes operation, bypasses interlocks or replaces LOTO and permits.', 'الموافقة توثّق الجاهزية فقط، ولا تخوّل التشغيل ولا تتجاوز الحمايات ولا تحل محل العزل (LOTO) وتصاريح العمل.'],
    ],
  },
  {
    id: 'admin', icon: 'users', title: ['Running the platform (administrator)', 'إدارة المنصة (مدير النظام)'], roles: ['admin'],
    steps: [
      ['Users → Add user: enter name, e-mail and role. They receive an e-mail to set a password, or simply use "Sign in with Google".', 'المستخدمون ← إضافة مستخدم: أدخل الاسم والبريد والدور. يصله بريد لتعيين كلمة المرور، أو يدخل مباشرة بـ"الدخول بحساب Google".'],
      ['When someone leaves, press Deactivate and then "Reassign open work". Their history stays intact.', 'عند مغادرة شخص اضغط تعطيل ثم "إعادة إسناد الأعمال المفتوحة". يبقى سجله محفوظاً.'],
      ['Devices: revoke a lost or shared phone — it is signed out immediately.', 'الأجهزة: ألغِ هاتفاً مفقوداً أو مشتركاً — يُسجَّل خروجه فوراً.'],
      ['Checklists: review the example items against your plant procedures and manuals, then publish. Published versions never change, so old inspections keep their original checklist.', 'قوائم الفحص: راجع البنود النموذجية وفق إجراءات المعمل وأدلة المعدات ثم انشرها. النسخ المنشورة لا تتغير، فتحتفظ الفحوصات القديمة بقائمتها الأصلية.'],
      ['Settings: plant name, who may override, and the example data loader for a fresh start.', 'الإعدادات: اسم المعمل، ومن يحق له التجاوز، وتحميل البيانات النموذجية للبداية.'],
    ],
  },
  {
    id: 'reports', icon: 'chart', title: ['Reports and records', 'التقارير والسجلات'],
    steps: [
      ['Reports: filter by department, equipment and dates, then export to Excel (CSV) or print.', 'التقارير: صفِّ حسب القسم والمعدة والتاريخ ثم صدّر إلى Excel ‏(CSV) أو اطبع.'],
      ['Every inspection has a print view for signatures and the plant file.', 'لكل فحص صفحة طباعة للتواقيع وملف المعمل.'],
      ['The audit log records who did what and when; nobody can edit or delete it.', 'سجل التدقيق يحفظ من فعل ماذا ومتى؛ ولا يمكن لأحد تعديله أو حذفه.'],
    ],
  },
];

/** Short tips for the dashboard card, by role. */
export const TIPS: { roles?: Role[]; text: T }[] = [
  { text: ['Start each shift from "My Tasks" — it lists only what is waiting for you.', 'ابدأ كل وجبة من "مهامي" — تعرض فقط ما ينتظرك.'] },
  { text: ['Working in an area with no signal? Carry on: everything syncs when you are back online.', 'تعمل في منطقة بلا تغطية؟ تابع: كل شيء يُزامن عند عودة الاتصال.'] },
  { roles: EXEC, text: ['Add a photo to every failed item — repairs go faster.', 'أضف صورة لكل بند فاشل — يصبح الإصلاح أسرع.'] },
  { roles: EXEC, text: ['Red readings are outside the allowed limits: re-check before saving.', 'القراءات الحمراء خارج الحدود المسموحة: أعد التحقق قبل الحفظ.'] },
  { roles: LEADS, text: ['The inspection page shows exactly what still blocks approval.', 'صفحة الفحص تعرض بالضبط ما يمنع الموافقة حتى الآن.'] },
  { roles: LEADS, text: ['Assign defects to the pool, not a person, so the next shift can continue.', 'أسند العيوب إلى المجموعة لا إلى شخص، لتتابعها الوجبة التالية.'] },
  { roles: ['admin'], text: ['Add people from Users — they get an e-mail or can sign in with Google.', 'أضف الأشخاص من المستخدمين — يصلهم بريد أو يدخلون بحساب Google.'] },
  { roles: ['admin'], text: ['Lost phone? Revoke it in Devices and it is signed out at once.', 'هاتف مفقود؟ ألغه من الأجهزة فيُسجَّل خروجه فوراً.'] },
  { text: ['Install the app on your phone for one-tap access and offline use.', 'ثبّت التطبيق على هاتفك للوصول بلمسة واحدة والعمل بدون إنترنت.'] },
];
