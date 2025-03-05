@echo off
echo ===================================
echo Node Module Remover GitHub Pusher
echo ===================================

:: Initialize Git repository if not already initialized
if not exist .git (
  echo Initializing Git repository...
  git init
  if %errorlevel% neq 0 (
    echo Error: Failed to initialize Git repository.
    pause
    exit /b %errorlevel%
  )
) else (
  echo Git repository already initialized.
)

:: Add all files to git
echo Adding files to Git...
git add .
if %errorlevel% neq 0 (
  echo Error: Failed to add files.
  pause
  exit /b %errorlevel%
)

:: Commit changes
echo Committing changes...
set /p commit_message=Enter commit message (default: "Initial commit"): 
if "%commit_message%"=="" set commit_message=Initial commit
git commit -m "%commit_message%"
if %errorlevel% neq 0 (
  echo Error: Failed to commit changes.
  pause
  exit /b %errorlevel%
)

:: Add remote repository if not already added
git remote -v | findstr "origin" > nul
if %errorlevel% neq 0 (
  echo Adding remote repository...
  git remote add origin https://github.com/sw-esports/SW-NO-DE-MODULE.git
) else (
  echo Remote repository already configured.
)

:: Set main branch and push
echo Pushing to GitHub...
git branch -M main
git push -u origin main
if %errorlevel% neq 0 (
  echo Error: Failed to push to GitHub.
  echo This might be because:
  echo 1. You don't have permission to push to this repository
  echo 2. The remote repository already has content that you need to pull first
  echo 3. Network issues
  pause
  exit /b %errorlevel%
)

echo ===================================
echo Successfully pushed to GitHub!
echo Repository: https://github.com/sw-esports/SW-NO-DE-MODULE
echo ===================================
pause
