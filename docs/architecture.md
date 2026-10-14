# AquaSense-IoT Architecture Specification

## 1. System Overview
AquaSense-IoT integrates three diverse data streams into a unified hydrological scheduling pipeline:
- **Ground Truth Sensors:** Measured telemetry for in-situ soil moisture and temperature.
- **NASA SMAP Satellite:** Remote sensing radiometer scans providing regional soil moisture dynamics.
- **Open-Meteo Meteorology:** Real-time NWP forecasts and ERA5 historical records.

## 2. FAO-56 Hydrological Model Formulation
The Irrigation Decision Engine calculates the soil water depletion $D_{r,i}$ at day $i$:
$$D_{r,i} = D_{r,i-1} - (P_i - RO_i) - I_i - CR_i + ET_{c,i} + DP_i$$

Where:
- $P_i$: Precipitation on day $i$
- $RO_i$: Runoff from soil surface
- $I_i$: Net irrigation depth
- $CR_i$: Capillary rise
- $ET_{c,i}$: Crop evapotranspiration ($ET_{c} = K_c \cdot ET_0$)
- $DP_i$: Deep percolation

When depletion $D_r$ exceeds the **Readily Available Water ($RAW$)**:
$$RAW = p \cdot TAW = p \cdot [1000 \cdot (\theta_{FC} - \theta_{WP}) \cdot Z_r]$$

where $p$ is the depletion fraction (typically $0.4 \dots 0.5$ for vegetables and field crops), $\theta_{FC}$ is field capacity, $\theta_{WP}$ is wilting point, and $Z_r$ is root depth, an irrigation advisory is triggered with irrigation requirement:
$$I_{net} = D_r$$
$$\text{Water Volume } (m^3) = \frac{I_{net} \cdot \text{Area } (m^2)}{1000 \cdot \text{Efficiency}}$$

## 3. Data Integrity & Provenance
All pipeline stages preserve origin markers:
1. `MEASURED`: Physical sensor hardware
2. `SATELLITE_DERIVED`: NASA Earthdata SMAP observations
3. `WEATHER_MODEL_DERIVED`: Numerical Weather Predictions
4. `PREDICTED`: Machine learning regression outputs
5. `SIMULATED`: Automated software integration test fixtures
