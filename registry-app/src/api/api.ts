// Backend API base URL - uses /api proxy in dev (avoids CORS), or explicit URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
}

export interface ApiOptions extends RequestInit {
  params?: Record<string, string>;
}

/**
 * Generic API wrapper function for making HTTP requests
 * @param endpoint - API endpoint (e.g., '/files')
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Promise with parsed response data
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { params, ...fetchOptions } = options;

  // Build URL with query parameters
  let url = `${API_BASE_URL}${endpoint}`;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...fetchOptions.headers,
      },
    });

    const responseData: ApiResponse<T> = {
      status: response.status,
      ok: response.ok,
    };

    // Try to parse JSON response, fallback to text if it fails
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      responseData.data = await response.json();
    } else {
      const text = await response.text();
      if (text) {
        try {
          responseData.data = JSON.parse(text) as T;
        } catch {
          responseData.data = text as any;
        }
      }
    }

    if (!response.ok) {
      responseData.error =
        responseData.data?.message ||
        responseData.data?.error ||
        response.statusText ||
        "Request failed";
    }

    return responseData;
  } catch (error) {
    return {
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Upload a file to the server
 * @param file - File to upload
 * @param key - Key identifier for the file
 * @returns Promise with upload response containing the key
 */
export async function uploadFile(
  file: File,
  key: string
): Promise<ApiResponse<{ key: string }>> {
  return apiCall<{ key: string }>(`/files/${key}`, {
    method: "POST",
    body: file,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Length": file.size.toString(),
    },
  });
}
