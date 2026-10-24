// Guide content. Each block: { en, ar } HTML. Images: { img: 'name' } → shots/<lang>-<name>.jpg
export const META = {
  title: { en: 'Cold Run Readiness', ar: 'جاهزية التشغيل البارد' },
  sub: { en: 'User & Administrator Guide — from A to Z', ar: 'دليل المستخدم ومدير النظام — من الألف إلى الياء' },
  plant: { en: 'Karbala Cement Plant · Yearly shutdown', ar: 'معمل سمنت كربلاء · التوقف السنوي' },
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
const h = (en, ar) => ({ h: T(en, ar) });

export const CHAPTERS = [
  {
    id: 'about', title: T('About the platform', 'نبذة عن المنصة'),
    body: [
      p('Cold Run Readiness organises the cold run tests of the yearly shutdown. Every piece of equipment has mechanical, electrical, instrumentation and production parts. Each team checks the parts of its own discipline, Not OK parts go through corrective maintenance, and the Cold Run Test Manager approves the result.',
        'تنظّم منصة جاهزية التشغيل البارد اختبارات التشغيل البارد في التوقف السنوي. لكل معدة أجزاء ميكانيكية وكهربائية وسيطرة وإنتاج. يفحص كل فريق أجزاء اختصاصه، وتمر الأجزاء غير السليمة بالصيانة التصحيحية، ثم يعتمد مدير اختبار التشغيل البارد النتيجة.'),
      p('The ten departments are <b>Raw Mill 1 and 2</b>, <b>Kiln 1 and 2</b>, <b>Cooler 1 and 2</b> and <b>Cement Mill 1 to 4</b> (the administrator can rename, add or retire them). The platform works in Arabic and English, on phones, tablets and computers, and keeps working without a network connection.',
        'الأقسام العشرة هي <b>طاحونة المواد الأولية 1 و2</b> و<b>الفرن 1 و2</b> و<b>المبرّد 1 و2</b> و<b>طاحونة السمنت من 1 إلى 4</b> (يستطيع مدير النظام تغيير أسمائها أو إضافة أقسام أو إيقافها). تعمل المنصة بالعربية والإنجليزية، على الهواتف والأجهزة اللوحية والحواسيب، وتستمر بالعمل دون اتصال بالشبكة.'),
      note('Approval documents readiness only. It never authorizes operation, never bypasses interlocks and never replaces LOTO, work permits or the formal operating authorization of the plant.',
        'الاعتماد يوثّق الجاهزية فقط. لا يخوّل التشغيل، ولا يتجاوز أنظمة الحماية (Interlocks)، ولا يحل محل العزل والإقفال (LOTO) أو تصاريح العمل أو تخويل التشغيل الرسمي في المعمل.'),
    ],
  },
  {
    id: 'access', title: T('Getting access', 'الدخول إلى المنصة'),
    body: [
      who('Everyone', 'الجميع'),
      p('Open <b>https://kcp-coldrun-2026.web.app</b> in Chrome, Edge or Safari. The administrator adds you first; you then receive an e-mail to set your password.',
        'افتح <b dir="ltr">https://kcp-coldrun-2026.web.app</b> في متصفح Chrome أو Edge أو Safari. يضيفك مدير النظام أولاً، ثم يصلك بريد لتعيين كلمة المرور.'),
      img('login', 'The sign-in page', 'صفحة الدخول'),
      steps(
        T('<b>With a password:</b> open the e-mail "Reset your password", choose a password of at least 8 characters, then sign in with your e-mail and that password.', '<b>بكلمة مرور:</b> افتح بريد "إعادة تعيين كلمة المرور"، واختر كلمة مرور لا تقل عن 8 أحرف، ثم ادخل ببريدك وكلمة المرور.'),
        T('<b>With Google:</b> press <b>Sign in with Google</b> and choose the same e-mail the administrator added.', '<b>بحساب Google:</b> اضغط <b>الدخول بحساب Google</b> واختر البريد نفسه الذي أضافه المدير.'),
        T('<b>Forgot your password?</b> Type your e-mail on the sign-in page and press <b>Forgot password?</b>.', '<b>نسيت كلمة المرور؟</b> اكتب بريدك في صفحة الدخول واضغط <b>نسيت كلمة المرور؟</b>.'),
        T('Switch language at any time with the <b>العربية / English</b> button at the top.', 'بدّل اللغة في أي وقت بزر <b>العربية / English</b> في الأعلى.'),
      ),
      h('Install the app', 'تثبيت التطبيق'),
      steps(
        T('<b>Android / computer:</b> press <b>Install</b> in the pop-up that appears when you open the site.', '<b>أندرويد / الحاسوب:</b> اضغط <b>تثبيت</b> في النافذة التي تظهر عند فتح الموقع.'),
        T('<b>iPhone / iPad:</b> press the Share button in Safari, then <b>Add to Home Screen</b>.', '<b>آيفون / آيباد:</b> اضغط زر المشاركة في Safari ثم <b>إضافة إلى الشاشة الرئيسية</b>.'),
      ),
      img('phone-install', 'The install pop-up on an iPhone', 'نافذة التثبيت على الآيفون'),
      tip('No signal on site? Keep working. Your changes are kept on the device and sent automatically when the connection returns.', 'لا توجد تغطية في الموقع؟ تابع العمل. تُحفظ تغييراتك على الجهاز وتُرسل تلقائياً عند عودة الاتصال.'),
    ],
  },
  {
    id: 'roles', title: T('Roles', 'الأدوار'),
    body: [
      table([T('Role', 'الدور'), T('What they do', 'ما يقوم به')], [
        [T('System Administrator', 'مدير النظام'), T('Everything: users, devices, departments, settings, equipment, approval and archive; renames shutdowns and corrects their year; deletes inspections made by mistake; plan, usage and billing.', 'كل الصلاحيات: المستخدمون والأجهزة والأقسام والإعدادات والمعدات والاعتماد والأرشفة؛ وإعادة تسمية التوقفات وتصحيح سنتها؛ وحذف الفحوصات المنشأة بالخطأ؛ والخطة والاستخدام والدفع.')],
        [T('Cold Run Test Manager', 'مدير اختبار التشغيل البارد'), T('Sees every team. Approves or sends back inspections, closes the shutdown and archives, manages equipment, sees reports and the audit log, receives the completion reports.', 'يرى جميع الفرق. يعتمد الفحوصات أو يعيدها، ويغلق التوقف ويؤرشف، ويدير المعدات، ويطّلع على التقارير وسجل التدقيق، ويستلم تقارير الإنجاز.')],
        [T('Team Member', 'عضو الفريق'), T('Has a discipline (Mechanical, Electrical, Instrumentation or Production) and a department. Sees, starts and checks only the inspections of that discipline in that department, and does the corrective maintenance. No reports, settings or administration — the menu shows <b>My profile</b> instead of Settings.', 'له اختصاص (ميكانيك أو كهرباء أو سيطرة أو إنتاج) وقسم. يرى ويبدأ ويفحص فحوصات اختصاصه في قسمه فقط، وينفذ الصيانة التصحيحية. لا تقارير ولا إعدادات ولا إدارة — تظهر في القائمة <b>ملفي الشخصي</b> بدلاً من الإعدادات.')],
      ]),
      img('roles', 'Settings → Roles & privileges', 'الإعدادات ← الأدوار والصلاحيات'),
      img('member', 'What a team member sees: only their own work, and My profile instead of Settings', 'ما يراه عضو الفريق: عمله فقط، وملفي الشخصي بدلاً من الإعدادات'),
      p('The same limits are enforced by the security rules on the server, so they cannot be bypassed from a device. For example, an electrical engineer of Kiln 1 only sees and works on the electrical inspections of Kiln 1; a member without a department works on their discipline in every department.',
        'تفرض قواعد الحماية على الخادم الحدود نفسها، فلا يمكن تجاوزها من أي جهاز. فمثلاً مهندس الكهرباء في الفرن 1 يرى ويعمل على الفحوصات الكهربائية للفرن 1 فقط؛ أما العضو الذي ليس له قسم فيعمل على اختصاصه في جميع الأقسام.'),
    ],
  },
  {
    id: 'flow', title: T('The workflow', 'مسار العمل'),
    body: [
      p('Each inspection covers one piece of equipment and one discipline. There is one per equipment and discipline in each shutdown.', 'يغطي كل فحص معدة واحدة واختصاصاً واحداً. ولكل معدة واختصاص فحص واحد في كل توقف.'),
      table([T('Stage', 'المرحلة'), T('What happens', 'ما يحدث')], [
        [T('New Inspection', 'فحص جديد'), T('A team member (or the manager) starts it for an equipment. The title is the equipment name.', 'يبدؤه عضو الفريق (أو المدير) لمعدة. العنوان هو اسم المعدة.')],
        [T('Waiting in pool', 'بانتظار الفريق'), T('The team checks every part: OK or Not OK. Then presses Submit.', 'يفحص الفريق كل جزء: سليم أو غير سليم. ثم يضغط إرسال.')],
        [T('Active · Corrective maintenance', 'نشط · صيانة تصحيحية'), T('At least one part was Not OK. A work order number is required; the team repairs the part and marks it Fixed.', 'جزء واحد على الأقل غير سليم. رقم أمر العمل إلزامي؛ ويصلح الفريق الجزء ويؤشر "تم الإصلاح".')],
        [T('Active · Waiting approval', 'نشط · بانتظار الموافقة'), T('Everything is OK or fixed. The Cold Run Test Manager reviews it.', 'كل شيء سليم أو تم إصلاحه. يراجعه مدير اختبار التشغيل البارد.')],
        [T('Active · Approved', 'نشط · معتمد'), T('Approved. Management is notified and receives the Excel results.', 'معتمد. تُبلَّغ الإدارة ويصلها ملف النتائج (Excel).')],
        [T('Done', 'منجز'), T('When all inspections are approved, the manager closes the shutdown: everything moves to Done and the active count goes back to 0. The next shutdown keeps the same year until the administrator changes it.', 'عند اعتماد جميع الفحوصات يغلق المدير التوقف: ينتقل كل شيء إلى المنجز ويعود عدد الفحوصات النشطة إلى الصفر. ويحتفظ التوقف التالي بالسنة نفسها حتى يغيّرها مدير النظام.')],
      ]),
      img('dashboard', 'Dashboard: the plant banner, the shutdown, your pool, the active inspections and Done', 'لوحة المتابعة: شريط المعمل، والتوقف، وما ينتظر فريقك، والفحوصات النشطة، والمنجز'),
    ],
  },
  {
    id: 'pool', title: T('Waiting in your pool & starting an inspection', 'بانتظار فريقك وبدء الفحص'),
    body: [
      who('Team members', 'أعضاء الفريق'),
      p('<b>Waiting in your pool</b> shows everything for your team (discipline + department): inspections to check, Not OK parts to fix, and the equipment nobody has started yet.',
        'تعرض <b>بانتظار فريقك</b> كل ما يخص فريقك (الاختصاص + القسم): فحوصات للفحص، وأجزاء غير سليمة للإصلاح، والمعدات التي لم يبدأها أحد بعد.'),
      img('pool', 'Waiting in your pool, with the equipment not started yet', 'بانتظار فريقك، مع المعدات التي لم تبدأ بعد'),
      steps(
        T('Press <b>Start</b> next to an equipment — or use <b>New Inspection</b> and choose the equipment.', 'اضغط <b>ابدأ</b> بجانب المعدة — أو استخدم <b>فحص جديد</b> واختر المعدة.'),
        T('Your department and discipline are filled in for you; the title is the equipment name and the parts of your discipline are listed.', 'يُملأ قسمك واختصاصك تلقائياً؛ ويكون العنوان اسم المعدة وتُدرج أجزاء اختصاصك.'),
        T('Press <b>Create inspection</b>. If your team already started it, the existing one opens instead.', 'اضغط <b>إنشاء الفحص</b>. إذا كان فريقك قد بدأه، يُفتح الفحص الموجود بدلاً من ذلك.'),
      ),
      img('new', 'New Inspection', 'فحص جديد'),
    ],
  },
  {
    id: 'check', title: T('Checking the parts', 'فحص الأجزاء'),
    body: [
      who('Team members', 'أعضاء الفريق'),
      steps(
        T('For each part press <b>✓</b> (OK) or <b>✕</b> (Not OK).', 'لكل جزء اضغط <b>✓</b> (سليم) أو <b>✕</b> (غير سليم).'),
        T('Not OK asks for a short description of the problem. Add a photo with the camera button, then <b>Save as Not OK</b>.', 'غير سليم يطلب وصفاً قصيراً للمشكلة. أضف صورة بزر الكاميرا ثم <b>حفظ كغير سليم</b>.'),
        T('Chose wrongly? Tap the highlighted <b>✓</b> again to clear it. Tapping a highlighted <b>✕</b> asks first, because it removes the note and photo; use <b>Edit</b> to change only the note.', 'اخترت خطأً؟ اضغط <b>✓</b> المؤشَّر مرة أخرى لإلغائه. أما الضغط على <b>✕</b> المؤشَّر فيطلب التأكيد لأنه يحذف الملاحظة والصورة؛ استخدم <b>تعديل</b> لتغيير الملاحظة فقط.'),
        T('Colleagues of the same team can work on the same inspection; everything is saved as you go.', 'يمكن لزملاء الفريق العمل على الفحص نفسه؛ ويُحفظ كل شيء أولاً بأول.'),
        T('When every part is checked, press <b>Submit inspection</b>. With a Not OK part the platform asks for the <b>work order</b> number raised in the maintenance system (required), then the inspection goes to <b>Corrective maintenance</b>; otherwise to <b>Waiting approval</b>.', 'عند فحص جميع الأجزاء اضغط <b>إرسال الفحص</b>. إذا وُجد جزء غير سليم تطلب المنصة رقم <b>أمر العمل</b> الصادر من نظام الصيانة (إلزامي)، ثم ينتقل الفحص إلى <b>صيانة تصحيحية</b>؛ وإلا إلى <b>بانتظار الموافقة</b>.'),
      ),
      img('checked', 'Parts checked: one OK, one Not OK with its description and photo', 'أجزاء مفحوصة: جزء سليم وآخر غير سليم مع الوصف والصورة'),
      img('workorder', 'Submitting with a Not OK part: the work order number is required', 'الإرسال مع جزء غير سليم: رقم أمر العمل إلزامي'),
      tip('Add a photo to every Not OK part — it saves time for the repair and for the approval.', 'أضف صورة لكل جزء غير سليم — توفر الوقت على الإصلاح والاعتماد.'),
    ],
  },
  {
    id: 'corrective', title: T('Corrective maintenance', 'الصيانة التصحيحية'),
    body: [
      who('Team members', 'أعضاء الفريق'),
      steps(
        T('The inspection is in <b>Waiting in your pool</b> under <b>Corrective maintenance</b>, with its <b>work order</b> number at the top. Wrong number? Press <b>Edit</b> next to it (possible until the inspection leaves corrective maintenance).', 'يظهر الفحص في <b>بانتظار فريقك</b> تحت <b>صيانة تصحيحية</b>، ورقم <b>أمر العمل</b> في أعلاه. رقم خاطئ؟ اضغط <b>تعديل</b> بجانبه (ممكن حتى يخرج الفحص من الصيانة التصحيحية).'),
        T('After the repair, open the Not OK part and press <b>Mark fixed</b>. Write what was done and add an "after" photo.', 'بعد الإصلاح افتح الجزء غير السليم واضغط <b>تم الإصلاح</b>. اكتب ما تم وأضف صورة "بعد".'),
        T('When the last Not OK part is fixed, the inspection moves to <b>Waiting approval</b> automatically.', 'عند إصلاح آخر جزء غير سليم ينتقل الفحص تلقائياً إلى <b>بانتظار الموافقة</b>.'),
      ),
      img('corrective', 'Corrective maintenance: the problem and Mark fixed', 'الصيانة التصحيحية: المشكلة وزر تم الإصلاح'),
    ],
  },
  {
    id: 'approve', title: T('Approval', 'الاعتماد'),
    body: [
      who('Cold Run Test Manager, administrator', 'مدير اختبار التشغيل البارد ومدير النظام'),
      steps(
        T('<b>Waiting in your pool</b> (or Inspections → Active → Waiting approval) lists what needs you.', '<b>بانتظار فريقك</b> (أو الفحوصات ← نشط ← بانتظار الموافقة) تعرض ما ينتظرك.'),
        T('Open the inspection and review the parts, the problems, the fixes and the photos.', 'افتح الفحص وراجع الأجزاء والمشكلات والإصلاحات والصور.'),
        T('Press <b>Approve</b> (an optional comment), or <b>Send back</b> with a reason — it returns to the team\'s pool and they see your reason.', 'اضغط <b>اعتماد</b> (ملاحظة اختيارية)، أو <b>إعادة للفريق</b> مع ذكر السبب — فيعود إلى الفريق ويرون سببك.'),
        T('On approval the report recipients are notified in the app and, when the e-mail service is connected, receive the Excel results.', 'عند الاعتماد يُبلَّغ مستلمو التقارير داخل التطبيق، ويصلهم ملف النتائج (Excel) عند ربط خدمة البريد.'),
      ),
      img('approve', 'Approving an inspection', 'اعتماد فحص'),
    ],
  },
  {
    id: 'archive', title: T('Closing the shutdown & archiving', 'إغلاق التوقف والأرشفة'),
    body: [
      who('Cold Run Test Manager, administrator', 'مدير اختبار التشغيل البارد ومدير النظام'),
      p('The shutdown card on the Dashboard and Inspections shows how many inspections are approved. When <b>every</b> inspection of the shutdown is approved, the button <b>Close shutdown & archive</b> appears.',
        'تعرض بطاقة التوقف في لوحة المتابعة والفحوصات عدد الفحوصات المعتمدة. عندما تُعتمد <b>جميع</b> فحوصات التوقف يظهر زر <b>إغلاق التوقف والأرشفة</b>.'),
      steps(
        T('Press <b>Close shutdown & archive</b> and confirm.', 'اضغط <b>إغلاق التوقف والأرشفة</b> وأكّد.'),
        T('All approved inspections move to <b>Done</b>, the active count goes back to <b>0</b>, and the next shutdown starts with the <b>same year</b> — the administrator sets the new year and name by hand (<b>Edit</b> on the shutdown card).', 'تنتقل جميع الفحوصات المعتمدة إلى <b>المنجز</b>، ويعود عدد الفحوصات النشطة إلى <b>الصفر</b>، ويبدأ التوقف التالي <b>بالسنة نفسها</b> — ويحدد مدير النظام السنة الجديدة والاسم يدوياً (<b>تعديل</b> في بطاقة التوقف).'),
        T('Done inspections stay available: Inspections → Done, filter by shutdown, export to Excel.', 'تبقى الفحوصات المنجزة متاحة: الفحوصات ← منجز، صفِّ حسب التوقف، وصدّر إلى Excel.'),
      ),
      tip('Administrators can rename a shutdown or project, or correct its year: <b>Edit</b> on the shutdown card, or <b>Settings → Shutdowns & projects</b> for past ones. The new name appears on all its inspections, reports and exports.', 'يستطيع مدير النظام إعادة تسمية توقف أو مشروع أو تصحيح سنته: <b>تعديل</b> في بطاقة التوقف، أو <b>الإعدادات ← التوقفات والمشاريع</b> للسابقة منها. يظهر الاسم الجديد على جميع فحوصاته وتقاريره وملفات التصدير.'),
      img('archive', 'Everything approved: the archive button on the shutdown card', 'كل شيء معتمد: زر الأرشفة في بطاقة التوقف'),
      img('done', 'Inspections → Done', 'الفحوصات ← منجز'),
    ],
  },
  {
    id: 'equipment', title: T('Equipment and parts (CSV)', 'المعدات والأجزاء (CSV)'),
    body: [
      who('Cold Run Test Manager, administrator', 'مدير اختبار التشغيل البارد ومدير النظام'),
      steps(
        T('<b>Equipment</b> → <b>Download CSV</b>. You get the current list (or an example when empty).', '<b>المعدات</b> ← <b>تنزيل CSV</b>. تحصل على القائمة الحالية (أو مثال عند خلوها).'),
        T('Open it in Excel and fill <b>one row per part</b>: Department, Equipment, Part type, Part. Part type is Mechanical, Electrical, Instrumentation or Production (Arabic names work too).', 'افتحه في Excel واملأ <b>صفاً لكل جزء</b>: القسم، المعدة، نوع الجزء، الجزء. نوع الجزء: Mechanical أو Electrical أو Instrumentation أو Production (والأسماء العربية تعمل أيضاً).'),
        T('Save as <b>CSV UTF-8</b> and press <b>Upload CSV</b>.', 'احفظه بصيغة <b>CSV UTF-8</b> واضغط <b>رفع CSV</b>.'),
        T('Check the preview — new and updated equipment, and any rows with problems — then press <b>Import</b>.', 'راجع المعاينة — المعدات الجديدة والمحدّثة وأي صفوف فيها مشكلات — ثم اضغط <b>استيراد</b>.'),
      ),
      table([T('Department', 'القسم'), T('Equipment', 'المعدة'), T('Part type', 'نوع الجزء'), T('Part', 'الجزء')], [
        [T('Kiln', 'Kiln'), T('Kiln main drive', 'Kiln main drive'), T('Electrical', 'Electrical'), T('Main motor', 'Main motor')],
        [T('Kiln', 'Kiln'), T('Kiln main drive', 'Kiln main drive'), T('Mechanical', 'Mechanical'), T('Gearbox', 'Gearbox')],
        [T('Raw Mill', 'Raw Mill'), T('Raw mill separator', 'Raw mill separator'), T('Instrumentation', 'Instrumentation'), T('Speed sensor', 'Speed sensor')],
      ]),
      img('csv', 'Upload preview', 'معاينة الرفع'),
      note('Equipment in the file get exactly the parts listed in it; equipment not in the file are not changed. Uploading the same file again updates — it never duplicates.', 'المعدات الموجودة في الملف تأخذ الأجزاء المدرجة فيه بالضبط؛ ولا تتغير المعدات غير الموجودة فيه. رفع الملف نفسه مرة أخرى يحدّث — ولا يكرر.'),
      p('For one change, press the pencil next to an equipment: name, department and one part per line for each discipline.', 'لتعديل واحد اضغط القلم بجانب المعدة: الاسم والقسم وجزء واحد في كل سطر لكل اختصاص.'),
      img('equipment', 'Equipment by department', 'المعدات حسب القسم'),
    ],
  },
  {
    id: 'reports', title: T('Reports and Excel', 'التقارير وملفات Excel'),
    body: [
      who('Cold Run Test Manager, administrator', 'مدير اختبار التشغيل البارد ومدير النظام'),
      steps(
        T('Open <b>Reports</b> and choose: overview by department, by discipline, Not OK parts & corrective maintenance, equipment not started, all inspections, or work per person.', 'افتح <b>التقارير</b> واختر: نظرة عامة حسب القسم، حسب الاختصاص، الأجزاء غير السليمة والصيانة التصحيحية، المعدات التي لم تبدأ، كل الفحوصات، أو العمل لكل شخص.'),
        T('Choose the shutdown and any filters (department, equipment, discipline, status).', 'اختر التوقف وأي تصفية (القسم، المعدة، الاختصاص، الحالة).'),
        T('Press <b>Export Excel</b>. The file holds exactly what you see, with the filters written at the top.', 'اضغط <b>تصدير Excel</b>. يحتوي الملف ما تراه بالضبط مع كتابة التصفية في أعلاه.'),
      ),
      img('reports', 'Reports', 'التقارير'),
      p('Every inspection also has <b>Export Excel</b> (summary and parts) and <b>Inspection report (PDF)</b> for printing and signatures.', 'ولكل فحص أيضاً <b>تصدير Excel</b> (الملخص والأجزاء) و<b>تقرير الفحص (PDF)</b> للطباعة والتوقيع.'),
    ],
  },
  {
    id: 'users', title: T('People and access', 'الأشخاص والصلاحيات'),
    body: [
      who('Administrators', 'مدراء النظام'),
      steps(
        T('<b>Users</b> → <b>Add user</b>: name, e-mail and role. For a <b>Team Member</b> also choose the discipline and the department.', '<b>المستخدمون</b> ← <b>إضافة مستخدم</b>: الاسم والبريد والدور. ولـ<b>عضو الفريق</b> اختر الاختصاص والقسم أيضاً.'),
        T('Leave the password empty: they receive an e-mail to set it, or simply use <b>Sign in with Google</b> with that e-mail.', 'اترك كلمة المرور فارغة: يصلهم بريد لتعيينها، أو يدخلون مباشرة بـ<b>الدخول بحساب Google</b> بالبريد نفسه.'),
        T('Change a role, discipline or department with the pencil. When someone leaves, press <b>Deactivate</b> — their history stays.', 'غيّر الدور أو الاختصاص أو القسم بالقلم. عند مغادرة شخص اضغط <b>تعطيل</b> — يبقى سجله.'),
        T('<b>Devices</b>: revoke a lost or shared phone and it is signed out immediately.', '<b>الأجهزة</b>: ألغِ صلاحية هاتف مفقود أو مشترك فيُسجَّل خروجه فوراً.'),
        T('<b>Departments</b> (Settings): rename in English and Arabic, change the order, add a department, or retire one — retired departments disappear from pools and menus but their history stays.', '<b>الأقسام</b> (الإعدادات): غيّر الاسم بالعربية والإنجليزية، ورتّبها، وأضف قسماً، أو أوقف قسماً — تختفي الأقسام الموقوفة من القوائم ومن عمل الفرق ويبقى سجلها.'),
        T('<b>Delete an inspection</b> made by mistake: open it and press <b>Delete</b> (administrators only). Its photos are removed too; the deletion stays in the audit log and cannot be undone.', '<b>حذف فحص</b> أُنشئ بالخطأ: افتحه واضغط <b>حذف</b> (لمدير النظام فقط). تُحذف صوره أيضاً؛ ويبقى الحذف مسجلاً في سجل التدقيق ولا يمكن التراجع عنه.'),
      ),
      img('user-add', 'Adding a team member', 'إضافة عضو فريق'),
    ],
  },
  {
    id: 'settings', title: T('Settings, report e-mails and backup', 'الإعدادات وبريد التقارير والنسخ الاحتياطي'),
    body: [
      who('Administrators', 'مدراء النظام'),
      steps(
        T('<b>Who receives the reports:</b> all managers and administrators (default), or only the people you tick, plus extra e-mail addresses.', '<b>من يستلم التقارير:</b> كل المدراء ومدراء النظام (افتراضياً)، أو فقط من تحددهم، إضافة إلى عناوين بريد أخرى.'),
        T('<b>Backup e-mail:</b> the weekly Google Drive backup folder is shared with it.', '<b>بريد النسخ الاحتياطي:</b> يُشارك معه مجلد النسخ الأسبوعي على Google Drive.'),
        T('<b>E-mail & backup service:</b> paste the service address once and press <b>Test</b> — a test e-mail is sent to you and the list of recipients is shown.', '<b>خدمة البريد والنسخ الاحتياطي:</b> الصق عنوان الخدمة مرة واحدة واضغط <b>اختبار</b> — يصلك بريد اختبار وتظهر قائمة المستلمين.'),
      ),
      h('Free plan, usage alerts and billing', 'الخطة المجانية وتنبيهات الاستخدام والدفع'),
      p('The platform runs on the free Firebase plan: 50,000 loads, 20,000 saves and 20,000 deletes per day (reset at about 10–11 am Baghdad time) and 1 GB of data. <b>Settings → Plan & billing</b> shows today\'s use. Administrators receive an e-mail at <b>25%, 50%, 75%, 90% and 100%</b> of any daily limit, of the stored data and of the daily e-mail quota.',
        'تعمل المنصة على خطة Firebase المجانية: 50,000 تحميل و20,000 حفظ و20,000 حذف يومياً (تبدأ من جديد نحو الساعة 10–11 صباحاً بتوقيت بغداد) و1 غيغابايت من البيانات. تعرض <b>الإعدادات ← الخطة والدفع</b> استخدام اليوم. ويصل لمديري النظام بريد عند <b>25% و50% و75% و90% و100%</b> من أي حد يومي ومن مساحة البيانات ومن حصة البريد اليومية.'),
      steps(
        T('<b>Add payment / upgrade plan</b> opens the Firebase console: <b>Modify plan → Blaze</b>, add the card and set a budget alert. The free amounts stay included; only use above them is charged.', '<b>إضافة وسيلة دفع / ترقية الخطة</b> يفتح لوحة Firebase: <b>Modify plan ← Blaze</b>، أضف البطاقة وحدّد تنبيه ميزانية. تبقى الكميات المجانية مشمولة ويُحتسب فقط ما يزيد عليها.'),
        T('<b>View usage</b> opens Firebase\'s own usage page.', '<b>عرض الاستخدام</b> يفتح صفحة الاستخدام في Firebase.'),
      ),
      img('billing', 'Settings → Plan & billing with today\'s use', 'الإعدادات ← الخطة والدفع مع استخدام اليوم'),
      img('report-settings', 'Reports, e-mail and backup settings', 'إعدادات التقارير والبريد والنسخ الاحتياطي'),
      h('One-time setup of the e-mail & backup service', 'الإعداد لمرة واحدة لخدمة البريد والنسخ الاحتياطي'),
      steps(
        T('Open <b>script.google.com</b> → <b>New project</b>.', 'افتح <b dir="ltr">script.google.com</b> ← <b>مشروع جديد</b>.'),
        T('Paste <b>Code.gs</b> from <b>platform/email-backup-service</b>. In Project settings tick "Show appsscript.json" and replace it with the file of the same name.', 'الصق <b>Code.gs</b> من <b dir="ltr">platform/email-backup-service</b>. في إعدادات المشروع فعّل "Show appsscript.json" واستبدله بالملف الذي يحمل الاسم نفسه.'),
        T('Set <b>WEB_API_KEY</b> at the top of Code.gs (the web API key of the Firebase app). Choose <b>setup</b> → <b>Run</b> and allow the permissions — this schedules the weekly backup (Fridays 02:00) and the usage check (every 30 minutes).', 'اكتب <b>WEB_API_KEY</b> في أعلى Code.gs (مفتاح الويب لتطبيق Firebase). اختر <b>setup</b> ← <b>Run</b> واسمح بالأذونات — هذا يجدول النسخ الأسبوعي (الجمعة 02:00) وفحص الاستخدام (كل 30 دقيقة).'),
        T('<b>Deploy</b> → <b>New deployment</b> → <b>Web app</b>, Execute as <b>Me</b>, access <b>Anyone</b>. Copy the /exec URL into Settings and press Test.', '<b>Deploy</b> ← <b>New deployment</b> ← <b>Web app</b>، التنفيذ باسم <b>Me</b> والوصول <b>Anyone</b>. انسخ رابط /exec إلى الإعدادات واضغط اختبار.'),
      ),
    ],
  },
  {
    id: 'help', title: T('Help inside the platform', 'المساعدة داخل المنصة'),
    body: [
      p('<b>Guide & Tips</b> in the menu explains every step for your role, and offers this guide as a PDF. Short tips appear at the top of the main pages; close one with ✕.',
        'يشرح <b>الدليل والنصائح</b> في القائمة كل خطوة حسب دورك، ويوفر هذا الدليل بصيغة PDF. تظهر نصائح قصيرة أعلى الصفحات الرئيسية؛ أغلق أياً منها بـ ✕.'),
      img('guide', 'Guide & Tips', 'الدليل والنصائح'),
    ],
  },
  {
    id: 'practice', title: T('Good practice', 'الممارسات الجيدة'),
    body: [
      steps(
        T('Use your own account; on shared tablets sign out at the end of the shift.', 'استخدم حسابك الخاص؛ وعلى الأجهزة المشتركة سجّل الخروج في نهاية الوجبة.'),
        T('Describe problems clearly and add photos — they are signed with your name and time.', 'صف المشكلات بوضوح وأضف الصور — كل شيء يُوقَّع باسمك والوقت.'),
        T('Back online after working without signal? Wait for the sync icon to disappear before closing the app.', 'عدت للاتصال بعد العمل دون تغطية؟ انتظر اختفاء أيقونة المزامنة قبل إغلاق التطبيق.'),
        T('Managers: close the shutdown only when the cold run is really complete — archiving cannot be undone.', 'المدراء: أغلقوا التوقف فقط عند اكتمال التشغيل البارد فعلاً — لا يمكن التراجع عن الأرشفة.'),
        T('To stay on the free plan: delete inspections made by mistake (photos take most of the space) and act on the usage e-mails at 75% and 90%.', 'للبقاء على الخطة المجانية: احذفوا الفحوصات المنشأة بالخطأ (الصور تأخذ معظم المساحة) وتصرّفوا عند وصول تنبيهات الاستخدام عند 75% و90%.'),
      ),
      note('Starting equipment always follows the plant\'s LOTO, permit and operating-authorization procedures.', 'تشغيل المعدات يتبع دائماً إجراءات العزل والإقفال والتصاريح وتخويل التشغيل في المعمل.'),
    ],
  },
  {
    id: 'faq', title: T('Questions and problems', 'أسئلة ومشكلات'),
    body: [
      table([T('Problem', 'المشكلة'), T('What to do', 'الحل')], [
        [T('"Your account has no profile yet"', '"لا يوجد ملف لحسابك بعد"'), T('Ask the administrator to add you with the exact e-mail you use.', 'اطلب من مدير النظام إضافتك بالبريد نفسه الذي تستخدمه.')],
        [T('I cannot see any equipment to start', 'لا أرى أي معدة لأبدأها'), T('Your department has no equipment with parts of your discipline yet, or your role/department is not set. Ask the manager.', 'لا توجد بعد معدات في قسمك لها أجزاء من اختصاصك، أو لم يُحدد دورك/قسمك. اسأل المدير.')],
        [T('"This inspection already exists"', '"هذا الفحص موجود مسبقاً"'), T('Your team started it already — it opens so you can continue.', 'بدأه فريقك مسبقاً — يُفتح لتتابع العمل.')],
        [T('It asks for a work order', 'يطلب رقم أمر العمل'), T('Some parts are Not OK: enter the work order number raised for the repair. Without it the inspection cannot go to corrective maintenance.', 'بعض الأجزاء غير سليمة: أدخل رقم أمر العمل الصادر للإصلاح. بدونه لا ينتقل الفحص إلى الصيانة التصحيحية.')],
        [T('Submit is greyed out', 'زر الإرسال غير مفعّل'), T('Some parts are still not checked; the bar at the bottom says how many.', 'بعض الأجزاء لم تُفحص بعد؛ يوضح الشريط أسفل الصفحة عددها.')],
        [T('The archive button does not appear', 'زر الأرشفة لا يظهر'), T('Not every inspection of the shutdown is approved yet.', 'لم تُعتمد جميع فحوصات التوقف بعد.')],
        [T('CSV rows were skipped', 'تم تخطي صفوف في ملف CSV'), T('The preview says why: unknown department, empty equipment name or unknown part type.', 'توضح المعاينة السبب: قسم غير معروف، أو اسم معدة فارغ، أو نوع جزء غير معروف.')],
        [T('A wrong ✓ or ✕', 'اخترت ✓ أو ✕ خطأً'), T('Tap the highlighted button again to clear the part, then choose again.', 'اضغط الزر المؤشَّر مرة أخرى لإلغاء الجزء ثم اختر من جديد.')],
        [T('I do not see Reports or Settings', 'لا أرى التقارير أو الإعدادات'), T('Team members see only their own work; reports and settings are for managers and administrators. Your own details are under <b>My profile</b>.', 'يرى أعضاء الفريق عملهم فقط؛ التقارير والإعدادات للمدراء ومديري النظام. بياناتك الشخصية في <b>ملفي الشخصي</b>.')],
        [T('The year of the new shutdown is wrong', 'سنة التوقف الجديد غير صحيحة'), T('The administrator presses <b>Edit</b> on the shutdown card and sets the name and year.', 'يضغط مدير النظام <b>تعديل</b> في بطاقة التوقف ويحدد الاسم والسنة.')],
        [T('A usage alert e-mail arrived', 'وصل بريد تنبيه الاستخدام'), T('Check Settings → Plan & billing. At 90–100% either wait for the daily reset or add a payment method.', 'راجع الإعدادات ← الخطة والدفع. عند 90–100% إما انتظر بدء اليوم الجديد أو أضف وسيلة دفع.')],
        [T('No password e-mail', 'لم يصل بريد كلمة المرور'), T('Check spam, use "Forgot password?", or ask the administrator to resend it.', 'تحقق من البريد غير المرغوب، أو استخدم "نسيت كلمة المرور؟"، أو اطلب من المدير إعادة الإرسال.')],
      ]),
    ],
  },
];
