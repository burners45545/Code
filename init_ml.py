import os
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
import joblib

def init_ml_models():
    """Initialize and save ML models"""
    # Create models directory if it doesn't exist
    if not os.path.exists('models'):
        os.makedirs('models')
        print("Created models directory")

    # Initialize models
    vectorizer = TfidfVectorizer(max_features=1000)
    scaler = StandardScaler()
    clusterer = DBSCAN(eps=0.3, min_samples=2)
    
    # Create some initial feature importance scores
    feature_importance = {
        'url_length': 0.5,
        'content_length': 0.3,
        'number_count': 0.2,
        'special_char_count': 0.2,
        'subdomain_count': 0.4,
        'path_depth': 0.3,
        'avg_word_length': 0.2,
        'word_count': 0.3,
        'unique_words': 0.4
    }

    # Save models
    models = {
        'vectorizer': vectorizer,
        'scaler': scaler,
        'clusterer': clusterer,
        'feature_importance': feature_importance
    }
    
    joblib.dump(models, 'models/url_analyzer.joblib')
    print("Initialized and saved ML models")

if __name__ == '__main__':
    init_ml_models() 