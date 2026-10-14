# AquaSense-IoT Baseline Comparison & Research Evaluation Methodology

**Project:** AquaSense-IoT: A Satellite-Sensor Fused Predictive Framework for Minimal-Water Precision Irrigation Scheduling  
**Document:** Research Evaluation Protocol & Benchmark Methodology  
**Version:** 1.0.0  

---

## 1. Objective of Baseline Comparison

A central claim of precision agricultural research is minimal-water consumption without inducing crop water stress. To evaluate this claim scientifically, AquaSense-IoT implements a dual-controller comparative simulation environment comparing:
1. **Conventional Static MAD (Management Allowed Depletion) Threshold Controller.**
2. **AquaSense-IoT Predictive Precision Irrigation Controller.**

Both controllers are subjected to identical meteorological time-series, identical soil hydraulic parameters, identical rooting depths, and identical application efficiencies ($\eta$).

---

## 2. Controller Specifications

### 2.1 Conventional Threshold Controller
- **Decision Rule:** Irrigates whenever root-zone depletion $D_r \ge RAW$ ($D_r \ge 51.0\text{ mm}$ for benchmark).
- **Application Depth:** Refills soil water deficit to field capacity:
  $$d_{net} = \min(D_r, d_{max})$$
- **Atmospheric Blindness:** Does not look ahead at forecast precipitation, probability of rain, or forward soil moisture trends.
- **Vulnerability:** Often triggers an irrigation cycle immediately before rainfall, causing saturation, waterlogging, deep percolation loss, and wasted energy.

### 2.2 AquaSense-IoT Predictive Controller
- **Dual Water Balance:** Incorporates 24-hour machine-learning predictions and forecast reference evapotranspiration ($ET_0$).
- **Rainfall Deferral:** When $D_r \ge RAW$, if high-probability ($\ge 70\%$) forecast rainfall will provide effective recharge ($P_{eff} \ge D_r$), irrigation is deferred.
- **Precipitation Deduction:** Deducts infiltrable effective rainfall ($P_{eff}$) from gross application demand ($d_{net} = D_r - P_{eff}$).
- **Anticipatory Pacing:** When $D_r < RAW$ but projected 24-hour depletion breaches $RAW$, recommends smaller anticipatory pulses ($0.5 \cdot RAW$) rather than bulk refill.

---

## 3. Evaluated Performance Metrics

1. **Water Application Quantities:**
   - Total Gross Irrigation Depth ($mm$)
   - Total Applied Water Volume ($m^3$)
   - Relative Water Savings ($m^3$ and $\%$):
     $$\text{Savings } (\%) = \frac{V_{\text{conventional}} - V_{\text{predictive}}}{V_{\text{conventional}}} \cdot 100$$
2. **Irrigation Frequency:**
   - Event Count over the evaluation window
   - Events per Week ($\text{frequency}$)
   - Mean Interval between applications ($\text{days}$)
3. **Moisture-Target Deviation:**
   - Mean Absolute Deviation ($MAD$) from optimal root-zone moisture band $[\theta_{RAW}, \theta_{FC}]$:
     $$MAD = \frac{1}{N} \sum_{t=1}^N |\theta_t - \theta_{\text{target}}|$$
4. **Crop Water Stress Hours:**
   - Cumulative hours where root-zone depletion $D_r \ge RAW$ (indicating crop transpirational reduction according to FAO-56 Eq. 83).
5. **Irrigation Water Productivity ($m^3/\text{ha}$):**
   - Gross water volume delivered per hectare of cultivated land.

---

## 4. Distinction Between Simulated and Measured Evidence

- **Simulated Metrics:** In the current phase, multi-week baseline comparisons are executed across chronological Open-Meteo ERA5 Land reanalysis time-series for the Kurnool site.
- **Yield-Based Water-Use Efficiency (WUE):** Agronomic WUE ($\text{kg of yield} / \text{m}^3\text{ of water}$) requires physical harvesting and crop weight telemetry. Because physical yield data is unharvested, the system honestly reports:
  `"NOT_MEASURED (Awaiting harvest yield data for agronomic WUE kg/m³)"`
  to maintain research integrity.
