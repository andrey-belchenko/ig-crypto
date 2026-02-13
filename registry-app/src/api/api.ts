import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export async function uploadFile(file: File, key: string): Promise<void> {
  await axios.post(`${API_BASE_URL}/files/${key}`, file, {
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
}
