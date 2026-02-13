import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import type { LegalDocument, DocumentImage } from "./domain-types";
import { DocumentType, ImageStatus } from "./domain-types";
import { uploadFile } from "../api/api";

/**
 * Calculates SHA256 hash for a single file
 */
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/**
 * Prepares legal document by calculating SHA256 hashes for all files
 * @param files Array of File objects to process
 * @param author Author name for the document
 * @param documentType Type of the document
 * @returns Promise resolving to LegalDocument object
 */
export async function prepareLegalDocument(
  files: File[],
  author: string,
  documentType: DocumentType
): Promise<LegalDocument> {
  if (!author || author.trim() === "") {
    throw new Error("Author is required");
  }

  // Generate document ID
  const documentId = uuidv4();

  // Generate creation date
  const creationDate = new Date().toISOString();

  // Handle empty files array
  if (files.length === 0) {
    return {
      documentId,
      payload: "",
      author,
      creationDate,
      documentType,
      documentImages: [],
    };
  }

  try {
    // Calculate hashes in parallel for better performance
    const hashPromises = files.map((file) => calculateFileHash(file));
    const hashes = await Promise.all(hashPromises);

    // Map files to DocumentImage objects
    const documentImages: DocumentImage[] = files.map((file, index) => {
      const imageId = uuidv4();
      return {
        imageId,
        name: file.name,
        originalName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storageKey: imageId,
        status: ImageStatus.UPLOADED,
        fileHash: hashes[index],
      };
    });

    return {
      documentId,
      payload: "",
      author,
      creationDate,
      documentType,
      documentImages,
    };
  } catch (error) {
    throw new Error(
      `Failed to calculate file hashes: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export function getSigKey(document: LegalDocument) {
  return document.documentId + ".sig";
}

export async function uploadLegalDocFile(
  document: LegalDocument,
  file: File
): Promise<void> {
  await uploadFile(file, document.documentId);
}

/**
 * Downloads a file from the given URL with a custom filename
 * @param url The URL to download the file from
 * @param filename The desired filename for the downloaded file
 */
export async function downloadFileWithName(url: string, filename: string): Promise<void> {
  try {
    const response = await axios.get(url, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Failed to download file:', error);
    throw error;
  }
}
