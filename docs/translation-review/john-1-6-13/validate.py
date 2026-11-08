#!/usr/bin/env python3
"""Integrity/scope checks only. Does not measure translation accuracy or human review."""
import argparse
import copy
import difflib
import hashlib
import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IDS = list(range(6, 14))
GATE = 'AI_ASSISTED_UNREVIEWED'
REG = {'el': 'contemporary Greek', 'he': 'biblical-style Hebrew; new translation, not ancient original'}
PAIRS = 'c93e694eb286bf55d2be9dcffc8b24edd0771a5300c369ede7ac805819a0a7e0'
ZIP = 'badce0aa0a9b70a9c81891ed48d5a9e86de1e24d12ad4ad378e060e03cabc7b9'
CONF = 'a4b45f9fdfed3c514f6acd55f90022ae19b4ae4a5c0953adfd17d549ea9e71c7'
WHOLE = '594428548d96fb2667b4db39e457f520db94876bff5cbdaf5c3f96505944f8cb'
HEAD = 'f2c46a209d3ef9bdfe919beea6ecd33d5b1f7c02'
JSON_FILES = ['pilot.json', 'source-john-1-6-13.json', 'module-extract-john-1-6-13.json',
              'source-verification.json', 'names-registry.json', 'john-1-1-5-review-02.json',
              'supporting-sources.json']

def sha(b):
    return hashlib.sha256(b).hexdigest()

def need(test, label):
    if not test:
        raise ValueError(label)

def pack_hash(rows):
    return sha(json.dumps([[r['v'], r['sy']] for r in rows], ensure_ascii=False,
                          separators=(',', ':')).encode())

def edits(a, b):
    result = []
    for op, i, j, k, l in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op != 'equal':
            result.append({'operation': op, 'repo_range_zero_based': [i, j],
                'module_range_zero_based': [k, l], 'repo_text': a[i:j], 'module_text': b[k:l],
                'repo_codepoints': [f'U+{ord(x):04X}' for x in a[i:j]],
                'module_codepoints': [f'U+{ord(x):04X}' for x in b[k:l]]})
    return result

