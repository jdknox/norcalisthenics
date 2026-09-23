import sys
import os
import re
import html
import time
import urllib.request

def readLinks(inputPath):
    links = []
    inputFile = open(inputPath, 'r')
    lines = inputFile.readlines()
    inputFile.close()
    for line in lines:
        stripped = line.strip()
        if stripped == '':
            continue
        if stripped.startswith('#'):
            continue
        links.append(stripped)
    return links

def fetchPage(url):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    request = urllib.request.Request(url, headers=headers)
    response = urllib.request.urlopen(request)
    return response.read().decode('utf-8')

def extractTitle(page):
    titleMatch = re.search(r'<title>(.*?)</title>', page, re.DOTALL)
    if not titleMatch:
        return ''
    title = html.unescape(titleMatch.group(1))
    return title.split(' – ')[0].strip()

def extractTranscript(page):
    detailsMatch = re.search(r'<summary>Full transcript</summary>(.*?)</details>', page, re.DOTALL)
    if not detailsMatch:
        return None
    inner = detailsMatch.group(1)
    inner = re.sub(r'<br\s*/?>', '\n\n', inner)
    inner = re.sub(r'<[^>]+>', '', inner)
    inner = html.unescape(inner)
    return inner.strip()

def slugFromUrl(url):
    trimmed = url.rstrip('/')
    return trimmed.split('/')[-1]

def main():
    if len(sys.argv) < 2:
        print('usage: python3 fetch_blog_transcripts.py <links_file> [output_dir]')
        sys.exit(1)

    inputPath = sys.argv[1]
    outputDir = sys.argv[2] if len(sys.argv) > 2 else 'blog_transcripts'
    os.makedirs(outputDir, exist_ok=True)

    links = readLinks(inputPath)
    print(f'found {len(links)} links in {inputPath}')

    for url in links:
        slug = slugFromUrl(url)
        outputPath = outputDir + '/' + slug + '.txt'
        print(f'fetching {url}')
        page = fetchPage(url)
        title = extractTitle(page)
        transcript = extractTranscript(page)
        if transcript is None:
            print('  no transcript found, skipping')
            continue
        outputFile = open(outputPath, 'w')
        outputFile.write(title + '\n')
        outputFile.write(url + '\n\n')
        outputFile.write(transcript + '\n')
        outputFile.close()
        print(f'  wrote {outputPath}')
        time.sleep(1)

main()
