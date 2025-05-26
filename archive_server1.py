from flask import Flask, jsonify, request
from flask_caching import Cache
from bs4 import BeautifulSoup
import requests
from datetime import datetime, timedelta
import re
import time
import json
from urllib.parse import urlparse, parse_qs
import logging
from logging.handlers import RotatingFileHandler
import os
from functools import wraps
import random

app = Flask(__name__)

# Configure logging
if not os.path.exists('logs'):
    os.makedirs('logs')

logging.basicConfig(level=logging.INFO)
handler = RotatingFileHandler('logs/archive_server.log', maxBytes=10000000, backupCount=5)
handler.setFormatter(logging.Formatter(
    '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
))
app.logger.addHandler(handler)

# Configure caching
cache_config = {
    'CACHE_TYPE': 'filesystem',
    'CACHE_DIR': 'cache',
    'CACHE_DEFAULT_TIMEOUT': 86400  # 24 hours
}
app.config.from_mapping(cache_config)
cache = Cache(app)

# Rate limiting configuration
RATE_LIMIT = {
    'requests': {},
    'window': 60,  # 1 minute window
    'max_requests': 30  # max requests per window
}

class RequestBlockedException(Exception):
    pass

def rate_limit(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        now = time.time()
        client_ip = request.remote_addr

        # Clean up old entries
        RATE_LIMIT['requests'] = {
            ip: timestamps for ip, timestamps in RATE_LIMIT['requests'].items()
            if timestamps[-1] > now - RATE_LIMIT['window']
        }

        # Initialize client's timestamp list
        if client_ip not in RATE_LIMIT['requests']:
            RATE_LIMIT['requests'][client_ip] = []

        # Add current timestamp
        RATE_LIMIT['requests'][client_ip].append(now)

        # Remove timestamps outside the window
        RATE_LIMIT['requests'][client_ip] = [
            t for t in RATE_LIMIT['requests'][client_ip]
            if t > now - RATE_LIMIT['window']
        ]

        # Check if rate limit is exceeded
        if len(RATE_LIMIT['requests'][client_ip]) > RATE_LIMIT['max_requests']:
            raise RequestBlockedException("Rate limit exceeded")

        return func(*args, **kwargs)
    return wrapper

def get_random_user_agent():
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    ]
    return random.choice(user_agents)

