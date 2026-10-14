/**
 * AquaSense-IoT Centralized API Client
 * Interfaces directly with FastAPI Backend (http://localhost:8000/api/v1)
 */

import {
  AdminEvent,
  AdminField,
  AdminOverviewStats,
  AdminUser,
  AuthToken,
  ComparativeEvaluationReport,
  DatabaseHealthResponse,
  Field,
  FieldCreatePayload,
  FieldUpdatePayload,
  IrrigationEvent,
  IrrigationEventCreatePayload,
  IrrigationRecommendation,
  IrrigationTriggerPayload,
  ModelMetricsResponse,
  Prediction,
  PredictionTriggerPayload,
  SatelliteResponse,
  SensorObservation,
  SystemStatusResponse,
  User,
  WeatherObservation,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const BACKEND_ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// Token storage helpers (safe for SSR)
export const TOKEN_STORAGE_KEY = "aquasense_jwt_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  isAbsolute = false
): Promise<T> {
  const url = isAbsolute ? endpoint : `${API_BASE_URL}${endpoint}`;
  const token = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (networkError: any) {
    throw new ApiError(
      `Cannot connect to AquaSense backend at ${url}. Please ensure the FastAPI server is running.`,
      0,
      networkError
    );
  }

  if (res.status === 204) {
    return {} as T;
  }

  let data: any = null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errorMsg =
      (data && (data.detail || data.message || data.error)) ||
      `HTTP Error ${res.status}: ${res.statusText}`;

    // Handle token expiry or unauthorized
    if (res.status === 401 && typeof window !== "undefined") {
      const isAuthPage =
        window.location.pathname === "/login" ||
        window.location.pathname === "/register";
      if (!isAuthPage) {
        clearStoredToken();
        // Redirect to login if unauthenticated on a protected page
        window.location.href = "/login?session_expired=true";
      }
    }

    throw new ApiError(errorMsg, res.status, data);
  }

  return data as T;
}

