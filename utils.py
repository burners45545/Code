import re
from urllib.parse import urlparse

def isArchivedUrl(url):
    """Check if a URL is from an archive service."""
    archive_domains = ['archive.ph', 'archive.is', 'archive.today', 'archive.fo']
    parsed = urlparse(url)
    return any(domain in parsed.netloc for domain in archive_domains)

def extractArchiveInfo(url):
    """Extract archive ID and other info from an archive URL."""
    parsed = urlparse(url)
    
    # Remove 'wip/' if present
    path = parsed.path.replace('wip/', '')
    
    # Extract archive ID (everything after the last slash)
    archive_id = path.split('/')[-1] if path else None
    
    return {
        'archiveId': archive_id,
        'domain': parsed.netloc,
        'isWIP': 'wip' in parsed.path,
        'fullPath': parsed.path
    }

def extractTwitterInfo(url):
    """Extract tweet ID and other info from a Twitter/X URL."""
    patterns = [
        r'(?:twitter|x)\.com/\w+/status/(\d+)',
        r'(?:twitter|x)\.com/i/status/(\d+)',
        r'(?:twitter|x)\.com/\w+/statuses/(\d+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return {
                'tweetId': match.group(1),
                'isTwitterUrl': True
            }
    
    return {
        'tweetId': None,
        'isTwitterUrl': False
    } 