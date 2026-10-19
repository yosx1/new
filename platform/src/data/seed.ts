/**
 * Example master data loaded on first setup. These are NOT approved engineering acceptance criteria:
 * every checklist item, method and limit must be confirmed against plant procedures and manuals.
 */
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { ChecklistItemDef, ChecklistSection, Discipline, Settings, UserProfile } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  plantName: { en: 'Karbala Cement Plant', ar: 'معمل سمنت كربلاء' },
  shifts: ['A (07:00–15:00)', 'B (15:00–23:00)', 'C (23:00–07:00)'],
  maintenanceTypes: ['Preventive', 'Corrective', 'Breakdown', 'Overhaul', 'Annual shutdown'],
  equipmentCategories: [
    'Crusher', 'Feeder', 'Belt conveyor', 'Bucket elevator', 'Mill', 'Separator', 'Fan',
    'Kiln', 'Main drive', 'Hydraulic system', 'Cooler', 'Grate drive', 'Packer', 'Rotary valve',
    'Compressor', 'Pump', 'Water system',
  ],
  overrideRoles: ['manager', 'admin'],
  defectTargetDays: { critical: 1, high: 3, medium: 7, low: 14 },
};

const DEPARTMENTS = [
  ['QRY', 'Quarry and Crushing', 'المقلع والتكسير'],
  ['RMH', 'Raw Material Handling', 'مناولة المواد الأولية'],
  ['RML', 'Raw Mill', 'طاحونة المواد الأولية'],
  ['KLN', 'Kiln', 'الفرن'],
  ['CLR', 'Clinker Cooler', 'مبرد الكلنكر'],
  ['CML', 'Cement Mills', 'طواحين السمنت'],
  ['PCK', 'Packing and Loading', 'التعبئة والتحميل'],
  ['UTL', 'Utilities', 'الخدمات'],
] as const;

type Eq = [tag: string, dept: string, en: string, ar: string, category: string, line: string, parent?: string];
const EQUIPMENT: Eq[] = [
  ['QRY-CR01', 'QRY', 'Primary crusher', 'الكسارة الرئيسية', 'Crusher', 'Crushing line 1'],
  ['QRY-FD01', 'QRY', 'Apron feeder', 'المغذي الصفائحي', 'Feeder', 'Crushing line 1'],
  ['QRY-BC01', 'QRY', 'Crusher discharge conveyor', 'ناقل تفريغ الكسارة', 'Belt conveyor', 'Crushing line 1'],
  ['RMH-BC10', 'RMH', 'Stockpile belt conveyor', 'ناقل الخزن الحزامي', 'Belt conveyor', 'Raw material transport'],
  ['RMH-BE01', 'RMH', 'Raw meal bucket elevator', 'الرافع القادوسي للمواد الأولية', 'Bucket elevator', 'Raw material transport'],
  ['RML-ML01', 'RML', 'Raw mill', 'طاحونة المواد الأولية', 'Mill', 'Raw mill system'],
  ['RML-SP01', 'RML', 'Raw mill separator', 'فاصل طاحونة المواد الأولية', 'Separator', 'Raw mill system', 'RML-ML01'],
  ['RML-FN01', 'RML', 'Raw mill ID fan', 'مروحة السحب لطاحونة المواد', 'Fan', 'Raw mill system'],
  ['KLN-KL01', 'KLN', 'Rotary kiln', 'الفرن الدوار', 'Kiln', 'Kiln line'],
  ['KLN-MD01', 'KLN', 'Kiln main drive', 'المحرك الرئيسي للفرن', 'Main drive', 'Kiln line', 'KLN-KL01'],
  ['KLN-HY01', 'KLN', 'Kiln hydraulic thrust system', 'منظومة الدفع الهيدروليكي للفرن', 'Hydraulic system', 'Kiln line', 'KLN-KL01'],
  ['CLR-CL01', 'CLR', 'Grate cooler', 'المبرد الشبكي', 'Cooler', 'Cooler line'],
  ['CLR-GD01', 'CLR', 'Cooler grate drive', 'محرك شبكة المبرد', 'Grate drive', 'Cooler line', 'CLR-CL01'],
  ['CLR-FN05', 'CLR', 'Cooling fan 5', 'مروحة التبريد 5', 'Fan', 'Cooler line', 'CLR-CL01'],
  ['CML-ML01', 'CML', 'Cement mill 1', 'طاحونة السمنت 1', 'Mill', 'Cement mill 1'],
  ['CML-SP01', 'CML', 'Cement mill 1 separator', 'فاصل طاحونة السمنت 1', 'Separator', 'Cement mill 1', 'CML-ML01'],
  ['CML-MD01', 'CML', 'Cement mill 1 drive', 'محرك طاحونة السمنت 1', 'Main drive', 'Cement mill 1', 'CML-ML01'],
  ['PCK-PK01', 'PCK', 'Rotary packer 1', 'ماكنة التعبئة الدوارة 1', 'Packer', 'Packing line 1'],
  ['PCK-RV01', 'PCK', 'Rotary valve', 'الصمام الدوار', 'Rotary valve', 'Packing line 1'],
  ['PCK-BC01', 'PCK', 'Truck loading conveyor', 'ناقل تحميل الشاحنات', 'Belt conveyor', 'Packing line 1'],
  ['UTL-AC01', 'UTL', 'Plant air compressor 1', 'ضاغط الهواء 1', 'Compressor', 'Compressed air'],
  ['UTL-PM01', 'UTL', 'Cooling water pump 1', 'مضخة ماء التبريد 1', 'Pump', 'Water system'],
  ['UTL-WS01', 'UTL', 'Water treatment system', 'منظومة معالجة المياه', 'Water system', 'Water system'],
];

