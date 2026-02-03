/// <reference path="./cryptopro.d.ts" />
import { useState, useCallback } from 'react';
import cadesplugin from 'crypto-pro-cadesplugin';
import type { CryptoProApi, CertificateInfo } from 'crypto-pro-cadesplugin';

type SigningStatus = 'idle' | 'checking' | 'loading-certs' | 'signing' | 'success' | 'error';

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [selectedCertThumbprint, setSelectedCertThumbprint] = useState<string>('');
  const [status, setStatus] = useState<SigningStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pluginAvailable, setPluginAvailable] = useState<boolean | null>(null);
  const [certsApi, setCertsApi] = useState<CryptoProApi | null>(null);

  // Проверка доступности плагина
  const checkPlugin = useCallback(async () => {
    setStatus('checking');
    setErrorMessage('');
    
    try {
      const api = await cadesplugin();
      setCertsApi(api);
      setPluginAvailable(true);
      setStatus('idle');
      
      // Автоматически загружаем список сертификатов
      await loadCertificates(api);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setErrorMessage(`Плагин КриптоПро недоступен: ${errorMsg}. Убедитесь, что плагин установлен и браузер поддерживает его работу.`);
      setPluginAvailable(false);
      setStatus('error');
    }
  }, []);

  // Загрузка списка сертификатов
  const loadCertificates = useCallback(async (api: CryptoProApi) => {
    setStatus('loading-certs');
    setErrorMessage('');
    
    try {
      const certs = await api.getCertsList();
      setCertificates(certs);
      
      if (certs.length === 0) {
        setErrorMessage('Не найдено сертификатов с закрытым ключом. Установите сертификат и повторите попытку.');
        setStatus('error');
      } else {
        // Автоматически выбираем первый сертификат
        setSelectedCertThumbprint(certs[0].thumbprint);
        setStatus('idle');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setErrorMessage(`Ошибка при загрузке сертификатов: ${errorMsg}`);
      setStatus('error');
    }
  }, []);

  // Чтение файла в base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Убираем префикс data:...;base64,
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Скачивание файла подписи
  const downloadSignature = (signatureBase64: string, originalFileName: string) => {
    try {
      // Декодируем base64 в бинарные данные
      const binaryString = atob(signatureBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Создаем Blob и скачиваем
      const blob = new Blob([bytes], { type: 'application/pkcs7-signature' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${originalFileName}.sig`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error('Ошибка при создании файла подписи');
    }
  };

  // Подписание файла
  const handleSign = useCallback(async () => {
    if (!selectedFile || !certsApi || !selectedCertThumbprint) {
      setErrorMessage('Выберите файл и сертификат для подписания');
      setStatus('error');
      return;
    }

    setStatus('signing');
    setErrorMessage('');

    try {
      // Читаем файл в base64
      const base64Data = await fileToBase64(selectedFile);
      
      // Подписываем файл (type = true для отсоединенной подписи)
      const signature = await certsApi.signBase64(selectedCertThumbprint, base64Data, true);
      
      // Скачиваем файл подписи
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '') || selectedFile.name;
      downloadSignature(signature, fileName);
      
      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        setSelectedFile(null);
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setErrorMessage(`Ошибка при подписании: ${errorMsg}`);
      setStatus('error');
    }
  }, [selectedFile, certsApi, selectedCertThumbprint]);

  // Обработка выбора файла
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage('');
      setStatus('idle');
    }
  };

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '50px auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        Подписание документов электронной подписью
      </h1>

      {/* Проверка плагина */}
      {pluginAvailable === null && (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <button 
            onClick={checkPlugin}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Проверить доступность плагина КриптоПро
          </button>
        </div>
      )}

      {/* Сообщение о недоступности плагина */}
      {pluginAvailable === false && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          {errorMessage}
        </div>
      )}

      {/* Форма подписания */}
      {pluginAvailable === true && (
        <div>
          {/* Выбор файла */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Выберите файл для подписания:
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              disabled={status === 'signing' || status === 'checking'}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            {selectedFile && (
              <div style={{ marginTop: '10px', color: '#666' }}>
                Выбран файл: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </div>

          {/* Выбор сертификата */}
          {certificates.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
                Выберите сертификат:
              </label>
              <select
                value={selectedCertThumbprint}
                onChange={(e) => setSelectedCertThumbprint(e.target.value)}
                disabled={status === 'signing' || status === 'loading-certs'}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                {certificates.map((cert) => {
                  const subjectInfo = cert.friendlySubjectInfo();
                  const owner = subjectInfo.find((el: { value: string; text: string }) => el.value === 'Владелец')?.text || cert.subjectInfo;
                  const validPeriod = cert.friendlyValidPeriod();
                  
                  return (
                    <option key={cert.thumbprint} value={cert.thumbprint}>
                      {owner} (действителен до: {validPeriod.to.ddmmyy} {validPeriod.to.hhmmss})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Кнопка подписания */}
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={handleSign}
              disabled={
                !selectedFile || 
                !selectedCertThumbprint || 
                status === 'signing' || 
                status === 'checking' ||
                status === 'loading-certs'
              }
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: selectedFile && selectedCertThumbprint && status !== 'signing' 
                  ? '#28a745' 
                  : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: selectedFile && selectedCertThumbprint && status !== 'signing' 
                  ? 'pointer' 
                  : 'not-allowed'
              }}
            >
              {status === 'signing' ? 'Подписание...' : 
               status === 'checking' ? 'Проверка плагина...' :
               status === 'loading-certs' ? 'Загрузка сертификатов...' :
               'Подписать файл'}
            </button>
          </div>

          {/* Сообщение об успехе */}
          {status === 'success' && (
            <div style={{
              padding: '15px',
              backgroundColor: '#d4edda',
              color: '#155724',
              borderRadius: '5px',
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              ✓ Файл успешно подписан! Файл подписи скачан.
            </div>
          )}

          {/* Сообщение об ошибке */}
          {status === 'error' && errorMessage && (
            <div style={{
              padding: '15px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '5px',
              marginBottom: '20px'
            }}>
              {errorMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
