import json
from pathlib import Path

base = Path(__file__).resolve().parent
questionnaire = json.loads((base / 'research/questionnaire.json').read_text())
references = json.loads((base / 'research/references.json').read_text())
families = json.loads((base / 'research/families.json').read_text())
assert len(questionnaire['axes']) == 18
questions = [q for a in questionnaire['axes'] for q in a['questions']]
assert len(questions) == 72
assert len({q['id'] for q in questions}) == 72
for axis in questionnaire['axes']:
    assert len(axis['questions']) == 4
    assert sorted(q['direction'] for q in axis['questions']) == [-1, -1, 1, 1]
    assert all(q['axis'] == axis['id'] for q in axis['questions'])
axis_ids = {a['id'] for a in questionnaire['axes']}
for family in families:
    assert set(family['positions']).issubset(axis_ids)
    assert all(0 <= value <= 10 for value in family['positions'].values())
data = {'edition': 'France · octobre 2026', 'axes': questionnaire['axes'], 'references': references, 'families': families}
(base / 'dist/data.js').write_text('window.REPERES_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'Assembled {len(questions)} questions, 18 axes, {len(references["economists"])} economists, {len(families)} families.')
