import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
import joblib
from datetime import datetime
import hashlib
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models import URL, ArchiveMetadata, Pattern, URLFeature
import json
import re
from collections import defaultdict

class MLAnalyzer:
    def __init__(self, session: Session):
        self.session = session
        self.vectorizer = TfidfVectorizer(max_features=1000)
        self.scaler = StandardScaler()
        self.clusterer = DBSCAN(eps=0.3, min_samples=2)
        self.feature_importance = {}
        self.pattern_cache = {}
        
    def compute_content_hash(self, content: str) -> str:
        """Generate a hash of the content for duplicate detection."""
        return hashlib.sha256(content.encode()).hexdigest()
        
    def extract_features(self, url: str, content: str) -> Dict[str, float]:
        """Extract numerical features from URL and content."""
        features = {
            'url_length': len(url),
            'content_length': len(content),
            'number_count': sum(c.isdigit() for c in url),
            'special_char_count': sum(not c.isalnum() for c in url),
            'subdomain_count': url.count('.') - 1 if '://' in url else url.count('.'),
            'path_depth': len([p for p in url.split('/') if p]) - 1 if '://' in url else len([p for p in url.split('/') if p])
        }
        
        # Add content-based features
        features.update({
            'avg_word_length': np.mean([len(w) for w in content.split()]) if content else 0,
            'word_count': len(content.split()),
            'unique_words': len(set(content.split())),
        })
        
        return features
        
    def compute_embedding(self, content: str) -> List[float]:
        """Compute vector embedding for content."""
        if not content:
            return []
            
        # Transform content to TF-IDF vector
        try:
            vector = self.vectorizer.transform([content]).toarray()[0]
            return vector.tolist()
        except Exception:
            # If vectorizer not fitted, fit it first
            self.vectorizer.fit([content])
            vector = self.vectorizer.transform([content]).toarray()[0]
            return vector.tolist()
            
    def detect_patterns(self, url: str, content: str) -> List[Dict[str, Any]]:
        """Detect patterns in URL and content."""
        patterns = []
        
        # URL structure patterns
        url_patterns = {
            'has_date': bool(re.search(r'\d{4}[-/]\d{2}[-/]\d{2}', url)),
            'has_query_params': '?' in url,
            'has_fragment': '#' in url,
            'is_archive': bool(re.search(r'archive\.(ph|is|today)', url)),
            'is_social_media': bool(re.search(r'(twitter|x|facebook|instagram)\.com', url))
        }
        
        for pattern_type, is_present in url_patterns.items():
            if is_present:
                patterns.append({
                    'pattern_type': f'url_structure_{pattern_type}',
                    'pattern_value': str(is_present),
                    'confidence_score': 1.0
                })
        
        # Content patterns
        if content:
            # Detect common content structures
            content_patterns = {
                'has_json': bool(re.search(r'^\s*{.*}\s*$', content, re.DOTALL)),
                'has_html': bool(re.search(r'<[^>]+>', content)),
                'has_markdown': bool(re.search(r'[#*_`]', content))
            }
            
            for pattern_type, is_present in content_patterns.items():
                if is_present:
                    patterns.append({
                        'pattern_type': f'content_structure_{pattern_type}',
                        'pattern_value': str(is_present),
                        'confidence_score': 1.0
                    })
        
        return patterns
        
    def compute_similarity_score(self, url: URL) -> float:
        """Compute similarity score against known patterns."""
        if not url.content_embedding:
            return 0.0
            
        # Get all patterns from cache or database
        if not self.pattern_cache:
            patterns = self.session.query(Pattern).filter_by(is_active=True).all()
            self.pattern_cache = {p.id: p for p in patterns}
        
        if not self.pattern_cache:
            return 0.0
            
        # Compute similarity against each pattern
        similarities = []
        for pattern in self.pattern_cache.values():
            try:
                pattern_embedding = json.loads(pattern.pattern_value) if isinstance(pattern.pattern_value, str) else pattern.pattern_value
                if pattern_embedding and len(pattern_embedding) == len(url.content_embedding):
                    similarity = cosine_similarity(
                        [url.content_embedding],
                        [pattern_embedding]
                    )[0][0]
                    similarities.append(similarity * pattern.confidence_score)
            except Exception:
                continue
                
        return max(similarities) if similarities else 0.0
        
    def update_feature_importance(self):
        """Update feature importance scores based on URL clusters."""
        features = self.session.query(URLFeature).all()
        feature_values = defaultdict(list)
        
        for feature in features:
            feature_values[feature.feature_name].append(feature.feature_value)
            
        for feature_name, values in feature_values.items():
            if len(values) > 1:
                # Compute importance based on variance and mean
                variance = np.var(values)
                mean = np.mean(values)
                importance = variance / (mean if mean != 0 else 1)
                self.feature_importance[feature_name] = importance
                
    def analyze_url(self, url: str, content: str) -> Dict[str, Any]:
        """Analyze a URL and its content, updating the ML models."""
        # Extract features
        features = self.extract_features(url, content)
        content_hash = self.compute_content_hash(content)
        content_embedding = self.compute_embedding(content)
        patterns = self.detect_patterns(url, content)
        
        # Create or update URL record
        url_obj = self.session.query(URL).filter_by(original_url=url).first()
        if not url_obj:
            url_obj = URL(
                original_url=url,
                content_hash=content_hash,
                content_embedding=content_embedding,
                created_at=datetime.utcnow()
            )
            self.session.add(url_obj)
        else:
            url_obj.last_accessed = datetime.utcnow()
            url_obj.access_count += 1
            url_obj.content_embedding = content_embedding
            
        # Update features
        for feature_name, feature_value in features.items():
            feature = URLFeature(
                url=url_obj,
                feature_name=feature_name,
                feature_value=feature_value,
                importance_score=self.feature_importance.get(feature_name, 0.0)
            )
            self.session.add(feature)
            
        # Update patterns
        for pattern_data in patterns:
            pattern = Pattern(
                pattern_type=pattern_data['pattern_type'],
                pattern_value=pattern_data['pattern_value'],
                confidence_score=pattern_data['confidence_score']
            )
            self.session.add(pattern)
            url_obj.patterns.append(pattern)
            
        # Compute similarity score
        url_obj.similarity_score = self.compute_similarity_score(url_obj)
        
        # Commit changes
        self.session.commit()
        
        return {
            'url_id': url_obj.id,
            'features': features,
            'patterns': patterns,
            'similarity_score': url_obj.similarity_score,
            'is_known_pattern': url_obj.similarity_score > 0.8
        }
        
    def save_models(self, path: str):
        """Save ML models to disk."""
        joblib.dump({
            'vectorizer': self.vectorizer,
            'scaler': self.scaler,
            'clusterer': self.clusterer,
            'feature_importance': self.feature_importance
        }, path)
        
    def load_models(self, path: str):
        """Load ML models from disk."""
        try:
            models = joblib.load(path)
            self.vectorizer = models['vectorizer']
            self.scaler = models['scaler']
            self.clusterer = models['clusterer']
            self.feature_importance = models['feature_importance']
        except Exception as e:
            print(f"Error loading models: {e}")
            # Initialize new models if loading fails
            pass 