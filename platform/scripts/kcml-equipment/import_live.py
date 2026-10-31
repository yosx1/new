"""Applies equipment.json to the live Firestore project (owner credentials via gcloud ADC).

python3 -I import_live.py <equipment.json> [--go]
Without --go it only prints what it would do. It: adds/updates the plant departments, retires departments
and equipment that are not in the list (active=false: history stays, devices drop them on their next sync),
writes every equipment (id = its code), bumps config/catalog so devices refresh, and records an audit entry.
"""
import json, re, subprocess, sys, urllib.error, urllib.request

PROJECT = 'kcp-coldrun-2026'
DB = f'projects/{PROJECT}/databases/(default)/documents'
BASE = f'https://firestore.googleapis.com/v1/{DB}'
DEPTS = [  # id, English, Arabic — in plant order
    ('CRS', 'Crusher', 'الكسارة'), ('RML1', 'Raw Mill 1', 'طاحونة المواد الأولية 1'), ('HOM1', 'Homogenizing', 'التجانس'),
    ('KLN1', 'Kiln 1', 'الفرن 1'), ('CLR1', 'Cooler 1', 'المبرّد 1'), ('CML1', 'Cement Mill 1', 'طاحونة السمنت 1'),
    ('CML2', 'Cement Mill 2', 'طاحونة السمنت 2'), ('CML3', 'Cement Mill 3', 'طاحونة السمنت 3'), ('CML4', 'Cement Mill 4', 'طاحونة السمنت 4'),
    ('CMX', 'Cement Mills — common', 'طواحين السمنت — مشترك'), ('PCK', 'Packing', 'التعبئة'), ('BLR', 'Boiler', 'المرجل'),
    ('WTR', 'Water Station', 'محطة المياه'),
]
token = subprocess.check_output(['gcloud', 'auth', 'application-default', 'print-access-token']).decode().strip()
H = {'Authorization': 'Bearer ' + token, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json'}


def call(method, url, body=None):
    req = urllib.request.Request(url, method=method, headers=H, data=json.dumps(body).encode() if body is not None else None)
    return json.load(urllib.request.urlopen(req))


def listing(c):
    out, tok = [], ''
    while True:
        d = call('GET', f'{BASE}/{c}?pageSize=300' + (f'&pageToken={tok}' if tok else ''))
        out += d.get('documents', []); tok = d.get('nextPageToken')
        if not tok: return out


S = lambda v: {'stringValue': v}
NOW = lambda field: {'fieldPath': field, 'setToServerValue': 'REQUEST_TIME'}
doc_id = lambda code: re.sub(r'[^A-Za-z0-9_-]+', '-', code.strip())[:60]
slug = lambda name: 'X-' + re.sub(r'[^A-Za-z0-9]+', '-', name).strip('-')[:50]


def main(path, go):
    items = json.load(open(path))
    admin = next(u['name'].split('/')[-1] for u in listing('users') if u['fields']['email']['stringValue'] == 'you.yousif.kadhim@gmail.com')
    have_d = {d['name'].split('/')[-1]: d for d in listing('departments')}
    have_e = {d['name'].split('/')[-1]: d for d in listing('equipment')}
    writes = []
    for k, (i, en, ar) in enumerate(DEPTS):
        f = {'code': S(i), 'name': {'mapValue': {'fields': {'en': S(en), 'ar': S(ar)}}}, 'order': {'integerValue': str(k + 1)}, 'active': {'booleanValue': True}}
        if i in have_d:
            writes.append({'update': {'name': f'{DB}/departments/{i}', 'fields': f}, 'updateMask': {'fieldPaths': list(f)}, 'updateTransforms': [NOW('updatedAt')]})
        else:
            writes.append({'update': {'name': f'{DB}/departments/{i}', 'fields': {**f, 'createdBy': S(admin)}}, 'updateTransforms': [NOW('createdAt')]})
    keep = {i for i, _, _ in DEPTS}
    retired_d = [i for i, d in have_d.items() if i not in keep and d['fields'].get('active', {}).get('booleanValue', True)]
    for n, i in enumerate(retired_d):
        writes.append({'update': {'name': f'{DB}/departments/{i}', 'fields': {'active': {'booleanValue': False}, 'order': {'integerValue': str(100 + n)}}},
                       'updateMask': {'fieldPaths': ['active', 'order']}, 'updateTransforms': [NOW('updatedAt')]})
    new_ids = set()
    for x in items:
        i = doc_id(x['code']) if x['code'] else slug(x['name'])
        assert i not in new_ids, i
        new_ids.add(i)
        parts = {'mapValue': {'fields': {d: {'arrayValue': {'values': [S(p) for p in v]}} for d, v in x['parts'].items()}}}
        writes.append({'update': {'name': f'{DB}/equipment/{i}', 'fields': {'code': S(x['code']), 'name': S(x['name']), 'departmentId': S(x['departmentId']),
                                                                       'parts': parts, 'active': {'booleanValue': True}}},
                       'updateTransforms': [NOW('updatedAt')]})
    retired_e = [i for i in have_e if i not in new_ids]
    for i in retired_e:
        writes.append({'update': {'name': f'{DB}/equipment/{i}', 'fields': {'active': {'booleanValue': False}}},
                       'updateMask': {'fieldPaths': ['active']}, 'updateTransforms': [NOW('updatedAt')]})
    try: cat = call('GET', f'{BASE}/config/catalog') if go else {}
    except urllib.error.HTTPError as e:
        if e.code != 404: raise
        cat = {}   # first import: no version yet
    print(f'departments: {len(DEPTS)} kept/added, retire {retired_d}; equipment: write {len(items)}, retire {len(retired_e)} old; total writes {len(writes) + 2}')
    if not go: return
    for k in range(0, len(writes), 400):
        r = call('POST', f'{BASE}:commit', {'writes': writes[k:k + 400]})
        print('  committed', len(r.get('writeResults', [])))
    v = int(cat.get('fields', {}).get('v', {}).get('integerValue', '0')) + 1
    call('POST', f'{BASE}:commit', {'writes': [
        {'update': {'name': f'{DB}/config/catalog', 'fields': {'v': {'integerValue': str(v)}, 'by': S(admin)}}, 'updateTransforms': [NOW('updatedAt')]},
        {'update': {'name': f'{DB}/audit/equipment-kcml-2026', 'fields': {
            'action': S('equipment.import'), 'entity': S('equipment'), 'entityId': S('csv'), 'label': S('KCML equipment list 2026'),
            'before': {'nullValue': None}, 'after': {'nullValue': None}, 'uid': S(admin), 'userName': S('Administrator (import)'),
            'note': S(f'{len(items)} equipment with checklists from Equipment-KCML 2026.xlsx; {len(retired_e)} old equipment retired')}},
         'updateTransforms': [NOW('at')]},
    ]})
    print('  catalog version', v)


if __name__ == '__main__':
    main(sys.argv[1], '--go' in sys.argv)
