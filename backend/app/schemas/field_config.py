"""Field and Crop Agricultural Parameter Schemas & Validations.

Implements FAO-56 soil-water-crop parameter definitions for precision irrigation scheduling.
Includes documented example configurations for testing.
"""

from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class CropConfig(BaseModel):
    """Crop agronomic parameters and growth stage coefficients."""

    crop_name: str = Field(..., min_length=2, max_length=50, description="Common crop name (e.g. Groundnut, Cotton, Tomato)")
    growth_stage: Literal["initial", "development", "mid_season", "late_season"] = Field(
        ...,
        description="FAO-56 crop growth stage",
    )

    @field_validator("growth_stage", mode="before")
    @classmethod
    def normalize_growth_stage(cls, v: str) -> str:
        if not isinstance(v, str):
            return "mid_season"
        v_clean = v.lower().strip()
        if "init" in v_clean:
            return "initial"
        if "dev" in v_clean:
            return "development"
        if "mid" in v_clean:
            return "mid_season"
        if "late" in v_clean or "end" in v_clean:
            return "late_season"
        return "mid_season"

    kc: float = Field(
        ...,
        ge=0.15,
        le=1.45,
        description="FAO-56 single crop coefficient (Kc)",
    )
    root_depth_m: float = Field(
        ...,
        ge=0.10,
        le=3.0,
        description="Effective crop root-zone depth in meters (Zr)",
    )
    depletion_fraction_p: float = Field(
        default=0.50,
        ge=0.10,
        le=0.85,
        description="Management Allowed Depletion (MAD) fraction of TAW without water stress (FAO-56 Table 22)",
    )


class SoilConfig(BaseModel):
    """Soil physical texture and hydraulic water-holding properties."""

    soil_texture: Literal[
        "sand",
        "loamy_sand",
        "sandy_loam",
        "loam",
        "silt_loam",
        "sandy_clay_loam",
        "clay_loam",
        "silty_clay_loam",
        "clay",
    ] = Field(..., description="USDA soil textural classification")

    @field_validator("soil_texture", mode="before")
    @classmethod
    def normalize_soil_texture(cls, v: str) -> str:
        if not isinstance(v, str):
            return "sandy_clay_loam"
        v_clean = v.lower().strip().replace(" ", "_").replace("-", "_")
        valid = {"sand", "loamy_sand", "sandy_loam", "loam", "silt_loam", "sandy_clay_loam", "clay_loam", "silty_clay_loam", "clay"}
        if v_clean in valid:
            return v_clean
        return "sandy_clay_loam"


    field_capacity_theta: float = Field(
        ...,
        ge=0.08,
        le=0.55,
        description="Volumetric water content at Field Capacity (theta_FC in m3/m3, ~ -33 kPa suction)",
    )
    wilting_point_theta: float = Field(
        ...,
        ge=0.02,
        le=0.35,
        description="Volumetric water content at Permanent Wilting Point (theta_WP in m3/m3, ~ -1500 kPa suction)",
    )

    @model_validator(mode="after")
    def validate_hydraulic_consistency(self) -> SoilConfig:
        """Field capacity must strictly exceed permanent wilting point."""
        if self.field_capacity_theta <= self.wilting_point_theta:
            raise ValueError(
                f"Field Capacity ({self.field_capacity_theta} m3/m3) must be strictly greater than "
                f"Permanent Wilting Point ({self.wilting_point_theta} m3/m3)."
            )
        taw_unit = self.field_capacity_theta - self.wilting_point_theta
        if taw_unit < 0.03:
            raise ValueError(
                f"Available water capacity ({taw_unit:.3f} m3/m3) is unrealistically low for agricultural soils."
            )
        return self


class FieldConfig(BaseModel):
    """Field geographical boundary, irrigation infrastructure, and limits."""

    field_id: str = Field(..., min_length=2, max_length=64, description="Unique field identifier")
    field_name: str = Field(..., min_length=2, max_length=100)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

    area_unit: Literal["square_meters", "hectares"] = "hectares"
    area_value: float = Field(..., gt=0.0, description="Field surface area")

    irrigation_method: Literal["drip", "sprinkler", "furrow", "flood", "subsurface_drip"] = Field(
        default="drip",
        description="On-field water distribution infrastructure",
    )
    application_efficiency: float = Field(
        default=0.90,
        ge=0.30,
        le=0.98,
        description="Fraction of applied irrigation water stored in the root zone (eta: 0.85-0.95 for drip, 0.70-0.80 for sprinkler)",
    )

    max_irrigation_depth_per_event_mm: float = Field(
        default=30.0,
        ge=5.0,
        le=100.0,
        description="Safety ceiling on single application depth to prevent deep percolation and runoff (mm)",
    )
    max_irrigation_volume_m3: Optional[float] = Field(
        default=None,
        gt=0.0,
        description="Maximum permitted water volume per irrigation event (m3) under water budget caps",
    )

    crop: CropConfig
    soil: SoilConfig

    @property
    def area_m2(self) -> float:
        """Returns field surface area normalized to square meters."""
        if self.area_unit == "hectares":
            return round(self.area_value * 10_000.0, 2)
        return round(self.area_value, 2)

    @property
    def area_hectares(self) -> float:
        """Returns field area in hectares."""
        if self.area_unit == "hectares":
            return self.area_value
        return round(self.area_value / 10_000.0, 4)


# ==============================================================================
# Documented Example Configurations for Testing & Verification
# Clearly labeled as examples for testing (NOT fabricated actual farm values).
# ==============================================================================

EXAMPLE_GROUNDNUT_LOAM_FIELD = FieldConfig(
    field_id="EXAMPLE_KURNOOL_PLOT_01",
    field_name="Example Groundnut Plot (Loam Soil - Drip)",
    latitude=15.8281,
    longitude=78.0373,
    area_unit="hectares",
    area_value=1.5,  # 1.5 hectares = 15,000 m2
    irrigation_method="drip",
    application_efficiency=0.90,  # 90% drip efficiency
    max_irrigation_depth_per_event_mm=30.0,
    crop=CropConfig(
        crop_name="Groundnut (Peanut)",
        growth_stage="mid_season",
        kc=1.05,  # FAO-56 mid-season Kc for groundnut
        root_depth_m=0.45,  # 45 cm effective root depth
        depletion_fraction_p=0.50,  # 50% allowable depletion
    ),
    soil=SoilConfig(
        soil_texture="loam",
        field_capacity_theta=0.28,  # 28% volumetric moisture
        wilting_point_theta=0.14,  # 14% volumetric moisture
    ),
)

EXAMPLE_COTTON_CLAY_FIELD = FieldConfig(
    field_id="EXAMPLE_KURNOOL_PLOT_02",
    field_name="Example Cotton Plot (Clay Loam - Sprinkler)",
    latitude=15.8281,
    longitude=78.0373,
    area_unit="square_meters",
    area_value=8_000.0,  # 0.8 hectares
    irrigation_method="sprinkler",
    application_efficiency=0.75,  # 75% sprinkler efficiency
    max_irrigation_depth_per_event_mm=35.0,
    crop=CropConfig(
        crop_name="Cotton",
        growth_stage="development",
        kc=0.75,
        root_depth_m=0.60,  # 60 cm root depth
        depletion_fraction_p=0.55,
    ),
    soil=SoilConfig(
        soil_texture="clay_loam",
        field_capacity_theta=0.34,
        wilting_point_theta=0.18,
    ),
)
