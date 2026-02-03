/// <reference path="./cryptopro.d.ts" />
import { useState, useCallback } from 'react';
import cadesplugin from 'crypto-pro-cadesplugin';
import type { CryptoProApi, CertificateInfo } from 'crypto-pro-cadesplugin';

type SigningStatus = 'idle' | 'checking' | 'loading-certs' | 'signing' | 'success' | 'error';

interface LogEntry {
  id: number;
  operation: string;
  duration: number; // в миллисекундах
  timestamp: Date;
  success: boolean;
  error?: string;
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [selectedCertThumbprint, setSelectedCertThumbprint] = useState<string>('');
  const [status, setStatus] = useState<SigningStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pluginAvailable, setPluginAvailable] = useState<boolean | null>(null);
  const [certsApi, setCertsApi] = useState<CryptoProApi | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logIdCounter, setLogIdCounter] = useState<number>(1);

  // Добавление записи в лог
  const addLogEntry = useCallback((operation: string, duration: number, success: boolean, error?: string) => {
    const entry: LogEntry = {
      id: logIdCounter,
      operation,
      duration,
      timestamp: new Date(),
      success,
      error
    };
    setLogEntries(prev => [...prev, entry]);
    setLogIdCounter(prev => prev + 1);
  }, [logIdCounter]);

  // Форматирование времени
  const formatDuration = (ms: number): string => {
    if (ms < 1000) {
      return `${ms.toFixed(0)} мс`;
    }
    return `${(ms / 1000).toFixed(2)} сек`;
  };

  // Форматирование времени для отображения
  const formatTime = (date: Date): string => {
    const timeStr = date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${timeStr}.${ms}`;
  };

  // Проверка доступности плагина
  const checkPlugin = useCallback(async () => {
    setStatus('checking');
    setErrorMessage('');
    const startTime = performance.now();
    
    try {
      const api = await cadesplugin();
      const duration = performance.now() - startTime;
      setCertsApi(api);
      setPluginAvailable(true);
      setStatus('idle');
      addLogEntry('Проверка доступности плагина', duration, true);
      
      // Автоматически загружаем список сертификатов
      await loadCertificates(api);
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setErrorMessage(`Плагин КриптоПро недоступен: ${errorMsg}. Убедитесь, что плагин установлен и браузер поддерживает его работу.`);
      setPluginAvailable(false);
      setStatus('error');
      addLogEntry('Проверка доступности плагина', duration, false, errorMsg);
    }
  }, [addLogEntry]);

  // Загрузка списка сертификатов
  const loadCertificates = useCallback(async (api: CryptoProApi) => {
    setStatus('loading-certs');
    setErrorMessage('');
    const startTime = performance.now();
    
    try {
      const certs = await api.getCertsList();
      const duration = performance.now() - startTime;
      setCertificates(certs);
      
      if (certs.length === 0) {
        setErrorMessage('Не найдено сертификатов с закрытым ключом. Установите сертификат и повторите попытку.');
        setStatus('error');
        addLogEntry('Загрузка списка сертификатов', duration, false, 'Сертификаты не найдены');
      } else {
        // Автоматически выбираем первый сертификат
        setSelectedCertThumbprint(certs[0].thumbprint);
        setStatus('idle');
        addLogEntry(`Загрузка списка сертификатов (найдено: ${certs.length})`, duration, true);
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setErrorMessage(`Ошибка при загрузке сертификатов: ${errorMsg}`);
      setStatus('error');
      addLogEntry('Загрузка списка сертификатов', duration, false, errorMsg);
    }
  }, [addLogEntry]);

  // Чтение файла в base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const reader = new FileReader();
      reader.onload = () => {
        const duration = performance.now() - startTime;
        const result = reader.result as string;
        // Убираем префикс data:...;base64,
        const base64 = result.split(',')[1] || result;
        addLogEntry(`Загрузка файла "${file.name}" (${(file.size / 1024).toFixed(2)} KB)`, duration, true);
        resolve(base64);
      };
      reader.onerror = (error) => {
        const duration = performance.now() - startTime;
        addLogEntry(`Загрузка файла "${file.name}"`, duration, false, 'Ошибка чтения файла');
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  };

  // Скачивание файла подписи
  const downloadSignature = (signatureBase64: string, originalFileName: string) => {
    const startTime = performance.now();
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
      
      const duration = performance.now() - startTime;
      addLogEntry(`Скачивание файла подписи "${originalFileName}.sig"`, duration, true);
    } catch (error) {
      const duration = performance.now() - startTime;
      addLogEntry(`Скачивание файла подписи "${originalFileName}.sig"`, duration, false, 'Ошибка при создании файла подписи');
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
      // Читаем файл в base64 (время загрузки логируется внутри fileToBase64)
      const base64Data = await fileToBase64(selectedFile);
      
      // Подписываем файл (type = true для отсоединенной подписи)
      const signingStartTime = performance.now();
      const signature = await certsApi.signBase64(selectedCertThumbprint, base64Data, true);
      const signingDuration = performance.now() - signingStartTime;
      addLogEntry('Подписание файла', signingDuration, true);
      
      // Скачиваем файл подписи (время скачивания логируется внутри downloadSignature)
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
  }, [selectedFile, certsApi, selectedCertThumbprint, addLogEntry]);

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

      {/* Лог операций */}
      {logEntries.length > 0 && (
        <div style={{
          marginTop: '40px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          border: '1px solid #dee2e6'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
            Лог операций
          </h2>
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '13px'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 'bold' }}>Время</th>
                  <th style={{ textAlign: 'left', padding: '8px', fontWeight: 'bold' }}>Операция</th>
                  <th style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>Длительность</th>
                  <th style={{ textAlign: 'center', padding: '8px', fontWeight: 'bold' }}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map((entry) => (
                  <tr 
                    key={entry.id}
                    style={{ 
                      borderBottom: '1px solid #e9ecef',
                      backgroundColor: entry.success ? 'transparent' : '#fff3cd'
                    }}
                  >
                    <td style={{ padding: '8px', color: '#666' }}>
                      {formatTime(entry.timestamp)}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {entry.operation}
                      {entry.error && (
                        <div style={{ fontSize: '11px', color: '#dc3545', marginTop: '4px' }}>
                          Ошибка: {entry.error}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                      {formatDuration(entry.duration)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {entry.success ? (
                        <span style={{ color: '#28a745', fontSize: '16px' }}>✓</span>
                      ) : (
                        <span style={{ color: '#dc3545', fontSize: '16px' }}>✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logEntries.length > 0 && (
            <div style={{ marginTop: '15px', textAlign: 'right' }}>
              <button
                onClick={() => setLogEntries([])}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Очистить лог
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
