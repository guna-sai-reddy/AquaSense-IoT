# AquaSense-IoT Multi-Source Spatiotemporal Data Fusion Methodology

**Project:** AquaSense-IoT: A Satellite-Sensor Fused Predictive Framework for Minimal-Water Precision Irrigation Scheduling  
**Document:** Technical Specification & Scientific Methodology  
**Version:** 1.0.0  

---

## 1. Introduction and Problem Statement

Precision irrigation scheduling requires continuous, depth-resolved soil moisture status across agricultural fields. However, real-world monitoring is constrained by two divergent measurement regimes:
1. **Satellite Remote Sensing (e.g., NASA SMAP SPL3SMP_E):** Offers regional coverage but is restricted to shallow penetration depths ($0\text{--}5\text{ cm}$ surface skin), coarse spatial resolution ($9\text{ km}$ EASE-Grid 2.0), and low temporal sampling cadence ($\sim 2\text{--}3\text{ days}$ repeat overpass).
2. **In-Situ Ground IoT Probes:** Delivers continuous, high-frequency, depth-specific measurements within the crop root zone ($7\text{--}28\text{ cm}$ and $20\text{ cm}$), but only provides discrete point measurements ($< 1\text{ m}^2$ footprint) subject to local soil heterogeneity.
3. **Numerical Meteorological Reanalysis (Open-Meteo ERA5 Land):** Delivers continuous hourly weather and multi-layer soil estimates at $\sim 9\text{--}25\text{ km}$ resolution, based on atmospheric physics models rather than direct field telemetry.

AquaSense-IoT implements an evidence-based fusion architecture that aligns and assimilates these streams without fabricating missing observations or conflating incompatible depths.

---

## 2. Spatiotemporal Alignment Framework

### 2.1 Spatial Scale Alignment
- **Field Target Coordinates:** Kurnool benchmark ($15.8281^\circ\text{N}, 78.0373^\circ\text{E}$).
- **Satellite Footprint:** Point-to-grid intersection queries NASA Common Metadata Repository (CMR) for the $9\text{ km}$ pixel containing the target farm boundary.
- **Limitation:** Spatial downscaling from $9\text{ km}$ to field scale ($2.5\text{ ha}$) is not performed using unverified interpolation. The satellite reading is explicitly flagged as a regional surface covariate.

### 2.2 Temporal Alignment Windows
The data fusion engine (`app.services.data_fusion.DataFusionEngine`) enforces temporal matching tolerances:
- **Satellite Pass Matching Window:** $\pm 180\text{ minutes}$ ($\pm 3\text{ hours}$) of an instantaneous AM ($\sim 06:00$) or PM ($\sim 18:00$) radiometer overpass.
- **In-Situ Ground Probe Window:** $\pm 30\text{ minutes}$ of the top-of-hour reanalysis timestamp.
- **Rule of Non-Interpolation:** When a satellite overpass does not occur on a given day, the satellite column is marked as `NaN` / unobserved. Unobserved passes are never synthetically interpolated across multi-day gaps.

---

## 3. Vertical Stratification and Root-Zone Transfer

### 3.1 Depth Discrepancy Matrix
| Layer | Stratum | Nominal Depth | Primary Source | Physical Meaning |
|---|---|---|---|---|
| Surface Skin | Stratum 0 | $0\text{--}5\text{ cm}$ | NASA SMAP Radiometer | Direct microwave reflection; highly sensitive to skin evaporation and light showers |
| Upper Root Zone | Stratum 1 | $7\text{--}28\text{ cm}$ | In-situ Capacitive Probe ($20\text{ cm}$) | Active crop extraction zone; buffered against rapid skin drying |
| Deep Subsoil | Stratum 2 | $28\text{--}100\text{ cm}$ | ERA5 Reanalysis / Deep Probe | Capillary rise and drainage boundary layer |

### 3.2 Root-Zone Safety Rule
In accordance with FAO-56 standards, surface satellite moisture ($0\text{--}5\text{ cm}$) is prohibited from directly substituting for root-zone moisture ($Z_r = 0.60\text{ m}$) in depletion calculations ($D_r$). If only surface data is available, the decision engine outputs an explicit `INDETERMINATE` status with the warning:
> *"Root-zone moisture (7-28 cm) absent. Surface stratum (0-5 cm) cannot be used directly to calculate root-zone depletion (FAO-56)."*

---

## 4. Quality Flag Filtering

Official NASA SMAP `retrieval_qual_flag` bitmasks are verified:
- **Bit 0 (Recommended Quality):** $0 = \text{Recommended}, 1 = \text{Not Recommended}$.
- **Bit 1 (Retrieval Attempted):** $0 = \text{Attempted}, 1 = \text{Not Attempted}$.
- **Bit 2 (Retrieval Success):** $0 = \text{Successful}, 1 = \text{Failed}$.

Observations with non-zero bitmasks (indicating radio-frequency interference, dense vegetation attenuation $> 5\text{ kg/m}^2$, or frozen soil) are rejected.

---

## 5. End-to-End Provenance Tags

Every record retains strict provenance labeling:
- `MEASURED`: Calibrated in-situ probe readings.
- `SATELLITE_DERIVED`: NASA SMAP radiometer retrievals.
- `WEATHER_MODEL_DERIVED`: Open-Meteo ERA5 Land numerical model estimates.
- `PREDICTED`: AquaSense-IoT machine learning 24h forecasts.
- `PROVISIONAL_DEFAULT_MIDPOINT`: Agronomic fallback $(FC + WP)/2$ used only when physical telemetry is unpopulated.
