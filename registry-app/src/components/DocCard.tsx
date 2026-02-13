import { useState, useEffect } from 'react'
import { Input } from 'antd'
import { getDocument, getFileDownloadUrl, DocumentResponse } from '../api/api'
import { FileItem } from './FileItem'

function DocCard() {
  const [document, setDocument] = useState<DocumentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true)
        const doc = await getDocument('f25d681e-2706-451d-97a0-fa68a6a65afa')
        setDocument(doc)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch document')
      } finally {
        setLoading(false)
      }
    }

    fetchDocument()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (!document) {
    return <div>No document found</div>
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div style={{ padding: '50px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Документ</h1>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Автор:
        </label>
        <Input
          style={{ width: '100%' }}
          value={document.author}
          readOnly
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Тип документа:
        </label>
        <Input
          style={{ width: '100%' }}
          value={document.type}
          readOnly
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Дата создания:
        </label>
        <Input
          style={{ width: '100%' }}
          value={formatDate(document.createdAt)}
          readOnly
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Файлы:
        </label>
        {document.images.map((image) => (
          <FileItem
            key={image.id}
            name={image.originalName}
            size={image.sizeBytes}
            type={image.contentType}
            status="done"
            showDownload={true}
            onDownload={() => window.open(getFileDownloadUrl(image.id), '_blank')}
          />
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
          Документ и подпись:
        </label>
        <FileItem
          name={`${document.type}.json`}
          size={0}
          type="application/json"
          isJson={true}
          showDownload={true}
          onDownload={() => window.open(getFileDownloadUrl(document.id), '_blank')}
        />
        <FileItem
          name={`${document.type}.json.sig`}
          size={0}
          type="application/pkcs7-signature"
          showDownload={true}
          onDownload={() => window.open(getFileDownloadUrl(document.id + '.sig'), '_blank')}
        />
      </div>
    </div>
  )
}

export default DocCard
