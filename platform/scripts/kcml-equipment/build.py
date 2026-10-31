"""Builds the KCML equipment list + checklists from the plant's Excel file.

python3 -I build.py <Equipment-KCML.xlsx> <out-dir>
Writes equipment.json (for the import), kcml-equipment.csv (the platform's CSV format, with codes)
and review.md (what was merged, corrected or needs a description from the plant).
"""
import csv, json, os, re, sys
from collections import OrderedDict
import openpyxl
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checklists import TEMPLATES, classify

DISCIPLINES = ['mechanical', 'electrical', 'instrumentation', 'production']
LABEL = {'mechanical': 'Mechanical', 'electrical': 'Electrical', 'instrumentation': 'Instrumentation', 'production': 'Production'}

# sheet → department id (the cement-mill sheet is split by the code: N1 → mill 1 … Nx → common)
# (the Homogenizing sheet belongs to the raw-mill department)
SHEETS = {'Crusher': 'CRS', 'Raw Mill': 'RML1', 'Homigenuos1': 'RML1', 'Kiln1': 'KLN1', 'Cooler1': 'CLR1',
          'Cement': None, 'Paking': 'PCK', 'Boiler ': 'BLR', 'Water Station': 'WTR'}
CEMENT = {'N1': 'CML1', 'N2': 'CML2', 'N3': 'CML3', 'N4': 'CML4', 'Nx': 'CMX'}

# second production lines: same equipment and checklists, code prefix of line 1 → line 2
LINE2 = {'CRS': ('CRS2', {'B1': 'B2'}), 'RML1': ('RML2', {'E1': 'E2', 'H1': 'H2'}), 'CLR1': ('CLR2', {'L1': 'L2'})}

# spelling in the source list → corrected (the code is never changed)
FIX = [(r'\bTyip\b', 'Type'), (r'compressore\b', 'compressor'), (r'\bouylet\b', 'outlet'), (r'seperator', 'separator'),
       (r'sepertor', 'separator'), (r'serculation', 'circulation'), (r'colletor', 'collector'), (r'Feiter', 'Filter'),
       (r'elevetor', 'elevator'), (r'^Gtae$', 'Gate'), (r'Serivce\s+', 'Service '), (r'Lubracten', 'Lubrication'),
       (r'Auxilary', 'Auxiliary'), (r'\(\s*divator\s*\)', '(diverter)'), (r'^Slid vane', 'Slide vane'), (r'^Slid gate', 'Slide gate'),
       (r'Firing fighting', 'Fire fighting'), (r'\bfoe\b', 'for'), (r'blowr\b', 'blower'), (r'shift bearing', 'shaft bearing'),
       (r'\s+', ' ')]


def fix(s):
    for a, b in FIX: s = re.sub(a, b, s, flags=re.I) if a not in (r'\s+',) else re.sub(a, b, s)
    s = s.strip()
    return s[:1].upper() + s[1:] if s else s


