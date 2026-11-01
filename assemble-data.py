import hashlib
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

# Questionnaire : 20 axes de 4 propositions, deux orientées vers chaque pôle, chacun rattaché à un thème.
assert len(questionnaire['axes']) == 20
questions = [q for a in questionnaire['axes'] for q in a['questions']]
assert len(questions) == 80
assert len({q['id'] for q in questions}) == 80
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
SOURCE_KINDS = {'programme', 'texte doctrinal', 'texte de campagne', 'site de parti', 'rapport', 'recherche', 'institut',
                'texte parlementaire', 'déclaration', 'compte rendu', 'article de presse'}
# Déclarations, comptes rendus de séance et articles de presse ne tranchent qu'un axe laissé ouvert par les textes
# officiels : ils sont marqués provisoires, et seuls eux le sont.
PROVISIONAL_KINDS = {'déclaration', 'compte rendu', 'article de presse'}
# Copies archivées des sources : chaque fichier figure dans l'index avec son empreinte. Les copies sont conservées
# hors de Git : une copie absente est signalée sans arrêter la construction, une copie présente doit être intacte.
source_index = {e['file']: e for e in json.loads((base / 'research/sources/index.json').read_text())['sources']}
missing_copies = 0
for entry in source_index.values():
    copy = base / entry['file']
    if not copy.is_file():
        missing_copies += 1
        continue
    assert hashlib.sha256(copy.read_bytes()).hexdigest() == entry['sha256'], f"archive altérée : {entry['file']}"
    assert entry['url'] is None or re.match(r'https?://', entry['url']), entry['file']
party_ids = [p['id'] for p in parties]
assert len(set(party_ids)) == len(parties), 'identifiant de parti en double'
# Première version d'un mois : AAAA.M ; révisions suivantes du même mois : AAAA.M.v2, AAAA.M.v3…
assert re.fullmatch(r'\d{4}\.\d{1,2}(\.v([2-9]|[1-9]\d+))?', families_catalog['version']), \
    'version des familles attendue sous la forme AAAA.M ou AAAA.M.vN (N ≥ 2)'
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
        assert (source['kind'] in PROVISIONAL_KINDS) == source.get('provisional', False), (family['id'], source['title'])
        assert all(a in source_index for a in source.get('archive', [])), (family['id'], source['title'])
    # Textes comparés : textes de partis vérifiés proches des repères, sans avoir servi à les fixer.
    for text in family.get('compared', []):
        assert text['party'] in party_ids and text['title'] and text['kind'] in SOURCE_KINDS, (family['id'], text)
        assert re.match(r'https?://', text['url']), (family['id'], text['url'])
        assert all(a in source_index for a in text.get('archive', [])), (family['id'], text['title'])

# Partis : chacun sert de référence à une famille, y est comparé, ou porte la raison explicite de son absence.
referenced = {s['party'] for f in families for s in f['sources'] if 'party' in s}
referenced |= {t['party'] for f in families for t in f.get('compared', [])}
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

# Auteurs et arguments : chaque argument se rattache à un pôle d'un axe connu, cite des auteurs du catalogue
# et renvoie à une source archivée ; chaque auteur a au moins un argument ; chaque pôle de chaque axe a une
# ou deux thèses mises en avant, les autres étant présentées comme lectures complémentaires.
thinkers = {t['id']: t for t in references['thinkers']}
assert len(thinkers) == len(references['thinkers']), 'auteur en double'
assert all(t['name'] and t['discipline'] for t in thinkers.values())
cited = set()
for argument in references['arguments']:
    assert argument['axis'] in axis_ids and argument['pole'] in ('low', 'high'), (argument['axis'], argument['pole'])
    assert argument['authors'] and all(a in thinkers for a in argument['authors']), argument['authors']
    assert argument['thesis'] and isinstance(argument['featured'], bool), argument['authors']
    source = argument['source']
    assert re.match(r'https?://', source['url']) and source['title'] and source['archive'], (argument['authors'], source)
    assert all(a in source_index for a in source['archive']), (argument['authors'], source['title'])
    cited.update(argument['authors'])
assert cited == set(thinkers), f'auteurs sans argument : {sorted(set(thinkers) - cited)}'
for axis in axis_ids:
    for pole in ('low', 'high'):
        featured = [x for x in references['arguments'] if x['axis'] == axis and x['pole'] == pole and x['featured']]
        assert 1 <= len(featured) <= 2, f'{axis}, pôle {pole} : {len(featured)} thèses mises en avant'

data = {'edition': 'France · novembre 2026', 'themes': themes, 'axes': questionnaire['axes'], 'references': references,
        'families': families, 'familiesVersion': families_catalog['version'], 'parties': parties_catalog}
(base / 'dist/data.js').write_text('window.REPERES_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'Assembled {len(questions)} questions, {len(questionnaire["axes"])} axes, {len(thinkers)} authors, {len(references["arguments"])} arguments, '
      f'{len(families)} families (version {families_catalog["version"]}), {len(parties)} parties.')
if missing_copies:
    print(f'{missing_copies} copies de sources absentes de research/sources/ sur {len(source_index)} : leurs empreintes n’ont pas été vérifiées.')