let n = 0;
const it = (en: string, ar: string, o: Partial<ChecklistItemDef> = {}): ChecklistItemDef => ({
  id: 'i' + (++n).toString(36), label: { en, ar }, mandatory: true, critical: false, measure: null, ...o,
});
const sec = (id: string, discipline: Discipline, stage: string, en: string, ar: string, items: ChecklistItemDef[]): ChecklistSection =>
  ({ id, discipline, stage, title: { en, ar }, items });

const prep = () => sec('prep', 'production', 'Prerequisites', 'Prerequisites & authorization', 'المتطلبات المسبقة والتخويل', [
  it('Confirm maintenance work order is completed and signed', 'التأكد من إكمال أمر عمل الصيانة وتوقيعه', { critical: true, procedureRef: 'SOP-CR-01' }),
  it('Confirm LOTO removal is coordinated with all teams', 'التأكد من تنسيق رفع أقفال العزل (LOTO) مع جميع الفرق', { critical: true, procedureRef: 'SOP-SAF-02' }),
  it('Confirm permit / authorization for Cold Run test', 'التأكد من وجود تصريح / تخويل لاختبار الـ Cold Run', { critical: true }),
  it('Area cleared of personnel, tools and temporary materials', 'إخلاء المنطقة من الأشخاص والأدوات والمواد المؤقتة', { photoRequired: true }),
]);

const mech = (extra: ChecklistItemDef[] = []) => sec('mech', 'mechanical', 'Inspection', 'Mechanical inspection', 'الفحص الميكانيكي', [
  it('Confirm completion of maintenance activities', 'التأكد من إكمال أعمال الصيانة'),
  it('Tools, temporary materials and maintenance debris removed', 'إزالة الأدوات والمواد المؤقتة ومخلفات الصيانة'),
  it('Lubrication system and oil levels inspected', 'فحص منظومة التزييت ومستويات الزيت', { photoRequired: true, procedureRef: 'MAN-LUB' }),
  it('Coupling and shaft alignment within approved tolerance', 'استقامة الـ Coupling والعمود ضمن السماحية المعتمدة', { critical: true, measure: { unit: 'mm', min: null, max: null } }),
  it('Guards, covers, fasteners and connections inspected', 'فحص الواقيات والأغطية والبراغي والوصلات', { critical: true }),
  it('Free movement verified, no mechanical obstruction', 'التحقق من حرية الحركة وعدم وجود عوائق ميكانيكية'),
  it('Bearings and relevant mechanical components inspected', 'فحص المحامل والأجزاء الميكانيكية ذات العلاقة'),
  ...extra,
  it('Required maintenance records are available', 'توفر سجلات الصيانة المطلوبة', { mandatory: false }),
]);

const elec = () => sec('elec', 'electrical', 'Inspection', 'Electrical inspection', 'الفحص الكهربائي', [
  it('Motor and cable installation ready', 'جاهزية تنصيب المحرك والكابلات'),
  it('Electrical connections and terminations inspected', 'فحص التوصيلات والنهايات الكهربائية'),
  it('Grounding verified per applicable requirements', 'التحقق من التأريض وفق المتطلبات', { critical: true }),
  it('Motor insulation resistance recorded', 'تسجيل مقاومة عزل المحرك', { measure: { unit: 'MΩ', min: null, max: null } }),
  it('Breaker and control circuit ready', 'جاهزية القاطع ودائرة السيطرة'),
  it('Protection devices and electrical interlocks ready', 'جاهزية أجهزة الحماية والـ Interlocks الكهربائية', { critical: true }),
  it('Motor rotation verified under approved test procedure', 'التحقق من اتجاه دوران المحرك وفق إجراء الاختبار المعتمد', { naReasonRequired: true }),
  it('Electrical test results documented', 'توثيق نتائج الاختبارات الكهربائية', { mandatory: false }),
]);