def main(src, out):
    wb = openpyxl.load_workbook(src, data_only=True)
    items = OrderedDict()           # code (or name when there is no code) → item
    notes = {'merged': [], 'no_type': [], 'no_code': [], 'skipped': [], 'corrected': []}
    for sheet, dept in SHEETS.items():
        ws = wb[sheet]
        for row in ws.iter_rows(min_row=4):
            v = [c.value for c in row]
            code = str(v[1]).strip() if len(v) > 1 and v[1] is not None else ''
            raw = str(v[2]).strip() if len(v) > 2 and v[2] is not None else ''
            extra = ' '.join(str(x).strip() for x in v[3:] if x is not None)
            if not code and not raw: continue
            if raw in ('#N/A', 'None'): raw = ''
            if not code and raw in ('', ): notes['skipped'].append((sheet, row[0].row)); continue
            # rows whose "code" is really a name (no tag): wells, compressor, R.O pump, MDS
            tagless = not re.match(r'^[A-Z][0-9x][A-Z]{1,2}[0-9]{2,3}[A-Z]?$', code)
            name_src = raw
            if code == 'Compressor': code, name_src = '', 'Compressor'
            m = re.match(r'^WellNo\.?\s*(\d+)$', code)
            if m: name_src = f'Water well No. {m.group(1)}'
            if code.lower().startswith('r.o reject'): code, name_src = '', 'R.O reject pump'
            if extra and 'slid vane' in extra.lower(): name_src = f'{raw} (slide vane)'
            name = fix(name_src) if name_src else ''
            if name_src and name != ' '.join(name_src.split()) and name_src not in ('Compressor',) and not name_src.startswith('Water well'):
                notes['corrected'].append((code, name_src, name))
            d = dept or CEMENT.get(code[:2], 'CMX')
            key = code or name
            if not name:
                name = 'Motor — type to be confirmed' if (len(code) > 2 and code[2] == 'M') else 'Equipment — type to be confirmed'
                notes['no_type'].append((sheet.strip(), code))
            if key in items:
                notes['merged'].append((sheet.strip(), key, items[key]['name']))
                if items[key]['name'].endswith('to be confirmed') and not name.endswith('to be confirmed'): items[key]['name'] = name
                continue
            if tagless and code: notes['no_code'].append((sheet.strip(), code, name))
            kind = classify(name if not name.endswith('to be confirmed') else '', code)
            items[key] = {'code': code, 'name': name, 'departmentId': d, 'kind': kind, 'parts': TEMPLATES[kind], 'sheet': sheet.strip()}
    # line 2 of the crusher, raw mill and cooler
    line2 = OrderedDict()
    for key, x in items.items():
        if x['departmentId'] not in LINE2: continue
        dept2, prefixes = LINE2[x['departmentId']]
        a = x['code'][:2]
        if x['code'] and a not in prefixes:
            notes['no_code'].append((x['sheet'], x['code'], x['name'] + ' — not copied to line 2 (unexpected code prefix)'))
            continue
        code2 = prefixes[a] + x['code'][2:] if x['code'] else ''
        k2 = code2 or f"{x['name']}@{dept2}"
        assert k2 not in items and k2 not in line2, k2
        line2[k2] = {**x, 'code': code2, 'departmentId': dept2}
    items.update(line2)
    os.makedirs(out, exist_ok=True)
    data = [{k: x[k] for k in ('code', 'name', 'departmentId', 'kind', 'parts')} for x in items.values()]
    json.dump(data, open(os.path.join(out, 'equipment.json'), 'w'), ensure_ascii=False, indent=1)
    with open(os.path.join(out, 'kcml-equipment.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f); w.writerow(['Department', 'Code', 'Equipment', 'Part type', 'Part'])
        for x in data:
            for dsc in DISCIPLINES:
                for p in x['parts'][dsc]: w.writerow([x['departmentId'], x['code'], x['name'], LABEL[dsc], p])
    by_kind = {}
    for x in data: by_kind.setdefault(x['kind'], []).append(x)
    with open(os.path.join(out, 'review.md'), 'w') as f:
        f.write(f"# KCML equipment import — review\n\n{len(data)} equipment from {sum(1 for _ in SHEETS)} sheets.\n\n")
        f.write('## Equipment per department\n\n' + '\n'.join(f"- {dp}: {sum(1 for x in data if x['departmentId']==dp)}" for dp in sorted({x['departmentId'] for x in data})) + '\n\n')
        f.write('## Codes listed more than once (kept once)\n\n' + '\n'.join(f'- {s}: {k} ({n})' for s, k, n in notes['merged']) + '\n\n')
        f.write('## No type in the list (#N/A or empty) — please send the description\n\n' + '\n'.join(f'- {s}: {c}' for s, c in notes['no_type']) + '\n\n')
        f.write('## Rows without a plant code\n\n' + '\n'.join(f'- {s}: "{c}" → {n}' for s, c, n in notes['no_code']) + '\n\n')
        f.write('## Spelling corrected (code unchanged)\n\n' + '\n'.join(f'- {c}: "{a}" → "{b}"' for c, a, b in notes['corrected']) + '\n\n')
        f.write('## Checklist type used\n\n' + '\n'.join(f"- {k} ({len(v)}): " + ', '.join(sorted({x['name'] for x in v}))[:400] for k, v in sorted(by_kind.items())) + '\n')
    print(len(data), 'equipment;', {k: len(v) for k, v in notes.items()})


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
