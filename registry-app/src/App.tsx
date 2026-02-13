import { Upload, message, Button } from 'antd'
import { InboxOutlined, UploadOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useState } from 'react'
import 'antd/dist/reset.css'

const { Dragger } = Upload

// Backend API base URL - uses /api proxy in dev (avoids CORS), or explicit URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

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

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
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
