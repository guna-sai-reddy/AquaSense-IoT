# AquaSense-IoT Windows PowerShell Local Setup, Execution & Testing Guide

**Project:** AquaSense-IoT: A Satellite-Sensor Fused Predictive Framework for Minimal-Water Precision Irrigation Scheduling  
**Operating System:** Windows 11 / Windows PowerShell  
**Target Environments:** Python 3.12 (FastAPI), Node.js v20+ (Next.js 14), PostgreSQL 18 / SQLite fallback  

---

## 1. Prerequisites and Environment Setup

### 1.1 Python Backend Virtual Environment
```powershell
# Navigate to backend directory
cd d:\Assignment\project\backend

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Verify installed packages
pip list
```

### 1.2 Frontend Node Dependencies
```powershell
# Navigate to frontend directory
cd d:\Assignment\project\frontend

# Verify installed Node packages
npm list --depth=0
```

---

## 2. Launching Services in Windows PowerShell

### 2.1 Starting the FastAPI Backend Server (Port 8000)
```powershell
cd d:\Assignment\project\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- **Backend API Base:** `http://127.0.0.1:8000`
- **Swagger Documentation:** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/health`
- **System Status:** `http://127.0.0.1:8000/api/v1/status`

### 2.2 Starting the Next.js Frontend Server (Port 3000)
```powershell
cd d:\Assignment\project\frontend
npm run dev
```
- **Overview Dashboard:** `http://localhost:3000`
- **Field Management:** `http://localhost:3000/fields`
- **Soil Moisture & Satellite Fusion:** `http://localhost:3000/soil-moisture`
- **Precision Irrigation Advisory:** `http://localhost:3000/irrigation`
- **Prediction History & Model Benchmarks:** `http://localhost:3000/predictions`
- **Research Evaluation & Baseline Comparison:** `http://localhost:3000/evaluation`
- **System Health & Ingestion Status:** `http://localhost:3000/system-health`
- **Operator Account:** `http://localhost:3000/account`

---

## 3. Running Automated Tests

### 3.1 Backend Pytest Suite (60/60 tests)
```powershell
cd d:\Assignment\project\backend
.\.venv\Scripts\Activate.ps1

# Run the master research verification suite
pytest tests/test_master_research_requirements.py -v

# Run full backend test suite
pytest tests -v
```

### 3.2 Frontend Production Build & Lint Verification
```powershell
cd d:\Assignment\project\frontend

# Run Next.js production build and type check
npm run build

# Run ESLint validation
npm run lint
```

---

## 4. Test User Credentials

To access protected dashboard routes, log in with the verified test operator profile:
- **Email:** `gunasaireddybacchu@gmail.com`
- **Password:** `SecurePassword123!`
- **Role:** Active Precision Irrigation Operator
