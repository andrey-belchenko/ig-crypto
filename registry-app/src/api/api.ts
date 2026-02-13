import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export interface ImageResponse {
  id: string;
  contentType: string;
  originalName: string;
  sizeBytes: number;
}

export interface DocumentResponse {
  id: string;
  payload: string;
  author: string;
  createdAt: string;
  type: string;
  images: ImageResponse[];
}

export async function uploadFile(file: File, key: string): Promise<void> {
  await axios.post(`${API_BASE_URL}/files/${key}`, file, {
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
}

export async function getDocument(id: string): Promise<DocumentResponse> {
  const response = await axios.get<DocumentResponse>(`${API_BASE_URL}/documents/${id}`);
  return response.data;
}
