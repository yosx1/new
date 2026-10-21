// Guide content. Each block: { en, ar } HTML. Images: { img: 'name' } → shots/<lang>-<name>.png
export const META = {
  title: { en: 'Cold Run Readiness', ar: 'جاهزية التشغيل البارد' },
  sub: { en: 'User & Administrator Guide — from A to Z', ar: 'دليل المستخدم ومدير النظام — من الألف إلى الياء' },
  plant: { en: 'Karbala Cement Plant', ar: 'معمل سمنت كربلاء' },
  url: 'https://kcp-coldrun-2026.web.app',
  contents: { en: 'Contents', ar: 'المحتويات' },
  part: { en: 'English', ar: 'العربية' },
  tip: { en: 'Tip', ar: 'نصيحة' },
  note: { en: 'Important', ar: 'مهم' },
  who: { en: 'For', ar: 'لمن' },
};

const T = (en, ar) => ({ en, ar });
const steps = (...xs) => ({ steps: xs });
const tip = (en, ar) => ({ tip: T(en, ar) });
const note = (en, ar) => ({ note: T(en, ar) });
const img = (name, en, ar) => ({ img: name, cap: T(en, ar) });
const p = (en, ar) => ({ p: T(en, ar) });
const table = (head, rows) => ({ table: { head, rows } });
const who = (en, ar) => ({ who: T(en, ar) });

