# Smart Wallet-to-VASP Mapping
## Client Installation Guide

This project keeps the React/Vite app at the repository root and the Django backend in the backend/ folder.

### 1. Required software

- Windows 10 or Windows 11
- VS Code
- Python 3.10 or newer
- Node.js 20+ LTS
- npm

SQLite is bundled with Python and does not require a separate install.

### 2. Open project

1. Open VS Code.
2. Select File → Open Folder.
3. Choose the project folder that contains this README and the backend/ folder.

### 3. Open terminal

In VS Code:

- Terminal → New Terminal

### 4. Backend setup

From the project root, run:

```bat
setup.bat
```

This script checks for Python and Node.js, creates a backend virtual environment if missing, installs the Django requirements, creates .env files when missing, installs frontend dependencies, and runs Django migrations.

If you prefer to do it manually:

```bat
cd backend
python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Environment variables

Create the environment file from the included example before running the app:

```bat
copy .env.example .env
copy backend\.env.example backend\.env
```

Then edit both files and add your actual values.

Important:

- The frontend should only use VITE_API_BASE_URL.
- The Alchemy key belongs in the backend/.env file.
- Never place the real Alchemy API key in the browser app or in source code.

### 6. Database

Run:

```bat
cd backend
python manage.py migrate
```

This creates the SQLite database if it does not already exist.

### 7. Create admin

To create a Django superuser:

```bat
cd backend
python manage.py createsuperuser
```

### 8. Start backend

```bat
cd backend
python manage.py runserver
```

Or use the supplied convenience script:

```bat
start_backend.bat
```

### 9. Frontend setup

From the project root:

```bat
npm install
npm run dev
```

Or use the supplied convenience script:

```bat
start_frontend.bat
```

### 10. URLs

Frontend:

- http://localhost:5173

Backend:

- http://localhost:8000

Django admin:

- http://localhost:8000/admin/

### 11. Troubleshooting

#### Python not recognized

Install Python 3.10+ from python.org and reopen VS Code.

#### Node not recognized

Install Node.js 20+ LTS and then reopen VS Code.

#### npm not recognized

Install Node.js and ensure npm is included in the installation options.

#### pip installation failure

Upgrade pip and reinstall requirements in the backend virtual environment.

#### npm installation failure

Delete node_modules and package-lock.json only if necessary, then run npm install again from the project root.

#### Port already in use

Stop the other process using the port or change the port in the Django or Vite config.

#### migration errors

Delete the local SQLite file only if you deliberately want a clean start, then run:

```bat
python manage.py migrate
```

#### missing .env

Copy the example files again before starting the app.

#### missing API key

Add ALCHEMY_API_KEY to backend/.env before performing blockchain analysis.

#### CORS errors

Verify CORS_ALLOWED_ORIGINS in the backend .env file includes http://localhost:5173.

#### Django server errors

Check the terminal output and verify the backend environment variables are valid.

#### frontend cannot connect to backend

Verify VITE_API_BASE_URL points to http://localhost:8000/api.

#### Alchemy API failure

Confirm the API key is valid, the network is correct, and the internet connection is available.

---

The project uses real on-chain blockchain data and real investigation analysis. Do not add fake wallet addresses, fake transactions, or fake VASP mappings to the database.
