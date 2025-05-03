import { Image, ViewsData, DiskUsage, CountryViews, ImageView, UploadResponse, LoginRequest, LoginResponse, ErrorResponse, RecentView, RecentViewsResponse, PaginatedResponse, DashboardStats, Config, RefreshTokenResponse } from "@/types";

const API_BASE_URL = "/api";

// Helper function to get auth headers with CSRF token
export const getAuthHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken() || '',
  };
  return headers;
};

// Helper function to handle API responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type");
  
  if (!response.ok) {
    let errorMessage = "Unknown error";
    if (contentType?.includes("application/json")) {
      const errorData = await response.json();
      errorMessage = errorData.error || `HTTP error ${response.status}`;
    } else {
      errorMessage = response.statusText || `HTTP error ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  if (!contentType?.includes("application/json")) {
    throw new Error("Invalid response format");
  }

  const data = await response.json();
  return data as T;
};

// Helper function to handle CSRF token refresh
const handleCSRFError = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Invalid CSRF token")) {
      // Try to refresh the session
      try {
        await refreshToken();
        // Retry the operation after refresh with updated headers
        return await operation();
      } catch (refreshError) {
        // If refresh fails, throw the original error
        throw error;
      }
    }
    throw error;
  }
};

// Helper function to get CSRF token from cookies
const getCsrfToken = (): string | null => {
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
};

// Auth endpoints
export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password } as LoginRequest),
    credentials: "include",
  });

  const data = await handleResponse<LoginResponse>(response);
  
  // Validate response data
  if (!data.username) {
    throw new Error("Invalid response data from server");
  }

  return data;
};

export const logout = async (): Promise<void> => {
  return handleCSRFError(async () => {
    const response = await fetch(`${API_BASE_URL}/logout`, {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to logout");
    }
  });
};

export const verifyToken = async (): Promise<{ username: string }> => {
  const response = await fetch(`${API_BASE_URL}/verify`, {
    method: "GET",
    headers: getAuthHeaders(),
    credentials: "include",
  });
  return handleResponse<{ username: string }>(response);
};

export const refreshToken = async (): Promise<RefreshTokenResponse> => {
  const response = await fetch(`${API_BASE_URL}/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken() || '',
    },
  });

  return handleResponse<RefreshTokenResponse>(response);
};

// Image endpoints
export const uploadImage = async (file: File): Promise<Image> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  return handleResponse<Image>(response);
};

export const getImages = async (
  type?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<Image[]> => {
  const params = new URLSearchParams();
  if (type && type !== "all") params.append("type", type);
  if (dateFrom) params.append("from", dateFrom);
  if (dateTo) params.append("to", dateTo);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/list${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  const data = await handleResponse<{ images: Image[] }>(response);
  return data.images;
};

export const getImage = async (uuid: string): Promise<Image> => {
  const response = await fetch(`${API_BASE_URL}/images/${uuid}`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  return handleResponse<Image>(response);
};

export const deleteImage = async (uuid: string): Promise<void> => {
  return handleCSRFError(async () => {
    const response = await fetch(`${API_BASE_URL}/delete/${uuid}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
      credentials: "include",
    });
    return handleResponse<void>(response);
  });
};

// Stats endpoints
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await fetch(`${API_BASE_URL}/stats/dashboard`, {
    method: "GET",
    headers: getAuthHeaders(),
    credentials: "include",
  });
  return handleResponse<DashboardStats>(response);
};

export const getViewsData = async (): Promise<ViewsData[]> => {
  const response = await fetch(`${API_BASE_URL}/stats/views`, {
    method: "GET",
    headers: getAuthHeaders(),
    credentials: "include",
  });
  return handleResponse<ViewsData[]>(response);
};

export const getCountryViews = async (): Promise<CountryViews[]> => {
  const response = await fetch(`${API_BASE_URL}/stats/country-views`, {
    method: "GET",
    headers: getAuthHeaders(),
    credentials: "include",
  });
  return handleResponse<CountryViews[]>(response);
};

export const getRecentViews = async (): Promise<RecentViewsResponse> => {
  const response = await fetch(`${API_BASE_URL}/stats/recent-views`, {
    method: "GET",
    headers: getAuthHeaders(),
    credentials: "include",
  });
  return handleResponse<RecentViewsResponse>(response);
};

export const getDiskUsage = async (): Promise<DiskUsage> => {
  const response = await fetch(`${API_BASE_URL}/stats/disk-usage`, {
    method: "GET",
    headers: getAuthHeaders(),
    credentials: "include",
  });
  return handleResponse<DiskUsage>(response);
};

// Image-specific stats
export const getImageById = async (id: number): Promise<Image> => {
  const response = await fetch(`${API_BASE_URL}/stats/${id}`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  return handleResponse<Image>(response);
};

export const updateImagePrivacy = async (id: number, isPrivate: boolean, password?: string): Promise<Image> => {
  return handleCSRFError(async () => {
    const response = await fetch(`${API_BASE_URL}/privacy/${id}`, {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ 
        isPrivate,
        password: isPrivate ? password : undefined 
      }),
    });
    return handleResponse<Image>(response);
  });
};

export const getImageViews = async (id: number): Promise<ImageView[]> => {
  const response = await fetch(`${API_BASE_URL}/stats/${id}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  
  const data = await handleResponse<{ image: Image, views: ImageView[] }>(response);
  return data.views;
};

export const getImageStats = async (id: number): Promise<{ image: Image, views: ImageView[] }> => {
  const response = await fetch(`${API_BASE_URL}/stats/${id}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<{ image: Image, views: ImageView[] }>(response);
};

export const getConfig = async (): Promise<Config> => {
  const response = await fetch(`${API_BASE_URL}/config`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  return handleResponse<Config>(response);
}; 