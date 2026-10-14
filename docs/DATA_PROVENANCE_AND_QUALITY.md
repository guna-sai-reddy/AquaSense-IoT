# AquaSense-IoT Data Provenance, Quality Assurance & Freshness Standards

**Project:** AquaSense-IoT: A Satellite-Sensor Fused Predictive Framework for Minimal-Water Precision Irrigation Scheduling  
**Document:** Provenance Taxonomy, Staleness Policies & Quality Safeguards  
**Version:** 1.0.0  

---

## 1. Provenance Taxonomy

Every data point, sensor observation, machine-learning inference, and irrigation advisory in AquaSense-IoT is tagged with an immutable provenance classification:

| Provenance Tag | Source System | Nominal Latency | Measurement Principle |
|---|---|---|---|
| `MEASURED` | In-situ Capacitive Probes | Continuous ($\sim 1\text{h}$) | Direct electrical permittivity measurement in root zone ($20\text{ cm}$) |
| `SATELLITE_DERIVED` | NASA SMAP Radiometer | $\sim 2\text{--}3\text{ days}$ | L-band passive microwave emission ($1.41\text{ GHz}$) for top $0\text{--}5\text{ cm}$ skin |
| `WEATHER_MODEL_DERIVED` | Open-Meteo ERA5 Land | Hourly ($\sim 1\text{h}$) | Atmospheric physics reanalysis and numerical weather prediction |
| `PREDICTED` | Scikit-Learn Pipeline | Real-time on demand | 24-hour forward autoregressive forecast from active model |
| `PROVISIONAL_DEFAULT_MIDPOINT` | Agronomic Calculation | Fallback | Unweighted midpoint between Field Capacity and Wilting Point $(FC+WP)/2$ |
| `SIMULATED` | Test Fixture Suite | On demand | Synthetic bench test records |

---

## 2. Source-Specific Freshness Cadence Thresholds

Different hydrological data sources operate on inherently different temporal update cycles. A single universal staleness threshold is scientifically invalid. AquaSense-IoT implements tiered, source-specific thresholds:

| Data Stream | Expected Cadence | Fresh Threshold | Delayed Threshold | Stale Threshold | Handling Rule |
|---|---|---|---|---|---|
| **In-Situ Ground Probes** | Hourly | $< 3\text{ hours}$ | $3\text{--}12\text{ hours}$ | $> 12\text{ hours}$ | If stale, issue telemetry warning; if $> 48\text{h}$, require manual confirmation |
| **Numerical Weather Forecasts** | 6-hourly cycle | $< 6\text{ hours}$ | $6\text{--}24\text{ hours}$ | $> 24\text{ hours}$ | Fall back to persistence evapotranspiration ($ET_0$) |
| **NASA SMAP Satellite Overpasses** | 2–3 days orbit | $< 72\text{ hours}$ | $72\text{--}168\text{ hours}$ | $> 168\text{ hours}$ | Flag as unobserved overpass; do not interpolate |

---

## 3. Physical & Agronomic Data Quality Boundary Guards

To prevent sensor anomalies or erroneous user overrides from corrupting the irrigation decision engine, strict physical boundary filters are enforced at the API and service layers:

1. **Volumetric Moisture Boundaries:**
   - Valid physical agricultural range: $0.01\text{ m}^3/\text{m}^3 \le \theta \le 0.65\text{ m}^3/\text{m}^3$.
   - Any value outside this band triggers HTTP 422 Unprocessable Entity.
2. **Wilting Point Safety Floor ($\theta_i < \theta_{WP}$):**
   - If input moisture falls below the field's configured wilting point ($\theta_{WP} = 0.14\text{ m}^3/\text{m}^3$), an **Investigation Warning** is generated.
   - Depletion is capped at $TAW$ ($102.0\text{ mm}$), preventing desiccated mathematical anomalies (e.g. $180.6\text{ mm}$ depletion).
3. **Sensor Saturation / Waterlogging ($\theta_i > 0.55\text{ m}^3/\text{m}^3$):**
   - Triggers an anaerobic waterlogging warning.
4. **Soil Texture Consistency:**
   - Enforces $0.02 \le (\theta_{FC} - \theta_{WP}) \le 0.35\text{ m}^3/\text{m}^3$.
