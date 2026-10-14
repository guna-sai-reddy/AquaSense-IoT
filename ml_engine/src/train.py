"""AquaSense-IoT Machine Learning Model Training & Evaluation Pipeline.

Trains, benchmarks, and exports 24-hour root-zone soil moisture predictive models
using strictly chronological splits and authentic hydrological metrics.
"""

from __future__ import annotations

import json
import logging
import platform
import sys
from pathlib import Path
from typing import Dict, Any

import joblib
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Ensure local imports work
ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR / "ml_engine") not in sys.path:
    sys.path.insert(0, str(ROOT_DIR / "ml_engine"))

from src.evaluate import compute_metrics
from src.feature_engineering import (
    prepare_features_and_target,
    TARGET_COLUMN,
    TARGET_DEPTH_CM,
    TARGET_HORIZON_HOURS,
    TARGET_UNIT,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("train_pipeline")


def train_and_evaluate(
    data_path: Path | str,
    output_model_dir: Path | str = "ml_engine/models",
) -> Dict[str, Any]:
    """Executes the end-to-end ML training, benchmark comparison, and artifact serialization."""
    csv_file = Path(data_path)
    model_dir = Path(output_model_dir)
    model_dir.mkdir(parents=True, exist_ok=True)

    if not csv_file.exists():
        raise FileNotFoundError(f"Dataset not found at {csv_file}")

    logger.info(f"Loading dataset from {csv_file}")
    df_raw = pd.read_csv(csv_file)

    # 1. Feature Engineering & Target Preparation (No leakage)
    X, y, feature_names, timestamps = prepare_features_and_target(df_raw, horizon_hours=TARGET_HORIZON_HOURS)

    total_samples = len(X)
    if total_samples < 50:
        raise ValueError(
            f"Dataset too small ({total_samples} samples) for valid chronological train/val/test splits. "
            "Please acquire a longer historical time window."
        )

    # 2. Chronological Train / Validation / Test Splitting (70% / 15% / 15%)
    n_train = int(total_samples * 0.70)
    n_val = int(total_samples * 0.15)
    n_test = total_samples - n_train - n_val

    X_train, y_train = X.iloc[:n_train], y.iloc[:n_train]
    X_val, y_val = X.iloc[n_train:n_train + n_val], y.iloc[n_train:n_train + n_val]
    X_test, y_test = X.iloc[n_train + n_val:], y.iloc[n_train + n_val:]

    train_dates = (timestamps.iloc[0], timestamps.iloc[n_train - 1])
    val_dates = (timestamps.iloc[n_train], timestamps.iloc[n_train + n_val - 1])
    test_dates = (timestamps.iloc[n_train + n_val], timestamps.iloc[-1])

    logger.info(f"Chronological Splits:")
    logger.info(f"  Train:      {len(X_train)} samples ({train_dates[0]} to {train_dates[1]})")
    logger.info(f"  Validation: {len(X_val)} samples ({val_dates[0]} to {val_dates[1]})")
    logger.info(f"  Test:       {len(X_test)} samples ({test_dates[0]} to {test_dates[1]})")

    # 3. Model Definitions
    # Baseline Persistence: y_pred = current root-zone soil moisture at prediction time t
    y_pred_val_persist = X_val["sm_root_current"].values
    y_pred_test_persist = X_test["sm_root_current"].values

    models = {
        "RidgeRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", Ridge(alpha=1.0, random_state=42)),
        ]),
        "RandomForest": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", RandomForestRegressor(n_estimators=100, max_depth=6, min_samples_leaf=4, random_state=42)),
        ]),
        "HistGradientBoosting": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", HistGradientBoostingRegressor(max_iter=100, max_depth=4, min_samples_leaf=5, random_state=42)),
        ]),
    }

    # 4. Training & Validation Comparison
    val_metrics = {
        "PersistenceBaseline": compute_metrics(y_val.values, y_pred_val_persist),
    }
    test_metrics = {
        "PersistenceBaseline": compute_metrics(y_test.values, y_pred_test_persist),
    }

    trained_pipelines = {}
    test_predictions = {
        "timestamp_utc": timestamps.iloc[n_train + n_val:].values,
        "actual_target_m3m3": y_test.values,
        "persistence_pred_m3m3": y_pred_test_persist,
    }

    best_model_name = "PersistenceBaseline"
    best_val_rmse = val_metrics["PersistenceBaseline"]["rmse"]

    for name, pipeline in models.items():
        logger.info(f"Training {name}...")
        pipeline.fit(X_train, y_train)
        trained_pipelines[name] = pipeline

        # Validation prediction & metrics
        val_pred = pipeline.predict(X_val)
        val_metrics[name] = compute_metrics(y_val.values, val_pred)

        # Test prediction & metrics
        test_pred = pipeline.predict(X_test)
        test_metrics[name] = compute_metrics(y_test.values, test_pred)
        test_predictions[f"{name}_pred_m3m3"] = test_pred

        logger.info(f"  {name} Val RMSE: {val_metrics[name]['rmse']:.6f} | Test RMSE: {test_metrics[name]['rmse']:.6f}")

        # Model selection based strictly on validation RMSE
        if val_metrics[name]["rmse"] < best_val_rmse:
            best_val_rmse = val_metrics[name]["rmse"]
            best_model_name = name

    logger.info(f"Selected Best Model: {best_model_name} (Validation RMSE: {best_val_rmse:.6f})")

    # 5. Baseline Relative Improvement Calculation
    base_test_rmse = test_metrics["PersistenceBaseline"]["rmse"]
    base_test_mae = test_metrics["PersistenceBaseline"]["mae"]

    comparison_rows = []
    for name in ["PersistenceBaseline", "RidgeRegression", "RandomForest", "HistGradientBoosting"]:
        m_test = test_metrics[name]
        m_val = val_metrics[name]

        rmse_imprv = ((base_test_rmse - m_test["rmse"]) / base_test_rmse) * 100.0 if base_test_rmse > 0 else 0.0
        mae_imprv = ((base_test_mae - m_test["mae"]) / base_test_mae) * 100.0 if base_test_mae > 0 else 0.0

        comparison_rows.append({
            "model_name": name,
            "val_rmse": m_val["rmse"],
            "val_mae": m_val["mae"],
            "val_r2": m_val["r2"],
            "test_rmse": m_test["rmse"],
            "test_mae": m_test["mae"],
            "test_r2": m_test["r2"],
            "test_ubrmse": m_test["ubrmse"],
            "test_bias_mbe": m_test["bias_mbe"],
            "rmse_improvement_pct": round(rmse_imprv, 2),
            "mae_improvement_pct": round(mae_imprv, 2),
            "is_selected": (name == best_model_name),
        })

    comparison_df = pd.DataFrame(comparison_rows)
    comparison_csv_path = model_dir / "model_comparison.csv"
    comparison_df.to_csv(comparison_csv_path, index=False)

    # 6. Export Test Predictions & Residuals
    test_pred_df = pd.DataFrame(test_predictions)
    test_pred_df["best_model_pred_m3m3"] = (
        test_pred_df[f"{best_model_name}_pred_m3m3"]
        if best_model_name != "PersistenceBaseline"
        else test_pred_df["persistence_pred_m3m3"]
    )
    test_pred_df["residual_m3m3"] = test_pred_df["best_model_pred_m3m3"] - test_pred_df["actual_target_m3m3"]
    test_pred_csv_path = model_dir / "test_predictions.csv"
    test_pred_df.to_csv(test_pred_csv_path, index=False)

    # 7. Generate Visualization Plots
    plot_actual_vs_predicted(test_pred_df, best_model_name, model_dir / "actual_vs_predicted.png")
    plot_residuals(test_pred_df, best_model_name, model_dir / "residual_plot.png")

    # 8. Save Model Artifacts
    # Save versioned artifact
    chosen_pipeline = trained_pipelines.get(best_model_name, trained_pipelines["RandomForest"])
    artifact_v1_path = model_dir / "root_zone_model_v1.joblib"
    artifact_std_path = model_dir / "root_zone_model.joblib"

    joblib.dump(chosen_pipeline, artifact_v1_path)
    joblib.dump(chosen_pipeline, artifact_std_path)
    logger.info(f"Serialized model pipeline to {artifact_v1_path} and {artifact_std_path}")

    # 9. Save Comprehensive Metadata JSON
    metadata = {
        "project": "AquaSense-IoT",
        "milestone": "Milestone 4: Machine Learning Model Training & Evaluation",
        "timestamp_created_utc": pd.Timestamp.now(tz="UTC").isoformat(),
        "target": {
            "variable": TARGET_COLUMN,
            "description": "Root-zone volumetric soil moisture in 7-28 cm depth stratum",
            "depth": TARGET_DEPTH_CM,
            "unit": TARGET_UNIT,
            "horizon_hours": TARGET_HORIZON_HOURS,
            "alignment": "Observation at t matched to ground-truth at t + 24 hours",
        },
        "data_source": {
            "provider": "Open-Meteo ERA5 Reanalysis",
            "source_type": "WEATHER_MODEL_DERIVED",
            "coordinates": {"latitude": 15.8281, "longitude": 78.0373},
            "raw_dataset": str(csv_file),
        },
        "sample_counts": {
            "total_clean_samples": total_samples,
            "train_samples": n_train,
            "validation_samples": n_val,
            "test_samples": n_test,
        },
        "split_date_ranges": {
            "train": [train_dates[0], train_dates[1]],
            "validation": [val_dates[0], val_dates[1]],
            "test": [test_dates[0], test_dates[1]],
        },
        "features": {
            "count": len(feature_names),
            "feature_names": feature_names,
            "excluded_features": [
                "future_realized_precipitation",
                "future_realized_weather",
                "satellite_skin_moisture (unpopulated in historical period)",
                "ground_probe_telemetry (unpopulated in historical period)",
            ],
        },
        "selected_best_model": best_model_name,
        "evaluation_metrics": {
            "validation": val_metrics,
            "test": test_metrics,
        },
        "artifacts": {
            "model_pipeline_v1": str(artifact_v1_path),
            "model_pipeline_active": str(artifact_std_path),
            "comparison_table": str(comparison_csv_path),
            "test_predictions": str(test_pred_csv_path),
            "actual_vs_predicted_plot": str(model_dir / "actual_vs_predicted.png"),
            "residual_plot": str(model_dir / "residual_plot.png"),
        },
        "environment_versions": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "joblib": joblib.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
        },
        "scientific_limitations": [
            "Source origin: The training data originates from ERA5 numerical reanalysis, not independent physical in-situ sensor ground truth.",
            "Sample span: The initial historical training set spans 15 days (312 valid 24h pairs); while sufficient to benchmark persistence vs ML algorithms, it does not capture full multi-season annual dynamics.",
            "Depth stratification: Target is 7-28 cm root zone; satellite SMAP surface skin moisture (0-5 cm) was not available for direct assimilation during this historical window.",
        ],
    }

    metadata_path = model_dir / "model_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Saved model metadata to {metadata_path}")

    return metadata


