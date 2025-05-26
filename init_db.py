import os
import logging
from logging.handlers import RotatingFileHandler
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base
from config import Config

# Configure logging
if not os.path.exists(Config.LOG_DIR):
    os.makedirs(Config.LOG_DIR)

logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL),
    format=Config.LOG_FORMAT,
    handlers=[
        RotatingFileHandler(
            os.path.join(Config.LOG_DIR, 'init_db.log'),
            maxBytes=Config.LOG_MAX_BYTES,
            backupCount=Config.LOG_BACKUP_COUNT
        ),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def init_db():
    """Initialize the database with proper error handling"""
    try:
        # Create database engine
        engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
        logger.info(f"Creating database at {Config.SQLALCHEMY_DATABASE_URI}")

        # Create all tables
        Base.metadata.create_all(engine)
        logger.info("Database tables created successfully")

        # Create session factory
        Session = sessionmaker(bind=engine)
        
        # Test database connection
        session = Session()
        session.execute("SELECT 1")
        session.close()
        
        logger.info("Database connection test successful")
        return True

    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}", exc_info=True)
        raise

def main():
    try:
        init_db()
        logger.info("Database initialization completed successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        exit(1)

if __name__ == '__main__':
    main() 