import { Upload, message, Button, Space, Select, Progress, Input } from 'antd'
import { InboxOutlined, UploadOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FileItem, uploadFileToFileItemProps } from './FileItem'
import { prepareLegalDocument } from '../domain/create-legal-doc'
import { DocumentType } from '../domain/domain-types'
import {
  activatePlugin,
  loadCertificates,
  signFile,
  downloadSignature,
  type Certificate,
} from '../lib/crypto'
import { extractNameFromDN } from '../lib/certificate-utils'

const { Dragger } = Upload

// Backend API base URL - uses /api proxy in dev (avoids CORS), or explicit URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function DocCreationCard() {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [preparedJson, setPreparedJson] = useState<string | null>(null)
  const [pluginAvailable, setPluginAvailable] = useState(false)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [selectedCertIndex, setSelectedCertIndex] = useState<number | null>(null)
  const [author, setAuthor] = useState<string>('')
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null)
  const [signing, setSigning] = useState(false)
  const [signProgress, setSignProgress] = useState(0)
  const [signatureFile, setSignatureFile] = useState<{ name: string; data: string } | null>(null)

  // Initialize plugin on component mount
  useEffect(() => {
    const initPlugin = async () => {
      try {
        await activatePlugin()
        setPluginAvailable(true)
        const certs = await loadCertificates()
        setCertificates(certs)
      } catch (error) {
        console.warn('Plugin initialization failed:', error)
        // Don't show error immediately - user might not need signing
      }
    }
    initPlugin()
  }, [])

  // Auto-fill author when certificate is selected
  useEffect(() => {
    if (selectedCertIndex !== null && certificates[selectedCertIndex]) {
      const selectedCert = certificates[selectedCertIndex]
      const extractedAuthor = extractNameFromDN(selectedCert.subjectName)
      setAuthor(extractedAuthor)
    } else {
      setAuthor('')
    }
  }, [selectedCertIndex, certificates])

  const handlePrepare = async () => {
    if (fileList.length === 0) {
      message.warning('Пожалуйста, выберите файлы для подготовки')
      return
    }

    if (selectedCertIndex === null || !certificates[selectedCertIndex]) {
      message.warning('Пожалуйста, выберите сертификат перед подготовкой')
      return
    }

    if (!author || author.trim() === '') {
      message.warning('Пожалуйста, укажите автора')
      return
    }

    if (selectedDocumentType === null) {
      message.warning('Пожалуйста, выберите тип документа перед подготовкой')
      return
    }

    setPreparing(true)
    try {
      // Extract File objects from fileList
      const files: File[] = []
      for (const fileItem of fileList) {
        const file = fileItem.originFileObj || fileItem
        if (file instanceof File) {
          files.push(file)
        }
      }

      if (files.length === 0) {
        message.warning('Не удалось извлечь файлы для обработки')
        return
      }

      // Calculate SHA256 hashes and prepare document with author
      const documentData = await prepareLegalDocument(files, author)
      
      // Create JSON object with hashes, author, and document type
      const jsonObject = {
        hashes: documentData.hashes,
        author: documentData.author,
        documentType: selectedDocumentType,
      }
      
      // Serialize as JSON
      const jsonString = JSON.stringify(jsonObject, null, 2)
      setPreparedJson(jsonString)
      
      // Reset signing state when new JSON is prepared
      setSignatureFile(null)
      
      message.success(`Подготовлено ${documentData.hashes.length} хешей файлов`)
    } catch (error) {
      message.error(`Ошибка подготовки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setPreparing(false)
    }
  }

  const handleDownloadJson = () => {
    if (!preparedJson) return

    const blob = new Blob([preparedJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'prepared-document-hashes.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSign = async () => {
    if (!preparedJson || selectedCertIndex === null || !certificates[selectedCertIndex]) {
      message.warning('Выберите сертификат для подписания')
      return
    }

    setSigning(true)
    setSignProgress(0)

    try {
      // Create a File object from the JSON string
      const jsonBlob = new Blob([preparedJson], { type: 'application/json' })
      const jsonFile = new File([jsonBlob], 'prepared-document-hashes.json', {
        type: 'application/json',
      })

      const selectedCert = certificates[selectedCertIndex]

      // Sign the file
      const signatureBase64 = await signFile(jsonFile, selectedCert.thumbprint, (percent) => {
        setSignProgress(percent)
      })

      // Create signature file data
      const sigFileName = 'prepared-document-hashes.sig'
      setSignatureFile({
        name: sigFileName,
        data: signatureBase64,
      })

      // Download signature file
      downloadSignature(signatureBase64, 'prepared-document-hashes.json')

      message.success('Файл успешно подписан!')
    } catch (error) {
      message.error(`Ошибка подписания: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setSigning(false)
      setSignProgress(0)
    }
  }

  const handleDownloadSignature = () => {
    if (!signatureFile) return

    downloadSignature(signatureFile.data, 'prepared-document-hashes.json')
  }

  const handleDownloadFile = (file: UploadFile) => {
    const actualFile = file.originFileObj || file
    if (!(actualFile instanceof File)) {
      message.warning('Не удалось загрузить файл')
      return
    }

    const url = URL.createObjectURL(actualFile)
    const link = document.createElement('a')
    link.href = url
    link.download = actualFile.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Пожалуйста, выберите файлы для загрузки')
      return
    }

    setUploading(true)

    try {
      // Upload files sequentially
      for (const fileItem of fileList) {
        // Skip files that are already uploaded
        if (fileItem.status === 'done') {
          continue
        }

        const file = fileItem.originFileObj || fileItem
        if (!file) {
          continue
        }

        const formData = new FormData()
        formData.append('file', file as File)
        const key = uuidv4()
        formData.append('key', key)

        try {
          const response = await fetch(`${API_BASE_URL}/files`, {
            method: 'POST',
            body: formData,
          })

            if (!response.ok) {
              throw new Error(`Upload failed: ${response.statusText}`)
            }

            const data = await response.json()
            
            // Update file status to done
            setFileList((prevList) =>
              prevList.map((item) =>
                item.uid === fileItem.uid
                  ? { ...item, status: 'done', response: data }
                  : item
              )
            )

            message.success(`${file.name} успешно загружен. Ключ: ${data.key}`)
        } catch (error) {
          // Update file status to error
          setFileList((prevList) =>
            prevList.map((item) =>
              item.uid === fileItem.uid
                ? { ...item, status: 'error' }
                : item
            )
          )
          message.error(`${file.name} ошибка загрузки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
        }
      }
    } finally {
      setUploading(false)
    }
  }

  // Custom file item renderer with detailed information in a single row
  const itemRender = (_originNode: React.ReactElement, file: UploadFile, fileList: UploadFile[]) => {
    const props = uploadFileToFileItemProps(
      file,
      fileList,
      () => {
        const index = fileList.indexOf(file)
        const newFileList = fileList.slice()
        newFileList.splice(index, 1)
        setFileList(newFileList)
      },
      file.status !== 'done' ? () => handleDownloadFile(file) : undefined
    )
    return <FileItem {...props} />
  }

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    itemRender,
    beforeUpload: () => {
      // Prevent automatic upload
      return false
    },
    onChange: (info) => {
      // Keep files in the list without changing their status
      setFileList(info.fileList)
    },
    onRemove: (file) => {
      const index = fileList.indexOf(file)
      const newFileList = fileList.slice()
      newFileList.splice(index, 1)
      setFileList(newFileList)
    },
  }

  return (
    <div style={{ padding: '50px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Загрузка файлов</h1>
      {pluginAvailable && certificates.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Выберите сертификат:
          </label>
          <Select
            style={{ width: '100%' }}
            placeholder="Выберите сертификат..."
            value={selectedCertIndex !== null ? selectedCertIndex.toString() : undefined}
            onChange={(value) => setSelectedCertIndex(value ? parseInt(value) : null)}
            options={certificates.map((cert, index) => ({
              value: index.toString(),
              label: cert.subjectName,
            }))}
          />
        </div>
      )}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Автор:
        </label>
        <Input
          style={{ width: '100%' }}
          placeholder="Автор документа"
          value={author}
          readOnly
        />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Выберите тип документа:
        </label>
        <Select
          style={{ width: '100%' }}
          placeholder="Выберите тип документа..."
          value={selectedDocumentType || undefined}
          onChange={(value) => setSelectedDocumentType(value as DocumentType)}
          options={Object.values(DocumentType).map((type) => ({
            value: type,
            label: type,
          }))}
        />
      </div>
      <Dragger {...props}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Нажмите или перетащите файл в эту область для выбора</p>
        <p className="ant-upload-hint">
          Поддержка выбора одного или нескольких файлов. Нажмите кнопку "Загрузить" для начала загрузки.
        </p>
      </Dragger>
      <div style={{ marginTop: '16px', textAlign: 'right' }}>
        <Space>
          <Button
            onClick={handlePrepare}
            loading={preparing}
            disabled={fileList.length === 0 || preparing || uploading || selectedCertIndex === null || selectedDocumentType === null || !author || author.trim() === ''}
          >
            Подготовить
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleUpload}
            loading={uploading}
            disabled={fileList.length === 0 || uploading || preparing}
          >
            Загрузить
          </Button>
        </Space>
      </div>
          {preparedJson && (
        <div style={{ marginTop: '16px' }}>
          <FileItem
            name="prepared-document-hashes.json"
            size={new Blob([preparedJson]).size}
            type="application/json"
            lastModified={Date.now()}
            status="ready"
            isJson={true}
            showDownload={true}
            onDownload={handleDownloadJson}
          />

          {pluginAvailable && certificates.length > 0 && selectedCertIndex !== null && (
            <div style={{ marginTop: '16px' }}>
              <Button
                type="primary"
                onClick={handleSign}
                loading={signing}
                disabled={signing || !preparedJson}
                style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}
              >
                Подписать
              </Button>
              {signing && (
                <div style={{ marginTop: '8px' }}>
                  <Progress percent={signProgress} status="active" />
                </div>
              )}
            </div>
          )}

          {signatureFile && (
            <div style={{ marginTop: '16px' }}>
              <FileItem
                name={signatureFile.name}
                size={(() => {
                  try {
                    return atob(signatureFile.data).length
                  } catch {
                    // Fallback: approximate size from base64 string
                    return Math.floor(signatureFile.data.length * 0.75)
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
    </div>
  )
}

export default DocCreationCard