def check(d):
    p, s, m, v, n, a, refs = [d[x] for x in JSON_FILES]
    need(p['status'] == GATE and p['publishable'] is False, 'root gate')
    need(p['coverage'] == {'book': 'John', 'chapter': 1, 'verse_ids': IDS, 'verse_count': 8}, 'bounds')
    need(p['registers'] == REG, 'registers')
    need([r['v'] for r in s] == IDS, 'source IDs')
    need([r['v'] for r in m] == IDS, 'module IDs')
    need([r['v'] for r in v['comparisons']] == IDS, 'comparison IDs')
    need([r['id'] for r in p['verses']] == [f'John.1.{x}' for x in IDS], 'draft IDs')
    need(pack_hash(s) == PAIRS, 'immutable source pairs')
    need(v['file_sha256'] == WHOLE and v['repo_commit'] == HEAD, 'frozen reference')
    need(v['pilot_pairs_sha256'] == PAIRS and p['source']['pilot_pairs_sha256'] == PAIRS, 'source hash references')
    need(v['module_version'] == p['source']['module_version'] == '2.0', 'actual module version')
    need(v['module_zip_sha256'] == p['source']['module_zip_sha256'] == ZIP, 'module package hash')
    need(p['source']['module_config_sha256'] == CONF, 'module configuration hash')
    need(p['source']['historical_import_provenance_verified'] is False, 'provenance not established')
    need(p['source']['printed_pointing_collation_completed'] is False, 'collation not completed')
    for key in ('english_pivot', 'target_corpus_copied', 'provider_calls', 'external_NC_lexicon_data_copied'):
        need(p['method'][key] is False, 'method exclusion '+key)
    hr=p['human_review']
    need(hr['independent_review_required'] is True and hr['approval'] is None, 'human gate')
    for key in ('qualified_syriac_completed','qualified_greek_completed','qualified_hebrew_completed'):
        need(hr[key] is False, 'uncompleted human review')
    need(v['summary']['only_one_trailing_space_difference'] == 5, 'five space-only comparisons')
    need(v['summary']['semkath_form_substitutions'] == 4, 'four semkath differences')
    need(v['summary']['verses_with_semkath_form_differences'] == [7,8,13], 'difference verse IDs')
    substitution_count=0
    for row, module, comp, draft in zip(s,m,v['comparisons'],p['verses']):
        text, raw = row['sy'], module['raw_osis']
        need(bool(text.strip()) and text==draft['sy'], 'nonblank exact source')
        need(sha(text.encode()) == draft['sy_sha256_utf8'], 'per verse source hash')
        need(raw == module['clean'] and raw.endswith(' ') and not raw.endswith('  '), 'preserved extraction/trailing space')
        need(raw[:-1].replace('\u0724','\u0723') == text, 'explicit comparison fold only')
        need(comp['only_one_trailing_space'] == (raw[:-1] == text), 'space-only truth')
        need(comp['edits'] == edits(text,raw), 'exact recorded edits')
        need(comp['exact_equal'] is False and comp['nonempty'] is True, 'comparison truth')
        need(comp['nfc_makes_equal'] == (unicodedata.normalize('NFC',text)==unicodedata.normalize('NFC',raw[:-1])), 'NFC truth')
        need(not comp['repo_vowel_or_combining_marks'], 'unpointed fields')
        for e in comp['edits']:
            if e['operation']=='replace':
                need(e['repo_text']=='\u0723' and e['module_text']=='\u0724', 'semkath form edit only')
                substitution_count+=1
            else:
                need(e['operation']=='insert' and e['module_text']==' ' and e['repo_text']=='', 'trailing insertion only')
        need(draft['review_status']==GATE and draft['publishable'] is False, 'verse gate')
        need(bool(draft['blocking_review_topics']), 'unresolved topics retained')
        for lang in REG:
            target=draft[lang]
            need(target['register']==REG[lang] and target['review_status']==GATE, 'per-language gate/register')
            need(bool(target['text'].strip()) and sha(target['text'].encode())==target['text_sha256_utf8'], 'target integrity')
        need(bool(draft['alignments']), 'alignment presence')
        for al in draft['alignments']:
            need(bool(al['sy']) and al['sy'] in text, 'source alignment substring')
            need(al['analysis_status']=='PROPOSED_REQUIRES_HUMAN_REVIEW' and bool(al['note']), 'analysis status/note')
            for lang in REG:
                need(bool(al[lang+'_proposed']) and al[lang+'_proposed'] in draft[lang]['text'], 'target alignment substring')
    need(substitution_count==4, 'computed four substitutions')
    supplied=p['verses'][2]['supplied_target_words']
    need(supplied['el']==['ήρθε'] and supplied['he']==['בא'] and supplied['source_repeats_come_verb'] is False, '1:8 supplied words disclosed')
    for lang in REG:
        need(all(w in p['verses'][2][lang]['text'] for w in supplied[lang]), 'supplied words in targets')
    moved=p['verses'][7]['reordered_target_material']
    need(moved['source_verb']=='ܐܬܝܠܕܘ' and moved['el_verb']=='γεννήθηκαν' and moved['status']=='PROPOSED_UNREVIEWED', '1:13 verb reordering disclosed')
    need(len(n)==1 and n[0]['syriac_source_form']=='ܝܘܚܢܢ' and n[0]['he_proposed']=='יוחנן', 'source name identity')
    need(n[0]['el_proposed']=='Γιοχανάν' and n[0]['pronunciation_verified'] is False, 'name spelling is not pronunciation')
    need(n[0]['pronunciation_tradition_selected'] is None and n[0]['name_identity_human_reviewed'] is False, 'name review gate')
    need(n[0]['el_proposed'] in p['verses'][0]['el']['text'] and n[0]['he_proposed'] in p['verses'][0]['he']['text'], 'name target alignment')
    need(a['coverage']==list(range(1,6)) and a['status']==GATE and a['publishable'] is False, 'followup scope/gate')
    need(a['baseline_pr_head']==HEAD and a['human_review_completed'] is False, 'followup baseline/human gate')
    need([r['id'] for r in a['reviews']]==[f'John.1.{x}' for x in range(1,6)], 'followup IDs')
    for row in a['reviews']:
        need(row['prior_draft_unchanged'] is True and row['publishable'] is False and row['review_status']==GATE, 'followup audit gate')
        need(sha(row['sy'].encode())==row['source_sha256_utf8'], 'followup source hash')
        need(bool(row['prior_el']) and bool(row['prior_he']), 'prior texts retained')
    last=a['reviews'][4]
    need(last['main_alternative_selected'] is None, '1:5 unresolved')
    need([r['id'] for r in last['alternatives']]==['reach-overtake','cognitive','domination'], 'paired 1:5 alternatives')
    for alt in last['alternatives']:
        need(alt['status']=='PROPOSED_UNREVIEWED' and bool(alt['el']) and bool(alt['he']) and bool(alt['rationale']), 'paired alternatives unreviewed')
    need(len(refs['sources'])==4, 'rights references present')
    need(all(bool(r.get('rights_evidence') or r.get('item_rights_evidence')) for r in refs['sources']), 'rights scope recorded')

