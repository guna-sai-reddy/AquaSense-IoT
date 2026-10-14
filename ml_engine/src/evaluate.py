"""Hydrological & Machine Learning Regression Evaluation Metrics.

Computes RMSE, MAE, R2, Mean Bias Error (MBE), and Unbiased RMSE (ubRMSE).
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """Computes comprehensive regression and hydrological accuracy metrics."""
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)

    if len(y_true) == 0:
        raise ValueError("y_true and y_pred cannot be empty.")

    mae = float(mean_absolute_error(y_true, y_pred))
    mse = float(mean_squared_error(y_true, y_pred))
    rmse = float(np.sqrt(mse))
    r2 = float(r2_score(y_true, y_pred))

    # Mean Bias Error (MBE)
    bias = float(np.mean(y_pred - y_true))

    # Unbiased Root Mean Square Error (ubRMSE)
    # ubRMSE = sqrt(RMSE^2 - Bias^2)
    diff_sq = rmse**2 - bias**2
    ubrmse = float(np.sqrt(max(0.0, diff_sq)))

    return {
        "sample_count": len(y_true),
        "mae": round(mae, 6),
        "rmse": round(rmse, 6),
        "r2": round(r2, 6),
        "bias_mbe": round(bias, 6),
        "ubrmse": round(ubrmse, 6),
    }
