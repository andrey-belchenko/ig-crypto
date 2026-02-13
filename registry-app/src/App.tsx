import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import DocCreationCard from './components/DocCreationCard'
import DocCard from './components/DocCard'
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
          ]}
        />
      </Header>
      <Content>
        <Routes>
          <Route path="/" element={<DocCreationCard />} />
          <Route path="/doc/:documentId" element={<DocCard />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