def plot_actual_vs_predicted(df: pd.DataFrame, model_name: str, output_path: Path):
    """Generates actual vs predicted time series and scatter plots."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))

    # Time series comparison
    ax1.plot(df.index, df["actual_target_m3m3"], label="Actual 24h Moisture", color="#0f766e", linewidth=2.0)
    ax1.plot(df.index, df["best_model_pred_m3m3"], label=f"{model_name} Prediction", color="#d97706", linestyle="--", linewidth=2.0)
    ax1.plot(df.index, df["persistence_pred_m3m3"], label="Persistence Baseline", color="#64748b", linestyle=":", linewidth=1.5, alpha=0.7)
    ax1.set_title("Test Period: 24h Root-Zone Moisture Forecast", fontsize=11, fontweight="bold")
    ax1.set_xlabel("Test Horizon Timestep (Hours)")
    ax1.set_ylabel("Volumetric Moisture ($m^3/m^3$)")
    ax1.legend(loc="best")
    ax1.grid(True, alpha=0.3)

    # Scatter plot
    ax2.scatter(df["actual_target_m3m3"], df["best_model_pred_m3m3"], color="#0f766e", alpha=0.7, edgecolors="none")
    lims = [
        min(df["actual_target_m3m3"].min(), df["best_model_pred_m3m3"].min()) - 0.005,
        max(df["actual_target_m3m3"].max(), df["best_model_pred_m3m3"].max()) + 0.005,
    ]
    ax2.plot(lims, lims, "r--", alpha=0.75, label="1:1 Perfect Agreement")
    ax2.set_xlim(lims)
    ax2.set_ylim(lims)
    ax2.set_title("Actual vs. Predicted Scatter", fontsize=11, fontweight="bold")
    ax2.set_xlabel("Actual Ground Truth ($m^3/m^3$)")
    ax2.set_ylabel("Model Forecast ($m^3/m^3$)")
    ax2.legend(loc="best")
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=200)
    plt.close()


def plot_residuals(df: pd.DataFrame, model_name: str, output_path: Path):
    """Generates residual distribution and residual-versus-predicted plots."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))

    residuals = df["residual_m3m3"]

    # Residuals over time
    ax1.axhline(0, color="black", linestyle="--", alpha=0.6)
    ax1.plot(df.index, residuals, marker="o", color="#dc2626", linewidth=1.2, markersize=3)
    ax1.set_title(f"{model_name}: Residuals ($y_{{pred}} - y_{{actual}}$)", fontsize=11, fontweight="bold")
    ax1.set_xlabel("Test Horizon Timestep (Hours)")
    ax1.set_ylabel("Residual ($m^3/m^3$)")
    ax1.grid(True, alpha=0.3)

    # Residual histogram / density
    ax2.hist(residuals, bins=12, color="#0d9488", edgecolor="white", alpha=0.8)
    ax2.axvline(0, color="black", linestyle="--", alpha=0.6)
    ax2.set_title("Residual Distribution", fontsize=11, fontweight="bold")
    ax2.set_xlabel("Residual ($m^3/m^3$)")
    ax2.set_ylabel("Frequency")
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output_path, dpi=200)
    plt.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="AquaSense-IoT Model Training Pipeline")
    parser.add_argument("--data-path", type=str, default=None, help="Path to input processed dataset CSV")
    parser.add_argument("--output-dir", type=str, default="ml_engine/models", help="Output model directory")
    args = parser.parse_args()

    if args.data_path:
        dataset_path = Path(args.data_path)
    elif (ROOT_DIR / "data" / "processed_data.csv").exists():
        dataset_path = ROOT_DIR / "data" / "processed_data.csv"
    else:
        dataset_path = ROOT_DIR / "ml_engine" / "data" / "processed" / "open_meteo_historical_lat15.83_lon78.04_dataset.csv"

    logger.info(f"Using dataset: {dataset_path}")
    train_and_evaluate(dataset_path, output_model_dir=args.output_dir)
