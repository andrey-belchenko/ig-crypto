import { Upload, message, Button, Typography, Space } from 'antd'
import { InboxOutlined, UploadOutlined, FileOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, DeleteOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import 'antd/dist/reset.css'

const { Text } = Typography

const { Dragger } = Upload

// Backend API base URL - uses /api proxy in dev (avoids CORS), or explicit URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// Helper function to format date
const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function App() {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)

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
    const actualFile = file.originFileObj || file
    const fileSize = actualFile instanceof File ? actualFile.size : file.size || 0
    const fileType = actualFile instanceof File ? actualFile.type : file.type || 'Неизвестно'
    const lastModified = actualFile instanceof File ? actualFile.lastModified : Date.now()

    const getStatusIcon = () => {
      if (file.status === 'uploading') return <LoadingOutlined style={{ color: '#1890ff' }} />
      if (file.status === 'done') return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      if (file.status === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      return <FileOutlined style={{ color: '#8c8c8c' }} />
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          marginBottom: '8px',
        }}
      >
        <Space size="middle" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: '16px' }}>{getStatusIcon()}</span>
          <Space size="small" split={<span style={{ color: '#d9d9d9' }}>•</span>} style={{ flex: 1, minWidth: 0 }}>
            <Text strong ellipsis style={{ fontSize: '14px' }}>
              {file.name}
            </Text>
            <Text type="secondary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
              {formatFileSize(fileSize)}
            </Text>
            <Text type="secondary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
              {fileType.split('/')[1] || fileType}
            </Text>
            <Text type="secondary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
              {formatDate(lastModified)}
            </Text>
          </Space>
        </Space>
        {file.status !== 'done' && (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => {
              const index = fileList.indexOf(file)
              const newFileList = fileList.slice()
              newFileList.splice(index, 1)
              setFileList(newFileList)
            }}
          />
        )}
      </div>
    )
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
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={handleUpload}
          loading={uploading}
          disabled={fileList.length === 0 || uploading}
        >
          Загрузить
        </Button>
      </div>
    </div>
  )
}

export default App
