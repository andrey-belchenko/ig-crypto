import { Upload, message } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useState } from 'react'
import 'antd/dist/reset.css'

const { Dragger } = Upload

// Backend API base URL - uses /api proxy in dev (avoids CORS), or explicit URL in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function App() {
  const [fileList, setFileList] = useState<UploadFile[]>([])

  const customRequest = async (options: any) => {
    const { file, onSuccess, onError } = options
    
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE_URL}/files`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const data = await response.json()
      onSuccess?.(data, file)
      message.success(`${file.name} успешно загружен. Ключ: ${data.key}`)
    } catch (error) {
      onError?.(error)
      message.error(`${file.name} ошибка загрузки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    }
  }

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    fileList,
    customRequest,
    onChange: (info) => {
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
        <p className="ant-upload-text">Нажмите или перетащите файл в эту область для загрузки</p>
        <p className="ant-upload-hint">
          Поддержка загрузки одного или нескольких файлов.
        </p>
      </Dragger>
    </div>
  )
}

export default App
