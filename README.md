# California House Price Prediction & Interactive AI Estimator

An interactive web application and production-ready machine learning API built with **FastAPI** and **Scikit-learn** that predicts California residential housing valuations using a **Random Forest Regressor** trained on the California Housing dataset.

https://california-house-price-prediction-jxcb.onrender.com

---

## ✨ Features

- **🏡 Interactive Valuation Estimator**:
  - Real-time prediction with dual slider & number input controls for all 8 census features.
  - **🗺️ Interactive Map (Leaflet.js)**: Click or drag the marker across California to automatically update latitude and longitude.
  - **⚡ Quick Regional Presets**: One-click test scenarios for *Silicon Valley / Bay Area*, *Beverly Hills / LA*, *San Diego Coast*, *Sacramento Suburbs*, and *Fresno / Central Valley*.
  - **💰 Financial Intelligence**: Dynamic 95% confidence intervals (±$39k), market tier categorization, estimated monthly mortgage calculations, and price-per-room breakdown.
  - **Live Auto-Predict Toggle**: Automatically updates estimates as sliders are moved or allows manual valuation on click.
  - **📌 Session Valuation History**: Pin and compare multiple valuations side-by-side with one-click restore.

- **📂 Batch CSV Valuation**:
  - Drag-and-drop CSV upload for processing multiple properties in bulk.
  - Interactive table preview with highlighted predictions.
  - Direct download button for the enriched `predictions.csv`.
  - Built-in **"Load Sample CSV"** and **"Download Template CSV"** buttons for instant testing.

- **📊 Model & API Developer Guide**:
  - **Interactive Feature Importance Chart**: Real-time breakdown of the top pricing drivers (`MedInc`, `AveOccup`, `Coordinates`, etc.).
  - Live cURL and Python snippet generator synchronized with current form values.
  - Integrated health check and links to FastAPI Swagger UI (`/docs`) and ReDoc (`/redoc`).

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11, FastAPI, Uvicorn, Pydantic
- **Machine Learning**: Scikit-learn (RandomForestRegressor, 100 estimators), Pandas, Joblib
- **Frontend / UI**: HTML5, Tailwind CSS, Leaflet.js (OpenStreetMap), Modern Glassmorphism Design

---

## 🚀 Getting Started Locally

### 1. Clone the repository
```bash
git clone https://github.com/Code-bee23/California-House-price-prediction.git
cd California-House-price-prediction
```

### 2. Create and activate virtual environment
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Train the Model
```bash
python train.py
```
*Trains the Random Forest model on 20,640 records and saves `house_model.joblib` and `house_features.joblib`.*

### 5. Start the Server
```bash
uvicorn main:app --reload
```

### 6. Open the Interactive UI
Open your browser and navigate to:
```
http://127.0.0.1:8000/
```
*(Swagger API docs are available at `http://127.0.0.1:8000/docs`)*

---

## ☁️ Deployment

### 1-Click Deploy on Render
Click the button below to deploy this application to Render with zero manual configuration:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Code-bee23/California-House-price-prediction)

### Docker Container (Local / Any Cloud)
Build and run the container:
```bash
docker build -t california-house-ai .
docker run -p 8000:8000 california-house-ai
```
Visit `http://localhost:8000/`.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the interactive Web UI (or JSON metadata for API clients) |
| `POST` | `/predict` | Predicts price for a single property JSON payload |
| `POST` | `/predict-file` | Accepts a `.csv` upload and returns a CSV with a `PredictedPrice` column |
| `GET` | `/sample-csv` | Downloads `test_houses.csv` as a ready-to-use sample |
| `GET` | `/health` | Model health status, feature list, and error metrics |
| `GET` | `/model-insights` | Dynamic feature importances and model statistics |
| `GET` | `/docs` | Interactive Swagger API documentation |
| `GET` | `/redoc` | Alternative ReDoc API documentation |

---

## 📋 Required Features

| Feature | Description | Range / Unit |
|---|---|---|
| `MedInc` | Median income in block group | Tens of thousands USD (e.g. `8.3` = $83,000/yr) |
| `HouseAge` | Median age of houses | 1 to 52 years |
| `AveRooms` | Average number of rooms per household | e.g. 3.0 to 12.0 |
| `AveBedrms` | Average number of bedrooms per household | e.g. 0.8 to 4.0 |
| `Population` | Total residents in block group | 50 to 5,000+ |
| `AveOccup` | Average number of household members | 1.0 to 8.0 |
| `Latitude` | Geographic latitude | 32.0° to 42.0° |
| `Longitude` | Geographic longitude | -125.0° to -114.0° |