const inst = () => sec('inst', 'instrumentation', 'Inspection', 'Instrumentation & Control', 'السيطرة والأجهزة الدقيقة', [
  it('Calibration status of relevant instruments verified', 'التحقق من حالة معايرة الأجهزة ذات العلاقة'),
  it('Signal availability confirmed at the DCS', 'التأكد من توفر الإشارات في الـ DCS'),
  it('Required alarms and interlocks verified', 'التحقق من الإنذارات والـ Interlocks المطلوبة', { critical: true }),
  it('Start / stop indications checked', 'فحص مؤشرات التشغيل والإيقاف'),
  it('Control logic and permissive conditions verified', 'التحقق من منطق السيطرة وشروط السماح (Permissives)'),
  it('Emergency shutdown functions tested per procedure', 'اختبار وظائف الإيقاف الطارئ وفق الإجراء', { critical: true }),
]);

const run = (extra: ChecklistItemDef[] = []) => sec('run', 'production', 'Cold Run', 'Cold Run operational test', 'اختبار التشغيل البارد (Cold Run)', [
  it('Local and remote operation tested where applicable', 'اختبار التشغيل المحلي والبعيد حيثما ينطبق', { naReasonRequired: true }),
  it('Operating sequence verified', 'التحقق من تسلسل التشغيل'),
  it('No abnormal vibration, noise or mechanical behaviour', 'عدم وجود اهتزاز أو صوت أو سلوك ميكانيكي غير طبيعي', { critical: true }),
  it('Motor current recorded', 'تسجيل تيار المحرك', { measure: { unit: 'A', min: null, max: null } }),
  it('Bearing temperature recorded', 'تسجيل درجة حرارة المحامل', { measure: { unit: '°C', min: null, max: null } }),
  it('Vibration recorded', 'تسجيل الاهتزاز', { measure: { unit: 'mm/s', min: null, max: null } }),
  ...extra,
  it('Test duration recorded', 'تسجيل مدة الاختبار', { measure: { unit: 'min', min: null, max: null } }),
  it('Final test outcome documented', 'توثيق النتيجة النهائية للاختبار', { critical: true }),
]);

function templates() {
  n = 0;
  return [
    {
      code: 'TPL-KDRV', name: { en: 'Kiln / mill main drive – Cold Run', ar: 'المحرك الرئيسي للفرن / الطاحونة – Cold Run' },
      equipmentCategories: ['Main drive'], maintenanceTypes: [],
      requiredApprovals: ['mechanical', 'electrical', 'instrumentation', 'production'] as Discipline[],
      sections: [prep(), mech([
        it('Girth gear and pinion contact / backlash checked', 'فحص تلامس وخلوص الترس الحلقي والـ Pinion', { critical: true, measure: { unit: 'mm', min: null, max: null } }),
        it('Main gearbox oil level and filters checked', 'فحص مستوى زيت الجيربوكس الرئيسي والفلاتر'),
        it('Auxiliary (barring) drive engagement verified', 'التحقق من تعشيق المحرك المساعد (Barring drive)', { critical: true }),
      ]), elec(), inst(), run([
        it('Gearbox oil pressure recorded', 'تسجيل ضغط زيت الجيربوكس', { measure: { unit: 'bar', min: null, max: null } }),
      ])],
    },
    {
      code: 'TPL-ROT', name: { en: 'Rotating equipment (fan, mill, separator, crusher) – Cold Run', ar: 'المعدات الدوارة (مروحة، طاحونة، فاصل، كسارة) – Cold Run' },
      equipmentCategories: ['Fan', 'Mill', 'Separator', 'Crusher', 'Feeder', 'Packer', 'Rotary valve', 'Grate drive', 'Cooler', 'Kiln'],
      maintenanceTypes: [], requiredApprovals: ['mechanical', 'electrical', 'production'] as Discipline[],
      sections: [prep(), mech(), elec(), inst(), run()],
    },
    {
      code: 'TPL-CONV', name: { en: 'Belt conveyor / bucket elevator – Cold Run', ar: 'الناقل الحزامي / الرافع القادوسي – Cold Run' },
      equipmentCategories: ['Belt conveyor', 'Bucket elevator'], maintenanceTypes: [],
      requiredApprovals: ['mechanical', 'electrical', 'production'] as Discipline[],
      sections: [prep(), mech([
        it('Belt tracking and tension checked', 'فحص مسار الحزام وشدّه'),
        it('Pull-cord and belt-sway switches tested', 'اختبار مفاتيح حبل السحب وانحراف الحزام', { critical: true }),
        it('Idlers, pulleys and scrapers inspected', 'فحص البكرات والطارات والكاشطات'),
      ]), elec(), run()],
    },
    {
      code: 'TPL-COMP', name: { en: 'Compressor – Cold Run', ar: 'الضاغط – Cold Run' },
      equipmentCategories: ['Compressor'], maintenanceTypes: [],
      requiredApprovals: ['mechanical', 'electrical', 'instrumentation'] as Discipline[],
      sections: [prep(), mech([
        it('Safety valve tag and certification valid', 'صلاحية بطاقة وشهادة صمام الأمان', { critical: true }),
        it('Air filters and separators inspected', 'فحص فلاتر الهواء والفواصل'),
      ]), elec(), inst(), run([
        it('Discharge pressure recorded', 'تسجيل ضغط التصريف', { measure: { unit: 'bar', min: null, max: null } }),
      ])],
    },
    {
      code: 'TPL-PUMP', name: { en: 'Pump / water system – Cold Run', ar: 'المضخة / منظومة المياه – Cold Run' },
      equipmentCategories: ['Pump', 'Water system'], maintenanceTypes: [],
      requiredApprovals: ['mechanical', 'electrical'] as Discipline[],
      sections: [prep(), mech([it('Mechanical seal / gland checked for leakage', 'فحص الحشوة الميكانيكية للتسريب')]), elec(), run()],
    },
    {
      code: 'TPL-HYD', name: { en: 'Hydraulic system – Cold Run', ar: 'المنظومة الهيدروليكية – Cold Run' },
      equipmentCategories: ['Hydraulic system'], maintenanceTypes: [],
      requiredApprovals: ['mechanical', 'electrical', 'instrumentation'] as Discipline[],
      sections: [prep(), mech([
        it('Hydraulic oil level and cleanliness checked', 'فحص مستوى ونظافة الزيت الهيدروليكي'),
        it('Hoses, fittings and accumulators inspected', 'فحص الخراطيم والوصلات والمراكم', { critical: true }),
      ]), elec(), inst(), run([
        it('System pressure recorded', 'تسجيل ضغط المنظومة', { measure: { unit: 'bar', min: null, max: null } }),
      ])],
    },
  ];
}

