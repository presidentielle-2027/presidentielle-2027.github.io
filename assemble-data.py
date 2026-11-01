import json
import re
from pathlib import Path

base = Path(__file__).resolve().parent


def load(name):
    return json.loads((base / 'research' / name).read_text())


questionnaire = load('questionnaire.json')
references = load('references.json')
families_catalog = load('families.json')
parties_catalog = load('parties.json')
themes = questionnaire['themes']
families = families_catalog['families']
parties = parties_catalog['parties']

# Questionnaire : 18 axes de 4 propositions, deux orientées vers chaque pôle, chacun rattaché à un thème.
assert len(questionnaire['axes']) == 18
questions = [q for a in questionnaire['axes'] for q in a['questions']]
assert len(questions) == 72
assert len({q['id'] for q in questions}) == 72
for axis in questionnaire['axes']:
    assert len(axis['questions']) == 4
    assert sorted(q['direction'] for q in axis['questions']) == [-1, -1, 1, 1]
    assert all(q['axis'] == axis['id'] for q in axis['questions'])
axis_ids = {a['id'] for a in questionnaire['axes']}

# Thèmes : identifiants et numéros uniques, chaque axe dans un thème, aucun thème vide.
theme_ids = [t['id'] for t in themes]
assert len(set(theme_ids)) == len(themes) and len({t['number'] for t in themes}) == len(themes)
assert all(a['group'] in theme_ids for a in questionnaire['axes'])
assert all(any(a['group'] == t for a in questionnaire['axes']) for t in theme_ids)

# Familles : une version datée, des repères entre 0 et 10 sur des axes connus, des sources décrites.
SOURCE_KINDS = {'programme', 'texte doctrinal', 'site de parti', 'rapport', 'recherche', 'institut'}
party_ids = [p['id'] for p in parties]
assert len(set(party_ids)) == len(parties), 'identifiant de parti en double'
assert re.fullmatch(r'\d{4}\.\d{1,2}', families_catalog['version']), 'version des familles attendue sous la forme AAAA.M'
assert len({f['id'] for f in families}) == len(families)
for family in families:
    assert set(family['positions']).issubset(axis_ids)
    assert all(0 <= value <= 10 for value in family['positions'].values())
    assert family['sources'], f"{family['id']} : aucune source"
    for source in family['sources']:
        # Une source de parti tire son éditeur du catalogue des partis ; les autres le nomment.
        assert ('party' in source) != ('publisher' in source), (family['id'], source)
        assert source['title'] and source['kind'] in SOURCE_KINDS, (family['id'], source)
        assert re.match(r'https?://', source['url']), (family['id'], source['url'])
        assert 'party' not in source or source['party'] in party_ids, f"{family['id']} : parti inconnu {source['party']}"

# Partis : chacun sert de référence à au moins une famille, ou porte la raison explicite de son absence.
referenced = {s['party'] for f in families for s in f['sources'] if 'party' in s}
BASIS_TYPES = {'assemblee', 'parlement-europeen', 'presidentielle-2027'}
for party in parties:
    # Un parti sans site officiel trouvé garde une adresse vide plutôt qu'une adresse supposée.
    assert party['name'] and (party['url'] is None or re.match(r'https?://', party['url'])), party['id']
    assert party['basis'], f"{party['id']} : critère d’inclusion non renseigné"
    assert all(b['type'] in BASIS_TYPES and re.match(r'https?://', b['evidence']) for b in party['basis']), party['id']
    assert party['scope'] in {'national', 'régional', 'ultramarin'}, party['id']
    assert (party['scope'] == 'national') != bool(party.get('territory')), f"{party['id']} : territoire attendu pour un parti régional ou ultramarin"
    candidate = party.get('candidate')
    assert any(b['type'] == 'presidentielle-2027' for b in party['basis']) == bool(candidate), f"{party['id']} : critère présidentiel et candidature incohérents"
    assert candidate is None or candidate.get('party') is None or candidate['party'] in party_ids, party['id']
    if party['id'] in referenced:
        assert 'unmodelled' not in party, f"{party['id']} sert de référence et est déclaré non modélisé"
    else:
        assert party.get('unmodelled'), f"{party['id']} : ni famille de référence, ni raison d’absence"

# Économistes mis en avant sous un axe : connus du catalogue et associés à cet axe.
economists = {e['id']: e for e in references['economists']}
for axis, ids in references['axisHighlights'].items():
    assert axis in axis_ids, axis
    assert all(i in economists and axis in economists[i]['axes'] for i in ids), (axis, ids)

data = {'edition': 'France · octobre 2026', 'themes': themes, 'axes': questionnaire['axes'], 'references': references,
        'families': families, 'familiesVersion': families_catalog['version'], 'parties': parties_catalog}
(base / 'dist/data.js').write_text('window.REPERES_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'Assembled {len(questions)} questions, 18 axes, {len(references["economists"])} economists, '
      f'{len(families)} families (version {families_catalog["version"]}), {len(parties)} parties.')
