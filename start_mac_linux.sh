#!/bin/bash
# Run:  bash start_mac_linux.sh   (installs Flask the first time, then starts the app)
cd "$(dirname "$0")/backend"
python3 -m pip install -r requirements.txt
python3 app.py