export const api = {
  // Auth Endpoints
  async register(payload: { email: string; password: string; full_name?: string }): Promise<User> {
    return request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async login(payload: { email: string; password: string }): Promise<AuthToken> {
    return request<AuthToken>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getMe(): Promise<User> {
    return request<User>("/auth/me", { method: "GET" });
  },

  async generateResetPIN(email: string): Promise<{
    success: boolean;
    email: string;
    pin: string;
    role: string;
    message: string;
  }> {
    return request<{
      success: boolean;
      email: string;
      pin: string;
      role: string;
      message: string;
    }>("/auth/reset-pin", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPasswordWithPIN(payload: {
    email: string;
    pin: string;
    new_password: string;
  }): Promise<{
    success: boolean;
    message: string;
    role: string;
    email: string;
  }> {
    return request<{
      success: boolean;
      message: string;
      role: string;
      email: string;
    }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Field Endpoints
  async getFields(): Promise<Field[]> {
    return request<Field[]>("/fields", { method: "GET" });
  },

  async getField(fieldId: string): Promise<Field> {
    return request<Field>(`/fields/${fieldId}`, { method: "GET" });
  },

  async createField(payload: FieldCreatePayload): Promise<Field> {
    return request<Field>("/fields", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateField(fieldId: string, payload: FieldUpdatePayload): Promise<Field> {
    return request<Field>(`/fields/${fieldId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async deleteField(fieldId: string): Promise<void> {
    return request<void>(`/fields/${fieldId}`, { method: "DELETE" });
  },

  // Observations Endpoints
  async getFieldObservations(
    fieldId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<SensorObservation[]> {
    return request<SensorObservation[]>(
      `/fields/${fieldId}/observations?limit=${limit}&offset=${offset}`,
      { method: "GET" }
    );
  },

  async getFieldWeather(
    fieldId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<WeatherObservation[]> {
    return request<WeatherObservation[]>(
      `/fields/${fieldId}/weather?limit=${limit}&offset=${offset}`,
      { method: "GET" }
    );
  },

  async ingestObservation(payload: any): Promise<SensorObservation> {
    return request<SensorObservation>("/observations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Prediction Endpoints
  async triggerPrediction(
    fieldId: string,
    payload: PredictionTriggerPayload = {}
  ): Promise<Prediction> {
    return request<Prediction>(`/fields/${fieldId}/predictions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getFieldPredictions(
    fieldId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Prediction[]> {
    return request<Prediction[]>(
      `/fields/${fieldId}/predictions?limit=${limit}&offset=${offset}`,
      { method: "GET" }
    );
  },

  async getPrediction(predictionId: string): Promise<Prediction> {
    return request<Prediction>(`/predictions/${predictionId}`, {
      method: "GET",
    });
  },

  // Precision Irrigation Advisory Endpoints
  async triggerRecommendation(
    fieldId: string,
    payload: IrrigationTriggerPayload = {}
  ): Promise<IrrigationRecommendation> {
    return request<IrrigationRecommendation>(
      `/fields/${fieldId}/irrigation/recommendations`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  async getFieldRecommendations(
    fieldId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<IrrigationRecommendation[]> {
    return request<IrrigationRecommendation[]>(
      `/fields/${fieldId}/irrigation/recommendations?limit=${limit}&offset=${offset}`,
      { method: "GET" }
    );
  },

  async getRecommendation(recommendationId: string): Promise<IrrigationRecommendation> {
    return request<IrrigationRecommendation>(
      `/irrigation/recommendations/${recommendationId}`,
      { method: "GET" }
    );
  },

  // Health & System Status Endpoints
  async getHealth(): Promise<{ status: string; environment: string; timestamp: string; services: Record<string, string> }> {
    return request(`${BACKEND_ROOT_URL}/health`, { method: "GET" }, true);
  },

  async getDatabaseHealth(): Promise<DatabaseHealthResponse> {
    return request<DatabaseHealthResponse>(
      `${BACKEND_ROOT_URL}/health/database`,
      { method: "GET" },
      true
    );
  },

  async getSystemStatus(): Promise<SystemStatusResponse> {
    return request<SystemStatusResponse>("/status", { method: "GET" });
  },

  // Satellite Remote Sensing Endpoints
  async getFieldSatellite(fieldId: string): Promise<SatelliteResponse> {
    return request<SatelliteResponse>(`/fields/${fieldId}/satellite`, { method: "GET" });
  },

  // Research Evaluation & Baseline Comparison Endpoints
  async getFieldEvaluation(fieldId: string): Promise<ComparativeEvaluationReport> {
    return request<ComparativeEvaluationReport>(`/evaluation/fields/${fieldId}`, { method: "GET" });
  },

  async getModelMetrics(): Promise<ModelMetricsResponse> {
    return request<ModelMetricsResponse>("/model/metrics", { method: "GET" });
  },

  // Post-Irrigation Event Logging Endpoints
  async listIrrigationEvents(fieldId: string, limit: number = 50): Promise<IrrigationEvent[]> {
    return request<IrrigationEvent[]>(`/fields/${fieldId}/events?limit=${limit}`, { method: "GET" });
  },

  async logIrrigationEvent(
    fieldId: string,
    payload: IrrigationEventCreatePayload
  ): Promise<IrrigationEvent> {
    return request<IrrigationEvent>(`/fields/${fieldId}/events`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async downloadEvaluationCsv(fieldId: string): Promise<Blob> {
    const token = getStoredToken();
    const res = await fetch(`${API_BASE_URL}/evaluation/fields/${fieldId}/export`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to export CSV: ${res.statusText}`);
    }
    return res.blob();
  },

  // Platform Administration Endpoints
  async getAdminStats(): Promise<AdminOverviewStats> {
    return request<AdminOverviewStats>("/admin/stats", { method: "GET" });
  },

  async getAdminUsers(): Promise<AdminUser[]> {
    return request<AdminUser[]>("/admin/users", { method: "GET" });
  },

  async createAdminUser(payload: {
    email: string;
    password: string;
    full_name?: string;
    is_active?: boolean;
    is_superuser?: boolean;
  }): Promise<AdminUser> {
    return request<AdminUser>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateAdminUserStatus(
    userId: string,
    payload: { is_active?: boolean; is_superuser?: boolean }
  ): Promise<AdminUser> {
    return request<AdminUser>(`/admin/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async getAdminFields(): Promise<AdminField[]> {
    return request<AdminField[]>("/admin/fields", { method: "GET" });
  },

  async getAdminEvents(limit: number = 100): Promise<AdminEvent[]> {
    return request<AdminEvent[]>(`/admin/events?limit=${limit}`, { method: "GET" });
  },
};


