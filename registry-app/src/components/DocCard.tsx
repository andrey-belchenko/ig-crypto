import { useState, useEffect } from 'react'
import { getDocument, DocumentResponse } from '../api/api'

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

  return (
    <div style={{ padding: '50px', maxWidth: '1200px', margin: '0 auto' }}>
      <pre style={{ background: '#f5f5f5', padding: '20px', borderRadius: '4px', overflow: 'auto' }}>
        {JSON.stringify(document, null, 2)}
      </pre>
    </div>
  )
}

export default DocCard
