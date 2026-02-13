// TypeScript type declarations for cadesplugin
declare global {
  interface Window {
    cadesplugin?: any
    cpcsp_chrome_nmcades?: {
      check_chrome_plugin: (resolve: () => void, reject: (error: any) => void) => void
      CreatePluginObject: () => Promise<any>
    }
  }
}

// Certificate type
export interface Certificate {
  thumbprint: string
  subjectName: string
}

// Hash algorithm info
interface HashAlgorithm {
  id: number
  name: string
  keyAlgo: string
}

// Check if cadesplugin is available
export function isCadesPluginDefined(): boolean {
  return typeof window.cadesplugin !== 'undefined'
}

// Activate plugin
export async function activatePlugin(): Promise<void> {
  if (!isCadesPluginDefined()) {
    throw new Error('Плагин КриптоПро не найден. Убедитесь, что плагин установлен.')
  }

  // Wait for plugin to be ready if it's a Promise
  if (window.cadesplugin instanceof Promise) {
    await window.cadesplugin
  }

  // Use the nmcades wrapper to check plugin
  if (window.cpcsp_chrome_nmcades && window.cpcsp_chrome_nmcades.check_chrome_plugin) {
    await new Promise<void>((resolve, reject) => {
      window.cpcsp_chrome_nmcades!.check_chrome_plugin(resolve, reject)
    })
  }

  // Create plugin object and cache it
  if (window.cpcsp_chrome_nmcades && window.cpcsp_chrome_nmcades.CreatePluginObject) {
    cachedPluginObject = await window.cpcsp_chrome_nmcades.CreatePluginObject()
    if (window.cadesplugin.set) {
      window.cadesplugin.set(cachedPluginObject)
    }
  }
}

// Load certificates
export async function loadCertificates(): Promise<Certificate[]> {
  if (!isCadesPluginDefined()) {
    throw new Error('Плагин не доступен')
  }

  const cadesplugin = window.cadesplugin!
  const pluginObject = await getPluginObject()

  return new Promise<Certificate[]>((resolve, reject) => {
    cadesplugin.async_spawn(function* () {
      try {
        // Create store object
        const oStore = yield pluginObject.CreateObjectAsync('CAdESCOM.Store')

        // Open store
        yield oStore.Open(
          cadesplugin.CAPICOM_CURRENT_USER_STORE,
          cadesplugin.CAPICOM_MY_STORE,
          cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
        )

        // Get certificates collection
        const oCertificates = yield oStore.Certificates
        const count = yield oCertificates.Count
        const certificates: Certificate[] = []

        // Iterate through all certificates and filter those with private keys
        for (let i = 1; i <= count; i++) {
          const cert = yield oCertificates.Item(i)
          const hasPrivateKey = yield cert.HasPrivateKey()

          if (hasPrivateKey) {
            const subjectName = yield cert.SubjectName
            const thumbprint = yield cert.Thumbprint

            certificates.push({
              thumbprint: thumbprint,
              subjectName: subjectName,
            })
          }
        }

        yield oStore.Close()
        resolve(certificates)
      } catch (err: any) {
        reject(new Error('Ошибка загрузки сертификатов: ' + (err.message || err)))
      }
    })
  })
}

// Plugin object cache
let cachedPluginObject: any = null

// Get plugin object
async function getPluginObject(): Promise<any> {
  if (cachedPluginObject) {
    return cachedPluginObject
  }

  const cadesplugin = window.cadesplugin!
  
  if (cadesplugin.CreateObjectAsync) {
    // For modern browsers with NativeMessage
    if (window.cpcsp_chrome_nmcades && window.cpcsp_chrome_nmcades.CreatePluginObject) {
      cachedPluginObject = await window.cpcsp_chrome_nmcades.CreatePluginObject()
      return cachedPluginObject
    }
    // Fallback - try to use CreateObjectAsync directly
    // The plugin object should be available via cadesplugin
    throw new Error('Плагин не инициализирован. Вызовите activatePlugin() сначала.')
  } else {
    throw new Error('Асинхронный режим не поддерживается в этом браузере')
  }
}

// Determine the hash algorithm constant and name from a certificate's public key OID
function getHashAlgorithmByOid(algorithmOid: string): HashAlgorithm {
  const cadesplugin = window.cadesplugin!

  // GOST R 34.10-2012 (256-bit) → GOST R 34.11-2012 (256-bit)
  if (algorithmOid === '1.2.643.7.1.1.1.1') {
    return {
      id: cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256, // 101
      name: 'GOST R 34.11-2012 (256-bit)',
      keyAlgo: 'GOST R 34.10-2012 (256-bit)',
    }
  }
  // GOST R 34.10-2012 (512-bit) → GOST R 34.11-2012 (512-bit)
  if (algorithmOid === '1.2.643.7.1.1.1.2') {
    return {
      id: cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_512, // 102
      name: 'GOST R 34.11-2012 (512-bit)',
      keyAlgo: 'GOST R 34.10-2012 (512-bit)',
    }
  }
  // GOST R 34.10-2001 → GOST R 34.11-94
  if (algorithmOid === '1.2.643.2.2.19') {
    return {
      id: cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411, // 100
      name: 'GOST R 34.11-94',
      keyAlgo: 'GOST R 34.10-2001',
    }
  }
  // RSA / other → SHA-256
  return {
    id: cadesplugin.CADESCOM_HASH_ALGORITHM_SHA_256, // 4
    name: 'SHA-256',
    keyAlgo: 'RSA',
  }
}

// Check File API support
function doCheck(): boolean {
  if (!window.FileReader) {
    throw new Error('File APIs не поддерживаются в этом браузере')
  }
  const fileReader = new FileReader()
  if (typeof fileReader.readAsDataURL !== 'function') {
    throw new Error('Метод readAsDataURL() не поддерживается в FileReader')
  }
  return true
}