def extract_tweet_id(url):
    """Extract tweet ID from various Twitter/X URL formats."""
    patterns = [
        r'(?:twitter|x)\.com/\w+/status/(\d+)',
        r'(?:twitter|x)\.com/i/status/(\d+)',
        r'(?:twitter|x)\.com/\w+/statuses/(\d+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def parse_twitter_date(date_str):
    """Parse Twitter date formats."""
    formats = [
        '%Y-%m-%dT%H:%M:%S.%fZ',
        '%Y-%m-%dT%H:%M:%SZ',
        '%a %b %d %H:%M:%S %z %Y',
        '%Y-%m-%d %H:%M:%S %z',
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None

class ArchivePhParser:
    def __init__(self, html_content):
        self.soup = BeautifulSoup(html_content, 'html.parser')
        
    def get_original_url(self):
        """Extract original URL from archive.ph page."""
        # Try multiple methods to find the original URL
        methods = [
            lambda: self.soup.find('meta', {'property': 'og:url'})['content'],
            lambda: self.soup.find('link', {'rel': 'canonical'})['href'],
            lambda: self.soup.find('input', {'id': 'originalUrl'})['value'],
            lambda: self.soup.find('meta', {'name': 'original-url'})['content'],
        ]
        
        for method in methods:
            try:
                url = method()
                if url and ('twitter.com' in url or 'x.com' in url):
                    return url
            except (TypeError, KeyError, AttributeError):
                continue
        
        return None

    def get_archive_date(self):
        """Extract archive date from archive.ph page."""
        methods = [
            lambda: self.soup.find('meta', {'property': 'article:modified_time'})['content'],
            lambda: self.soup.find('meta', {'name': 'archive-date'})['content'],
            lambda: self.soup.find(class_='archive-date').text,
        ]
        
        for method in methods:
            try:
                date_str = method()
                date = parse_twitter_date(date_str)
                if date:
                    return date
            except (TypeError, KeyError, AttributeError, ValueError):
                continue
        
        return None

    def get_tweet_date(self):
        """Extract tweet date from archived Twitter/X page."""
        methods = [
            lambda: self.soup.find('time')['datetime'],
            lambda: self.soup.find('span', {'data-time': True})['data-time'],
            lambda: self.soup.find(class_='tweet-timestamp')['title'],
        ]
        
        for method in methods:
            try:
                date_str = method()
                date = parse_twitter_date(date_str)
                if date:
                    return date
            except (TypeError, KeyError, AttributeError, ValueError):
                continue
        
        return None

@app.route('/archive-metadata/<archive_id>', methods=['GET'])
@rate_limit
@cache.memoize(timeout=86400)  # Cache for 24 hours
def get_archive_metadata(archive_id):
    try:
        app.logger.info(f"Processing archive ID: {archive_id}")
        
        # Fetch the archive.ph page with retries
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                headers = {
                    'User-Agent': get_random_user_agent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'DNT': '1',
                }
                
                archive_url = f'https://archive.ph/{archive_id}'
                response = requests.get(archive_url, headers=headers, timeout=10)
                response.raise_for_status()
                break
            except requests.RequestException as e:
                if attempt == max_retries - 1:
                    raise
                time.sleep(retry_delay * (attempt + 1))
                continue

        parser = ArchivePhParser(response.text)
        
        original_url = parser.get_original_url()
        if not original_url:
            raise ValueError("Could not extract original URL")

        archive_date = parser.get_archive_date()
        tweet_date = parser.get_tweet_date()

        # Format dates
        formatted_archive_date = archive_date.strftime('%d %b %Y') if archive_date else None
        formatted_tweet_date = tweet_date.strftime('%d %b %Y') if tweet_date else None

        result = {
            'originalUrl': original_url,
            'archiveDate': formatted_archive_date,
            'tweetDate': formatted_tweet_date,
            'tweetId': extract_tweet_id(original_url),
            'metadata': {
                'archiveId': archive_id,
                'fetchedAt': datetime.utcnow().isoformat(),
                'isTwitterUrl': bool(extract_tweet_id(original_url))
            }
        }

        app.logger.info(f"Successfully processed {archive_id}: {json.dumps(result)}")
        return jsonify(result)

    except RequestBlockedException:
        app.logger.warning(f"Rate limit exceeded for IP: {request.remote_addr}")
        return jsonify({
            'error': 'Rate limit exceeded',
            'retryAfter': RATE_LIMIT['window']
        }), 429

    except requests.RequestException as e:
        app.logger.error(f"Request error for {archive_id}: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch archive page',
            'details': str(e)
        }), 503

    except Exception as e:
        app.logger.error(f"Error processing {archive_id}: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.route('/create-archive', methods=['POST'])
@rate_limit
def create_archive():
    try:
        data = request.get_json()
        if not data or 'url' not in data:
            return jsonify({
                'error': 'Missing URL parameter',
                'details': 'Please provide a URL to archive'
            }), 400

        url = data['url']
        app.logger.info(f"Creating archive for URL: {url}")

        # Validate URL
        try:
            parsed = urlparse(url)
            if not all([parsed.scheme, parsed.netloc]):
                raise ValueError("Invalid URL format")
        except Exception as e:
            return jsonify({
                'error': 'Invalid URL',
                'details': str(e)
            }), 400

        # Submit URL to archive.ph
        headers = {
            'User-Agent': get_random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Content-Type': 'application/x-www-form-urlencoded',
            'DNT': '1',
        }

        # First, try to submit the URL
        submit_url = 'https://archive.ph/submit/'
        max_retries = 3
        retry_delay = 1
        archive_url = None

        for attempt in range(max_retries):
            try:
                response = requests.post(
                    submit_url,
                    data={'url': url},
                    headers=headers,
                    timeout=30,
                    allow_redirects=True
                )
                response.raise_for_status()

                # Check if we were redirected to an archive page
                final_url = response.url
                if 'archive.ph/' in final_url:
                    archive_url = final_url
                    break

                time.sleep(2)  # Wait a bit before checking status
            except requests.RequestException as e:
                if attempt == max_retries - 1:
                    raise
                time.sleep(retry_delay * (attempt + 1))
                continue

        if not archive_url:
            return jsonify({
                'error': 'Failed to create archive',
                'details': 'Could not get archive URL after submission'
            }), 500

        # Extract archive ID from the URL
        archive_id = archive_url.split('/')[-1]

        result = {
            'status': 'success',
            'archiveUrl': archive_url,
            'archiveId': archive_id,
            'originalUrl': url,
            'timestamp': datetime.utcnow().isoformat()
        }

        app.logger.info(f"Successfully created archive: {json.dumps(result)}")
        return jsonify(result)

    except RequestBlockedException:
        app.logger.warning(f"Rate limit exceeded for IP: {request.remote_addr}")
        return jsonify({
            'error': 'Rate limit exceeded',
            'retryAfter': RATE_LIMIT['window']
        }), 429

    except requests.RequestException as e:
        app.logger.error(f"Request error while creating archive: {str(e)}")
        return jsonify({
            'error': 'Failed to create archive',
            'details': str(e)
        }), 503

    except Exception as e:
        app.logger.error(f"Error creating archive: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'cache': {
            'type': app.config['CACHE_TYPE'],
            'timeout': app.config['CACHE_DEFAULT_TIMEOUT']
        },
        'rate_limit': {
            'window': RATE_LIMIT['window'],
            'max_requests': RATE_LIMIT['max_requests']
        }
    })

if __name__ == '__main__':
    # Create cache directory if it doesn't exist
    if not os.path.exists('cache'):
        os.makedirs('cache')
        
    app.run(port=5000, debug=False) 