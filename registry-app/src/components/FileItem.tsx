import { Button, Typography, Space } from 'antd'
import { FileOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, DeleteOutlined, CodeOutlined, DownloadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'

const { Text } = Typography

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

export interface FileItemProps {
  name: string
  size: number
  type?: string
  lastModified?: number
  status?: 'uploading' | 'done' | 'error' | 'ready'
  onRemove?: () => void
  showRemove?: boolean
  onDownload?: () => void
  showDownload?: boolean
  isJson?: boolean
}

export function FileItem({
  name,
  size,
  type,
  lastModified,
  status,
  onRemove,
  showRemove = false,
  onDownload,
  showDownload = false,
  isJson = false,
}: FileItemProps) {
  const getStatusIcon = () => {
    if (status === 'uploading') return <LoadingOutlined style={{ color: '#1890ff' }} />
    if (status === 'done') return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    if (status === 'error') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    if (isJson) return <CodeOutlined style={{ color: '#1890ff' }} />
    return <FileOutlined style={{ color: '#8c8c8c' }} />
  }

  const displayType = type ? (type.split('/')[1] || type) : (isJson ? 'JSON' : 'Неизвестно')
  const displayDate = lastModified ? formatDate(lastModified) : formatDate(Date.now())

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
            {name}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
            {formatFileSize(size)}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
            {displayType}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
            {displayDate}
          </Text>
        </Space>
      </Space>
      <Space size="small">
        {showDownload && onDownload && (
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            onClick={onDownload}
          />
        )}
        {showRemove && onRemove && status !== 'done' && (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={onRemove}
          />
        )}
      </Space>
    </div>
  )
}

// Helper function to convert UploadFile to FileItemProps
export function uploadFileToFileItemProps(
  file: UploadFile,
  fileList: UploadFile[],
  onRemove?: () => void
): FileItemProps {
  const actualFile = file.originFileObj || file
  const fileSize = actualFile instanceof File ? actualFile.size : file.size || 0
  const fileType = actualFile instanceof File ? actualFile.type : file.type || 'Неизвестно'
  const lastModified = actualFile instanceof File ? actualFile.lastModified : Date.now()

  return {
    name: file.name,
    size: fileSize,
    type: fileType,
    lastModified,
    status: file.status,
    showRemove: true,
    onRemove,
  }
}
