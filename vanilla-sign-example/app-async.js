// Global state
let pluginAvailable = false;
let certificates = [];
let selectedCert = null;
let selectedFile = null;
let pluginObject = null;

// Check if cadesplugin is available
function isCadesPluginDefined() {
    return typeof cadesplugin !== 'undefined';
}

// Activate plugin
async function activatePlugin() {
    const activateBtn = document.getElementById('activateBtn');
    const pluginStatus = document.getElementById('pluginStatus');
    
    activateBtn.disabled = true;
    pluginStatus.innerHTML = '<div class="status info">Проверка доступности плагина...</div>';

    if (!isCadesPluginDefined()) {
        pluginStatus.innerHTML = '<div class="status error">Плагин КриптоПро не найден. Убедитесь, что плагин установлен.</div>';
        activateBtn.disabled = false;
        return;
    }

    try {
        // Use the nmcades wrapper to check plugin
        if (window.cpcsp_chrome_nmcades && window.cpcsp_chrome_nmcades.check_chrome_plugin) {
            await new Promise((resolve, reject) => {
                window.cpcsp_chrome_nmcades.check_chrome_plugin(resolve, reject);
            });
        }

        // Create plugin object
        pluginObject = await window.cpcsp_chrome_nmcades.CreatePluginObject();
        
        pluginAvailable = true;
        pluginStatus.innerHTML = '<div class="status success">Плагин активирован успешно</div>';
        activateBtn.disabled = true;
        
        // Load certificates
        await loadCertificates();
    } catch (error) {
        pluginAvailable = false;
        const errorMsg = error.message || 'Неизвестная ошибка';
        pluginStatus.innerHTML = `<div class="status error">Ошибка активации плагина: ${errorMsg}</div>`;
        activateBtn.disabled = false;
    }
}

// Load certificates
async function loadCertificates() {
    const certSelect = document.getElementById('certSelect');
    const certSection = document.getElementById('certSection');
    
    certSection.style.display = 'block';
    certSelect.innerHTML = '<option value="">Загрузка сертификатов...</option>';

    if (!isCadesPluginDefined() || !pluginObject) {
        return;
    }

    try {
        await cadesplugin.async_spawn(function* () {
            try {
                // Create store object
                const oStore = yield pluginObject.CreateObjectAsync("CAdESCOM.Store");
                
                // Open store
                yield oStore.Open(
                    cadesplugin.CAPICOM_CURRENT_USER_STORE,
                    cadesplugin.CAPICOM_MY_STORE,
                    cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
                );

                // Get certificates collection
                const oCertificates = yield oStore.Certificates;
                const count = yield oCertificates.Count;
                certificates = [];

                // Iterate through all certificates and filter those with private keys
                for (let i = 1; i <= count; i++) {
                    const cert = yield oCertificates.Item(i);
                    const hasPrivateKey = yield cert.HasPrivateKey();
                    
                    if (hasPrivateKey) {
                        const subjectName = yield cert.SubjectName;
                        const thumbprint = yield cert.Thumbprint;
                        
                        certificates.push({
                            thumbprint: thumbprint,
                            subjectName: subjectName,
                            cert: cert
                        });
                    }
                }

                yield oStore.Close();

                // Update UI
                certSelect.innerHTML = '';
                if (certificates.length === 0) {
                    certSelect.innerHTML = '<option value="">Сертификаты не найдены</option>';
                } else {
                    certSelect.innerHTML = '<option value="">Выберите сертификат...</option>';
                    certificates.forEach((cert, index) => {
                        const option = document.createElement('option');
                        option.value = index;
                        option.textContent = cert.subjectName;
                        certSelect.appendChild(option);
                    });
                }
            } catch (err) {
                throw new Error('Ошибка загрузки сертификатов: ' + (err.message || err));
            }
        });
    } catch (error) {
        const errorMsg = error.message || 'Неизвестная ошибка';
        certSelect.innerHTML = `<option value="">Ошибка: ${errorMsg}</option>`;
    }
}

// Handle certificate selection
function onCertChange() {
    const certSelect = document.getElementById('certSelect');
    const fileSection = document.getElementById('fileSection');
    const signSection = document.getElementById('signSection');
    const signBtn = document.getElementById('signBtn');
    
    const selectedIndex = certSelect.value;
    
    if (selectedIndex === '' || selectedIndex === null) {
        selectedCert = null;
        fileSection.style.display = 'none';
        signSection.style.display = 'none';
        return;
    }

    selectedCert = certificates[parseInt(selectedIndex)];
    fileSection.style.display = 'block';
    
    if (selectedFile) {
        signSection.style.display = 'block';
        signBtn.disabled = false;
    }
}

