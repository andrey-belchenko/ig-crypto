import { Card, Typography, Space, Tag, Button } from 'antd'
import { FileTextOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

function DocCard() {
  // Dummy content
  const dummyDoc = {
    id: 'doc-12345',
    name: 'Пример документа.pdf',
    size: '2.5 MB',
    type: 'application/pdf',
    createdAt: '2026-02-13 14:30:00',
    status: 'active',
    description: 'Это пример документа с фиктивными данными для демонстрации компонента DocCard.',
  }

  return (
    <div style={{ padding: '50px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={1}>Просмотр документа</Title>
      <Card
        style={{ marginTop: '24px' }}
        actions={[
          <Button key="view" type="primary" icon={<EyeOutlined />}>
            Просмотр
          </Button>,
          <Button key="download" icon={<DownloadOutlined />}>
            Скачать
          </Button>,
        ]}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">ID документа:</Text>
            <br />
            <Text strong>{dummyDoc.id}</Text>
          </div>
          
          <div>
            <Text type="secondary">Название:</Text>
            <br />
            <Space>
              <FileTextOutlined />
              <Text strong>{dummyDoc.name}</Text>
            </Space>
          </div>
          
          <div>
            <Text type="secondary">Размер:</Text>
            <br />
            <Text>{dummyDoc.size}</Text>
          </div>
          
          <div>
            <Text type="secondary">Тип:</Text>
            <br />
            <Tag color="blue">{dummyDoc.type}</Tag>
          </div>
          
          <div>
            <Text type="secondary">Дата создания:</Text>
            <br />
            <Text>{dummyDoc.createdAt}</Text>
          </div>
          
          <div>
            <Text type="secondary">Статус:</Text>
            <br />
            <Tag color="green">{dummyDoc.status}</Tag>
          </div>
          
          <div>
            <Text type="secondary">Описание:</Text>
            <br />
            <Text>{dummyDoc.description}</Text>
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default DocCard