def self_test(d):
    mutations=[
      ('publishable root', lambda x: x['pilot.json'].__setitem__('publishable',True)),
      ('wrong range', lambda x: x['pilot.json']['coverage']['verse_ids'].append(14)),
      ('duplicate verse', lambda x: x['pilot.json']['verses'][1].__setitem__('id','John.1.6')),
      ('Koine register', lambda x: x['pilot.json']['registers'].__setitem__('el','Koine Greek ancient original')),
      ('changed source', lambda x: x['source-john-1-6-13.json'][0].__setitem__('sy','ܐ')),
      ('wrong module version', lambda x: x['source-verification.json'].__setitem__('module_version','1.1')),
      ('blank module', lambda x: x['module-extract-john-1-6-13.json'][0].__setitem__('raw_osis','')),
      ('silent semkath repair', lambda x: x['module-extract-john-1-6-13.json'][1].__setitem__('raw_osis',x['module-extract-john-1-6-13.json'][1]['raw_osis'].replace('\u0724','\u0723'))),
      ('false eight matches', lambda x: x['source-verification.json']['summary'].__setitem__('only_one_trailing_space_difference',8)),
      ('omitted edit', lambda x: x['source-verification.json']['comparisons'][1].__setitem__('edits',[])),
      ('false NFC match', lambda x: x['source-verification.json']['comparisons'][1].__setitem__('nfc_makes_equal',True)),
      ('bad source hash', lambda x: x['pilot.json']['verses'][0].__setitem__('sy_sha256_utf8','0'*64)),
      ('hidden supplied word', lambda x: x['pilot.json']['verses'][2]['supplied_target_words'].__setitem__('source_repeats_come_verb',True)),
      ('hidden verb reordering', lambda x: x['pilot.json']['verses'][7]['reordered_target_material'].__setitem__('source_verb','not source')),
      ('blank target', lambda x: x['pilot.json']['verses'][0]['el'].__setitem__('text','')),
      ('invented alignment', lambda x: x['pilot.json']['verses'][0]['alignments'][0].__setitem__('sy','not present')),
      ('target not aligned', lambda x: x['pilot.json']['verses'][0]['alignments'][0].__setitem__('he_proposed','not present')),
      ('reviewed verse', lambda x: x['pilot.json']['verses'][0].__setitem__('review_status','APPROVED')),
      ('fake human review', lambda x: x['pilot.json']['human_review'].__setitem__('qualified_syriac_completed',True)),
      ('English pivot', lambda x: x['pilot.json']['method'].__setitem__('english_pivot',True)),
      ('verified historical import', lambda x: x['pilot.json']['source'].__setitem__('historical_import_provenance_verified',True)),
      ('asserted scan collation', lambda x: x['pilot.json']['source'].__setitem__('printed_pointing_collation_completed',True)),
      ('localized name silently', lambda x: x['names-registry.json'][0].__setitem__('el_proposed','Ιωάννης')),
      ('pronunciation certainty', lambda x: x['names-registry.json'][0].__setitem__('pronunciation_verified',True)),
      ('lost source name', lambda x: x['names-registry.json'][0].__setitem__('syriac_source_form','ܝܫܘܥ')),
      ('settled 1:5', lambda x: x['john-1-1-5-review-02.json']['reviews'][4].__setitem__('main_alternative_selected','domination')),
      ('lost prior audit', lambda x: x['john-1-1-5-review-02.json']['reviews'][0].__setitem__('prior_draft_unchanged',False)),
      ('unpaired 1:5', lambda x: x['john-1-1-5-review-02.json']['reviews'][4]['alternatives'][0].__setitem__('he','')),
      ('missing rights evidence', lambda x: x['supporting-sources.json']['sources'][0].__setitem__('item_rights_evidence','')),
    ]
    for label, mutate in mutations:
        trial=copy.deepcopy(d)
        mutate(trial)
        try:
            check(trial)
        except (ValueError,KeyError,TypeError,IndexError):
            continue
        raise ValueError('negative mutation accepted: '+label)
    print(f'PASS: {len(mutations)} negative mutations rejected (integrity, not linguistic accuracy)')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test',action='store_true')
    parser.add_argument('--module',type=Path,help='Optional cached official Peshitta ZIP; requires published pysword reader')
    parser.add_argument('--baseline-pilot',type=Path,help='Optional existing immutable John1:1–5 pilot JSON')
    args=parser.parse_args()
    d={name:json.loads((ROOT/name).read_text()) for name in JSON_FILES}
    check(d)
    conf=(ROOT/'crosswire-peshitta-2.0.conf').read_bytes()
    need(sha(conf)==CONF,'actual bundled conf hash')
    need(b'Version=2.0' in conf and b'DistributionLicense=Public Domain' in conf,'affirmative specific config rights/version')
    manifest=(ROOT/'SHA256SUMS').read_text().splitlines()
    expected_files=set(JSON_FILES+['README.md','DRAFTS.md','crosswire-peshitta-2.0.conf','validate.py'])
    seen=set()
    for line in manifest:
        digest,name=line.split('  ',1)
        need(name in expected_files and name not in seen,'manifest paths')
        seen.add(name)
        need(sha((ROOT/name).read_bytes())==digest,'file checksum '+name)
    need(seen==expected_files,'complete manifest')
    print('PASS: 8 source/draft IDs, exact hashes/diffs, 5-verse audit, name/register/status gates and checksums')
    if args.baseline_pilot:
        base=args.baseline_pilot.read_bytes()
        a=d['john-1-1-5-review-02.json']
        need(sha(base)==a['baseline_pilot_sha256'],'baseline byte hash')
        for row, prior in zip(a['reviews'],json.loads(base)['verses']):
            need(row['sy']==prior['sy'] and row['prior_el']==prior['el']['text'] and row['prior_he']==prior['he']['text'],'unchanged audit baseline')
        print('PASS: original 1:1–5 source/targets preserved against provided baseline')
    if args.module:
        need(sha(args.module.read_bytes())==ZIP,'cached archive hash')
        from pysword.modules import SwordModules
        modules=SwordModules(str(args.module))
        modules.parse_modules()
        bible=modules.get_bible_from_module('Peshitta')
        for r in d['module-extract-john-1-6-13.json']:
            for clean,key in ((False,'raw_osis'),(True,'clean')):
                need(bible.get(books=['john'],chapters=[1],verses=[r['v']],clean=clean)==r[key],'repeat extraction '+str(r['v']))
        print('PASS: cached official ZIP hash and raw/clean extraction reproduced for all 8 verses')
    if args.self_test:
        self_test(d)
    print('NOT CERTIFICATION: independent qualified human review and fresh approval still required')

if __name__=='__main__':
    main()