// Handle file selection
function onFileChange() {
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const signSection = document.getElementById('signSection');
    const signBtn = document.getElementById('signBtn');
    const progressContainer = document.getElementById('progressContainer');
    
    const file = fileInput.files[0];
    
    if (file) {
        selectedFile = file;
        fileInfo.textContent = `Выбран файл: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        progressContainer.style.display = 'none';
        
        if (selectedCert) {
            signSection.style.display = 'block';
            signBtn.disabled = false;
        }
    } else {
        selectedFile = null;
        fileInfo.textContent = '';
        progressContainer.style.display = 'none';
        signSection.style.display = 'none';
    }
}

// Check File API support
function doCheck() {
    if (!window.FileReader) {
        alert("The File APIs are not fully supported in this browser.");
        return false;
    }
    const fileReader = new FileReader();
    if (typeof(fileReader.readAsDataURL) !== "function") {
        alert("Method readAsDataURL() is not supported in FileReader.");
        return false;
    }
    return true;
}

// Download signature file
function downloadSignature(signatureBase64, originalFileName) {
    try {
        // Decode base64 to binary
        const binaryString = atob(signatureBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Create blob and download
        const blob = new Blob([bytes], { type: 'application/pkcs7-signature' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Remove extension from original filename if present
        const baseName = originalFileName.replace(/\.[^/.]+$/, '') || originalFileName;
        link.download = baseName + '.sig';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        throw new Error('Ошибка при создании файла подписи: ' + error.message);
    }
}

// Determine the hash algorithm constant from a certificate's public key OID
function getHashAlgorithmByOid(algorithmOid) {
    // GOST R 34.10-2012 (256-bit) → GOST R 34.11-2012 (256-bit)
    if (algorithmOid === "1.2.643.7.1.1.1.1") {
        return cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256; // 101
    }
    // GOST R 34.10-2012 (512-bit) → GOST R 34.11-2012 (512-bit)
    if (algorithmOid === "1.2.643.7.1.1.1.2") {
        return cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_512; // 102
    }
    // GOST R 34.10-2001 → GOST R 34.11-94
    if (algorithmOid === "1.2.643.2.2.19") {
        return cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411; // 100
    }
    // RSA / other → SHA-256
    return cadesplugin.CADESCOM_HASH_ALGORITHM_SHA_256; // 4
}

// Sign file using async hash-based approach with chunked reading
async function signFile() {
    if (!selectedFile || !selectedCert || !pluginObject) {
        return;
    }

    // Check File API
    if (!doCheck()) {
        return;
    }

    const signBtn = document.getElementById('signBtn');
    const signStatus = document.getElementById('signStatus');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    
    signBtn.disabled = true;
    signStatus.innerHTML = '<div class="status info">Подписание файла...</div>';

    try {
        await cadesplugin.async_spawn(function* () {
            const oFile = selectedFile;
            const sCertThumbprint = selectedCert.thumbprint;

            // Step 1: Find the certificate and determine the correct hash algorithm
            const oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
            yield oStore.Open(
                cadesplugin.CAPICOM_CURRENT_USER_STORE,
                cadesplugin.CAPICOM_MY_STORE,
                cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
            );

            const oStoreCerts = yield oStore.Certificates;
            const oCertificates = yield oStoreCerts.Find(
                cadesplugin.CAPICOM_CERTIFICATE_FIND_SHA1_HASH,
                sCertThumbprint
            );
            const certsCount = yield oCertificates.Count;

            if (certsCount === 0) {
                yield oStore.Close();
                signStatus.innerHTML = `<div class="status error">Certificate not found (thumbprint: ${sCertThumbprint})</div>`;
                signBtn.disabled = false;
                return;
            }

            const oCertificate = yield oCertificates.Item(1);

            // Detect hash algorithm from certificate's public key
            let hashAlgorithm;
            try {
                const oPublicKey = yield oCertificate.PublicKey();
                const oAlgorithm = yield oPublicKey.Algorithm;
                const algorithmOid = yield oAlgorithm.Value;
                hashAlgorithm = getHashAlgorithmByOid(algorithmOid);
                console.log("Detected certificate algorithm OID:", algorithmOid, "→ hash algorithm:", hashAlgorithm);
            } catch (algoErr) {
                console.warn("Could not detect certificate algorithm, using GOST 2012-256 as default:", algoErr);
                hashAlgorithm = cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256;
            }

            // Step 2: Create HashedData with the correct algorithm matching the certificate
            const blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
            const chunkSize = 3 * 1024 * 1024; // 3MB
            const chunks = Math.ceil(oFile.size / chunkSize);
            let currentChunk = 0;

            const oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");
            yield oHashedData.propset_Algorithm(hashAlgorithm);
            yield oHashedData.propset_DataEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY);

            // Show progress bar
            progressContainer.style.display = 'block';
            progressFill.style.width = '0%';
            progressFill.textContent = '0%';

            // Step 3: Read and hash chunks (like in doc-async.txt)
            const frOnload = function(e) {
                const header = ";base64,";
                const sFileData = e.target.result;
                const sBase64Data = sFileData.substr(sFileData.indexOf(header) + header.length);

                // Hash the chunk - fire-and-forget Promise; native host processes sequentially
                oHashedData.Hash(sBase64Data);

                const percentLoaded = Math.round((currentChunk / chunks) * 100);
                if (percentLoaded <= 100) {
                    progressFill.style.width = percentLoaded + '%';
                    progressFill.textContent = percentLoaded + '%';
                }

                currentChunk++;

                if (currentChunk < chunks) {
                    loadNext();
                } else {
                    // All chunks hashed, now sign
                    progressContainer.style.display = 'none';
                    signStatus.innerHTML = '<div class="status info">Создание подписи...</div>';
                    
                    // Step 4: Sign with nested async_spawn (like doc-async.txt)
                    cadesplugin.async_spawn(function* () {
                        try {
                            const oSigner = yield cadesplugin.CreateObjectAsync("CAdESCOM.CPSigner");
                            yield oSigner.propset_Certificate(oCertificate);
                            yield oSigner.propset_CheckCertificate(true);

                            const oSignedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                            yield oSignedData.propset_ContentEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY);

                            let sSignedMessage;
                            try {
                                sSignedMessage = yield oSignedData.SignHash(oHashedData, oSigner, cadesplugin.CADESCOM_CADES_BES);
                            } catch (err) {
                                const errorMsg = cadesplugin.getLastError ? cadesplugin.getLastError(err) : (err.message || err);
                                signStatus.innerHTML = `<div class="status error">Ошибка подписания: ${errorMsg}</div>`;
                                signBtn.disabled = false;
                                return;
                            }

                            yield oStore.Close();

                            // Download signature
                            downloadSignature(sSignedMessage, oFile.name);
                            
                            signStatus.innerHTML = '<div class="status success">Файл успешно подписан! Файл подписи скачан.</div>';

                            // Verify signature (optional, like doc-async.txt)
                            const oSignedData2 = yield cadesplugin.CreateObjectAsync("CAdESCOM.CadesSignedData");
                            try {
                                yield oSignedData2.VerifyHash(oHashedData, sSignedMessage, cadesplugin.CADESCOM_CADES_BES);
                                console.log("Signature verified successfully");
                            } catch (err) {
                                console.warn("Signature verification failed: " + (cadesplugin.getLastError ? cadesplugin.getLastError(err) : err.message || err));
                            }

                            // Reset after 2 seconds
                            setTimeout(() => {
                                signStatus.innerHTML = '';
                                signBtn.disabled = false;
                            }, 2000);
                        } catch (err) {
                            progressContainer.style.display = 'none';
                            signStatus.innerHTML = `<div class="status error">Ошибка подписания: ${err.message || err}</div>`;
                            signBtn.disabled = false;
                        }
                    });
                }
            };

            const frOnerror = function() {
                progressContainer.style.display = 'none';
                signStatus.innerHTML = '<div class="status error">Ошибка чтения файла.</div>';
                signBtn.disabled = false;
            };

            function loadNext() {
                const fileReader = new FileReader();
                fileReader.onload = frOnload;
                fileReader.onerror = frOnerror;

                const start = currentChunk * chunkSize;
                const end = ((start + chunkSize) >= oFile.size) ? oFile.size : start + chunkSize;

                fileReader.readAsDataURL(blobSlice.call(oFile, start, end));
            }

            loadNext();
        });
    } catch (error) {
        progressContainer.style.display = 'none';
        const errorMsg = error.message || 'Неизвестная ошибка';
        signStatus.innerHTML = `<div class="status error">Ошибка: ${errorMsg}</div>`;
        signBtn.disabled = false;
    }
}
