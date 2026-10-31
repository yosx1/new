# KCML equipment list → equipment + cold-run checklists

Source: the plant's `Equipment-KCML 2026.xlsx` (one sheet per area: No., Code, Type). Not stored here.

| File | What it is |
|---|---|
| `checklists.py` | The checklist library: checks per equipment type for the four disciplines, and the rules that pick a type from the description and the code (M = motor/drive, Y = valve/actuator, A = cabinet). |
| `build.py` | Reads the Excel file, corrects spelling (never the code), merges codes listed twice, splits the cement-mill sheet by code (N1…N4, Nx = common) and writes `data/`. |
| `data/equipment.json` | 814 equipment with code, name, department and checklist — what was imported. |
| `data/kcml-equipment.csv` | The same in the platform's CSV format (Department, Code, Equipment, Part type, Part) — can be edited in Excel and uploaded on the Equipment page. |
| `data/review.md` | What needs the plant's attention: codes with no type in the list (#N/A), rows without a code, merged duplicates, spelling corrections, and which checklist each type got. |
| `import_live.py` | Applies `equipment.json` to the live project (owner credentials): departments, equipment (id = code), retires what is not in the list, bumps `config/catalog`. Dry run without `--go`. |

```bash
python3 -I build.py "Equipment-KCML 2026.xlsx" data
python3 -I import_live.py data/equipment.json          # dry run
python3 -I import_live.py data/equipment.json --go
```

Teams can still remove or add checklist items when they create an inspection; changes to the standard
checklist of an equipment are made on the Equipment page (pencil) or by uploading the CSV.
