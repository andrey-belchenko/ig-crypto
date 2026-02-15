import { useState } from 'react';
import { Button, Upload, message, Card, Typography, Space } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { uploadImage, getImageDownloadUrl, ImageUploadResponse } from '../api/api';

const { Title, Text } = Typography;

export default function ImageUploadTest() {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<ImageUploadResponse | null>(null);
  const [errorResult, setErrorResult] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!selectedFile) {
      message.warning('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadResult(null);
    setErrorResult(null);

    try {
      const result = await uploadImage(selectedFile, '');
      setUploadResult(result);
      message.success('Image uploaded successfully');
      setFileList([]);
      setSelectedFile(null);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Upload failed';
      const errorDetails = error.response?.data ? JSON.stringify(error.response.data, null, 2) : errorMessage;
      setErrorResult(errorDetails);
      message.error(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setFileList([]);
    setSelectedFile(null);
    setUploadResult(null);
    setErrorResult(null);
  };

  return (
    <Card style={{ maxWidth: 800, margin: '50px auto', padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2}>Image Upload Test</Title>
        
        <Text type="secondary">
          Test the image upload endpoint. Select an image file and click Upload.
        </Text>

        <Upload
          fileList={fileList}
          beforeUpload={(file) => {
            const uploadFile: UploadFile = {
              uid: `${Date.now()}`,
              name: file.name,
              status: 'done',
              originFileObj: file,
            };
            setFileList([uploadFile]);
            setSelectedFile(file);
            return false; // Prevent auto upload
          }}
          onRemove={handleRemove}
          maxCount={1}
          accept="image/*"
        >
          <Button icon={<UploadOutlined />}>Select Image</Button>
        </Upload>

        {selectedFile && (
          <div>
            <Text strong>Selected file: </Text>
            <Text>{selectedFile.name}</Text>
            <br />
            <Text type="secondary">
              Size: {(selectedFile.size / 1024).toFixed(2)} KB
            </Text>
          </div>
        )}

        <Button
          type="primary"
          onClick={handleUpload}
          loading={uploading}
          disabled={!selectedFile}
          size="large"
        >
          {uploading ? 'Uploading...' : 'Upload Image'}
        </Button>

        {uploadResult && (
          <Card
            type="inner"
            style={{
              backgroundColor: '#f6ffed',
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong style={{ color: '#52c41a' }}>✓ Upload Successful</Text>
              <Text strong>Response JSON:</Text>
              <pre
                style={{
                  backgroundColor: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              >
                {JSON.stringify(uploadResult, null, 2)}
              </pre>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                href={getImageDownloadUrl(uploadResult.id)}
                target="_blank"
                download
              >
                Download File
              </Button>
            </Space>
          </Card>
        )}

        {errorResult && (
          <Card
            type="inner"
            style={{
              backgroundColor: '#fff2f0',
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong style={{ color: '#ff4d4f' }}>✗ Upload Failed</Text>
              <Text strong>Error Response:</Text>
              <pre
                style={{
                  backgroundColor: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#ff4d4f',
                }}
              >
                {errorResult}
              </pre>
            </Space>
          </Card>
        )}
      </Space>
    </Card>
  );
}
