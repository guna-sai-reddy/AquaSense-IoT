# AquaSense-IoT: Precision Irrigation Decision Support Framework

> **A Satellite-Sensor Fused Predictive Framework for Minimal-Water Precision Irrigation Scheduling**

---

## 1. Project Overview

**AquaSense-IoT** is an end-to-end precision agriculture platform designed to optimize irrigation scheduling under strict water-budget constraints. The system synthesizes:

1. **In-situ Ground Probes:** High-frequency soil moisture ($m^3/m^3$ at multiple depths), root-zone temperature, and air humidity.
2. **Satellite Microwave Observations:** NASA SMAP radiometer retrievals (L3/L4 surface and root-zone moisture).
3. **Numerical Weather Predictions:** Open-Meteo ERA5 reanalysis and high-resolution 7-day synoptic weather forecasts (including FAO-56 Penman-Monteith reference evapotranspiration, $ET_0$).
4. **Hydrological Decision Engine:** Physics-informed water balance based on FAO-56 Irrigation and Drainage guidelines (depletion fraction, field capacity, management allowed depletion).
5. **Interactive Operations Dashboard:** Next.js full-stack web application with provenance tracking, maps, and advisories.

---

## 2. System Architecture

```text
AquaSense-IoT/
├── backend/          # FastAPI REST API & FAO-56 Irrigation Decision Engine
├── ml_engine/        # Machine Learning pipelines, satellite fetchers, model training
├── frontend/         # Next.js 14 App Router, TypeScript, Tailwind CSS
├── docs/             # Technical specifications, API schema documentation
├── scripts/          # Automation and developer utility scripts
└── docker-compose.yml# Local database services (PostgreSQL + PostGIS)
```

### Data Provenance Guarantee
AquaSense-IoT enforces strict labeling of all data points across both backend models and UI charts:
- `MEASURED`: Calibrated physical in-situ sensor records (e.g. ISMN or local IoT probes).
- `SATELLITE_DERIVED`: NASA SMAP radiometer retrievals.
- `WEATHER_MODEL_DERIVED`: Open-Meteo Numerical Weather Prediction models.
- `PREDICTED`: AquaSense-IoT machine learning forecasts.
- `SIMULATED`: Clearly isolated test fixtures for automated end-to-end testing.

---

## 3. Windows PowerShell Setup Guide

### Prerequisites
Ensure the following tools are installed:
- **Python 3.11+** (`python --version`)
- **Node.js 20+** and **npm** (`node --version`, `npm --version`)
- **Docker Desktop** (optional, for local PostgreSQL container)

---

### Step 1: Database Setup (Optional Docker or Local Postgres)

To launch a dedicated local PostgreSQL database using Docker:
```powershell
docker compose up -d database
```

---

### Step 2: Backend Setup & Verification

Open a new PowerShell terminal in the project root:

```powershell
# Navigate to backend directory
cd backend

# Create Python virtual environment
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install backend dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create local environment file from template
Copy-Item .env.example .env

# Run backend tests to verify configuration
pytest

# Start the FastAPI backend server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Once started:
- API Root: [http://localhost:8000](http://localhost:8000)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- Swagger Interactive Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Step 3: Frontend Setup & Verification

Open a separate PowerShell terminal in the project root:

```powershell
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Create local environment configuration
Copy-Item .env.local.example .env.local

# Start Next.js development server
npm run dev
```

Once started:
- Dashboard: [http://localhost:3000](http://localhost:3000)

---

### Step 4: Machine Learning Engine Setup (Offline)

For offline research, dataset ingestion, and model training:

```powershell
cd ml_engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

---

## 4. Current Milestone Status

- **Milestone 1:** Project Structure & Initial Configuration (**Completed**)
- **Milestone 2:** Real-World Data Ingestion & Validation Pipelines (**Completed**)
- **Milestone 3:** Satellite (NASA SMAP) & Ground-Sensor Integration (**Completed**)
- **Milestone 4:** Machine Learning Model Training & Evaluation (24h Root-Zone Model) (**Completed**)
- **Milestone 5:** FAO-56 Precision Irrigation Decision Engine (**Completed**)
- **Milestone 6:** FastAPI Backend + PostgreSQL Integration & Verification (**Completed**)
- **Milestone 7:** Next.js Operations Dashboard & Visualization (**Completed**)
- **Milestone 8:** Final Demonstration, Evaluation & Field Simulation (Next)
