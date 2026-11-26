import io
import os
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(
    title="California House Prediction API",
    description="Machine Learning service & interactive web UI to predict California house values.",
    version="2.0.0"
)

# Mount static assets for interactive UI
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Load model and features
model_path = "house_model.joblib"
features_path = "house_features.joblib"

if os.path.exists(model_path) and os.path.exists(features_path):
    model = joblib.load(model_path)
    features = joblib.load(features_path)
else:
    model = None
    features = ["MedInc", "HouseAge", "AveRooms", "AveBedrms", "Population", "AveOccup", "Latitude", "Longitude"]

# Input schema
class HouseFeatures(BaseModel):
    MedInc: float = Field(gt=0, description="Median income in block group (in $10,000s)")
    HouseAge: float = Field(gt=0, description="Average age of house in the block group")
    AveRooms: float = Field(gt=0, description="Average number of rooms per household")
    AveBedrms: float = Field(gt=0, description="Average number of bedrooms per household")
    Population: float = Field(gt=0, description="Total population")
    AveOccup: float = Field(gt=0, description="Average number of household members")
    Latitude: float = Field(ge=32, le=42, description="Latitude")
    Longitude: float = Field(ge=-125, le=-114, description="Longitude")

# Interactive UI at root, with fallback JSON for API clients
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    accept_header = request.headers.get("accept", "")
    # If explicit API client only accepting json and not html, return json
    if "application/json" in accept_header and "text/html" not in accept_header:
        return JSONResponse({
            "message": "California house prediction api",
            "status": "running",
            "endpoint": "send POST request to /predict"
        })
    
    # Return interactive UI
    index_file = os.path.join("static", "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    
    return HTMLResponse("<h1>California House Prediction API</h1><p>UI under construction.</p>")

# Health check
@app.get("/health")
def health():
    return {
        "status": "running" if model is not None else "model_not_found",
        "model": "RandomForestRegressor",
        "features": features,
        "avg_error": "$32,773"
    }

# Model Insights & Feature Importance
@app.get("/model-insights")
def model_insights():
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded.")
    
    feature_names = features
    importances = [round(float(x) * 100, 2) for x in model.feature_importances_]
    feature_imp = [
        {"feature": f, "importance": imp}
        for f, imp in sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
    ]
    return {
        "model_type": "RandomForestRegressor",
        "n_estimators": 100,
        "features_count": len(feature_names),
        "feature_importances": feature_imp,
        "avg_absolute_error": "$32,773",
        "r2_score": 0.805,
        "dataset": "California Housing Dataset (20,640 records)"
    }


# Provide sample CSV for download & testing
@app.get("/sample-csv")
def get_sample_csv():
    sample_file = "test_houses.csv"
    if os.path.exists(sample_file):
        return FileResponse(
            sample_file,
            media_type="text/csv",
            filename="sample_california_houses.csv"
        )
    raise HTTPException(status_code=404, detail="Sample CSV file not found.")

# Single prediction endpoint
@app.post("/predict")
def predict(house: HouseFeatures):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded. Please train first.")

    try:
        input_data = pd.DataFrame([{
            "MedInc": house.MedInc,
            "HouseAge": house.HouseAge,
            "AveRooms": house.AveRooms,
            "AveBedrms": house.AveBedrms,
            "Population": house.Population,
            "AveOccup": house.AveOccup,
            "Latitude": house.Latitude,
            "Longitude": house.Longitude
        }])

        predicted = float(model.predict(input_data)[0])
        price_usd = predicted * 100000

        return {
            "predicted_price": f"${price_usd:,.0f}",
            "predicted_price_short": f"${predicted:.2f} hundred thousands",
            "confidence_range": f"${max(0, price_usd - 39000):,.0f} to ${price_usd + 39000:,.0f}",
            "raw_price": round(price_usd, 2)
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

# Batch prediction with CSV file upload
@app.post("/predict-file")
async def predict_file(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded. Please train first.")

    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file only."
        )

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        # Remove accidental whitespace in column names
        df.columns = df.columns.str.strip()

        required_columns = [
            "MedInc",
            "HouseAge",
            "AveRooms",
            "AveBedrms",
            "Population",
            "AveOccup",
            "Latitude",
            "Longitude"
        ]

        missing_columns = [
            col for col in required_columns
            if col not in df.columns
        ]

        if missing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Missing columns: {missing_columns}"
            )

        if len(df) == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded CSV has no data."
            )

        predictions = model.predict(df[required_columns])
        df["PredictedPrice"] = [f"${p * 100000:,.0f}" for p in predictions]

        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=predictions.csv"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )
