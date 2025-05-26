# URL Counter Tool

A powerful tool for archiving and analyzing URLs with machine learning capabilities.

## Features

- URL archiving with archive.ph integration
- Batch processing support
- Machine learning-based URL analysis
- Elasticsearch integration for full-text search
- Redis caching
- Rate limiting
- Comprehensive logging
- Prometheus metrics
- Docker support

## Prerequisites

- Python 3.11+
- Docker and Docker Compose
- Redis (optional)
- Elasticsearch (optional)

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/url-counter-tool.git
cd url-counter-tool
```

2. Run with Docker Compose:
```bash
docker-compose up -d
```

The application will be available at http://localhost:5000

## Manual Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Initialize the database:
```bash
python init_db.py
```

4. Start the application:
```bash
python archive_server.py
```

## Configuration

Configuration is managed through environment variables. Create a `.env` file with:

```env
FLASK_ENV=development
SECRET_KEY=your-secret-key
USE_REDIS=true
USE_ELASTICSEARCH=true
REDIS_URL=redis://localhost:6379/0
ELASTICSEARCH_URL=http://localhost:9200
```

See `config.py` for all available options.

## API Documentation

### Endpoints

- `POST /create-archive`: Archive a single URL
- `POST /batch-archive`: Archive multiple URLs
- `GET /archive-metadata/<archive_id>`: Get metadata for archived URL
- `GET /search`: Search archived URLs
- `GET /health`: Health check endpoint

### Example Usage

```python
import requests

# Archive a URL
response = requests.post('http://localhost:5000/create-archive', 
                        json={'url': 'http://example.com'})
print(response.json())
```

## Testing

Run the test suite:

```bash
pytest
```

Run with coverage:

```bash
pytest --cov=./ --cov-report=html
```

## Monitoring

The application exposes metrics at `/metrics` for Prometheus.

Access Grafana dashboards at http://localhost:3000

## Development

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Deployment

The application can be deployed to:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Any Docker-compatible hosting

See the deployment documentation in `docs/deployment.md` for details.

## Contributing

1. Check for open issues or create a new one
2. Fork the repository
3. Create a new branch
4. Make your changes
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- Create an issue for bug reports
- Join our Discord community
- Email support at support@example.com

## Acknowledgments

- archive.ph for archiving service
- All contributors
- Open source community 