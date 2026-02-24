import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import DocCreationCard from './components/DocCreationCard'
import DocCard from './components/DocCard'
import ImageUploadTest from './components/ImageUploadTest'
import TestPage from './components/TestPage'
import 'antd/dist/reset.css'

const { Header, Content } = Layout

function App() {
  const location = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={[
            {
              key: '/',
              label: <Link to="/">Создание документа</Link>,
            },
            {
              key: '/doc',
              label: <Link to="/doc">Просмотр документа</Link>,
            },
            {
              key: '/test-upload',
              label: <Link to="/test-upload">Test Image Upload</Link>,
            },
            {
              key: '/test',
              label: <Link to="/test">Test</Link>,
            },
          ]}
        />
      </Header>
      <Content>
        <Routes>
          <Route path="/" element={<DocCreationCard />} />
          <Route path="/doc/:documentId" element={<DocCard />} />
          <Route path="/test-upload" element={<ImageUploadTest />} />
          <Route path="/test" element={<TestPage />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
