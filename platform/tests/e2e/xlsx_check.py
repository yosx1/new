import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
cells = [str(c.value) for ws in wb.worksheets for row in ws.iter_rows() for c in row if c.value is not None]
first = [[c.value for c in row] for row in wb.worksheets[0].iter_rows(max_row=6)]
print(json.dumps({"sheets": wb.sheetnames, "cells": cells, "first": first, "rtl": [ws.sheet_view.rightToLeft for ws in wb.worksheets]}, default=str, ensure_ascii=False))
