/**
 * Domain types matching the backend Kotlin entities
 */

// Value types (wrapped primitives)
export type DocumentId = string; // UUID
export type ImageId = string; // UUID
export type FileHash = string; // hex-encoded hash

// Enums
export enum DocumentType {
  CERTIFICATION_APPLICATION = "Заявка на сертификацию",
  CERTIFICATION_REJECT = "Отказ в выдаче сертификата",
  CERTIFICATE = "Сертификат",
}

export enum ImageStatus {
  UPLOADED = "UPLOADED",
  ATTACHED = "ATTACHED",
}

// Entity types
export interface DocumentImage {
  imageId: ImageId;
  name: string;
  originalName: string;
  contentType: string;
  sizeBytes: number; // Long in Kotlin
  storageKey: string;
  status: ImageStatus;
  fileHash: FileHash;
}

export interface LegalDocument {
  documentId: DocumentId;
  payload: string;
  author: string;
  creationDate: string; // ISO 8601 date-time string (LocalDateTime in Kotlin)
  documentType: DocumentType;
  documentImages: DocumentImage[];
}
