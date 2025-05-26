# Create a timestamp for the zip file name
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$projectName = "URL_Counter_Tool"
$zipName = "${projectName}_${timestamp}.zip"

# Create a temporary directory for the files to zip
$tempDir = ".\temp_for_zip"
New-Item -ItemType Directory -Force -Path $tempDir

# Copy only the necessary files
$filesToCopy = @(
    "archive_server.py",
    "archive_server1.py",
    "url-analyzer.js",
    "run.py",
    "requirements.txt",
    "server_manager.py",
    "README.md",
    "prometheus.yml",
    "docker-compose.yml",
    "Dockerfile",
    "tasks.py",
    "init_db.py",
    "config.py",
    "utils.py",
    "init_ml.py",
    "models.py",
    "ml_analyzer.py",
    "index.html",
    "start_server.bat"
)

# Copy directories
$dirsToCopy = @(
    "css",
    "js",
    "models"
)

# Copy individual files
foreach ($file in $filesToCopy) {
    if (Test-Path $file) {
        Copy-Item $file -Destination $tempDir
    }
}

# Copy directories
foreach ($dir in $dirsToCopy) {
    if (Test-Path $dir) {
        Copy-Item $dir -Destination $tempDir -Recurse
    }
}

# Create the zip file
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -Force

# Clean up temporary directory
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Created share package: $zipName"
Write-Host "You can now share this ZIP file with your collaborator."
Write-Host "Instructions for your collaborator:"
Write-Host "1. Extract the ZIP file"
Write-Host "2. Open the extracted folder in Cursor AI"
Write-Host "3. Run these commands to set up the environment:"
Write-Host "   python -m venv venv311"
Write-Host "   .\venv311\Scripts\pip install -r requirements.txt"
Write-Host "4. Run start_server.bat to start the server" 