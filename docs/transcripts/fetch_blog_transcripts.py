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

def stripTags(fragment):
    return re.sub(r'<[^>]+>', '', fragment)

def extractTitle(page):
    titleMatch = re.search(r'<h1 class="op-headline"[^>]*><a[^>]*>(.*?)</a></h1>', page, re.DOTALL)
    if not titleMatch:
        return None
    return html.unescape(titleMatch.group(1)).strip()

def extractIsoDate(page):
    dateMatch = re.search(r'<time[^>]*datetime="(\d{4}-\d{2}-\d{2})T', page)
    if not dateMatch:
        return None
    return dateMatch.group(1)

def extractVideoId(page):
    videoMatch = re.search(r'youtube\.com/embed/([a-zA-Z0-9_-]+)', page)
    if not videoMatch:
        return None
    return videoMatch.group(1)

def extractEntryContent(page):
    contentMatch = re.search(r'<div class="entry-content" itemprop="text">(.*)', page, re.DOTALL)
    if not contentMatch:
        return None
    return contentMatch.group(1)

def extractSynopsis(entryContent):
    synopsisMatch = re.search(r'<p class="wp-block-paragraph">(.*?)</p>', entryContent, re.DOTALL)
    if not synopsisMatch:
        return ''
    return html.unescape(stripTags(synopsisMatch.group(1))).strip()

def extractBullets(entryContent):
    listMatch = re.search(r'<ul class="wp-block-list">(.*?)</ul>', entryContent, re.DOTALL)
    if not listMatch:
        return []
    items = re.findall(r'<li>(.*?)</li>', listMatch.group(1), re.DOTALL)
    bullets = []
    for item in items:
        bullets.append(html.unescape(stripTags(item)).strip())
    return bullets

def extractTranscript(page):
    detailsMatch = re.search(r'<summary>Full transcript</summary>(.*?)</details>', page, re.DOTALL)
    if not detailsMatch:
        return None
    inner = detailsMatch.group(1)
    inner = re.sub(r'<br\s*/?>', '\n\n', inner)
    inner = stripTags(inner)
    inner = html.unescape(inner)
    return inner.strip()

def slugFromUrl(url):
    trimmed = url.rstrip('/')
    return trimmed.split('/')[-1]

def buildSynopsisLine(synopsis, videoId):
    videoUrl = f'https://www.youtube.com/watch?v={videoId}'
    prefix = 'In this video'
    if synopsis.startswith(prefix):
        remainder = synopsis[len(prefix):]
        return f'[In this video]({videoUrl}){remainder}'
    return f'[In this video]({videoUrl}) {synopsis}'

def buildMarkdown(title, isoDate, synopsisLine, bullets, transcript):
    lines = []
    lines.append(f'# {title}')
    lines.append(isoDate)
    lines.append('')
    lines.append(synopsisLine)
    lines.append('')
    for bullet in bullets:
        lines.append(f'- {bullet}')
    lines.append('')
    lines.append('---')
    lines.append('')
    lines.append('## Full transcript')
    lines.append('')
    lines.append(transcript)
    lines.append('')
    return '\n'.join(lines)

def processLink(url, outputDir):
    slug = slugFromUrl(url)
    print(f'fetching {url}')
    page = fetchPage(url)

    title = extractTitle(page)
    isoDate = extractIsoDate(page)
    videoId = extractVideoId(page)
    transcript = extractTranscript(page)

    if not title or not isoDate or not videoId or not transcript:
        print('  missing title, date, video id, or transcript, skipping')
        return

    entryContent = extractEntryContent(page)
    synopsis = extractSynopsis(entryContent) if entryContent else ''
    bullets = extractBullets(entryContent) if entryContent else []
    synopsisLine = buildSynopsisLine(synopsis, videoId)

    markdown = buildMarkdown(title, isoDate, synopsisLine, bullets, transcript)

    yearTwoDigit = isoDate[2:]
    outputPath = outputDir + '/' + yearTwoDigit + '_' + slug + '.' + videoId + '.md'
    outputFile = open(outputPath, 'w')
    outputFile.write(markdown)
    outputFile.close()
    print(f'  wrote {outputPath}')

def main():
    if len(sys.argv) < 2:
        print('usage: python3 fetch_blog_transcripts.py <links_file> [output_dir]')
        sys.exit(1)

    inputPath = sys.argv[1]
    outputDir = sys.argv[2] if len(sys.argv) > 2 else 'processed_transcripts'
    os.makedirs(outputDir, exist_ok=True)

    links = readLinks(inputPath)
    print(f'found {len(links)} links in {inputPath}')

    for url in links:
        processLink(url, outputDir)
        time.sleep(1)

main()
