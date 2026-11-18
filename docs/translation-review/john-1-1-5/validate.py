"""Structural review-artifact checks only; NEVER a linguistic accuracy test."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import unicodedata

ROOT = Path(__file__).resolve().parent
IDS = [f'John.1.{n}' for n in range(1, 6)]
PAIR_HASH = '151546fe2142c8cb808c345c94757a9a7d1da2bd4294da9f647e26788c9f6dd1'
CONF_HASH = 'a4b45f9fdfed3c514f6acd55f90022ae19b4ae4a5c0953adfd17d549ea9e71c7'
STATUS = 'AI_ASSISTED_UNREVIEWED'
REGISTERS = {'el': 'contemporary Greek', 'he': 'biblical-style Hebrew; new translation, not ancient original'}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def validate(data, source, config_bytes, module):
    require(data['status'] == STATUS and data['publishable'] is False, 'global review gate')
    require(data['coverage'] == {'book': 'John', 'chapter': 1, 'verse_ids': [1, 2, 3, 4, 5], 'verse_count': 5}, 'bounded coverage')
    require(data['registers'] == REGISTERS, 'register labels')
    require([r['v'] for r in source] == [1, 2, 3, 4, 5], 'source IDs')
    pairs = json.dumps([[r['v'], r['sy']] for r in source], ensure_ascii=False, separators=(',', ':')).encode()
    require(hashlib.sha256(pairs).hexdigest() == PAIR_HASH, 'pinned source hash')
    require(data['source']['pilot_pairs_sha256'] == PAIR_HASH, 'recorded source hash')
    require(hashlib.sha256(config_bytes).hexdigest() == CONF_HASH, 'bundled config hash')
    require(data['source']['bundled_conf_sha256'] == CONF_HASH, 'recorded config hash')
    require(data['source']['module_zip_sha256'] == 'badce0aa0a9b70a9c81891ed48d5a9e86de1e24d12ad4ad378e060e03cabc7b9', 'recorded archive hash')
    require(data['source']['historical_import_provenance_verified'] is False, 'provenance qualification')
    require(data['method']['target_corpus_consulted'] is False and data['method']['external_lexicon_data_copied'] is False, 'method declarations')
    hr = data['human_review']
    require(all(hr[k] is False for k in ['qualified_syriac_completed', 'qualified_greek_completed', 'qualified_hebrew_completed']), 'human review not completed')
    require(hr['independent_review_required'] is True and hr['approval'] is None, 'independent review required')
    require(data['name_policy']['names_validated'] is False, 'name review not established')
    require(data['name_policy']['personal_place_names_present'] is False, 'bounded names declaration')
    require([r['v'] for r in module] == [1, 2, 3, 4, 5], 'module extraction IDs')
    for row, adopted in zip(module, source):
        require(row['clean'] == row['raw_osis'] == adopted['sy'] + ' ', 'only one module trailing ASCII space differs')
    require([r['id'] for r in data['verses']] == IDS, 'draft IDs')
    for index, row in enumerate(data['verses']):
        expected = source[index]['sy']
        require(row['sy'] == expected, f'{row["id"]} source string')
        require(row['sy_sha256_utf8'] == hashlib.sha256(expected.encode()).hexdigest(), 'verse source hash')
        require(row['source_reference'] == f'John 1:{index + 1}', 'verse reference')
        require(row['review_status'] == STATUS and row['publishable'] is False, 'verse review gate')
        require(bool(row['blocking_review_topics']), 'explicit pending topics')
        for lang in ['el', 'he']:
            target = row[lang]
            require(target['register'] == REGISTERS[lang] and target['review_status'] == STATUS, 'target register/review gate')
            require(bool(target['text'].strip()), 'nonempty proposed draft')
            require(target['text'] == unicodedata.normalize('NFC', target['text']), 'NFC target')
            require(any((0x370 <= ord(c) <= 0x3ff) if lang == 'el' else (0x5d0 <= ord(c) <= 0x5ea) for c in target['text']), 'expected target-script presence')
        require(bool(row['alignments']), 'phrase alignment required')
        for a in row['alignments']:
            require(a['analysis_status'] == 'PROPOSED_REQUIRES_HUMAN_REVIEW', 'provisional analysis')
            require(bool(a['sy']) and a['sy'] in expected, 'alignment source substring')
            require(a['el_proposed'] in row['el']['text'], 'Greek alignment substring')
            require(a['he_proposed'] in row['he']['text'], 'Hebrew alignment substring')
    required_topics = [
        {'mltha-term', 'alha-predication'},
        {'demonstrative-reference'},
        {'agency-hand', 'relative-attachment-1-3-4'},
        {'relative-attachment-1-3-4'},
        {'adrkh-unresolved', 'cross-target-semantic-mismatch'},
    ]
    for row, topics in zip(data['verses'], required_topics):
        require(topics <= set(row['blocking_review_topics']), 'required unresolved review topics')

def main():
    data = json.loads((ROOT/'pilot.json').read_text())
    source = json.loads((ROOT/'source-john-1-1-5.json').read_text())
    config = (ROOT/'crosswire-peshitta-2.0.conf').read_bytes()
    module = json.loads((ROOT/'module-extract-john-1-1-5.json').read_text())
    validate(data, source, config, module)
    mutations = [
        ('extra verse', lambda d: d['verses'].append(copy.deepcopy(d['verses'][0]))),
        ('wrong ID', lambda d: d['verses'][0].update(id='John.1.6')),
        ('changed source', lambda d: d['verses'][0].update(sy=d['verses'][0]['sy']+' ')),
        ('missing draft', lambda d: d['verses'][0]['el'].update(text='')),
        ('wrong register', lambda d: d['verses'][0]['el'].update(register='ancient original')),
        ('promoted status', lambda d: d.update(status='HUMAN_APPROVED')),
        ('publishable flag', lambda d: d.update(publishable=True)),
        ('false human review', lambda d: d['human_review'].update(qualified_syriac_completed=True)),
        ('removed lexical warning', lambda d: d['verses'][4].update(blocking_review_topics=['aspect-1-5'])),
        ('removed cross-target mismatch', lambda d: d['verses'][4]['blocking_review_topics'].remove('cross-target-semantic-mismatch')),
        ('removed mltha warning', lambda d: d['verses'][0]['blocking_review_topics'].remove('mltha-term')),
        ('removed alha warning', lambda d: d['verses'][0]['blocking_review_topics'].remove('alha-predication')),
        ('removed agency warning', lambda d: d['verses'][2]['blocking_review_topics'].remove('agency-hand')),
        ('removed attachment warning', lambda d: d['verses'][3]['blocking_review_topics'].remove('relative-attachment-1-3-4'))
    ]
    for name, mutate in mutations:
        changed = copy.deepcopy(data); mutate(changed)
        try:
            validate(changed, source, config, module)
        except ValueError:
            continue
        raise AssertionError('mutation unexpectedly accepted: '+name)
    changed_module = copy.deepcopy(module)
    changed_module[0]['clean'] += ' '
    try:
        validate(data, source, config, changed_module)
    except ValueError:
        pass
    else:
        raise AssertionError('module whitespace mutation unexpectedly accepted')
    print(f'PASS: 5 verse records, 10 proposed target texts, source/config hashes, labels, alignments and review gates; {len(mutations) + 1} negative cases rejected (including module whitespace).')
    print('NOT CHECKED: Syriac analysis, Greek/Hebrew quality, semantic accuracy, rights warranties or human approval.')

if __name__ == '__main__':
    main()
