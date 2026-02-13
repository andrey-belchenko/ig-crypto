import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Input } from 'antd'
import { getDocument, getFileDownloadUrl, DocumentResponse } from '../api/api'
import { FileItem } from './FileItem'
import { downloadFileWithName } from '../domain/create-legal-doc'

function DocCard() {
  const { documentId } = useParams<{ documentId: string }>()
  const [document, setDocument] = useState<DocumentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      setError('Document ID is required')
      setLoading(false)
      return
    }

    const fetchDocument = async () => {
      try {
        setLoading(true)
        const doc = await getDocument(documentId)
        setDocument(doc)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch document')
      } finally {
        setLoading(false)
      }
    }

    fetchDocument()
  }, [documentId])

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
        {document.images.map((image) => (
          <FileItem
            key={image.id}
            name={image.originalName}
            size={image.sizeBytes}
            type={image.contentType}
            status="done"
            showDownload={true}
            onDownload={() => downloadFileWithName(getFileDownloadUrl(image.id), image.originalName)}
          />
        ))}
        <FileItem
          name={`${document.type}.json`}
          size={0}
          type="application/json"
          isJson={true}
          showDownload={true}
          onDownload={() => downloadFileWithName(getFileDownloadUrl(document.id), `${document.type}.json`)}
        />
        <FileItem
          name={`${document.type}.json.sig`}
          size={0}
          type="application/pkcs7-signature"
          showDownload={true}
          onDownload={() => downloadFileWithName(getFileDownloadUrl(document.id + '.sig'), `${document.type}.json.sig`)}
        />
      </div>
    </div>
  )
}

export default DocCard
