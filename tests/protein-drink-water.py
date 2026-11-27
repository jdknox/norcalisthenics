import copy
import io
import json
import runpy
import subprocess
from unittest.mock import patch


tool = runpy.run_path('src/protein-drink-water.py')
estimates = tool['readEstimates']()
apple_reference = next(row for row in estimates if row['name'] == 'Apple juice')
apple = {
    'key':apple_reference['item_key'],
    'name':apple_reference['name'],
    'brand':apple_reference['brand'],
    'barcode':apple_reference['barcode'],
    'scoop_g':200,
    'water_content':99.6
}
renamed = dict(apple, name='Apple juice concentrate')
recipe = dict(apple, ingredients=[{'item_key':'water', 'grams':10}])
items = [
    apple,
    {'key':'tea', 'name':'Barley tea', 'ingredients':[{'item_key':'whey', 'grams':30}], 'tags':['drinks']},
    {'key':'milk', 'name':'Milk Tea; malt', 'tags':['tea']},
    {'key':'hk', 'name':'H.K. Tea (even SCM & EM)', 'tags':['tea']},
    {'key':'powder', 'name':'Green tea powder', 'tags':['drinks']},
    {'key':'new-juice', 'name':'New juice', 'scoop_g':250},
    {'key':'old', 'name':'Orange juice', 'archived':True},
    {'key':'food', 'name':'Cashew Pieces', 'tags':['snack mix']}
]
original = copy.deepcopy(items)
report = tool['buildReport'](items, 'live-revision', estimates)
assert items == original, 'report generation must not modify pantry data'
assert report['revision'] == 'live-revision'
assert report['pantry_item_count'] == 8 and report['archived_items_skipped'] == 1
assert len(report['candidates']) == 4 and len(report['deferred']) == 2
row = report['candidates'][0]
assert row['current_water_percent'] == 99.6, 'existing values remain visible and unchanged'
assert row['estimated_water_percent'] == 88.24
assert row['estimated_water_g'] == 176.5, 'water mass uses grams and reference percentage, not volume or kcal'
assert row['source_url'].startswith('https://') and row['reference']
assert all(row['estimated_water_percent'] == None for row in report['candidates'][1:]), 'unresearched drinks must not get invented percentages'
for row in report['deferred']:
    assert row['estimated_water_percent'] == None, 'powders and recipes cannot inherit a plain-drink estimate'

kefir_reference = next(row for row in estimates if row['name'] == 'Kefir')
kefir = {'key':kefir_reference['item_key'], 'name':kefir_reference['name'], 'brand':kefir_reference['brand'], 'barcode':kefir_reference['barcode'], 'scoop_g':240, 'water_content':90}
kefir_row = tool['buildReport']([kefir], 'revision', estimates)['candidates'][0]
assert kefir_row['estimated_water_percent'] == 90.07 and kefir_row['estimated_water_g'] == 216.2
assert kefir_row['current_water_percent'] == 90, 'reviewing kefir never changes its existing water value'
assert tool['buildReport']([dict(kefir, ingredients=[{'item_key':'water', 'grams':1}])], 'revision', estimates)['deferred'][0]['estimated_water_percent'] == None
assert tool['matchingEstimate'](renamed, estimates) == None, 'renamed products require review'
assert tool['matchingEstimate'](dict(apple, barcode='other'), estimates) == None
assert tool['buildReport']([recipe], 'revision', estimates)['deferred'][0]['estimated_water_percent'] == None
assert tool['buildReport']([dict(apple, scoop_g=None)], 'revision', estimates)['candidates'][0]['estimated_water_g'] == None

mock_response = json.dumps({'revision':'pi-revision', 'value':json.dumps({'scoop_items':items})})
patcher = patch('subprocess.check_output', return_value=mock_response)
read_mock = patcher.start()
revision, read_items = tool['readLivePantry']()
patcher.stop()
assert revision == 'pi-revision' and read_items == items
command = read_mock.call_args.args[0]
assert command[0] == 'ssh' and command[-2] == 'rpi', 'read from the Pi, not the checkout database'
assert command[-1] == 'curl --fail --silent --show-error --max-time 15 http://127.0.0.1:8010/api/storage?key=protein-loadout%3Av1', 'the only remote operation is the live storage GET'
output = io.StringIO()
patcher = patch('sys.stdout', output)
patcher.start()
tool['writeTSV'](report)
patcher.stop()
assert '88.2\t200.0\t176.5' in output.getvalue(), 'TSV uses compact numeric display'
print('Drink-water report: live GET destination, estimates, identity checks, exclusions, unknowns, water mass, read-only behavior, and TSV output passed.')
