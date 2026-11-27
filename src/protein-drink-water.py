#!/usr/bin/env python3
"""Read the Pi pantry and report drink-water estimates. Never write to storage."""

import argparse
import csv
import datetime
import json
import re
import subprocess
import sys


def readLivePantry():
    response_text = subprocess.check_output([
        'ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5', 'rpi',
        'curl --fail --silent --show-error --max-time 15 '
        'http://127.0.0.1:8010/api/storage?key=protein-loadout%3Av1'
    ], text=True, timeout=25)
    response = json.loads(response_text)
    if not response['value']:
        raise ValueError('The Pi returned no protein pantry data')
    payload = json.loads(response['value'])
    return response['revision'], payload['scoop_items']


def readEstimates():
    reference_path = __file__.rsplit('/', 1)[0] + '/../data/protein-drink-water-estimates.tsv'
    handle = open(reference_path, 'r', encoding='utf-8', newline='')
    estimates = list(csv.DictReader(handle, delimiter='\t'))
    handle.close()
    for estimate in estimates:
        percent = float(estimate['water_percent'])
        if not 0 <= percent <= 100:
            raise ValueError('Invalid water percentage for ' + estimate['name'])
    return estimates


def matchingEstimate(item, estimates):
    for estimate in estimates:
        if estimate['item_key'] != item['key']:
            continue
        # A renamed/replaced item needs another review, even if its ID survived.
        for field in ['name', 'brand', 'barcode']:
            if (item.get(field) or '') != estimate[field]:
                return None
        return estimate
    return None


def drinkDisposition(item):
    name = item['name'].casefold()
    tags = [tag.casefold() for tag in item.get('tags', [])]
    drink_name = re.search(r'\b(juice|tea|water|coffee|chai|kvas|квас|latte|milk|shake|kefir|lassi)\b', name)
    if not drink_name and 'drinks' not in tags:
        return '', ''
    if item.get('ingredients'):
        return 'deferred', 'Recipe: use its actual ingredients and added water; do not apply a plain-drink percentage.'
    if re.search(r'\b(protein|powder|syrup|condensed|evaporated)\b', name):
        return 'deferred', 'Concentrated ingredient or mix: use its composition rather than a finished-drink estimate.'
    return 'candidate', 'Needs a matching composition reference; no percentage inferred from kcal alone.'


def buildReport(items, revision, estimates):
    candidates = []
    deferred = []
    archived_count = 0
    for item in items:
        if item.get('archived'):
            archived_count += 1
            continue
        disposition, reason = drinkDisposition(item)
        if not disposition:
            continue
        estimate = matchingEstimate(item, estimates) if disposition == 'candidate' else None
        percent = float(estimate['water_percent']) if estimate else None
        serving_g = item.get('scoop_g')
        water_g = None
        if percent != None and serving_g != None:
            water_g = round(float(serving_g)*percent/100, 1)
        row = {
            'item_key':item['key'],
            'name':item['name'],
            'brand':item.get('brand') or '',
            'barcode':item.get('barcode') or '',
            'current_water_percent':item.get('water_content'),
            'estimated_water_percent':percent,
            'serving_g':serving_g,
            'estimated_water_g':water_g,
            'status':'estimate' if estimate else disposition,
            'reference':estimate['reference'] if estimate else '',
            'source_url':estimate['source_url'] if estimate else '',
            'note':estimate['note'] if estimate else reason
        }
        if disposition == 'deferred':
            deferred.append(row)
        else:
            candidates.append(row)
    candidates.sort(key=drinkSortKey)
    deferred.sort(key=drinkSortKey)
    return {
        'source':'Pi rpi / localhost:8010 / protein-loadout:v1 (GET only)',
        'revision':revision,
        'fetched_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'pantry_item_count':len(items),
        'archived_items_skipped':archived_count,
        'candidates':candidates,
        'deferred':deferred
    }


def drinkSortKey(row):
    return row['estimated_water_percent'] == None, row['name'].casefold(), row['brand'].casefold()


def writeTSV(report):
    fields = ['status', 'name', 'brand', 'current_water_percent', 'estimated_water_percent',
              'serving_g', 'estimated_water_g', 'item_key', 'barcode', 'reference', 'source_url', 'note']
    writer = csv.DictWriter(sys.stdout, fieldnames=fields, delimiter='\t', lineterminator='\n')
    writer.writeheader()
    for row in report['candidates'] + report['deferred']:
        display = row.copy()
        for field in ['current_water_percent', 'estimated_water_percent', 'serving_g', 'estimated_water_g']:
            if display[field] != None:
                display[field] = f'{float(display[field]):.1f}'
        writer.writerow(display)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--format', choices=['json', 'tsv'], default='json')
    args = parser.parse_args()
    estimates = readEstimates()
    revision, items = readLivePantry()
    report = buildReport(items, revision, estimates)
    if args.format == 'tsv':
        writeTSV(report)
    else:
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
