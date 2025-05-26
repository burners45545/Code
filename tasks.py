from celery import Celery
from celery.exceptions import MaxRetriesExceededError
import logging
from logging.handlers import RotatingFileHandler
import os
from datetime import datetime
import requests
from urllib.parse import urlparse
import archiveis
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import URL, ArchiveMetadata
from config import Config
from ml_analyzer import MLAnalyzer

# Configure logging
if not os.path.exists(Config.LOG_DIR):
    os.makedirs(Config.LOG_DIR)

logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL),
    format=Config.LOG_FORMAT,
    handlers=[
        RotatingFileHandler(
            os.path.join(Config.LOG_DIR, 'tasks.log'),
            maxBytes=Config.LOG_MAX_BYTES,
            backupCount=Config.LOG_BACKUP_COUNT
        ),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Initialize Celery
celery = Celery('tasks',
                broker=Config.CELERY_BROKER_URL,
                backend=Config.CELERY_RESULT_BACKEND)

celery.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    task_soft_time_limit=3300,  # 55 minutes
    worker_max_tasks_per_child=200,
    worker_prefetch_multiplier=1
)

# Initialize SQLAlchemy
engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
Session = sessionmaker(bind=engine)

# Initialize ML Analyzer
ml_analyzer = MLAnalyzer(Session())

def validate_url(url):
    """Validate URL format and accessibility"""
    try:
        result = urlparse(url)
        if not all([result.scheme, result.netloc]):
            raise ValueError("Invalid URL format")
        
        response = requests.head(url, timeout=Config.REQUEST_TIMEOUT, 
                               allow_redirects=True, verify=Config.SSL_VERIFY)
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        raise ValueError(f"URL validation failed: {str(e)}")

@celery.task(bind=True, max_retries=3, default_retry_delay=60)
def archive_url(self, url):
    """Archive a single URL with retries and proper error handling"""
    logger.info(f"Starting archive task for URL: {url}")
    session = Session()
    
    try:
        # Validate URL
        validate_url(url)
        
        # Create archive
        archive_url = archiveis.capture(url)
        archive_id = archive_url.split('/')[-1]
        archive_date = archiveis.extract_date(archive_id)
        
        # Store in database
        url_obj = URL(
            original_url=url,
            archive_url=archive_url,
            archive_date=archive_date,
            status='completed',
            created_at=datetime.utcnow()
        )
        session.add(url_obj)
        
        # Analyze with ML
        try:
            ml_results = ml_analyzer.analyze_url(url)
            metadata = ArchiveMetadata(
                url_id=url_obj.id,
                ml_category=ml_results.get('category'),
                ml_confidence=ml_results.get('confidence'),
                created_at=datetime.utcnow()
            )
            session.add(metadata)
        except Exception as e:
            logger.warning(f"ML analysis failed for {url}: {str(e)}")
        
        session.commit()
        logger.info(f"Successfully archived URL: {url}")
        
        return {
            'status': 'success',
            'archive_url': archive_url,
            'archive_date': archive_date.isoformat() if archive_date else None,
            'url_id': url_obj.id
        }
        
    except Exception as e:
        session.rollback()
        logger.error(f"Failed to archive URL {url}: {str(e)}", exc_info=True)
        
        try:
            self.retry(exc=e)
        except MaxRetriesExceededError:
            # Update status in database after max retries
            try:
                url_obj = URL(
                    original_url=url,
                    status='failed',
                    error_message=str(e),
                    created_at=datetime.utcnow()
                )
                session.add(url_obj)
                session.commit()
            except Exception as db_error:
                logger.error(f"Failed to update database status: {str(db_error)}")
            
            raise Exception(f"Failed to archive URL after {self.max_retries} retries: {str(e)}")
    
    finally:
        session.close()

@celery.task(bind=True)
def batch_archive_urls(self, urls):
    """Process a batch of URLs"""
    logger.info(f"Starting batch archive for {len(urls)} URLs")
    results = []
    
    for url in urls:
        try:
            result = archive_url.delay(url)
            results.append({
                'url': url,
                'task_id': result.id,
                'status': 'submitted'
            })
        except Exception as e:
            logger.error(f"Failed to submit archive task for {url}: {str(e)}")
            results.append({
                'url': url,
                'status': 'failed',
                'error': str(e)
            })
    
    return {
        'status': 'success',
        'total_urls': len(urls),
        'results': results
    } 