const DOCS = [
  ['procedure', 'Cold Run procedure after maintenance', 'إجراء التشغيل البارد بعد الصيانة', 'SOP-CR-01'],
  ['safety', 'Lockout / Tagout (LOTO) procedure', 'إجراء العزل والتأشير (LOTO)', 'SOP-SAF-02'],
  ['instruction', 'Lubrication inspection instruction', 'تعليمات فحص التزييت', 'MAN-LUB'],
  ['criteria', 'Equipment acceptance criteria register', 'سجل معايير قبول المعدات', 'CRT-01'],
];

/** Writes example master data. Safe to call once after first setup. */
export async function seedExampleData(user: UserProfile) {
  const batch = writeBatch(db);
  const by = { createdBy: user.id, createdAt: serverTimestamp() };
  batch.set(doc(db, 'config', 'settings'), { ...DEFAULT_SETTINGS, updatedAt: serverTimestamp(), updatedBy: user.id });
  DEPARTMENTS.forEach(([code, en, ar], i) => {
    batch.set(doc(db, 'departments', code), { code, name: { en, ar }, order: i + 1, active: true, ...by });
  });
  const tpls = templates();
  const tagToTemplate = (category: string) => tpls.find(t => t.equipmentCategories.includes(category))?.code;
  for (const [tag, dept, en, ar, category, line, parent] of EQUIPMENT) {
    const tpl = tagToTemplate(category);
    batch.set(doc(db, 'equipment', tag), {
      tag, departmentId: dept, name: { en, ar }, category, line, parentId: parent ?? null,
      location: '', manufacturer: '', model: '', templateIds: tpl ? [tpl] : [], active: true, ...by,
    });
  }
  for (const t of tpls) {
    const { sections, ...meta } = t;
    batch.set(doc(db, 'templates', t.code), { ...meta, currentVersion: 1, active: true, updatedAt: serverTimestamp(), updatedBy: user.id });
    batch.set(doc(db, 'templates', t.code, 'versions', '1'), {
      version: 1, sections, notes: 'Initial example – to be confirmed by plant engineering',
      createdAt: serverTimestamp(), createdBy: user.id, createdByName: user.name,
    });
  }
  for (const [category, en, ar, code] of DOCS) {
    batch.set(doc(db, 'documents', code), {
      title: { en: `${code} – ${en}`, ar: `${code} – ${ar}` }, category, url: '', attachmentId: null,
      departmentId: null, equipmentId: null, templateId: null, visibleTo: ['all'], ...by,
    });
  }
  await batch.commit();
}