export const CHAPTERS = [
  {
    id: 'about', title: T('About the platform', 'نبذة عن المنصة'),
    body: [
      p('Cold Run Readiness records and controls the inspection of plant equipment after maintenance, before it returns to service. Every discipline fills in its own checklist, failures become tracked defects, and each step is signed off and kept in an audit log that nobody can edit.',
        'تسجّل منصة جاهزية التشغيل البارد فحص معدات المعمل بعد الصيانة وقبل عودتها للخدمة وتضبطه. يملأ كل اختصاص قائمة الفحص الخاصة به، وتتحول حالات الفشل إلى عيوب متابَعة، ويُوقَّع على كل خطوة ويُحفظ في سجل تدقيق لا يمكن لأحد تعديله.'),
      p('It works in Arabic and English, on phones, tablets and computers, and keeps working without a network connection.', 'تعمل المنصة بالعربية والإنجليزية، على الهواتف والأجهزة اللوحية والحواسيب، وتستمر بالعمل دون اتصال بالشبكة.'),
      note('The platform documents readiness only. It never authorizes operation, never bypasses interlocks and never replaces LOTO, work permits or the formal operating authorization of the plant.',
        'المنصة توثّق الجاهزية فقط. لا تخوّل التشغيل، ولا تتجاوز أنظمة الحماية (Interlocks)، ولا تحل محل العزل والإقفال (LOTO) أو تصاريح العمل أو تخويل التشغيل الرسمي في المعمل.'),
    ],
  },
  {
    id: 'access', title: T('Getting access', 'الدخول إلى المنصة'),
    body: [
      who('Everyone', 'الجميع'),
      p(`Open <b>${'https://kcp-coldrun-2026.web.app'}</b> in Chrome, Edge or Safari. Your administrator adds you first; you then receive an e-mail to set your password.`,
        `افتح <b dir="ltr">https://kcp-coldrun-2026.web.app</b> في متصفح Chrome أو Edge أو Safari. يضيفك مدير النظام أولاً، ثم يصلك بريد لتعيين كلمة المرور.`),
      img('login', 'The sign-in page', 'صفحة الدخول'),
      steps(
        T('<b>With a password:</b> open the e-mail "Reset your password", choose a password of at least 8 characters, then sign in with your e-mail and that password.', '<b>بكلمة مرور:</b> افتح بريد "إعادة تعيين كلمة المرور"، واختر كلمة مرور لا تقل عن 8 أحرف، ثم ادخل ببريدك وكلمة المرور.'),
        T('<b>With Google:</b> press <b>Sign in with Google</b> and choose the same e-mail the administrator added. If the browser blocks the window, allow pop-ups for the site.', '<b>بحساب Google:</b> اضغط <b>الدخول بحساب Google</b> واختر البريد نفسه الذي أضافه المدير. إذا منع المتصفح النافذة فاسمح بالنوافذ المنبثقة للموقع.'),
        T('<b>Forgot your password?</b> Type your e-mail on the sign-in page and press <b>Forgot password?</b>.', '<b>نسيت كلمة المرور؟</b> اكتب بريدك في صفحة الدخول واضغط <b>نسيت كلمة المرور؟</b>.'),
        T('Switch language at any time with the <b>العربية / English</b> button at the top.', 'بدّل اللغة في أي وقت بزر <b>العربية / English</b> في الأعلى.'),
      ),
      { h: T('Install the app', 'تثبيت التطبيق') },
      p('When you open the site, a pop-up offers to install the app. Installed, it opens full-screen from your home screen and works offline.', 'عند فتح الموقع تظهر نافذة تعرض تثبيت التطبيق. بعد التثبيت يفتح بملء الشاشة من الشاشة الرئيسية ويعمل دون إنترنت.'),
      steps(
        T('<b>Android / computer:</b> press <b>Install</b> in the pop-up.', '<b>أندرويد / الحاسوب:</b> اضغط <b>تثبيت</b> في النافذة.'),
        T('<b>iPhone / iPad:</b> press the Share button in Safari, then <b>Add to Home Screen</b>.', '<b>آيفون / آيباد:</b> اضغط زر المشاركة في Safari ثم <b>إضافة إلى الشاشة الرئيسية</b>.'),
      ),
      img('phone-install', 'The install pop-up on an iPhone', 'نافذة التثبيت على الآيفون'),
      tip('No signal in the plant? Keep working. Your changes are kept on the device and sent automatically when the connection returns — the sync icon at the top shows while they upload.',
        'لا توجد تغطية في الموقع؟ تابع العمل. تُحفظ تغييراتك على الجهاز وتُرسل تلقائياً عند عودة الاتصال — تظهر أيقونة المزامنة في الأعلى أثناء الرفع.'),
    ],
  },
  {
    id: 'roles', title: T('Roles & privileges', 'الأدوار والصلاحيات'),
    body: [
      p('What you can do depends on your role. The same limits are enforced by the security rules on the server, so they cannot be bypassed from a device.', 'ما تستطيع فعله يعتمد على دورك. تفرض قواعد الحماية على الخادم الحدود نفسها، فلا يمكن تجاوزها من أي جهاز.'),
      table([T('Role', 'الدور'), T('Main job in the platform', 'مهمته الأساسية في المنصة')], [
        [T('System Administrator', 'مدير النظام'), T('Everything, plus users, devices, checklists, equipment and settings.', 'كل الصلاحيات، إضافة إلى المستخدمين والأجهزة وقوائم الفحص والمعدات والإعدادات.')],
        [T('Department Manager', 'مدير القسم'), T('Creates inspections, signs off for the department, final approval, overrides with justification, receives completion reports.', 'ينشئ الفحوصات، ويوقّع عن القسم، ويعطي الموافقة النهائية، ويتجاوز بمبرر، ويستلم تقارير الإنجاز.')],
        [T('Shift Supervisor', 'مسؤول الوجبة'), T('Creates and runs inspections, assigns and verifies defects, final approval.', 'ينشئ الفحوصات ويديرها، ويسند العيوب ويتحقق منها، ويعطي الموافقة النهائية.')],
        [T('Mechanical / Electrical / Instrumentation / Production engineer', 'مهندس ميكانيك / كهرباء / سيطرة / إنتاج'), T('Fills in their own discipline\'s section, reports and repairs defects in their pool, signs off their discipline.', 'يملأ قسم اختصاصه، ويسجّل العيوب ويصلحها ضمن مجموعته، ويوقّع لاختصاصه.')],
        [T('Viewer', 'مطّلع'), T('Reads everything and exports; cannot change anything.', 'يطّلع على كل شيء ويصدّر؛ ولا يستطيع تغيير شيء.')],
      ]),
      img('roles', 'Settings → Roles & privileges shows the full table', 'الإعدادات ← الأدوار والصلاحيات تعرض الجدول كاملاً'),
    ],
  },
  {
    id: 'daily', title: T('Your day: Dashboard and My Tasks', 'يومك: لوحة المتابعة ومهامي'),
    body: [
      who('Everyone', 'الجميع'),
      p('The <b>Dashboard</b> shows plant readiness at a glance: inspections by status, open and overdue defects, and readiness by department. A tip card under the title gives short advice for your role.',
        'تعرض <b>لوحة المتابعة</b> جاهزية المعمل بنظرة واحدة: الفحوصات حسب الحالة، والعيوب المفتوحة والمتأخرة، والجاهزية حسب القسم. وتعرض بطاقة النصائح تحت العنوان نصيحة قصيرة لدورك.'),
      img('dashboard', 'Dashboard', 'لوحة المتابعة'),
      p('<b>My Tasks</b> lists only what is waiting for you or your discipline: checklist sections to complete, approvals, defects in your pool and repairs to verify.',
        'تعرض <b>مهامي</b> فقط ما ينتظرك أو ينتظر اختصاصك: أقسام فحص لإكمالها، وموافقات، وعيوب في مجموعتك، وإصلاحات بانتظار التحقق.'),
      steps(
        T('Press <b>Take it</b> to own a task — colleagues see it is yours.', 'اضغط <b>استلام</b> لتتولى المهمة — يرى زملاؤك أنها لك.'),
        T('Press <b>Return to pool</b> to hand it back, e.g. at the end of your shift.', 'اضغط <b>إرجاع للمجموعة</b> لإعادتها، مثلاً في نهاية وجبتك.'),
      ),
      img('tasks', 'My Tasks', 'مهامي'),
      tip('The bell at the top shows your notifications: when you are added to an inspection, a defect is assigned to you, or an inspection is approved.', 'يعرض الجرس في الأعلى إشعاراتك: عند إضافتك إلى فحص، أو إسناد عيب إليك، أو الموافقة على فحص.'),
    ],
  },
  {
    id: 'lifecycle', title: T('How an inspection moves', 'مسار الفحص'),
    body: [
      p('Each inspection shows its status as a coloured badge. The platform moves it forward automatically as work is done:', 'يظهر لكل فحص شارة ملونة بحالته، وتنقله المنصة تلقائياً مع إنجاز العمل:'),
      table([T('Status', 'الحالة'), T('Meaning', 'المعنى')], [
        [T('Maintenance Completed', 'اكتملت الصيانة'), T('Created; nothing filled in yet.', 'أُنشئ ولم يُعبّأ شيء بعد.')],
        [T('Inspection in Progress', 'الفحص قيد التنفيذ'), T('Items are being filled in.', 'تُعبّأ البنود.')],
        [T('Failed — Corrective Action Required', 'مرفوض — يتطلب إجراء تصحيحي'), T('At least one defect is open.', 'يوجد عيب مفتوح واحد على الأقل.')],
        [T('Awaiting Verification', 'بانتظار التحقق'), T('Repairs are done and must be verified.', 'اكتملت الإصلاحات ويجب التحقق منها.')],
        [T('Awaiting Departmental Approval', 'بانتظار موافقة الأقسام'), T('All items done; disciplines must sign off.', 'اكتملت البنود؛ وعلى الاختصاصات التوقيع.')],
        [T('Ready for Authorized Review', 'جاهز للمراجعة المخوّلة'), T('Everything signed; waiting for final approval.', 'اكتملت التواقيع؛ بانتظار الموافقة النهائية.')],
        [T('Approved for Next Stage', 'معتمد للمرحلة التالية'), T('Final approval given; results reported to management.', 'أُعطيت الموافقة النهائية؛ وأُرسلت النتائج للإدارة.')],
        [T('Rejected / Reopened', 'مرفوض / أعيد فتحه'), T('Sent back with a reason; work continues.', 'أُعيد مع ذكر السبب؛ ويستمر العمل.')],
      ]),
    ],
  },
  {
    id: 'create', title: T('Creating an inspection', 'إنشاء فحص'),
    body: [
      who('Supervisors, managers, administrators', 'مسؤولو الوجبات ومدراء الأقسام ومدراء النظام'),
      steps(
        T('Press <b>New Inspection</b> (top of the menu).', 'اضغط <b>فحص جديد</b> (أعلى القائمة).'),
        T('Choose the <b>equipment</b> and the <b>maintenance type</b>. The matching checklist and the required sign-offs are loaded automatically.', 'اختر <b>المعدة</b> و<b>نوع الصيانة</b>. تُحمَّل قائمة الفحص المناسبة والتواقيع المطلوبة تلقائياً.'),
        T('Fill in the work order, dates, shift and the responsible engineers. Add extra people if needed — they are notified.', 'أدخل أمر العمل والتواريخ والوجبة والمهندسين المسؤولين. أضف أشخاصاً آخرين عند الحاجة — يصلهم إشعار.'),
        T('Press <b>Create inspection</b>. Each discipline now sees its section in My Tasks.', 'اضغط <b>إنشاء الفحص</b>. يرى كل اختصاص قسمه الآن في مهامي.'),
      ),
      img('new', 'New inspection', 'فحص جديد'),
      tip('If no checklist matches the equipment and maintenance type, ask the administrator to link one (Checklists).', 'إذا لم تتطابق أي قائمة فحص مع المعدة ونوع الصيانة، اطلب من مدير النظام ربط قائمة (قوائم الفحص).'),
    ],
  },
  {
    id: 'execute', title: T('Filling in a checklist', 'تعبئة قائمة الفحص'),
    body: [
      who('Engineers and supervisors', 'المهندسون ومسؤولو الوجبات'),
      steps(
        T('Open the inspection (from My Tasks or Inspections) and stay on the <b>Execute</b> tab.', 'افتح الفحص (من مهامي أو الفحوصات) وابقَ على تبويب <b>التنفيذ</b>.'),
        T('Open your discipline\'s section. Use the quick buttons ✓ / ✕ / N/A, or tap the item to open its full sheet.', 'افتح قسم اختصاصك. استخدم الأزرار السريعة ✓ / ✕ / لا ينطبق، أو اضغط على البند لفتح صفحته الكاملة.'),
        T('In the sheet: choose <b>Pass</b>, <b>Fail</b> or <b>N/A</b>; enter the reading when a unit is shown (red = outside the allowed range); add a comment and photos.', 'في صفحة البند: اختر <b>مقبول</b> أو <b>مرفوض</b> أو <b>لا ينطبق</b>؛ أدخل القراءة عند ظهور وحدة (الأحمر = خارج الحدود)؛ وأضف ملاحظة وصوراً.'),
        T('A <b>Fail</b> needs a description. <b>Raise defect / corrective action</b> is ticked by default: describe the corrective action and press Save — a defect opens for the responsible discipline. Critical items block approval until fixed.', 'حالة <b>مرفوض</b> تتطلب وصفاً. خيار <b>تسجيل عيب / إجراء تصحيحي</b> مفعّل افتراضياً: صف الإجراء التصحيحي واضغط حفظ — فيُفتح عيب للاختصاص المسؤول. البنود الحرجة تمنع الموافقة حتى تُعالج.'),
        T('Progress is saved automatically — you can stop and continue any time.', 'يُحفظ التقدم تلقائياً — يمكنك التوقف والمتابعة في أي وقت.'),
      ),
      img('execute', 'The Execute tab with sections and quick buttons', 'تبويب التنفيذ مع الأقسام والأزرار السريعة'),
      img('item', 'An item sheet: result, reason, photos and the linked defect', 'صفحة البند: النتيجة والسبب والصور والعيب المرتبط'),
      tip('Read the guidance under each item: it explains how to check it. Add a photo to every failure — it saves time for the repair team.', 'اقرأ الإرشاد تحت كل بند: يشرح طريقة الفحص. أضف صورة لكل حالة فشل — توفر الوقت على فريق الإصلاح.'),
      p('If a colleague saved the same item at the same moment, you are shown their version and can keep theirs or overwrite with yours.', 'إذا حفظ زميل البند نفسه في اللحظة ذاتها، تظهر لك نسخته ويمكنك الإبقاء عليها أو الكتابة فوقها بنسختك.'),
    ],
  },
  {
    id: 'defects', title: T('Defects and repairs', 'العيوب والإصلاح'),
    body: [
      who('Everyone except viewers', 'الجميع عدا المطّلعين'),
      p('Each defect has a code, severity, responsible discipline (pool), target date and status: <b>Open → Assigned → In Progress → Repair Completed → Awaiting Verification → Verified & Closed</b>.',
        'لكل عيب رمز وخطورة واختصاص مسؤول (مجموعة) وموعد مستهدف وحالة: <b>مفتوح ← مُسند ← قيد المعالجة ← اكتمل الإصلاح ← بانتظار التحقق ← تم التحقق والإغلاق</b>.'),
      steps(
        T('Find it in <b>My Tasks</b> or <b>Defects</b>. Take it, or a supervisor assigns it to someone.', 'تجده في <b>مهامي</b> أو <b>العيوب</b>. استلمه، أو يسنده المسؤول إلى شخص.'),
        T('Press <b>Start work</b>, repair, then <b>Mark repair completed</b> with a short note of what was done.', 'اضغط <b>بدء العمل</b>، ثم أصلح، ثم <b>تأكيد اكتمال الإصلاح</b> مع ملاحظة قصيرة بما تم.'),
        T('A supervisor, manager or administrator — <b>not the person who repaired it</b> — checks the repair: <b>Verified — close</b>, or <b>Verification failed — reopen</b>.', 'يتحقق مسؤول الوجبة أو مدير القسم أو مدير النظام — <b>وليس من أصلحه</b> — من الإصلاح: <b>تم التحقق — إغلاق</b> أو <b>فشل التحقق — إعادة فتح</b>.'),
        T('After closing, re-inspect the original checklist item so the inspection can move on.', 'بعد الإغلاق أعد فحص البند الأصلي في القائمة ليتقدم الفحص.'),
      ),
      img('defects', 'Defects & corrective actions', 'العيوب والإجراءات التصحيحية'),
      img('defect', 'A defect with its history and actions', 'عيب مع سجله والإجراءات المتاحة'),
    ],
  },
  {
    id: 'approve', title: T('Sign-offs and final approval', 'التواقيع والموافقة النهائية'),
    body: [
      who('Engineers (own discipline), managers, supervisors, administrators', 'المهندسون (لاختصاصهم) ومدراء الأقسام ومسؤولو الوجبات ومدراء النظام'),
      steps(
        T('Open the inspection → <b>Review & approvals</b>. The <b>Blocking final approval</b> list shows exactly what is still missing.', 'افتح الفحص ← <b>المراجعة والموافقات</b>. تعرض قائمة <b>ما يمنع الموافقة النهائية</b> بالضبط ما ينقص.'),
        T('Each required discipline presses <b>Approve</b> (or <b>Reject</b> with a reason).', 'يضغط كل اختصاص مطلوب <b>موافقة</b> (أو <b>رفض</b> مع السبب).'),
        T('When nothing blocks, a supervisor, manager or administrator presses <b>Approve for next stage</b>.', 'عندما لا يبقى مانع، يضغط مسؤول الوجبة أو مدير القسم أو مدير النظام <b>اعتماد للمرحلة التالية</b>.'),
        T('The completion report goes out automatically: the chosen recipients are notified in the app and receive the Excel results by e-mail.', 'يُرسل تقرير الإنجاز تلقائياً: يُبلَّغ المستلمون المحددون داخل التطبيق ويصلهم ملف النتائج (Excel) بالبريد.'),
      ),
      img('review', 'Review & approvals', 'المراجعة والموافقات'),
      note('<b>Documented override</b> (roles chosen in Settings): approve despite critical items only under an approved plant disposition. A written justification of at least 10 characters is required and recorded in the audit log.',
        '<b>التجاوز الموثّق</b> (للأدوار المحددة في الإعدادات): الموافقة رغم البنود الحرجة فقط بموجب قرار معتمد في المعمل. يلزم مبرر مكتوب لا يقل عن 10 أحرف ويُسجّل في سجل التدقيق.'),
      p('An approved inspection can be <b>reopened</b> by a lead with a reason; it then goes back through the steps above.', 'يمكن للمسؤول <b>إعادة فتح</b> فحص معتمد مع ذكر السبب، فيعود ليمر بالخطوات أعلاه.'),
    ],
  },
  {
    id: 'reports', title: T('Reports and Excel', 'التقارير وملفات Excel'),
    body: [
      who('Everyone', 'الجميع'),
      steps(
        T('Open <b>Reports</b> and choose a report: plant readiness, department, equipment, open defects, critical & overdue, corrective-action completion, inspection completion, approval history or repeated defects.', 'افتح <b>التقارير</b> واختر تقريراً: جاهزية المعمل، القسم، المعدات، العيوب المفتوحة، الحرجة والمتأخرة، إنجاز الإجراءات التصحيحية، إنجاز الفحوصات، سجل الموافقات، أو العيوب المتكررة.'),
        T('Set the filters (department, equipment, dates, discipline).', 'حدّد التصفية (القسم، المعدة، التواريخ، الاختصاص).'),
        T('Press <b>Export Excel</b>. The file contains exactly what you see, with the report name, date and filters written at the top.', 'اضغط <b>تصدير Excel</b>. يحتوي الملف ما تراه بالضبط، مع اسم التقرير والتاريخ والتصفية في أعلاه.'),
      ),
      img('reports', 'Reports & analytics', 'التقارير والتحليلات'),
      p('On any inspection, <b>Export Excel</b> gives one workbook with four sheets — Summary, Results, Defects and Approvals — and <b>Inspection report (PDF)</b> opens a printable report for signatures. In Arabic the sheets are right-to-left.',
        'في أي فحص يعطيك <b>تصدير Excel</b> ملفاً بأربع أوراق — الملخص والنتائج والعيوب والموافقات — ويفتح <b>تقرير الفحص (PDF)</b> تقريراً قابلاً للطباعة والتوقيع. وبالعربية تكون الأوراق من اليمين إلى اليسار.'),
    ],
  },
  {
    id: 'users', title: T('Administration: people and access', 'الإدارة: الأشخاص والصلاحيات'),
    body: [
      who('Administrators', 'مدراء النظام'),
      { h: T('Add a person', 'إضافة شخص') },
      steps(
        T('<b>Users</b> → <b>Add user</b>.', '<b>المستخدمون</b> ← <b>إضافة مستخدم</b>.'),
        T('Enter name, e-mail, role, department scope and phone. Leave the password empty.', 'أدخل الاسم والبريد والدور ونطاق القسم والهاتف. اترك كلمة المرور فارغة.'),
        T('Press <b>Save</b>. They receive an e-mail to set their password, or can simply use <b>Sign in with Google</b> with that e-mail.', 'اضغط <b>حفظ</b>. يصله بريد لتعيين كلمة المرور، أو يدخل مباشرة بـ<b>الدخول بحساب Google</b> بنفس البريد.'),
      ),
      img('user-add', 'Add user', 'إضافة مستخدم'),
      p('If the e-mail already has a login (for example the person tried Google first), an <b>invitation</b> is saved instead. It appears under <b>Pending invitations</b> and turns into their account the next time they sign in. You can <b>Resend e-mail</b> or cancel it.',
        'إذا كان للبريد حساب دخول مسبقاً (مثلاً جرّب الشخص Google أولاً)، تُحفظ <b>دعوة</b> بدلاً من ذلك. تظهر تحت <b>دعوات بانتظار القبول</b> وتتحول إلى حسابه عند دخوله القادم. يمكنك <b>إعادة إرسال البريد</b> أو إلغاؤها.'),
      { h: T('Change, deactivate, hand over', 'التعديل والتعطيل وتسليم العمل') },
      steps(
        T('Press the pencil to change role, department or phone, or to <b>Send password reset</b>.', 'اضغط القلم لتغيير الدور أو القسم أو الهاتف، أو <b>إرسال إعادة تعيين كلمة المرور</b>.'),
        T('When someone leaves: <b>Deactivate</b> — they are signed out at once and cannot sign in again; their history stays.', 'عند مغادرة شخص: <b>تعطيل</b> — يُسجَّل خروجه فوراً ولا يستطيع الدخول مجدداً؛ ويبقى سجله.'),
        T('<b>Reassign open work</b> returns their defects to the pool so colleagues continue.', '<b>إعادة إسناد الأعمال المفتوحة</b> تعيد عيوبه إلى المجموعة ليتابعها زملاؤه.'),
      ),
      img('users', 'Users & roles', 'المستخدمون والأدوار'),
      { h: T('Devices', 'الأجهزة') },
      p('<b>Devices</b> lists every phone, tablet and computer that signed in. <b>Revoke</b> a lost or shared device and it is signed out immediately; <b>Allow again</b> undoes it.',
        'تعرض <b>الأجهزة</b> كل هاتف وجهاز لوحي وحاسوب سجّل الدخول. <b>ألغِ الصلاحية</b> لجهاز مفقود أو مشترك فيُسجَّل خروجه فوراً؛ و<b>السماح مجدداً</b> يلغي ذلك.'),
      img('devices', 'Devices', 'الأجهزة'),
    ],
  },
  {
    id: 'master', title: T('Administration: equipment and checklists', 'الإدارة: المعدات وقوائم الفحص'),
    body: [
      who('Administrators', 'مدراء النظام'),
      { h: T('Departments and equipment', 'الأقسام والمعدات') },
      steps(
        T('<b>Equipment</b> → <b>Add department</b> for each plant area.', '<b>المعدات</b> ← <b>إضافة قسم</b> لكل منطقة في المعمل.'),
        T('<b>Add equipment</b>: unique tag, name in both languages, department, category, location and maker. The <b>category</b> decides which checklist is used.', '<b>إضافة معدة</b>: رمز فريد، والاسم باللغتين، والقسم، والفئة، والموقع والمصنّع. <b>الفئة</b> تحدد قائمة الفحص المستخدمة.'),
        T('Open any equipment to see its history: previous inspections, repeated defects and earlier readings.', 'افتح أي معدة لرؤية سجلها: الفحوصات السابقة والعيوب المتكررة والقراءات السابقة.'),
      ),
      img('equipment', 'Equipment & departments', 'المعدات والأقسام'),
      { h: T('Checklists', 'قوائم الفحص') },
      steps(
        T('<b>Checklists</b> → <b>New template</b>, or open an existing one.', '<b>قوائم الفحص</b> ← <b>قالب جديد</b>، أو افتح قالباً موجوداً.'),
        T('Choose the equipment categories, maintenance types and required departmental approvals.', 'اختر فئات المعدات وأنواع الصيانة وموافقات الأقسام المطلوبة.'),
        T('Add sections (one discipline each) and items: mandatory, critical, measurement unit and limits, photo required, N/A needs reason, guidance and procedure reference.', 'أضف أقساماً (لكل قسم اختصاص واحد) وبنوداً: إلزامي، حرج، وحدة القياس وحدودها، صورة مطلوبة، سبب عند لا ينطبق، إرشاد ومرجع الإجراء.'),
        T('Press <b>Publish new version</b> and describe what changed. Published versions never change, so old inspections keep their original checklist.', 'اضغط <b>نشر إصدار جديد</b> واذكر ما تغيّر. الإصدارات المنشورة لا تتغير، فتحتفظ الفحوصات القديمة بقائمتها الأصلية.'),
      ),
      img('templates', 'Checklist templates', 'قوالب قوائم الفحص'),
      note('Starter checklists are examples. Check every item, method and limit against the approved plant procedures and equipment manuals before using them.', 'القوائم النموذجية أمثلة. راجع كل بند وطريقة وحد وفق إجراءات المعمل المعتمدة وأدلة المعدات قبل استخدامها.'),
    ],
  },
  {
    id: 'settings', title: T('Administration: settings, reports, backup', 'الإدارة: الإعدادات والتقارير والنسخ الاحتياطي'),
    body: [
      who('Administrators', 'مدراء النظام'),
      { h: T('System settings', 'إعدادات النظام') },
      p('Plant name (both languages), shifts, maintenance types, equipment categories, the roles allowed to make documented overrides, and default target days per defect severity.', 'اسم المعمل (باللغتين)، والوجبات، وأنواع الصيانة، وفئات المعدات، والأدوار المسموح لها بالتجاوز الموثّق، والأيام المستهدفة الافتراضية حسب خطورة العيب.'),
      { h: T('Completion reports, e-mail and backup', 'تقارير الإنجاز والبريد والنسخ الاحتياطي') },
      steps(
        T('<b>Who receives them:</b> all managers and administrators (default), or only the people you tick.', '<b>من يستلمها:</b> كل مدراء الأقسام ومدراء النظام (افتراضياً)، أو فقط من تحددهم.'),
        T('<b>Extra e-mail addresses:</b> people outside the platform, separated by commas.', '<b>عناوين بريد إضافية:</b> أشخاص من خارج المنصة، مفصولة بفواصل.'),
        T('<b>Backup e-mail:</b> the weekly Google Drive backup folder is shared with this address, which also gets a short e-mail after every backup.', '<b>بريد النسخ الاحتياطي:</b> يُشارك مجلد النسخ الأسبوعي على Google Drive مع هذا البريد، ويصله إشعار قصير بعد كل نسخة.'),
        T('<b>E-mail & backup service:</b> paste the service address once (see the next section) and press <b>Test</b>; the badge turns <b>Connected</b>.', '<b>خدمة البريد والنسخ الاحتياطي:</b> الصق عنوان الخدمة مرة واحدة (انظر القسم التالي) واضغط <b>اختبار</b>؛ تتحول الشارة إلى <b>متصل</b>.'),
      ),
      img('report-settings', 'Completion reports, e-mail and backup', 'تقارير الإنجاز والبريد والنسخ الاحتياطي'),
      { h: T('Audit log', 'سجل التدقيق') },
      p('Every important action — sign-offs, overrides, user changes, settings — is recorded with who, what and when. Nobody can edit or delete it.', 'يُسجَّل كل إجراء مهم — التواقيع والتجاوزات وتغييرات المستخدمين والإعدادات — مع من وماذا ومتى. ولا يمكن لأحد تعديله أو حذفه.'),
      img('audit', 'Audit log', 'سجل التدقيق'),
    ],
  },
  {
    id: 'service', title: T('One-time setup of e-mail and weekly backup', 'الإعداد لمرة واحدة للبريد والنسخ الأسبوعي'),
    body: [
      who('The platform owner (once)', 'مالك المنصة (مرة واحدة)'),
      p('The free plan has no server, so a small Google Apps Script in the owner\'s Google account sends the e-mails and makes the backups. It checks every request against the platform: a valid sign-in, an active lead or administrator, an approved inspection — and it only sends to the recipients in Settings.',
        'الخطة المجانية بلا خادم، لذا يرسل برنامج Google Apps Script صغير في حساب المالك الرسائلَ ويعمل النسخ الاحتياطية. يتحقق من كل طلب مقابل المنصة: دخول صحيح، ومسؤول أو مدير فعّال، وفحص معتمد — ولا يرسل إلا إلى المستلمين المحددين في الإعدادات.'),
      steps(
        T('Open <b>script.google.com</b> → <b>New project</b>. Name it "KCP Cold Run service".', 'افتح <b dir="ltr">script.google.com</b> ← <b>مشروع جديد</b>. سمّه "KCP Cold Run service".'),
        T('Replace the code with <b>Code.gs</b> from the folder <b>platform/email-backup-service</b>. In Project settings tick "Show appsscript.json" and replace it with the file of the same name.', 'استبدل الشيفرة بملف <b>Code.gs</b> من المجلد <b dir="ltr">platform/email-backup-service</b>. في إعدادات المشروع فعّل "Show appsscript.json" واستبدله بالملف الذي يحمل الاسم نفسه.'),
        T('Choose the function <b>setup</b> and press <b>Run</b>; allow the permissions it asks for. This schedules the weekly backup (Fridays, 02:00).', 'اختر الدالة <b>setup</b> واضغط <b>Run</b>؛ واسمح بالأذونات المطلوبة. هذا يجدول النسخ الأسبوعي (الجمعة، 02:00).'),
        T('<b>Deploy</b> → <b>New deployment</b> → <b>Web app</b>; Execute as <b>Me</b>, access <b>Anyone</b>. Copy the URL ending in <b>/exec</b>.', '<b>Deploy</b> ← <b>New deployment</b> ← <b>Web app</b>؛ التنفيذ باسم <b>Me</b> والوصول <b>Anyone</b>. انسخ الرابط المنتهي بـ <b dir="ltr">/exec</b>.'),
        T('In the platform: <b>Settings</b> → <b>E-mail & backup service</b> → paste the URL → <b>Test</b> → <b>Save</b>.', 'في المنصة: <b>الإعدادات</b> ← <b>خدمة البريد والنسخ الاحتياطي</b> ← الصق الرابط ← <b>اختبار</b> ← <b>حفظ</b>.'),
      ),
      tip('Backups are kept in Google Drive → "KCP Cold Run backups", one dated folder per week, newest 12 kept. Each collection is a JSON file; README.txt lists the record counts.', 'تُحفظ النسخ في Google Drive ← "KCP Cold Run backups"، بمجلد مؤرخ لكل أسبوع، ويُحتفظ بآخر 12. كل مجموعة بيانات في ملف JSON، ويعرض README.txt عدد السجلات.'),
    ],
  },
  {
    id: 'help', title: T('Help inside the platform', 'المساعدة داخل المنصة'),
    body: [
      p('<b>Guide & Tips</b> in the menu explains every step for your role. Short tips appear at the top of the main pages; close one with ✕. To see them again, open Guide & Tips → <b>Show all tips again</b>.',
        'يشرح <b>الدليل والنصائح</b> في القائمة كل خطوة حسب دورك. تظهر نصائح قصيرة أعلى الصفحات الرئيسية؛ أغلق أياً منها بـ ✕. ولإظهارها مجدداً افتح الدليل والنصائح ← <b>إظهار كل النصائح مجدداً</b>.'),
      img('guide', 'Guide & Tips', 'الدليل والنصائح'),
    ],
  },
  {
    id: 'practice', title: T('Good practice and security', 'الممارسات الجيدة والأمان'),
    body: [
      steps(
        T('Use your own account. Never share passwords; on shared tablets sign out at the end of the shift.', 'استخدم حسابك الخاص. لا تشارك كلمة المرور؛ وعلى الأجهزة المشتركة سجّل الخروج في نهاية الوجبة.'),
        T('Lost phone? Tell the administrator — they revoke it in Devices.', 'فقدت هاتفك؟ أبلغ مدير النظام — يلغي صلاحيته من الأجهزة.'),
        T('Before leaving an area without signal, wait for the sync icon to disappear once you are back online.', 'قبل مغادرة منطقة بلا تغطية، انتظر اختفاء أيقونة المزامنة بعد عودة الاتصال.'),
        T('Record facts: readings, photos and clear descriptions. Everything is signed with your name and time.', 'سجّل الحقائق: القراءات والصور والوصف الواضح. كل شيء يُوقَّع باسمك والوقت.'),
        T('Administrators: deactivate leavers the same day and review the audit log regularly.', 'مدراء النظام: عطّلوا حسابات المغادرين في اليوم نفسه وراجعوا سجل التدقيق بانتظام.'),
      ),
      note('The platform documents readiness only. Starting equipment always follows the plant\'s LOTO, permit and operating-authorization procedures.', 'المنصة توثّق الجاهزية فقط. تشغيل المعدات يتبع دائماً إجراءات العزل والإقفال والتصاريح وتخويل التشغيل في المعمل.'),
    ],
  },
  {
    id: 'faq', title: T('Questions and problems', 'أسئلة ومشكلات'),
    body: [
      table([T('Problem', 'المشكلة'), T('What to do', 'الحل')], [
        [T('"Your account has no profile yet"', '"لا يوجد ملف لحسابك بعد"'), T('The administrator has not added your e-mail yet. Ask them to add you with the exact e-mail you use.', 'لم يُضِف مدير النظام بريدك بعد. اطلب منه إضافتك بالبريد نفسه الذي تستخدمه.')],
        [T('"Your account is deactivated"', '"حسابك معطّل"'), T('Contact the administrator.', 'تواصل مع مدير النظام.')],
        [T('"This device was signed out by the administrator"', '"تم تسجيل خروج هذا الجهاز من قبل مدير النظام"'), T('The device was revoked. Ask the administrator to allow it again.', 'أُلغيت صلاحية الجهاز. اطلب من المدير السماح به مجدداً.')],
        [T('No password e-mail', 'لم يصل بريد كلمة المرور'), T('Check spam. Use "Forgot password?" or ask the administrator to resend it.', 'تحقق من البريد غير المرغوب. استخدم "نسيت كلمة المرور؟" أو اطلب من المدير إعادة الإرسال.')],
        [T('Google window does not open', 'نافذة Google لا تفتح'), T('Allow pop-ups for the site in the browser, then try again.', 'اسمح بالنوافذ المنبثقة للموقع في المتصفح ثم حاول مجدداً.')],
        [T('A button is greyed out', 'زر غير مفعّل'), T('Your role does not allow it, or something still blocks it — the inspection page lists the blockers.', 'دورك لا يسمح به، أو هناك ما يمنعه — تعرض صفحة الفحص الموانع.')],
        [T('Approval says the e-mail could not be sent', 'رسالة تعذّر إرسال البريد بعد الموافقة'), T('Management was still notified in the app. Export Excel and send it manually; ask the administrator to press Test in Settings.', 'أُبلغت الإدارة داخل التطبيق. صدّر ملف Excel وأرسله يدوياً، واطلب من المدير الضغط على اختبار في الإعدادات.')],
        [T('Data looks old on one device', 'بيانات قديمة على جهاز واحد'), T('Check the connection. As a last resort: Settings → Clear local cache & sign out.', 'تحقق من الاتصال. كحل أخير: الإعدادات ← مسح البيانات المحلية وتسجيل الخروج.')],
      ]),
    ],
  },
];
