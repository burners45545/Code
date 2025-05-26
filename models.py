from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, Float, ForeignKey, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

# Association table for URL patterns
url_patterns = Table('url_patterns', Base.metadata,
    Column('url_id', Integer, ForeignKey('urls.id')),
    Column('pattern_id', Integer, ForeignKey('patterns.id'))
)

class URL(Base):
    __tablename__ = 'urls'
    
    id = Column(Integer, primary_key=True)
    original_url = Column(String(2048), nullable=False)
    archive_url = Column(String(2048))
    archive_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime)
    access_count = Column(Integer, default=0)
    
    # ML-related fields
    content_hash = Column(String(64))  # For duplicate detection
    content_embedding = Column(JSON)  # Vector representation of content
    similarity_score = Column(Float)  # Similarity to known patterns
    
    # Relationships
    url_metadata = relationship("ArchiveMetadata", back_populates="url", uselist=False)
    patterns = relationship("Pattern", secondary=url_patterns, back_populates="urls")
    features = relationship("URLFeature", back_populates="url")
    
    def to_dict(self):
        return {
            'id': self.id,
            'original_url': self.original_url,
            'archive_url': self.archive_url,
            'archive_date': self.archive_date.isoformat() if self.archive_date else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None,
            'access_count': self.access_count,
            'similarity_score': self.similarity_score
        }

class ArchiveMetadata(Base):
    __tablename__ = 'archive_metadata'
    
    id = Column(Integer, primary_key=True)
    url_id = Column(Integer, ForeignKey('urls.id'))
    archive_date = Column(DateTime)
    tweet_date = Column(DateTime)
    content_type = Column(String(100))
    content_length = Column(Integer)
    http_status = Column(Integer)
    
    # Enhanced metadata
    extracted_text = Column(String)
    sentiment_score = Column(Float)
    topics = Column(JSON)
    entities = Column(JSON)
    
    # ML features
    feature_vector = Column(JSON)
    cluster_id = Column(Integer)
    
    # Relationship
    url = relationship("URL", back_populates="url_metadata")
    
    def to_dict(self):
        return {
            'id': self.id,
            'url_id': self.url_id,
            'archive_date': self.archive_date.isoformat() if self.archive_date else None,
            'tweet_date': self.tweet_date.isoformat() if self.tweet_date else None,
            'content_type': self.content_type,
            'sentiment_score': self.sentiment_score,
            'topics': self.topics,
            'entities': self.entities
        }

class Pattern(Base):
    __tablename__ = 'patterns'
    
    id = Column(Integer, primary_key=True)
    pattern_type = Column(String)  # URL structure, content type, etc.
    pattern_value = Column(String)
    confidence_score = Column(Float)
    last_updated = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    urls = relationship("URL", secondary=url_patterns, back_populates="patterns")
    
    def to_dict(self):
        return {
            'id': self.id,
            'pattern_type': self.pattern_type,
            'pattern_value': self.pattern_value,
            'confidence_score': self.confidence_score,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'is_active': self.is_active
        }

class URLFeature(Base):
    __tablename__ = 'url_features'
    
    id = Column(Integer, primary_key=True)
    url_id = Column(Integer, ForeignKey('urls.id'))
    feature_name = Column(String)
    feature_value = Column(Float)
    importance_score = Column(Float)
    last_updated = Column(DateTime, default=datetime.utcnow)
    
    # Relationship
    url = relationship("URL", back_populates="features")
    
    def to_dict(self):
        return {
            'id': self.id,
            'url_id': self.url_id,
            'feature_name': self.feature_name,
            'feature_value': self.feature_value,
            'importance_score': self.importance_score,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        } 