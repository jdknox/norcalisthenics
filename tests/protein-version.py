import json
import runpy
import subprocess
from unittest.mock import patch


server = runpy.run_path('shared-server.py')
html_text = server['readTextFile']('protein-loadout.html')
version_html = server['versionHtmlScripts'](html_text)
commit_info = subprocess.check_output(['git', 'log', '-1', '--format=%cI%n%B'], text=True)
commit_date, commit_message = commit_info.split('\n', 1)
assert f"const PROTEIN_VERSION = '{commit_date}';" in version_html
message_json = json.dumps(commit_message.strip()).replace('<', '\\u003c')
assert f'const PROTEIN_COMMIT_MESSAGE = {message_json};' in version_html
assert 'class="site-version" title="${esc(PROTEIN_COMMIT_MESSAGE)}"' in version_html

first_date = '2026-11-06T11:32:42-06:00'
second_date = '2026-11-06T12:45:03-06:00'
message = 'Keep "quotes" & tags\n\nDo not execute </script><script>alert(1)</script>.'
patcher = patch('subprocess.check_output', side_effect=[first_date + '\n' + message, second_date + '\nNext commit\n'])
git_mock = patcher.start()
first_html = server['versionHtmlScripts'](html_text)
second_html = server['versionHtmlScripts'](html_text)
assert f"const PROTEIN_VERSION = '{first_date}';" in first_html
assert f"const PROTEIN_VERSION = '{second_date}';" in second_html, 'each response must use the latest commit without a server restart'
assert json.dumps(message).replace('<', '\\u003c') in first_html
assert '</script><script>alert(1)' not in first_html, 'commit messages cannot break out of the script element'
assert git_mock.call_count == 2
workout_html = server['readTextFile']('workout-recorder.html')
server['versionHtmlScripts'](workout_html)
assert git_mock.call_count == 2, 'unrelated pages do not read commit metadata'
patcher.stop()

print('Protein version: latest commit timestamp, message tooltip, updated responses, script escaping, and unchanged workout pages passed.')
