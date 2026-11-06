#!/usr/bin/env python3
import hashlib
import sys

source_dir, output_dir = sys.argv[1:]
handle = open(f'{source_dir}/dashboard.html')
html = handle.read()
handle.close()

for name, attribute in [('dashboard.css', 'href'), ('dashboard.js', 'src')]:
    handle = open(f'{source_dir}/{name}', 'rb')
    content = handle.read()
    handle.close()
    version = hashlib.sha256(content).hexdigest()[:16]
    reference = f'{attribute}="{name}"'
    if html.count(reference) != 1:
        raise ValueError(f'Expected one {reference} in dashboard.html')
    html = html.replace(reference, f'{attribute}="{name}?v={version}"')
    handle = open(f'{output_dir}/{name}', 'wb')
    handle.write(content)
    handle.close()

handle = open(f'{output_dir}/dashboard.html', 'w')
handle.write(html)
handle.close()
