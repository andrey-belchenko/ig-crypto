import { Upload, Button, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import { useState } from 'react'
import 'antd/dist/reset.css'

// Backend API base URL - adjust this to match your backend server
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

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
      message.success(`${file.name} uploaded successfully. Key: ${data.key}`)
    } catch (error) {
      onError?.(error)
      message.error(`${file.name} upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      <h1>File Uploader</h1>
      <Upload {...props}>
        <Button icon={<UploadOutlined />}>Click to Upload</Button>
      </Upload>
    </div>
  )
}

export default App