// Download signature file
export function downloadSignature(signatureBase64: string, originalFileName: string): void {
  try {
    // Decode base64 to binary
    const binaryString = atob(signatureBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Create blob and download
    const blob = new Blob([bytes], { type: 'application/pkcs7-signature' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url

    // Remove extension from original filename if present
    const baseName = originalFileName.replace(/\.[^/.]+$/, '') || originalFileName
    link.download = baseName + '.sig'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error: any) {
    throw new Error('Ошибка при создании файла подписи: ' + error.message)
  }
}

// Sign file using async hash-based approach with chunked reading
export async function signFile(
  file: File,
  certificateThumbprint: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!isCadesPluginDefined()) {
    throw new Error('Плагин не доступен')
  }

  // Check File API
  doCheck()

  const cadesplugin = window.cadesplugin!
  const pluginObject = await getPluginObject()

  return new Promise<string>((resolve, reject) => {
    cadesplugin.async_spawn(function* () {
      try {
        // Step 1: Find the certificate and determine the correct hash algorithm
        const oStore = yield cadesplugin.CreateObjectAsync('CAdESCOM.Store')
        yield oStore.Open(
          cadesplugin.CAPICOM_CURRENT_USER_STORE,
          cadesplugin.CAPICOM_MY_STORE,
          cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
        )

        const oStoreCerts = yield oStore.Certificates
        const oCertificates = yield oStoreCerts.Find(
          cadesplugin.CAPICOM_CERTIFICATE_FIND_SHA1_HASH,
          certificateThumbprint
        )
        const certsCount = yield oCertificates.Count

        if (certsCount === 0) {
          yield oStore.Close()
          reject(new Error(`Сертификат не найден (thumbprint: ${certificateThumbprint})`))
          return
        }

        const oCertificate = yield oCertificates.Item(1)

        // Detect hash algorithm from certificate's public key
        let hashAlgo: HashAlgorithm
        try {
          const oPublicKey = yield oCertificate.PublicKey()
          const oAlgorithm = yield oPublicKey.Algorithm
          const algorithmOid = yield oAlgorithm.Value
          hashAlgo = getHashAlgorithmByOid(algorithmOid)
          console.log(
            'Detected certificate algorithm OID:',
            algorithmOid,
            '→ hash algorithm:',
            hashAlgo.name,
            '(',
            hashAlgo.id,
            ')'
          )
        } catch (algoErr) {
          console.warn('Could not detect certificate algorithm, using GOST 2012-256 as default:', algoErr)
          hashAlgo = {
            id: cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256,
            name: 'GOST R 34.11-2012 (256-bit)',
            keyAlgo: 'unknown',
          }
        }

        // Step 2: Create HashedData with the correct algorithm matching the certificate
        const blobSlice = File.prototype.slice || (File.prototype as any).mozSlice || (File.prototype as any).webkitSlice
        const chunkSize = 3 * 1024 * 1024 // 3MB
        const chunks = Math.ceil(file.size / chunkSize)
        let currentChunk = 0

        const oHashedData = yield cadesplugin.CreateObjectAsync('CAdESCOM.HashedData')
        yield oHashedData.propset_Algorithm(hashAlgo.id)
        yield oHashedData.propset_DataEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY)

        // Step 3: Read and hash chunks
        const frOnload = function (e: ProgressEvent<FileReader>) {
          const header = ';base64,'
          const sFileData = (e.target as FileReader).result as string
          const sBase64Data = sFileData.substr(sFileData.indexOf(header) + header.length)

          // Hash the chunk
          oHashedData.Hash(sBase64Data)

          const percentLoaded = Math.round((currentChunk / chunks) * 100)
          if (percentLoaded <= 100 && onProgress) {
            onProgress(percentLoaded)
          }

          currentChunk++

          if (currentChunk < chunks) {
            loadNext()
          } else {
            // All chunks hashed, now sign
            // Step 4: Sign with nested async_spawn
            cadesplugin.async_spawn(function* () {
              try {
                const oSigner = yield cadesplugin.CreateObjectAsync('CAdESCOM.CPSigner')
                yield oSigner.propset_Certificate(oCertificate)
                yield oSigner.propset_CheckCertificate(true)

                const oSignedData = yield cadesplugin.CreateObjectAsync('CAdESCOM.CadesSignedData')
                yield oSignedData.propset_ContentEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY)

                let sSignedMessage: string
                try {
                  sSignedMessage = yield oSignedData.SignHash(
                    oHashedData,
                    oSigner,
                    cadesplugin.CADESCOM_CADES_BES
                  )
                } catch (err: any) {
                  const errorMsg = cadesplugin.getLastError
                    ? cadesplugin.getLastError(err)
                    : err.message || err
                  reject(new Error('Ошибка подписания: ' + errorMsg))
                  return
                }

                yield oStore.Close()
                resolve(sSignedMessage)
              } catch (err: any) {
                reject(new Error('Ошибка подписания: ' + (err.message || err)))
              }
            })
          }
        }

        const frOnerror = function () {
          reject(new Error('Ошибка чтения файла'))
        }

        const loadNext = () => {
          const fileReader = new FileReader()
          fileReader.onload = frOnload
          fileReader.onerror = frOnerror

          const start = currentChunk * chunkSize
          const end = start + chunkSize >= file.size ? file.size : start + chunkSize

          fileReader.readAsDataURL(blobSlice.call(file, start, end))
        }

        loadNext()
      } catch (error: any) {
        reject(new Error(error.message || 'Неизвестная ошибка'))
      }
    })
  })
}
