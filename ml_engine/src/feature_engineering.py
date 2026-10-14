"""Feature Engineering for 24-Hour Root-Zone Soil Moisture Forecasting.

Builds reproducible, leakage-free feature matrices from historical meteorological
and hydrological observations.
"""

from __future__ import annotations

import logging
from typing import List, Tuple
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Target variable definition
TARGET_COLUMN = "soil_moisture_7_to_28cm"
TARGET_DEPTH_CM = "7-28 cm (Primary Root-Zone)"
TARGET_UNIT = "m3/m3 (Volumetric Water Content)"
TARGET_HORIZON_HOURS = 24


def prepare_features_and_target(
    df: pd.DataFrame,
    horizon_hours: int = TARGET_HORIZON_HOURS,
) -> Tuple[pd.DataFrame, pd.Series, List[str], pd.Series]:
    """Extracts features and target, strictly enforcing temporal causality (no future leakage).

    Returns:
        X: Feature matrix DataFrame
        y: Target series (soil moisture at t + horizon_hours)
        feature_names: List of column names in X
        timestamps: Observation timestamps at prediction time t
    """
    if df.empty:
        raise ValueError("Input DataFrame is empty.")

    work_df = df.copy()
    if "timestamp_utc" not in work_df.columns:
        raise ValueError("DataFrame must contain 'timestamp_utc' column.")

    work_df["dt"] = pd.to_datetime(work_df["timestamp_utc"], utc=True)
    work_df.sort_values(by="dt", inplace=True)
    work_df.reset_index(drop=True, inplace=True)

    # 1. Prediction Target: Root-zone soil moisture at t + horizon_hours
    # shift(-horizon_hours) aligns the observation at t with the ground-truth value at t + 24h
    work_df["target_24h"] = work_df[TARGET_COLUMN].shift(-horizon_hours)

    # 2. Autoregressive Lags (strictly known at prediction time t)
    work_df["sm_root_current"] = work_df[TARGET_COLUMN]
    work_df["sm_root_lag_1h"] = work_df[TARGET_COLUMN].shift(1)
    work_df["sm_root_lag_3h"] = work_df[TARGET_COLUMN].shift(3)
    work_df["sm_root_lag_6h"] = work_df[TARGET_COLUMN].shift(6)
    work_df["sm_root_lag_24h"] = work_df[TARGET_COLUMN].shift(24)

    # Cross-depth profile observations at t
    work_df["sm_surface_0_to_7cm"] = work_df["soil_moisture_0_to_7cm"]
    work_df["sm_deep_28_to_100cm"] = work_df["soil_moisture_28_to_100cm"]

    # Thermal observations at t
    work_df["soil_temp_root_c"] = work_df["soil_temperature_7_to_28cm"]
    work_df["soil_temp_surface_c"] = work_df["soil_temperature_0_to_7cm"]
    work_df["air_temp_2m_c"] = work_df["temperature_2m"]

    # Atmospheric state at t
    work_df["relative_humidity_pct"] = work_df["relative_humidity_2m"]
    work_df["surface_pressure_hpa"] = work_df["surface_pressure"]
    work_df["wind_speed_kmh"] = work_df["wind_speed_10m"]

    # 3. Antecedent Hydrological Fluxes (Past only - NO future leakage)
    work_df["et0_current_mm"] = work_df["et0_fao_evapotranspiration"]
    work_df["et0_rolling_24h_sum_mm"] = work_df["et0_fao_evapotranspiration"].rolling(24).sum()

    work_df["precip_current_mm"] = work_df["precipitation"]
    work_df["precip_rolling_6h_sum_mm"] = work_df["precipitation"].rolling(6).sum()
    work_df["precip_rolling_24h_sum_mm"] = work_df["precipitation"].rolling(24).sum()

    # Solar radiation at t
    if "shortwave_radiation_instant" in work_df.columns:
        work_df["shortwave_radiation_wm2"] = work_df["shortwave_radiation_instant"]
    else:
        work_df["shortwave_radiation_wm2"] = 0.0

    # 4. Cyclical Temporal Features
    hours = work_df["dt"].dt.hour
    work_df["hour_sin"] = np.sin(2 * np.pi * hours / 24.0)
    work_df["hour_cos"] = np.cos(2 * np.pi * hours / 24.0)
    work_df["day_of_year"] = work_df["dt"].dt.dayofyear / 365.25

    feature_cols = [
        "sm_root_current",
        "sm_root_lag_1h",
        "sm_root_lag_3h",
        "sm_root_lag_6h",
        "sm_root_lag_24h",
        "sm_surface_0_to_7cm",
        "sm_deep_28_to_100cm",
        "soil_temp_root_c",
        "soil_temp_surface_c",
        "air_temp_2m_c",
        "relative_humidity_pct",
        "surface_pressure_hpa",
        "wind_speed_kmh",
        "et0_current_mm",
        "et0_rolling_24h_sum_mm",
        "precip_current_mm",
        "precip_rolling_6h_sum_mm",
        "precip_rolling_24h_sum_mm",
        "shortwave_radiation_wm2",
        "hour_sin",
        "hour_cos",
        "day_of_year",
    ]

    # Exclude samples that lack complete historical rolling features or lack future 24h target
    # Rows with NaN in features or target are dropped
    clean_mask = work_df[feature_cols + ["target_24h"]].notna().all(axis=1)
    clean_df = work_df[clean_mask].copy().reset_index(drop=True)

    X = clean_df[feature_cols]
    y = clean_df["target_24h"]
    timestamps = clean_df["timestamp_utc"]

    logger.info(
        f"Prepared dataset: {len(X)} valid samples with {len(feature_cols)} features "
        f"(dropped {len(work_df) - len(clean_df)} edge rows due to lag/horizon windowing)."
    )

    return X, y, feature_cols, timestamps
