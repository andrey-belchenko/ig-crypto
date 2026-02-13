import { Upload, message, Button, Space } from 'antd'
import { InboxOutlined, UploadOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { FileItem, uploadFileToFileItemProps } from './FileItem'
import { prepareLegalDocument } from '../domain/create-legal-doc'

const { Dragger } = Upload

// Backend API base URL - uses /api proxy in dev (avoids CORS), or explicit URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function DocCreationCard() {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [preparedJson, setPreparedJson] = useState<string | null>(null)

  const handlePrepare = async () => {
    if (fileList.length === 0) {
      message.warning('Пожалуйста, выберите файлы для подготовки')
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

      // Calculate SHA256 hashes
      const hashes = await prepareLegalDocument(files)
      
      // Serialize as JSON
      const jsonString = JSON.stringify(hashes, null, 2)
      setPreparedJson(jsonString)
      
      message.success(`Подготовлено ${hashes.length} хешей файлов`)
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
            disabled={fileList.length === 0 || preparing || uploading}
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
        </div>
      )}
    </div>
  )
}

export default DocCreationCard
