# DO NOT SHARE - Sensitive Files and Directories

The following files and directories contain sensitive information and should NEVER be shared with external developers:

## Database Files
- `urls.db` - Contains user data and URL information
- Any other *.db files

## Configuration and Secrets
- `config.py` - Contains actual API keys and sensitive settings
- Any `.env` files
- Any files containing API keys or tokens

## Log Files
- `logs/` directory - Contains server logs with sensitive information
- Any `*.log` files
- `debug_output.html` - May contain sensitive debug information

## Cache and Temporary Files
- `cache/` directory - May contain sensitive cached data
- `__pycache__/` directory
- Any temporary files with sensitive data

## Version Control
- `.git/` directory - Contains commit history that might include sensitive data
- Any backup files of .git

## Virtual Environment
- `venv/` directory
- `venv311/` directory
- Any other virtual environment directories

## Runtime Data
- Any session files
- Runtime generated data files
- Memory dumps

## Development Artifacts
- IDE configuration files with sensitive paths
- Local development environment settings

## Security Notes
1. Always check files for sensitive data before sharing
2. Use the template files provided in the safe-to-share directory
3. Never share database dumps or backups
4. Remove any hardcoded credentials before sharing code

Remember: When in doubt, don't share it out! 