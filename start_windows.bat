@echo off
REM Double-click this file to install Flask (first time) and start the app.
cd /d "%~dp0backend"
python -m pip install -r requirements.txt
start "" http://localhost:5000
python app.py
pause
