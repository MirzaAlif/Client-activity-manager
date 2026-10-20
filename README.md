# Client Activity Manager

A small full-stack app to manage **clients** and the **activities** (tasks) for each client.

- **Frontend:** HTML + CSS (responsive) + React (prebuilt, works offline)
- **Backend:** Python + Flask (REST API)
- **Database:** SQLite

## Features

- Add, edit, delete clients (name, email, phone, company)
- Search clients
- Add, edit, delete activities for each client
- Activity status: Pending, In Progress, Completed
- Filter activities by status
- Validation (on the server): name, email format, duplicate email, phone format, title length
- Deleting a client deletes all of its activities automatically
- Light / dark theme, works on phone, tablet and desktop

## Project structure

```
client-activity-manager/
├── README.md
├── start_windows.bat     <- double-click to install + run (Windows)
├── start_mac_linux.sh    <- one-command start (Mac / Linux)
├── backend/
│   ├── app.py            <- Flask server: API routes + validation
│   ├── database.py       <- SQLite helper functions + demo data
│   ├── schema.sql        <- Table definitions
│   └── requirements.txt  <- Python packages needed
├── frontend/
    ├── index.html        <- Page shell
    ├── styles.css        <- All styling (responsive)
    ├── app.jsx           <- React components (the source you read and edit)
    ├── app.bundle.js     <- app.jsx + React, already built (the page loads this)
    └── package.json      <- Only needed if you edit app.jsx (rebuild command)


## Requirements

- Python 3.9 or newer (check with `python --version`)
- Nothing else. React is already bundled in `frontend/app.bundle.js`, so no Node.js and no internet are needed. (The Figtree font loads from Google if you are online; otherwise a normal system font is used.)

## Setup (5 steps)

1. Open a terminal inside the project folder:
   ```
   cd client-activity-manager/backend
   ```
2. (Recommended) create a virtual environment:
   ```
   python -m venv venv
   ```
   Activate it:
   - Windows: `venv\Scripts\activate`
   - Mac / Linux: `source venv/bin/activate`
3. Install the packages:
   ```
   pip install -r requirements.txt
   ```
4. Start the server:
   ```
   python app.py
   ```
   The first run creates `client_activity.db` and adds 2 demo clients.
5. Open your browser at **http://localhost:5000**

**Shortcut:** on Windows double-click `start_windows.bat`; on Mac/Linux run `bash start_mac_linux.sh`.

The Python server must be running for the data to load. The best way to open the app is http://localhost:5000. Opening `frontend/index.html` by double-click also works while the server is running. If the server is stopped, the page shows "Cannot reach the server" instead of a blank screen.

## Editing the React code (optional)

The page loads `app.bundle.js`, which is built from `app.jsx`. If you change `app.jsx`, rebuild it once (needs Node.js):

```
cd frontend
npm install
npm run build
```

Then refresh the browser. If you never edit `app.jsx`, you can ignore this.

To reset the data, stop the server, delete `backend/client_activity.db`, and start it again.

## API reference

| Method | URL | What it does |
|--------|-----|--------------|
| GET | `/api/clients?q=text` | List clients (optional search) with activity counts |
| GET | `/api/clients/<id>` | Get one client |
| POST | `/api/clients` | Create a client |
| PUT | `/api/clients/<id>` | Update a client |
| DELETE | `/api/clients/<id>` | Delete a client and its activities |
| GET | `/api/clients/<id>/activities?status=Pending` | List a client's activities (optional filter) |
| POST | `/api/clients/<id>/activities` | Create an activity |
| PUT | `/api/activities/<id>` | Update an activity |
| PATCH | `/api/activities/<id>/status` | Change only the status |
| DELETE | `/api/activities/<id>` | Delete an activity |

Success returns JSON. Validation problems return status `400` with `{"errors": {"field": "message"}}`. Missing items return `404`.

## Quick test without the browser

```
curl http://localhost:5000/api/clients
curl -X POST http://localhost:5000/api/clients -H "Content-Type: application/json" -d "{\"name\":\"Test User\",\"email\":\"test@example.com\"}"
```

## Troubleshooting

- **"Cannot reach the server" message:** the Python server is not running. Start it with `python app.py` inside `backend`, then refresh.
- **Blank page after editing `app.jsx`:** you need to rebuild (`npm run build` in `frontend`), or there is a typo in your JSX. Press F12 and look at the Console tab.
- **Changes to `app.jsx` don't show:** the page loads `app.bundle.js`; rebuild it.
- **`ModuleNotFoundError: flask`:** run `pip install -r requirements.txt` again (with the virtual environment active).
- **Port 5000 already in use:** change `port=5000` at the bottom of `backend/app.py` and use the new port in the browser.

## Limitations (honest notes)

- No login / users yet
- The React build uses one esbuild command; a bigger app would use a full tool such as Vite
- SQLite is perfect for one server; very high write traffic would need PostgreSQL or MySQL
