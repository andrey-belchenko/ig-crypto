import { Upload, message, Button, Select, Input } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { FileItem, uploadFileToFileItemProps } from "./FileItem";
import {
  prepareLegalDocument,
  getSigKey,
  uploadLegalDocFile,
} from "../domain/create-legal-doc";
import { DocumentType, LegalDocument } from "../domain/domain-types";
import {
  activatePlugin,
  loadCertificates,
  signFile,
  downloadSignature,
  type Certificate,
} from "../lib/crypto";
import { extractNameFromDN } from "../lib/certificate-utils";
import { uploadFile } from "../api/api";

const { Dragger } = Upload;

function DocCreationCard() {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [preparedJson, setPreparedJson] = useState<string | null>(null);
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(
    null
  );
  const [pluginAvailable, setPluginAvailable] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selectedCertIndex, setSelectedCertIndex] = useState<number | null>(
    null
  );
  const [author, setAuthor] = useState<string>("");
  const [selectedDocumentType, setSelectedDocumentType] =
    useState<DocumentType | null>(null);
  const [signing, setSigning] = useState(false);
  const [signatureFile, setSignatureFile] = useState<{
    name: string;
    data: string;
  } | null>(null);

  // Initialize plugin on component mount
  useEffect(() => {
    const initPlugin = async () => {
      try {
        await activatePlugin();
        setPluginAvailable(true);
        const certs = await loadCertificates();
        setCertificates(certs);
      } catch (error) {
        console.warn("Plugin initialization failed:", error);
        // Don't show error immediately - user might not need signing
      }
    };
    initPlugin();
  }, []);

  // Auto-fill author when certificate is selected
  useEffect(() => {
    if (selectedCertIndex !== null && certificates[selectedCertIndex]) {
      const selectedCert = certificates[selectedCertIndex];
      const extractedAuthor = extractNameFromDN(selectedCert.subjectName);
      setAuthor(extractedAuthor);
    } else {
      setAuthor("");
    }
  }, [selectedCertIndex, certificates]);

  // Helper functions for file naming
  const getJsonFileName = (documentType: DocumentType | null): string => {
    return documentType ? `${documentType}.json` : "document.json";
  };

  const getSigFileName = (documentType: DocumentType | null): string => {
    return documentType ? `${documentType}.json.sig` : "document.json.sig";
  };

  const handlePrepare = async () => {
    if (fileList.length === 0) {
      message.warning("Пожалуйста, выберите файлы для подготовки");
      return;
    }

    if (selectedCertIndex === null || !certificates[selectedCertIndex]) {
      message.warning("Пожалуйста, выберите сертификат перед подготовкой");
      return;
    }

    if (!author || author.trim() === "") {
      message.warning("Пожалуйста, укажите автора");
      return;
    }

    if (selectedDocumentType === null) {
      message.warning("Пожалуйста, выберите тип документа перед подготовкой");
      return;
    }

    setPreparing(true);
    try {
      // Extract File objects from fileList
      const files: File[] = [];
      for (const fileItem of fileList) {
        const file = fileItem.originFileObj || fileItem;
        if (file instanceof File) {
          files.push(file);
        }
      }

      if (files.length === 0) {
        message.warning("Не удалось извлечь файлы для обработки");
        return;
      }

      // Calculate SHA256 hashes and prepare document with author
      const legalDocument = await prepareLegalDocument(
        files,
        author,
        selectedDocumentType!
      );

      // Store legal document for later use
      setLegalDocument(legalDocument);

      // Serialize LegalDocument as JSON
      const jsonString = JSON.stringify(legalDocument, null, 2);
      setPreparedJson(jsonString);

      // Reset signing state when new JSON is prepared
      setSignatureFile(null);

      message.success(
        `Подготовлено ${legalDocument.documentImages.length} файлов`
      );
    } catch (error) {
      message.error(
        `Ошибка подготовки: ${
          error instanceof Error ? error.message : "Неизвестная ошибка"
        }`
      );
    } finally {
      setPreparing(false);
    }
  };

  const handleDownloadJson = () => {
    if (!preparedJson) return;

    const blob = new Blob([preparedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getJsonFileName(selectedDocumentType);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSignAndUpload = async () => {
    if (
      !preparedJson ||
      selectedCertIndex === null ||
      !certificates[selectedCertIndex]
    ) {
      message.warning("Выберите сертификат для подписания");
      return;
    }

    if (!legalDocument) {
      message.warning("Пожалуйста, подготовьте документ перед подписанием");
      return;
    }

    if (fileList.length === 0) {
      message.warning("Пожалуйста, выберите файлы для загрузки");
      return;
    }

    setSigning(true);
    setUploading(true);

    try {
      // Step 1: Sign the document
      const jsonFileName = getJsonFileName(selectedDocumentType);
      const jsonBlob = new Blob([preparedJson], { type: "application/json" });
      const jsonFile = new File([jsonBlob], jsonFileName, {
        type: "application/json",
      });

      const selectedCert = certificates[selectedCertIndex];

      // Sign the file (without progress callback)
      const signatureBase64 = await signFile(jsonFile, selectedCert.thumbprint);

      // Create signature file data
      const sigFileName = getSigFileName(selectedDocumentType);
      const sigFileData = {
        name: sigFileName,
        data: signatureBase64,
      };
      setSignatureFile(sigFileData);

      message.success("Файл успешно подписан!");

      // Step 2: Upload JSON file
      try {
        await uploadLegalDocFile(legalDocument, jsonFile);
        message.success(
          `JSON файл успешно загружен. Ключ: ${legalDocument.documentId}`
        );
      } catch (error) {
        message.error(
          `Ошибка загрузки JSON: ${
            error instanceof Error ? error.message : "Неизвестная ошибка"
          }`
        );
        throw error;
      }

      // Step 3: Upload SIG file
      try {
        // Decode base64 to binary
        const binaryString = atob(signatureBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const sigBlob = new Blob([bytes], {
          type: "application/pkcs7-signature",
        });
        const sigFile = new File([sigBlob], sigFileName, {
          type: "application/pkcs7-signature",
        });

        await uploadFile(sigFile, getSigKey(legalDocument));
        message.success(
          `SIG файл успешно загружен. Ключ: ${getSigKey(legalDocument)}`
        );
      } catch (error) {
        message.error(
          `Ошибка загрузки SIG: ${
            error instanceof Error ? error.message : "Неизвестная ошибка"
          }`
        );
        throw error;
      }

      // Step 4: Upload original files sequentially
      for (const fileItem of fileList) {
        // Skip files that are already uploaded
        if (fileItem.status === "done") {
          continue;
        }

        const file = fileItem.originFileObj || fileItem;
        if (!file) {
          continue;
        }

        const key = uuidv4();

        try {
          await uploadFile(file as File, key);

          // Update file status to done
          setFileList((prevList) =>
            prevList.map((item) =>
              item.uid === fileItem.uid ? { ...item, status: "done" } : item
            )
          );

          message.success(`${file.name} успешно загружен. Ключ: ${key}`);
        } catch (error) {
          // Update file status to error
          setFileList((prevList) =>
            prevList.map((item) =>
              item.uid === fileItem.uid ? { ...item, status: "error" } : item
            )
          );
          message.error(
            `${file.name} ошибка загрузки: ${
              error instanceof Error ? error.message : "Неизвестная ошибка"
            }`
          );
        }
      }
    } catch (error) {
      message.error(
        `Ошибка подписания и загрузки: ${
          error instanceof Error ? error.message : "Неизвестная ошибка"
        }`
      );
    } finally {
      setSigning(false);
      setUploading(false);
    }
  };

  const handleDownloadSignature = () => {
    if (!signatureFile) return;

    downloadSignature(
      signatureFile.data,
      getJsonFileName(selectedDocumentType)
    );
  };

  const handleDownloadFile = (file: UploadFile) => {
    const actualFile = file.originFileObj || file;
    if (!(actualFile instanceof File)) {
      message.warning("Не удалось загрузить файл");
      return;
    }

    const url = URL.createObjectURL(actualFile);
    const link = document.createElement("a");
    link.href = url;
    link.download = actualFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Custom file item renderer with detailed information in a single row
  const itemRender = (
    _originNode: React.ReactElement,
    file: UploadFile,
    fileList: UploadFile[]
  ) => {
    const props = uploadFileToFileItemProps(
      file,
      fileList,
      () => {
        const index = fileList.indexOf(file);
        const newFileList = fileList.slice();
        newFileList.splice(index, 1);
        setFileList(newFileList);
      },
      file.status !== "done" ? () => handleDownloadFile(file) : undefined
    );
    return <FileItem {...props} />;
  };

  const props: UploadProps = {
    name: "file",
    multiple: true,
    fileList,
    itemRender,
    beforeUpload: () => {
      // Prevent automatic upload
      return false;
    },
    onChange: (info) => {
      // Keep files in the list without changing their status
      setFileList(info.fileList);
    },
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
  };

  return (
    <div style={{ padding: "50px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Загрузка файлов</h1>
      {pluginAvailable && certificates.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "bold",
            }}
          >
            Выберите сертификат:
          </label>
          <Select
            style={{ width: "100%" }}
            placeholder="Выберите сертификат..."
            value={
              selectedCertIndex !== null
                ? selectedCertIndex.toString()
                : undefined
            }
            onChange={(value) =>
              setSelectedCertIndex(value ? parseInt(value) : null)
            }
            options={certificates.map((cert, index) => ({
              value: index.toString(),
              label: cert.subjectName,
            }))}
          />
        </div>
      )}
      <div style={{ marginBottom: "16px" }}>
        <label
          style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}
        >
          Автор:
        </label>
        <Input
          style={{ width: "100%" }}
          placeholder="Автор документа"
          value={author}
          readOnly
        />
      </div>
      <div style={{ marginBottom: "16px" }}>
        <label
          style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}
        >
          Выберите тип документа:
        </label>
        <Select
          style={{ width: "100%" }}
          placeholder="Выберите тип документа..."
          value={selectedDocumentType || undefined}
          onChange={(value) => setSelectedDocumentType(value as DocumentType)}
          options={Object.values(DocumentType).map((type) => ({
            value: type,
            label: type,
          }))}
        />
      </div>
      <div style={{ marginBottom: "16px" }}>
        <label
          style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}
        >
          Выберите файлы:
        </label>
        <Dragger {...props}>
          <p className="ant-upload-hint">
            Нажмите или перетащите файл в эту область для выбора
          </p>
          <p className="ant-upload-hint">
            Поддержка выбора одного или нескольких файлов.
          </p>
        </Dragger>
      </div>

      <div style={{ marginTop: "16px", textAlign: "right" }}>
        <Button
          onClick={handlePrepare}
          loading={preparing}
          disabled={
            fileList.length === 0 ||
            preparing ||
            uploading ||
            selectedCertIndex === null ||
            selectedDocumentType === null ||
            !author ||
            author.trim() === ""
          }
        >
          Подготовить
        </Button>
      </div>
      {preparedJson && (
        <div style={{ marginTop: "16px" }}>
          <FileItem
            name={getJsonFileName(selectedDocumentType)}
            size={new Blob([preparedJson]).size}
            type="application/json"
            lastModified={Date.now()}
            status="ready"
            isJson={true}
            showDownload={true}
            onDownload={handleDownloadJson}
          />

          {signatureFile && (
            <div style={{ marginTop: "16px" }}>
              <FileItem
                name={signatureFile.name}
                size={(() => {
                  try {
                    return atob(signatureFile.data).length;
                  } catch {
                    // Fallback: approximate size from base64 string
                    return Math.floor(signatureFile.data.length * 0.75);
                  }
                })()}
                type="application/pkcs7-signature"
                lastModified={Date.now()}
                status="ready"
                showDownload={true}
                onDownload={handleDownloadSignature}
              />
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "16px", textAlign: "right" }}>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={handleSignAndUpload}
          loading={signing || uploading}
          disabled={
            !legalDocument ||
            !preparedJson ||
            fileList.length === 0 ||
            uploading ||
            signing ||
            preparing ||
            selectedCertIndex === null ||
            !certificates[selectedCertIndex]
          }
        >
          Подписать и отправить
        </Button>
      </div>
    </div>
  );
}

export default DocCreationCard;
