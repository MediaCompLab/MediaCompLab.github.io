@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

echo.
echo === Media Comprehension Lab site updater (Astro) ===
echo Working directory: %cd%
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found on PATH.
  goto fail
)

where git >nul 2>nul
if errorlevel 1 (
  echo git was not found on PATH.
  goto fail
)

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if /i not "!BRANCH!"=="main" (
  echo Current branch is "!BRANCH!", but GitHub Pages deploys from "main".
  set /p CONTINUE=Continue anyway? [y/N] 
  if /i not "!CONTINUE!"=="y" goto done
)

echo Running local build check...
call npm run build
if errorlevel 1 goto fail

echo.
echo Verifying the build against the archived Hexo output (if present)...
if exist "..\hexo\public\index.html" (
  call npm run verify
  if errorlevel 1 (
    echo.
    echo Verification reported differences. Review them before pushing.
    set /p CONTINUE=Continue anyway? [y/N] 
    if /i not "!CONTINUE!"=="y" goto done
  )
) else (
  echo Skipped: ..\hexo\public was not found.
)

echo.
echo Checking for changes...
git status --short
for /f %%C in ('git status --porcelain ^| find /c /v ""') do set "CHANGE_COUNT=%%C"
if "%CHANGE_COUNT%"=="0" (
  echo.
  echo No source changes to commit. Your site is already up to date locally.
  goto done
)

echo.
set "DEFAULT_MESSAGE=Update site %date% %time%"
set /p COMMIT_MESSAGE=Commit message [%DEFAULT_MESSAGE%]: 
if "%COMMIT_MESSAGE%"=="" set "COMMIT_MESSAGE=%DEFAULT_MESSAGE%"

echo.
echo Staging changes...
git add -A
if errorlevel 1 goto fail

echo Committing...
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto fail

echo Pushing to GitHub...
git push
if errorlevel 1 goto fail

echo.
echo Done. GitHub Actions will build and deploy the site.
goto done

:fail
echo.
echo Update failed. Check the messages above.

:done
echo.
pause
