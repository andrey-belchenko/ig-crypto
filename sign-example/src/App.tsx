/// <reference path="./cryptopro.d.ts" />
import { useState, useCallback, useEffect } from 'react';
import cadesplugin from 'crypto-pro-cadesplugin';
import type { CryptoProApi, CertificateInfo } from 'crypto-pro-cadesplugin';

type SigningStatus = 'idle' | 'checking' | 'loading-certs' | 'signing' | 'success' | 'error';

interface LogEntry {
  id: number;
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
  details?: string;
}

interface ProgressInfo {
  current: number;
  total: number;
  percent: number;
  loadedSize: number;
  totalSize: number;
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [selectedCertThumbprint, setSelectedCertThumbprint] = useState<string>('');
  const [selectedCertName, setSelectedCertName] = useState<string>('');
  const [status, setStatus] = useState<SigningStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pluginAvailable, setPluginAvailable] = useState<boolean | null>(null);
  const [certsApi, setCertsApi] = useState<CryptoProApi | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logIdCounter, setLogIdCounter] = useState<number>(1);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [fileApiSupported, setFileApiSupported] = useState<boolean>(true);

  // Проверка поддержки File API
  useEffect(() => {
    const checkFileApiSupport = () => {
      const isSupported = !!(window.File && window.FileReader && window.FileList && window.Blob);
      setFileApiSupported(isSupported);
      
      if (!isSupported) {
        addLogEntry(
          'Проверка File API', 
          0, 
          false, 
          'File API не поддерживается браузером'
        );
      }
    };
    
    checkFileApiSupport();
  }, []);

  // Добавление записи в лог
  const addLogEntry = useCallback((operation: string, duration: number, success: boolean, error?: string, details?: string) => {
    const entry: LogEntry = {
      id: logIdCounter,
      operation,
      duration,
      timestamp: new Date(),
      success,
      error,
      details
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

  // Форматирование размера файла
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' КБ';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' МБ';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' ГБ';
  };

  // Проверка доступности плагина
  const checkPlugin = useCallback(async () => {
    setStatus('checking');
    setErrorMessage('');
    const startTime = performance.now();
    
    try {
      const plugin = await cadesplugin();
      const api = plugin as unknown as CryptoProApi;
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
        const firstCert = certs[0];
        setSelectedCertThumbprint(firstCert.thumbprint);
        // Извлекаем CN из subjectInfo для File API
        const subject = firstCert.subjectInfo;
        const cnMatch = subject.match(/CN=([^,]+)/);
        if (cnMatch) {
          setSelectedCertName(cnMatch[1]);
        }
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

  // Определяем, нужно ли использовать File API
  const shouldUseFileAPI = useCallback((file: File): boolean => {
    // Используем File API если:
    // 1. Браузер поддерживает File API
    // 2. Файл больше 40MB ИЛИ у нас есть CN сертификата
    return fileApiSupported && (file.size > 40 * 1024 * 1024 /*|| !!selectedCertName*/);
  }, [fileApiSupported, selectedCertName]);

  // Подписание файла через File API (для больших файлов)
  const signFileWithFileAPI = useCallback(async (file: File, certName: string) => {
    return new Promise<string>((resolve, reject) => {
      window.cadesplugin.async_spawn(function* () {
        try {
          const fileSize = file.size;
          const chunkSize = 3 * 1024 * 1024; // 3MB
          const chunks = Math.ceil(fileSize / chunkSize);
          let currentChunk = 0;

          addLogEntry(
            'Начало подписания через File API',
            0,
            true,
            undefined,
            `Файл ${file.name} (${formatFileSize(fileSize)}) будет обработан по ${chunks} частям`
          );

          // Создаем объект для хэширования
          const oHashedData = yield window.cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");
          yield oHashedData.propset_DataEncoding(window.cadesplugin.CADESCOM_BASE64_TO_BINARY);
          yield oHashedData.propset_Algorithm(window.cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256);

          // Функция для обработки загрузки чанка
          const frOnload = function (e: ProgressEvent<FileReader>) {
            window.cadesplugin.async_spawn(function* () {
              try {
                const result = (e.target as FileReader).result as string;
                const header = ";base64,";
                const base64Data = result.substr(result.indexOf(header) + header.length);
                
                // Добавляем данные в хэш
                yield oHashedData.Hash(base64Data);
                
                // Обновляем прогресс
                currentChunk++;
                const percentLoaded = Math.round((currentChunk / chunks) * 100);
                const loadedSize = Math.min(currentChunk * chunkSize, fileSize);
                
                setProgress({
                  current: currentChunk,
                  total: chunks,
                  percent: percentLoaded,
                  loadedSize,
                  totalSize: fileSize
                });

                if (currentChunk < chunks) {
                  loadNext();
                } else {
                  // Все чанки обработаны, создаем подпись
                  setProgress(null);
                  
                  addLogEntry(
                    'Файл полностью загружен',
                    0,
                    true,
                    undefined,
                    'Начинаем создание подписи'
                  );

                  const oStore = yield window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");
                  yield oStore.Open(
                    window.cadesplugin.CAPICOM_CURRENT_USER_STORE,
                    window.cadesplugin.CAPICOM_MY_STORE,
                    window.cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
                  );

                  const oStoreCerts = yield oStore.Certificates;
                  const oCertificates = yield oStoreCerts.Find(
                    window.cadesplugin.CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME,
                    certName
                  );
                  
                  const certsCount = yield oCertificates.Count;
                  if (certsCount === 0) {
                    throw new Error(`Сертификат не найден: ${certName}`);
                  }
                  
                  const oCertificate = yield oCertificates.Item(1);
                  const oSigner = yield window.cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                  yield oSigner.propset_Certificate(oCertificate);
                  yield oSigner.propset_CheckCertificate(true);
                  yield oSigner.propset_Options(window.cadesplugin.CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN);

                  const oSignedData = yield window.cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                  yield oSignedData.propset_ContentEncoding(window.cadesplugin.CADESCOM_BASE64_TO_BINARY);

                  const signatureStartTime = performance.now();
                  const sSignedMessage = yield oSignedData.SignHash(
                    oHashedData,
                    oSigner,
                    window.cadesplugin.CADESCOM_CADES_BES
                  );
                  const signatureDuration = performance.now() - signatureStartTime;

                  yield oStore.Close();
                  
                  addLogEntry(
                    'Подписание завершено',
                    signatureDuration,
                    true,
                    undefined,
                    'Файл успешно подписан через File API'
                  );
                  
                  resolve(sSignedMessage);
                }
              } catch (error) {
                reject(error);
              }
            });
          };

          const frOnerror = function () {
            reject(new Error("Ошибка чтения файла"));
          };

          const loadNext = function () {
            const fileReader = new FileReader();
            fileReader.onload = frOnload;
            fileReader.onerror = frOnerror;

            const start = currentChunk * chunkSize;
            const end = Math.min(start + chunkSize, fileSize);

            // Используем slice с учетом префиксов браузеров
            const blobSlice = (file as any).slice || (file as any).mozSlice || (file as any).webkitSlice;
            const chunk = blobSlice.call(file, start, end);
            
            fileReader.readAsDataURL(chunk);
          };

          // Начинаем обработку
          loadNext();
        } catch (error) {
          reject(error);
        }
      });
    });
  }, [addLogEntry]);

  // Подписание файла стандартным способом (для маленьких файлов)
  const signFileStandard = useCallback(async (file: File, thumbprint: string) => {
    const startTime = performance.now();
    
    addLogEntry(
      'Начало стандартного подписания',
      0,
      true,
      undefined,
      `Файл ${file.name} (${formatFileSize(file.size)})`
    );

    // Читаем файл в base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const duration = performance.now() - startTime;
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        addLogEntry(
          `Файл загружен в память`, 
          duration, 
          true
        );
        resolve(base64);
      };
      reader.onerror = () => {
        const duration = performance.now() - startTime;
        addLogEntry(
          `Загрузка файла "${file.name}"`, 
          duration, 
          false, 
          'Ошибка чтения файла'
        );
        reject(new Error('Ошибка чтения файла'));
      };
      reader.readAsDataURL(file);
    });

    // Подписываем файл
    if (!certsApi) throw new Error('API плагина не инициализирован');
    
    const signingStartTime = performance.now();
    const signature = await certsApi.signBase64(thumbprint, base64Data, true);
    const signingDuration = performance.now() - signingStartTime;
    
    addLogEntry(
      'Стандартное подписание завершено',
      signingDuration,
      true,
      undefined,
      'Файл успешно подписан стандартным методом'
    );
    
    return signature;
  }, [certsApi, addLogEntry]);

  // Основная функция подписания - автоматически выбирает метод
  const handleSign = useCallback(async () => {
    if (!selectedFile || !certsApi || !selectedCertThumbprint) {
      setErrorMessage('Выберите файл и сертификат для подписания');
      setStatus('error');
      return;
    }

    // Проверяем, что у нас есть CN сертификата для File API
    if (!selectedCertName && shouldUseFileAPI(selectedFile)) {
      setErrorMessage('Для подписания больших файлов необходим сертификат с CN. Выберите другой сертификат или используйте файл меньшего размера.');
      setStatus('error');
      return;
    }

    setStatus('signing');
    setErrorMessage('');
    setProgress(null);

    try {
      let signature: string;
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '') || selectedFile.name;

      // Автоматически выбираем метод подписания
      if (shouldUseFileAPI(selectedFile)) {
        // Используем File API для больших файлов
        signature = await signFileWithFileAPI(selectedFile, selectedCertName);
      } else {
        // Используем стандартный метод для маленьких файлов
        signature = await signFileStandard(selectedFile, selectedCertThumbprint);
      }

      // Скачиваем файл подписи
      downloadSignature(signature, fileName);
      
      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        setSelectedFile(null);
        setProgress(null);
      }, 2000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setErrorMessage(`Ошибка при подписании: ${errorMsg}`);
      setStatus('error');
      addLogEntry('Подписание файла', 0, false, errorMsg);
      setProgress(null);
    }
  }, [
    selectedFile, 
    certsApi, 
    selectedCertThumbprint, 
    selectedCertName, 
    signFileWithFileAPI, 
    signFileStandard, 
    addLogEntry,
    shouldUseFileAPI
  ]);

  // Обработка выбора файла
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMessage('');
      setStatus('idle');
      setProgress(null);
      
      // Показываем информацию о методе подписания
      const willUseFileAPI = shouldUseFileAPI(file);
      addLogEntry(
        `Выбран файл: ${file.name}`,
        0,
        true,
        undefined,
        willUseFileAPI 
          ? `Будет использован File API (${formatFileSize(file.size)})` 
          : `Будет использован стандартный метод (${formatFileSize(file.size)})`
      );
    }
  };

  // Обработка выбора сертификата
  const handleCertChange = (thumbprint: string) => {
    setSelectedCertThumbprint(thumbprint);
    const cert = certificates.find(c => c.thumbprint === thumbprint);
    if (cert) {
      const subject = cert.subjectInfo;
      const cnMatch = subject.match(/CN=([^,]+)/);
      if (cnMatch) {
        setSelectedCertName(cnMatch[1]);
        addLogEntry(
          'Выбран сертификат',
          0,
          true,
          undefined,
          `CN: ${cnMatch[1]}`
        );
      } else {
        setSelectedCertName('');
        addLogEntry(
          'Выбран сертификат',
          0,
          true,
          undefined,
          'CN не найден - File API не доступен'
        );
      }
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

      {/* Сообщение о недоступности File API */}
      {!fileApiSupported && (
        <div style={{
          padding: '15px',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderRadius: '5px',
          marginBottom: '20px',
          border: '1px solid #ffeaa7'
        }}>
          ⚠️ Ваш браузер не поддерживает File API. Файлы больше 50MB не могут быть подписаны.
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
                <div>Выбран файл: <strong>{selectedFile.name}</strong></div>
                <div>Размер: {formatFileSize(selectedFile.size)}</div>
                {selectedFile.size > 10 * 1024 * 1024 && !selectedCertName && (
                  <div style={{ color: '#856404', fontSize: '14px', marginTop: '5px' }}>
                    ⚠️ Для файлов больше 10MB требуется сертификат с CN
                  </div>
                )}
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
                onChange={(e) => handleCertChange(e.target.value)}
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
                  
                  // Извлекаем CN для подсказки
                  const cnMatch = cert.subjectInfo.match(/CN=([^,]+)/);
                  const cnInfo = cnMatch ? ` [CN: ${cnMatch[1]}]` : ' [CN не найден]';
                  
                  return (
                    <option key={cert.thumbprint} value={cert.thumbprint}>
                      {owner}{cnInfo} (до: {validPeriod.to.ddmmyy})
                    </option>
                  );
                })}
              </select>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px' }}>
                {selectedCertName 
                  ? `Будут доступны оба метода подписания (CN: ${selectedCertName})`
                  : 'Доступен только стандартный метод подписания (до 10MB)'
                }
              </div>
            </div>
          )}

          {/* Прогресс бар для File API */}
          {progress && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '5px',
                fontSize: '14px'
              }}>
                <span>
                  Обработка файла: {progress.current}/{progress.total} частей
                </span>
                <span>{progress.percent}%</span>
              </div>
              <div style={{
                width: '100%',
                height: '20px',
                backgroundColor: '#e9ecef',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progress.percent}%`,
                  height: '100%',
                  backgroundColor: '#17a2b8',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {formatFileSize(progress.loadedSize)} / {formatFileSize(progress.totalSize)}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '5px', textAlign: 'center' }}>
                Используется File API - файл обрабатывается по частям
              </div>
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
                status === 'loading-certs' ||
                (selectedFile.size > 10 * 1024 * 1024 && !selectedCertName)
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
                'Подписать файл'
              }
            </button>
            {selectedFile && selectedCertThumbprint && !selectedCertName && selectedFile.size > 10 * 1024 * 1024 && (
              <div style={{ fontSize: '12px', color: '#dc3545', marginTop: '5px', textAlign: 'center' }}>
                ⚠️ Для файлов больше 10MB выберите сертификат с CN
              </div>
            )}
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
                      <div>{entry.operation}</div>
                      {entry.details && (
                        <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>
                          {entry.details}
                        </div>
                      )}
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

// /// <reference path="./cryptopro.d.ts" />
// import { useState, useCallback } from 'react';
// import cadesplugin from 'crypto-pro-cadesplugin';
// import type { CryptoProApi, CertificateInfo } from 'crypto-pro-cadesplugin';

// type SigningStatus = 'idle' | 'checking' | 'loading-certs' | 'signing' | 'success' | 'error';

// interface LogEntry {
//   id: number;
//   operation: string;
//   duration: number; // в миллисекундах
//   timestamp: Date;
//   success: boolean;
//   error?: string;
// }

// // Функция для определения, нужно ли использовать метод с чанками
// const shouldUseChunkedSigning = (file: File): boolean => {
//   // Используем чанки для файлов больше 40 МБ
//   const FILE_SIZE_THRESHOLD = 40 * 1024 * 1024; // 40 МБ в байтах
//   return file.size > FILE_SIZE_THRESHOLD;
// };

// function App() {
//   const [selectedFile, setSelectedFile] = useState<File | null>(null);
//   const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
//   const [selectedCertThumbprint, setSelectedCertThumbprint] = useState<string>('');
//   const [status, setStatus] = useState<SigningStatus>('idle');
//   const [errorMessage, setErrorMessage] = useState<string>('');
//   const [pluginAvailable, setPluginAvailable] = useState<boolean | null>(null);
//   const [certsApi, setCertsApi] = useState<CryptoProApi | null>(null);
//   const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
//   const [logIdCounter, setLogIdCounter] = useState<number>(1);

//   // Добавление записи в лог
//   const addLogEntry = useCallback((operation: string, duration: number, success: boolean, error?: string) => {
//     const entry: LogEntry = {
//       id: logIdCounter,
//       operation,
//       duration,
//       timestamp: new Date(),
//       success,
//       error
//     };
//     setLogEntries(prev => [...prev, entry]);
//     setLogIdCounter(prev => prev + 1);
//   }, [logIdCounter]);

//   // Форматирование времени
//   const formatDuration = (ms: number): string => {
//     if (ms < 1000) {
//       return `${ms.toFixed(0)} мс`;
//     }
//     return `${(ms / 1000).toFixed(2)} сек`;
//   };

//   // Форматирование времени для отображения
//   const formatTime = (date: Date): string => {
//     const timeStr = date.toLocaleTimeString('ru-RU', { 
//       hour: '2-digit', 
//       minute: '2-digit', 
//       second: '2-digit'
//     });
//     const ms = date.getMilliseconds().toString().padStart(3, '0');
//     return `${timeStr}.${ms}`;
//   };

//   // Проверка доступности плагина
//   const checkPlugin = useCallback(async () => {
//     setStatus('checking');
//     setErrorMessage('');
//     const startTime = performance.now();
    
//     try {
//       const api = await cadesplugin();
//       const duration = performance.now() - startTime;
//       setCertsApi(api);
//       setPluginAvailable(true);
//       setStatus('idle');
//       addLogEntry('Проверка доступности плагина', duration, true);
      
//       // Автоматически загружаем список сертификатов
//       await loadCertificates(api);
//     } catch (error) {
//       const duration = performance.now() - startTime;
//       const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
//       setErrorMessage(`Плагин КриптоПро недоступен: ${errorMsg}. Убедитесь, что плагин установлен и браузер поддерживает его работу.`);
//       setPluginAvailable(false);
//       setStatus('error');
//       addLogEntry('Проверка доступности плагина', duration, false, errorMsg);
//     }
//   }, [addLogEntry]);

//   // Загрузка списка сертификатов
//   const loadCertificates = useCallback(async (api: CryptoProApi) => {
//     setStatus('loading-certs');
//     setErrorMessage('');
//     const startTime = performance.now();
    
//     try {
//       const certs = await api.getCertsList();
//       const duration = performance.now() - startTime;
//       setCertificates(certs);
      
//       if (certs.length === 0) {
//         setErrorMessage('Не найдено сертификатов с закрытым ключом. Установите сертификат и повторите попытку.');
//         setStatus('error');
//         addLogEntry('Загрузка списка сертификатов', duration, false, 'Сертификаты не найдены');
//       } else {
//         // Автоматически выбираем первый сертификат
//         setSelectedCertThumbprint(certs[0].thumbprint);
//         setStatus('idle');
//         addLogEntry(`Загрузка списка сертификатов (найдено: ${certs.length})`, duration, true);
//       }
//     } catch (error) {
//       const duration = performance.now() - startTime;
//       const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
//       setErrorMessage(`Ошибка при загрузке сертификатов: ${errorMsg}`);
//       setStatus('error');
//       addLogEntry('Загрузка списка сертификатов', duration, false, errorMsg);
//     }
//   }, [addLogEntry]);

//   // Чтение файла в base64 (для маленьких файлов)
//   const fileToBase64 = (file: File): Promise<string> => {
//     return new Promise((resolve, reject) => {
//       const startTime = performance.now();
//       const reader = new FileReader();
//       reader.onload = () => {
//         const duration = performance.now() - startTime;
//         const result = reader.result as string;
//         // Убираем префикс data:...;base64,
//         const base64 = result.split(',')[1] || result;
//         addLogEntry(`Загрузка файла "${file.name}" (${(file.size / 1024).toFixed(2)} KB)`, duration, true);
//         resolve(base64);
//       };
//       reader.onerror = (error) => {
//         const duration = performance.now() - startTime;
//         addLogEntry(`Загрузка файла "${file.name}"`, duration, false, 'Ошибка чтения файла');
//         reject(error);
//       };
//       reader.readAsDataURL(file);
//     });
//   };

//   // Подписание файла с использованием чанков (для больших файлов)
//   const signFileWithChunks = async (file: File, certThumbprint: string): Promise<string> => {
//     const chunkStartTime = performance.now();
    
//     // Получаем CAdESCOM API из плагина
//     const cadespluginApi = await cadesplugin();
    
//     try {
//       // Получаем сертификат по thumbprint
//       const cert = await cadespluginApi.getCert(certThumbprint);
      
//       // Создаем объекты CAdESCOM
//       //const oStore = window.cadesplugin.CreateObject("CAdESCOM.Store");
//       const oStore = await window.cadesplugin.CreateObjectAsync("CAdESCOM.Store");

//       oStore.Open(
//         window.cadesplugin.CAPICOM_CURRENT_USER_STORE,
//         window.cadesplugin.CAPICOM_MY_STORE,
//         window.cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
//       );

//       const oCerts = await oStore.Certificates;

//       // Ищем сертификат по Subject Name
//       // const oCertificates = oStore.Certificates.Find(
//       //   window.cadesplugin.CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME,
//       //   cert.subjectInfo
//       // );
//       const oCertificates = await oCerts.Find(
//         window.cadesplugin.CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME,
//         //cert.subjectInfo
//         "Тестовая подпись"
//       );

//       const certificatesCnt = await oCertificates.Count;
      
//       if (certificatesCnt === 0) {
//         throw new Error(`Certificate not found: ${cert.subjectInfo}`);
//       }
      
//       //const oCertificate = oCertificates.Item(1);
//       //const oSigner = window.cadesplugin.CreateObject("CAdESCOM.CPSigner");
//       const oCertificate = await oCertificates.Item(1);

//       const oSigner = await window.cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");

//       //oSigner.Certificate = oCertificate;
//       //oSigner.CheckCertificate = true;

//       await oSigner.propset_Certificate(oCertificate);
//       await oSigner.propset_CheckCertificate(true);

//       //const oHashedData = window.cadesplugin.CreateObject("CAdESCOM.HashedData");
//       const oHashedData = await window.cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");

//       //oHashedData.Algorithm = window.cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256;
//       //oHashedData.DataEncoding = window.cadesplugin.CADESCOM_BASE64_TO_BINARY;

//       await oHashedData.propset_Algorithm(window.cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256);
//       await oHashedData.propset_DataEncoding(window.cadesplugin.CADESCOM_BASE64_TO_BINARY);

//       // Настраиваем чтение файла по частям
//       const chunkSize = 3 * 1024 * 1024; // 3MB
//       const chunks = Math.ceil(file.size / chunkSize);
//       let currentChunk = 0;

//       // Функция для чтения следующего чанка
//       const readNextChunk = (): Promise<void> => {
//         return new Promise((resolve, reject) => {
//           const reader = new FileReader();
//           const start = currentChunk * chunkSize;
//           const end = Math.min(start + chunkSize, file.size);
//           const blob = file.slice(start, end);

//           reader.onload = async (e) => {
//             try {
//               const result = e.target?.result as string;
//               // Убираем префикс data:...;base64,
//               const header = ";base64,";
//               const base64Data = result.substr(result.indexOf(header) + header.length);
              
//               // Добавляем хеш чанка
//               //oHashedData.Hash(base64Data);
//               await oHashedData.Hash(base64Data);

//               const rty = await oHashedData.Value;
              
//               currentChunk++;
              
//               // Логируем прогресс каждые 10%
//               if (currentChunk % Math.max(1, Math.floor(chunks / 10)) === 0 || currentChunk === chunks) {
//                 const percentLoaded = Math.round((currentChunk / chunks) * 100);
//                 addLogEntry(
//                   `Хеширование файла "${file.name}" (${percentLoaded}%)`, 
//                   0, 
//                   true
//                 );
//               }
              
//               resolve();
//             } catch (error) {
//               reject(error);
//             }
//           };

//           reader.onerror = (error) => {
//             reject(new Error('Ошибка чтения чанка файла'));
//           };

//           reader.readAsDataURL(blob);
//         });
//       };

//       // Читаем все чанки последовательно
//       while (currentChunk < chunks) {
//         await readNextChunk();
//       }

//       // Создаем подписанные данные
//       //const oSignedData = window.cadesplugin.CreateObject("CAdESCOM.CadesSignedData");
//       const oSignedData = await window.cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");

//       //oSignedData.ContentEncoding = window.cadesplugin.CADESCOM_BASE64_TO_BINARY;
//       await oSignedData.propset_ContentEncoding(window.cadesplugin.CADESCOM_BASE64_TO_BINARY);

//       // Создаем подпись (detached = true для отсоединенной подписи)
//       //const signature = oSignedData.SignHash(oHashedData.Value, oSigner, window.cadesplugin.CADESCOM_CADES_BES);

//       const hashedDataVal = await oHashedData.Value;

//       let hashObject = await window.cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");
//       await hashObject.SetHashValue(hashedDataVal);

//       const signature = await oSignedData.SignHash(hashObject, oSigner, window.cadesplugin.CADESCOM_CADES_BES);

//       oStore.Close();
      
//       const chunkDuration = performance.now() - chunkStartTime;
//       addLogEntry(`Подписание файла с чанками (${chunks} чанков)`, chunkDuration, true);
      
//       return signature;
//     } catch (error) {
//       const chunkDuration = performance.now() - chunkStartTime;
//       const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
//       addLogEntry('Подписание файла с чанками', chunkDuration, false, errorMsg);
//       throw error;
//     }
//   };

//   // Скачивание файла подписи
//   const downloadSignature = (signatureBase64: string, originalFileName: string) => {
//     const startTime = performance.now();
//     try {
//       // Декодируем base64 в бинарные данные
//       const binaryString = atob(signatureBase64);
//       const bytes = new Uint8Array(binaryString.length);
//       for (let i = 0; i < binaryString.length; i++) {
//         bytes[i] = binaryString.charCodeAt(i);
//       }
      
//       // Создаем Blob и скачиваем
//       const blob = new Blob([bytes], { type: 'application/pkcs7-signature' });
//       const url = URL.createObjectURL(blob);
//       const link = document.createElement('a');
//       link.href = url;
//       link.download = `${originalFileName}.sig`;
//       document.body.appendChild(link);
//       link.click();
//       document.body.removeChild(link);
//       URL.revokeObjectURL(url);
      
//       const duration = performance.now() - startTime;
//       addLogEntry(`Скачивание файла подписи "${originalFileName}.sig"`, duration, true);
//     } catch (error) {
//       const duration = performance.now() - startTime;
//       addLogEntry(`Скачивание файла подписи "${originalFileName}.sig"`, duration, false, 'Ошибка при создании файла подписи');
//       throw new Error('Ошибка при создании файла подписи');
//     }
//   };

//   // Основная функция подписания с выбором метода
//   const handleSign = useCallback(async () => {
//     if (!selectedFile || !certsApi || !selectedCertThumbprint) {
//       setErrorMessage('Выберите файл и сертификат для подписания');
//       setStatus('error');
//       return;
//     }

//     setStatus('signing');
//     setErrorMessage('');

//     try {
//       let signature: string;
//       const fileName = selectedFile.name.replace(/\.[^/.]+$/, '') || selectedFile.name;
      
//       // Выбираем метод подписания в зависимости от размера файла
//       if (shouldUseChunkedSigning(selectedFile)) {
//         addLogEntry(`Начало подписания большого файла (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`, 0, true);
//         signature = await signFileWithChunks(selectedFile, selectedCertThumbprint);
//       } else {
//         // Старый метод для маленьких файлов
//         const base64Data = await fileToBase64(selectedFile);
        
//         const signingStartTime = performance.now();
//         signature = await certsApi.signBase64(selectedCertThumbprint, base64Data, true);
//         const signingDuration = performance.now() - signingStartTime;
//         addLogEntry('Подписание файла стандартным методом', signingDuration, true);
//       }
      
//       // Скачиваем файл подписи
//       downloadSignature(signature, fileName);
      
//       setStatus('success');
//       setTimeout(() => {
//         setStatus('idle');
//         setSelectedFile(null);
//       }, 2000);
//     } catch (error) {
//       const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
//       setErrorMessage(`Ошибка при подписании: ${errorMsg}`);
//       setStatus('error');
//     }
//   }, [selectedFile, certsApi, selectedCertThumbprint, addLogEntry]);

//   // Обработка выбора файла
//   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (file) {
//       setSelectedFile(file);
//       setErrorMessage('');
//       setStatus('idle');
      
//       // Показываем уведомление о методе подписания для больших файлов
//       if (shouldUseChunkedSigning(file)) {
//         addLogEntry(
//           `Выбран большой файл: ${(file.size / 1024 / 1024).toFixed(2)} MB. Будет использовано подписание по частям`, 
//           0, 
//           true
//         );
//       }
//     }
//   };

//   return (
//     <div style={{ 
//       maxWidth: '800px', 
//       margin: '50px auto', 
//       padding: '20px',
//       fontFamily: 'system-ui, -apple-system, sans-serif'
//     }}>
//       <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
//         Подписание документов электронной подписью
//       </h1>

//       {/* Проверка плагина */}
//       {pluginAvailable === null && (
//         <div style={{ marginBottom: '20px', textAlign: 'center' }}>
//           <button 
//             onClick={checkPlugin}
//             style={{
//               padding: '10px 20px',
//               fontSize: '16px',
//               backgroundColor: '#007bff',
//               color: 'white',
//               border: 'none',
//               borderRadius: '5px',
//               cursor: 'pointer'
//             }}
//           >
//             Проверить доступность плагина КриптоПро
//           </button>
//         </div>
//       )}

//       {/* Сообщение о недоступности плагина */}
//       {pluginAvailable === false && (
//         <div style={{
//           padding: '15px',
//           backgroundColor: '#f8d7da',
//           color: '#721c24',
//           borderRadius: '5px',
//           marginBottom: '20px'
//         }}>
//           {errorMessage}
//         </div>
//       )}

//       {/* Форма подписания */}
//       {pluginAvailable === true && (
//         <div>
//           {/* Выбор файла */}
//           <div style={{ marginBottom: '20px' }}>
//             <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
//               Выберите файл для подписания:
//             </label>
//             <input
//               type="file"
//               onChange={handleFileChange}
//               disabled={status === 'signing' || status === 'checking'}
//               style={{
//                 width: '100%',
//                 padding: '8px',
//                 border: '1px solid #ddd',
//                 borderRadius: '4px'
//               }}
//             />
//             {selectedFile && (
//               <div style={{ marginTop: '10px', color: '#666' }}>
//                 Выбран файл: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
//                 {shouldUseChunkedSigning(selectedFile) && (
//                   <div style={{ color: '#e67e22', fontSize: '14px', marginTop: '5px' }}>
//                     ⚠️ Файл большой, будет использовано подписание по частям
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>

//           {/* Выбор сертификата */}
//           {certificates.length > 0 && (
//             <div style={{ marginBottom: '20px' }}>
//               <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
//                 Выберите сертификат:
//               </label>
//               <select
//                 value={selectedCertThumbprint}
//                 onChange={(e) => setSelectedCertThumbprint(e.target.value)}
//                 disabled={status === 'signing' || status === 'loading-certs'}
//                 style={{
//                   width: '100%',
//                   padding: '8px',
//                   border: '1px solid #ddd',
//                   borderRadius: '4px',
//                   fontSize: '14px'
//                 }}
//               >
//                 {certificates.map((cert) => {
//                   const subjectInfo = cert.friendlySubjectInfo();
//                   const owner = subjectInfo.find((el: { value: string; text: string }) => el.value === 'Владелец')?.text || cert.subjectInfo;
//                   const validPeriod = cert.friendlyValidPeriod();
                  
//                   return (
//                     <option key={cert.thumbprint} value={cert.thumbprint}>
//                       {owner} (действителен до: {validPeriod.to.ddmmyy} {validPeriod.to.hhmmss})
//                     </option>
//                   );
//                 })}
//               </select>
//             </div>
//           )}

//           {/* Кнопка подписания */}
//           <div style={{ marginBottom: '20px' }}>
//             <button
//               onClick={handleSign}
//               disabled={
//                 !selectedFile || 
//                 !selectedCertThumbprint || 
//                 status === 'signing' || 
//                 status === 'checking' ||
//                 status === 'loading-certs'
//               }
//               style={{
//                 width: '100%',
//                 padding: '12px',
//                 fontSize: '16px',
//                 fontWeight: 'bold',
//                 backgroundColor: selectedFile && selectedCertThumbprint && status !== 'signing' 
//                   ? '#28a745' 
//                   : '#6c757d',
//                 color: 'white',
//                 border: 'none',
//                 borderRadius: '5px',
//                 cursor: selectedFile && selectedCertThumbprint && status !== 'signing' 
//                   ? 'pointer' 
//                   : 'not-allowed'
//               }}
//             >
//               {status === 'signing' ? 'Подписание...' : 
//                status === 'checking' ? 'Проверка плагина...' :
//                status === 'loading-certs' ? 'Загрузка сертификатов...' :
//                'Подписать файл'}
//             </button>
//           </div>

//           {/* Сообщение об успехе */}
//           {status === 'success' && (
//             <div style={{
//               padding: '15px',
//               backgroundColor: '#d4edda',
//               color: '#155724',
//               borderRadius: '5px',
//               marginBottom: '20px',
//               textAlign: 'center'
//             }}>
//               ✓ Файл успешно подписан! Файл подписи скачан.
//             </div>
//           )}

//           {/* Сообщение об ошибке */}
//           {status === 'error' && errorMessage && (
//             <div style={{
//               padding: '15px',
//               backgroundColor: '#f8d7da',
//               color: '#721c24',
//               borderRadius: '5px',
//               marginBottom: '20px'
//             }}>
//               {errorMessage}
//             </div>
//           )}
//         </div>
//       )}

//       {/* Лог операций */}
//       {logEntries.length > 0 && (
//         <div style={{
//           marginTop: '40px',
//           padding: '20px',
//           backgroundColor: '#f8f9fa',
//           borderRadius: '5px',
//           border: '1px solid #dee2e6'
//         }}>
//           <h2 style={{ marginTop: 0, marginBottom: '15px', fontSize: '18px' }}>
//             Лог операций
//           </h2>
//           <div style={{
//             maxHeight: '400px',
//             overflowY: 'auto',
//             fontFamily: 'monospace',
//             fontSize: '13px'
//           }}>
//             <table style={{ width: '100%', borderCollapse: 'collapse' }}>
//               <thead>
//                 <tr style={{ borderBottom: '2px solid #dee2e6' }}>
//                   <th style={{ textAlign: 'left', padding: '8px', fontWeight: 'bold' }}>Время</th>
//                   <th style={{ textAlign: 'left', padding: '8px', fontWeight: 'bold' }}>Операция</th>
//                   <th style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>Длительность</th>
//                   <th style={{ textAlign: 'center', padding: '8px', fontWeight: 'bold' }}>Статус</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {logEntries.map((entry) => (
//                   <tr 
//                     key={entry.id}
//                     style={{ 
//                       borderBottom: '1px solid #e9ecef',
//                       backgroundColor: entry.success ? 'transparent' : '#fff3cd'
//                     }}
//                   >
//                     <td style={{ padding: '8px', color: '#666' }}>
//                       {formatTime(entry.timestamp)}
//                     </td>
//                     <td style={{ padding: '8px' }}>
//                       {entry.operation}
//                       {entry.error && (
//                         <div style={{ fontSize: '11px', color: '#dc3545', marginTop: '4px' }}>
//                           Ошибка: {entry.error}
//                         </div>
//                       )}
//                     </td>
//                     <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
//                       {formatDuration(entry.duration)}
//                     </td>
//                     <td style={{ padding: '8px', textAlign: 'center' }}>
//                       {entry.success ? (
//                         <span style={{ color: '#28a745', fontSize: '16px' }}>✓</span>
//                       ) : (
//                         <span style={{ color: '#dc3545', fontSize: '16px' }}>✗</span>
//                       )}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//           {logEntries.length > 0 && (
//             <div style={{ marginTop: '15px', textAlign: 'right' }}>
//               <button
//                 onClick={() => setLogEntries([])}
//                 style={{
//                   padding: '6px 12px',
//                   fontSize: '12px',
//                   backgroundColor: '#6c757d',
//                   color: 'white',
//                   border: 'none',
//                   borderRadius: '4px',
//                   cursor: 'pointer'
//                 }}
//               >
//                 Очистить лог
//               </button>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

//export default App;