# California House Price Prediction

A machine learning project that estimates California house prices from property details for users who want a quick price prediction.

![Demo](demo.gif)

**Live Demo:** [Add your live demo link here]

## Features
- Predicts house prices using a trained Random Forest model.
- Accepts property details through a REST API.
- Supports batch predictions through CSV file uploads.
- Validates input values before making predictions.
- Returns predicted prices in USD.

## Tech Stack
Python, FastAPI, Scikit-learn, Pandas, Joblib, Pydantic.

## Run It Locally

**1. Clone the repository**
```bash
git clone https://github.com/Code-bee23/California-House-price-prediction.git
cd California-House-price-prediction
```

**2. Create a virtual environment**
```bash
python -m venv .venv
```

**3. Activate the environment (Windows)**
```bash
.venv\Scripts\activate
```

**4. Install dependencies**
```bash
python -m pip install fastapi uvicorn pandas scikit-learn joblib python-multipart
```

**5. Train the model**
```bash
python train.py
```

This generates:
- `house_model.joblib`
- `house_features.joblib`

**6. Start the API**
```bash
uvicorn main:app --reload
```

**7. Open the API documentation**

Visit: http://127.0.0.1:8000/docs

You can test individual predictions and upload CSV files using the Swagger interface.

## What I'd Add Next
- Build a simple web interface for entering house details and viewing predictions.
- Add visual charts to show how different property features affect predicted prices.
