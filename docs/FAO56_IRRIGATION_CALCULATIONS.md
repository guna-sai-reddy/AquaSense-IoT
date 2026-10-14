# AquaSense-IoT FAO-56 Irrigation Decision Engine & Hydraulic Calculations

**Project:** AquaSense-IoT: A Satellite-Sensor Fused Predictive Framework for Minimal-Water Precision Irrigation Scheduling  
**Document:** Agronomic Specification & Mathematical Derivations  
**Reference:** Allen, R. G., et al. (1998). *Crop evapotranspiration - Guidelines for computing crop water requirements*. FAO Irrigation and Drainage Paper 56.  

---

## 1. Soil Hydraulic Capacities

### 1.1 Total Available Water (TAW)
Total Available Water ($TAW$) is the maximum depth of water in millimeters that a crop can extract from its root zone:

$$TAW = 1000 \cdot (\theta_{FC} - \theta_{WP}) \cdot Z_r$$

where:
- $\theta_{FC}$ is soil volumetric water content at Field Capacity ($\text{m}^3/\text{m}^3$, $\sim -33\text{ kPa}$ suction).
- $\theta_{WP}$ is soil volumetric water content at Permanent Wilting Point ($\text{m}^3/\text{m}^3$, $\sim -1500\text{ kPa}$ suction).
- $Z_r$ is the effective rooting depth of the crop in meters.

### 1.2 Readily Available Water (RAW)
Readily Available Water ($RAW$) is the fraction of $TAW$ that a crop can extract without suffering water stress:

$$RAW = p \cdot TAW$$

where:
- $p$ is the soil water depletion fraction (MAD: Management Allowed Depletion), typically $0.50$ for groundnut and cotton during mid-season.

---

## 2. Root-Zone Water Depletion ($D_r$)

Current root-zone soil water depletion ($D_r$) in millimeters is defined as:

$$D_r = 1000 \cdot (\theta_{FC} - \theta_i) \cdot Z_r$$

where:
- $\theta_i$ is the current volumetric moisture content in the root zone ($\text{m}^3/\text{m}^3$).

### Scientific Boundary Safeguards:
1. **Soil Saturation ($\theta_i \ge \theta_{FC}$):** Depletion is zero ($D_r = 0.0\text{ mm}$).
2. **Wilting Point Floor ($\theta_i < \theta_{WP}$):** If input moisture is below wilting point, the engine issues an **Investigation Warning** (`Severe crop water stress or sensor miscalibration suspected`) and caps depletion at $TAW$ ($D_r = TAW$). This prevents desiccated sensor readings (e.g. $0.009\text{ m}^3/\text{m}^3$) from computing impossible mathematical depletions exceeding plant-available capacity.
3. **Sensor Saturation Ceiling ($\theta_i > 0.55\text{ m}^3/\text{m}^3$):** Generates a Data Quality Warning for waterlogging.

---

## 3. Crop Evapotranspiration ($ET_c$) and Effective Rainfall ($P_{eff}$)

### 3.1 Crop Evapotranspiration ($ET_c$)
$$ET_c = K_c \cdot ET_0$$

where:
- $ET_0$ is FAO-56 Penman-Monteith reference evapotranspiration ($\text{mm/day}$).
- $K_c$ is the single crop coefficient appropriate for the growth stage (e.g., $K_c = 1.15$ for mid-season groundnut).

### 3.2 Effective Rainfall ($P_{eff}$)
Effective rainfall infiltrating into the crop root zone is calculated using a conservative deficit approach:
- **Interception Threshold:** Light precipitation ($P < 2.0\text{ mm}$) is discounted ($P_{eff} = 0.0$) due to canopy interception and skin evaporation.
- **Probability Filter:** Forecast rainfall with probability $< 40\%$ is discounted to prevent deficit under-irrigation.
- **Recharge Fraction:** For valid rain events ($P \ge 2.0\text{ mm}$, $\text{prob} \ge 40\%$), $80\%$ is considered infiltrable, capped at current soil deficit:
  $$P_{eff} = \min(0.80 \cdot P_{forecast}, D_r)$$

---

## 4. Precision Irrigation Scheduling Logic

The decision engine evaluates three sequential conditions:

1. **Immediate Stress Condition ($D_r \ge RAW$):**
   - If high-probability forecast rain satisfies $P_{eff} \ge D_r$, irrigation is **DEFERRED** to avoid runoff and leaching.
   - Otherwise, irrigation is **RECOMMENDED** immediately.
   - Net depth: $d_{net} = \max(0.0, D_r - P_{eff})$.
2. **Predictive Pre-Emptive Condition ($D_r < RAW$ but Projected $D_{r,24h} \ge RAW$):**
   - Incorporates the 24-hour ML forecast $\theta_{pred,24h}$.
   - If upcoming rain will recharge the profile, irrigation is **DEFERRED**.
   - Otherwise, anticipatory irrigation is **RECOMMENDED** before stress occurs.
3. **Adequate Moisture Condition ($D_r < RAW$ and $D_{r,24h} < RAW$):**
   - Irrigation is **DEFERRED**.

---

## 5. Gross Irrigation Depth and Applied Volume

### 5.1 Single-Event Depth Ceiling
To prevent deep percolation losses beyond effective root depth ($Z_r = 0.60\text{ m}$), net application is capped at field limit $d_{max}$ ($30.0\text{ mm}$):
$$d_{net,applied} = \min(d_{net}, d_{max})$$

### 5.2 Gross Depth ($d_{gross}$)
$$d_{gross} = \frac{d_{net,applied}}{\eta}$$

where $\eta$ is irrigation application efficiency (e.g. $0.90$ for precision drip, $0.75$ for sprinkler).

### 5.3 Volumetric Conversion
$$V_{gross} = \frac{d_{gross} \cdot A}{1000} \quad [\text{m}^3]$$
$$V_{liters} = V_{gross} \cdot 1000 \quad [\text{Liters}]$$

where $A$ is field surface area in square meters ($1\text{ ha} = 10,000\text{ m}^2$).
