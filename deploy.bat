@echo off
cd /d "%~dp0"

echo ================================
echo DEPLOY PROJEKTU DOMOWE
echo ================================
echo Folder projektu:
echo %cd%
echo.

set /p msg=Opis zmiany: 

if "%msg%"=="" (
  set msg=Update app
)

echo.
echo Sprawdzam build...
call npm run build

if errorlevel 1 (
  echo.
  echo BLAD: Build nie przeszedl.
  echo Nie wysylam zmian na GitHub.
  echo.
  pause
  exit /b 1
)

echo.
echo Build OK.
echo.

echo Sprawdzam status Git...
git status
echo.

echo Dodaje pliki...
git add .

echo.
echo Tworze commit...
git commit -m "%msg%"

echo.
echo Wysylam na GitHub...
git push

echo.
echo ================================
echo GOTOWE
echo ================================
echo Jesli nie bylo bledow, Vercel za chwile zaktualizuje:
echo https://domowe.vercel.app/
echo.
pause