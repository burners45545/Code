# Developer Guide for URL Counter Tool

## Setup Instructions

1. Clone this repository
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy `config.template.py` to `config.py` and update with your settings
5. Initialize the database:
   ```bash
   python init_db.py
   ```

## Development Environment

- Python 3.11+ required
- Node.js for JavaScript development
- SQLite for database

## Project Structure

- `archive_server.py` - Main server application
- `url-analyzer.js` - Core URL analysis functionality
- `models/` - Database models and schemas
- `tests/` - Test suite
- `css/` - Styling files
- `js/` - JavaScript modules

## Important Notes

1. Never commit sensitive data or API keys
2. Use the config template for configuration
3. Run tests before submitting PRs:
   ```bash
   python -m pytest tests/
   ```
4. Follow the existing code style and conventions

## API Endpoints

- `/api/analyze` - URL analysis endpoint
- `/api/archive` - Archive creation endpoint
- `/health` - Health check endpoint

## Common Issues

1. Server won't start:
   - Check config.py settings
   - Verify port availability
   - Check log files

2. Archive functionality:
   - Requires valid API keys
   - Check network connectivity
   - Verify archive.ph access

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## Security Considerations

- Don't store sensitive data in code
- Use environment variables for secrets
- Follow secure coding practices
- Validate all inputs 