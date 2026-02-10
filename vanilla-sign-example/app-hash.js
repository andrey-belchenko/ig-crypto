// #region agent log
console.log('[DEBUG] Script loaded, checking cadesplugin:', typeof cadesplugin, cadesplugin);
window.addEventListener('error', function(e) {
    console.error('[DEBUG] Global error:', e.error, e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', function(e) {
    console.error('[DEBUG] Unhandled promise rejection:', e.reason);
});
// #endregion

// Global state
let pluginAvailable = false;
let certificates = [];
let selectedCertSubjectName = '';
let selectedFile = null;
let oHashedData = null;
let cadespluginObj = null; // Store resolved plugin object for synchronous use

// Check if cadesplugin is available
function isCadesPluginDefined() {
    const isDefined = typeof cadesplugin !== 'undefined';
    // #region agent log
    console.log('[DEBUG] isCadesPluginDefined check:', isDefined, typeof cadesplugin);
    // #endregion
    return isDefined;
}

// Activate plugin
async function activatePlugin() {
    // #region agent log
    const logData1 = {location:'app-hash.js:15',message:'activatePlugin called',data:{cadespluginDefined:typeof cadesplugin !== 'undefined',cadespluginType:typeof cadesplugin,cadespluginIsPromise:cadesplugin instanceof Promise},timestamp:Date.now(),runId:'run1',hypothesisId:'A'};
    console.log('[DEBUG]', logData1);
    fetch('http://127.0.0.1:7243/ingest/7c3b4314-3d55-4e03-93dc-50b6fc33d15e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData1)}).catch((e)=>console.error('[DEBUG] Log fetch failed:',e));
    // #endregion
    
    const activateBtn = document.getElementById('activateBtn');
    const pluginStatus = document.getElementById('pluginStatus');
    
    activateBtn.disabled = true;
    pluginStatus.innerHTML = '<div class="status info">Проверка доступности плагина...</div>';

    if (!isCadesPluginDefined()) {
        // #region agent log
        const logData2 = {location:'app-hash.js:26',message:'cadesplugin not defined',data:{},timestamp:Date.now(),runId:'run1',hypothesisId:'A'};
        console.log('[DEBUG]', logData2);
        fetch('http://127.0.0.1:7243/ingest/7c3b4314-3d55-4e03-93dc-50b6fc33d15e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch((e)=>console.error('[DEBUG] Log fetch failed:',e));
        // #endregion
        pluginStatus.innerHTML = '<div class="status error">Плагин КриптоПро не найден. Убедитесь, что плагин установлен.</div>';
        activateBtn.disabled = false;
        return;
    }

    try {
        // #region agent log
        const logData3 = {location:'app-hash.js:31',message:'Before awaiting cadesplugin Promise',data:{cadespluginType:typeof cadesplugin,isPromise:cadesplugin instanceof Promise,isObject:typeof cadesplugin === 'object'},timestamp:Date.now(),runId:'run1',hypothesisId:'B'};
        console.log('[DEBUG]', logData3);
        fetch('http://127.0.0.1:7243/ingest/7c3b4314-3d55-4e03-93dc-50b6fc33d15e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch((e)=>console.error('[DEBUG] Log fetch failed:',e));
        // #endregion
        
        // Wait for plugin promise to resolve
        // cadesplugin is a Promise that resolves to the plugin object
        // #region agent log
        console.log('[DEBUG] About to await cadesplugin, type:', typeof cadesplugin);
        // #endregion
        
        // Check if cadesplugin is already resolved (not a Promise)
        if (cadesplugin instanceof Promise) {
            // #region agent log
            console.log('[DEBUG] Awaiting Promise...');
            // #endregion
            // The Promise resolves to undefined, but cadesplugin itself becomes the plugin object
            // After awaiting, cadesplugin (the global variable) will have CreateObject method
            await cadesplugin;
            // #region agent log
            console.log('[DEBUG] Promise resolved, checking cadesplugin:', typeof cadesplugin, 'has CreateObject:', typeof cadesplugin?.CreateObject);
            // #endregion
            
            // After Promise resolves, use cadesplugin directly (not the resolved value)
            // #region agent log
            const pluginProps = {
                hasCreateObject: typeof cadesplugin.CreateObject,
                hasCreateObjectAsync: typeof cadesplugin.CreateObjectAsync,
                hasAsyncSpawn: typeof cadesplugin.async_spawn,
                cadespluginType: typeof cadesplugin,
                isPromise: cadesplugin instanceof Promise,
                keys: Object.keys(cadesplugin).slice(0, 15)
            };
            console.log('[DEBUG] After await, cadesplugin properties:', pluginProps);
            // #endregion
            
            // Check if CreateObject exists (synchronous API) or CreateObjectAsync (async API)
            if (typeof cadesplugin === 'object') {
                // Properties are added to the cadesplugin object, check if they're accessible
                if (typeof cadesplugin.CreateObject === 'function') {
                    // Synchronous API available (IE/NPAPI)
                    cadespluginObj = cadesplugin;
                } else if (typeof cadesplugin.CreateObjectAsync === 'function' || typeof cadesplugin.async_spawn === 'function') {
                    // Async API available (Chrome/Edge with extension)
                    // For hash-based version following doc.txt, we need synchronous API
                    // But we can adapt to use async_spawn if needed
                    console.warn('[DEBUG] Browser uses async API, adapting hash-based version to use async_spawn');
                    cadespluginObj = cadesplugin; // We'll use async_spawn wrapper
                } else {
                    // Wait a bit more for properties to be added
                    await new Promise(resolve => setTimeout(resolve, 200));
                    if (typeof cadesplugin.CreateObject === 'function') {
                        cadespluginObj = cadesplugin;
                    } else {
                        throw new Error('cadesplugin Promise resolved but plugin object does not have CreateObject or CreateObjectAsync method. Available methods: ' + Object.keys(cadesplugin).join(', '));
                    }
                }
            } else {
                throw new Error('cadesplugin is not an object after Promise resolution, type: ' + typeof cadesplugin);
            }
        } else if (typeof cadesplugin === 'object' && cadesplugin.CreateObject) {
            // Already resolved, use directly
            cadespluginObj = cadesplugin;
        } else {
            throw new Error('cadesplugin is not a Promise and does not have CreateObject method');
        }
        
        // #region agent log
        const logData4 = {location:'app-hash.js:35',message:'cadesplugin Promise resolved',data:{cadespluginObjType:typeof cadespluginObj,cadespluginObjIsNull:cadespluginObj === null,hasCreateObject:typeof cadespluginObj?.CreateObject === 'function',cadespluginHasCreateObject:typeof cadesplugin?.CreateObject === 'function'},timestamp:Date.now(),runId:'run1',hypothesisId:'C'};
        console.log('[DEBUG]', logData4);
        fetch('http://127.0.0.1:7243/ingest/7c3b4314-3d55-4e03-93dc-50b6fc33d15e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData4)}).catch((e)=>console.error('[DEBUG] Log fetch failed:',e));
        // #endregion
        
        // Test plugin by creating an object
        // #region agent log
        const logData5 = {location:'app-hash.js:40',message:'Before CreateObject call',data:{hasCreateObject:typeof cadespluginObj?.CreateObject === 'function'},timestamp:Date.now(),runId:'run1',hypothesisId:'D'};
        console.log('[DEBUG]', logData5);
        fetch('http://127.0.0.1:7243/ingest/7c3b4314-3d55-4e03-93dc-50b6fc33d15e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData5)}).catch((e)=>console.error('[DEBUG] Log fetch failed:',e));
        // #endregion
        
        const oAbout = cadespluginObj.CreateObject("CAdESCOM.About");
        
        // #region agent log
        const logData6 = {location:'app-hash.js:44',message:'CreateObject succeeded',data:{oAboutType:typeof oAbout,hasPluginVersion:typeof oAbout?.PluginVersion === 'string'},timestamp:Date.now(),runId:'run1',hypothesisId:'E'};
        console.log('[DEBUG]', logData6);
        fetch('http://127.0.0.1:7243/ingest/7c3b4314-3d55-4e03-93dc-50b6fc33d15e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData6)}).catch((e)=>console.error('[DEBUG] Log fetch failed:',e));
        // #endregion
        
        const version = oAbout.PluginVersion;
        
        pluginAvailable = true;
        pluginStatus.innerHTML = `<div class="status success">Плагин активирован успешно (версия: ${version})</div>`;
        activateBtn.disabled = true;
        
        // Load certificates
        await loadCertificates();
    } catch (error) {
        // #region agent log
        const logData7 = {location:'app-hash.js:54',message:'Error caught in activatePlugin',data:{errorName:error?.name,errorMessage:error?.message,errorStack:error?.stack?.substring(0,500),errorString:String(error),errorType:typeof error},timestamp:Date.now(),runId:'run1',hypothesisId:'C'};
        console.error('[DEBUG] ERROR in activatePlugin:', error);
        console.error('[DEBUG] ERROR details:', logData7);
        fetch('http://127.0.0.1:7243/ingest/7c3b4314-3d55-4e03-93dc-50b6fc33d15e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData7)}).catch((e)=>console.error('[DEBUG] Log fetch failed:',e));
        // #endregion
        
        pluginAvailable = false;
        cadespluginObj = null;
        const errorMsg = error?.message || error?.toString() || String(error) || 'Неизвестная ошибка';
        console.error('[DEBUG] Showing error to user:', errorMsg);
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

    if (!isCadesPluginDefined()) {
        return;
    }

    try {
        if (!cadespluginObj) {
            throw new Error('Плагин не активирован');
        }
        
        // Create store object (synchronous after plugin is resolved)
        const oStore = cadespluginObj.CreateObject("CAdESCOM.Store");
        oStore.Open(
            cadespluginObj.CAPICOM_CURRENT_USER_STORE,
            cadespluginObj.CAPICOM_MY_STORE,
            cadespluginObj.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
        );

        // Get certificates collection
        const oCertificates = oStore.Certificates;
        const count = oCertificates.Count;
        certificates = [];

        // Iterate through all certificates and filter those with private keys
        for (let i = 1; i <= count; i++) {
            try {
                const cert = oCertificates.Item(i);
                const hasPrivateKey = cert.HasPrivateKey();
                
                if (hasPrivateKey) {
                    const subjectName = cert.SubjectName;
                    const thumbprint = cert.Thumbprint;
                    
                    certificates.push({
                        thumbprint: thumbprint,
                        subjectName: subjectName
                    });
                }
            } catch (err) {
                // Skip certificates that can't be accessed
                continue;
            }
        }

        oStore.Close();

        // Update UI
        certSelect.innerHTML = '';
        if (certificates.length === 0) {
            certSelect.innerHTML = '<option value="">Сертификаты не найдены</option>';
        } else {
            certSelect.innerHTML = '<option value="">Выберите сертификат...</option>';
            certificates.forEach((cert) => {
                const option = document.createElement('option');
                option.value = cert.subjectName;
                option.textContent = cert.subjectName;
                certSelect.appendChild(option);
            });
        }
    } catch (error) {
        const errorMsg = error.message || 'Неизвестная ошибка';
        certSelect.innerHTML = `<option value="">Ошибка: ${errorMsg}</option>`;
    }
}

// Handle certificate selection from dropdown
function onCertChange() {
    const certSelect = document.getElementById('certSelect');
    const certNameInput = document.getElementById('certNameInput');
    const fileSection = document.getElementById('fileSection');
    const signSection = document.getElementById('signSection');
    const signBtn = document.getElementById('signBtn');
    
    const subjectName = certSelect.value;
    
    if (subjectName === '' || subjectName === null) {
        selectedCertSubjectName = '';
        certNameInput.value = '';
        fileSection.style.display = 'none';
        signSection.style.display = 'none';
        return;
    }

    selectedCertSubjectName = subjectName;
    certNameInput.value = subjectName;
    fileSection.style.display = 'block';
    
    if (selectedFile) {
        signSection.style.display = 'block';
        signBtn.disabled = false;
    }
}

// Handle manual certificate name input
function onCertNameChange() {
    const certNameInput = document.getElementById('certNameInput');
    const certSelect = document.getElementById('certSelect');
    const fileSection = document.getElementById('fileSection');
    const signSection = document.getElementById('signSection');
    const signBtn = document.getElementById('signBtn');
    
    const subjectName = certNameInput.value.trim();
    
    if (subjectName === '') {
        selectedCertSubjectName = '';
        certSelect.value = '';
        fileSection.style.display = 'none';
        signSection.style.display = 'none';
        return;
    }

    selectedCertSubjectName = subjectName;
    
    // Try to match with dropdown
    const options = certSelect.options;
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === subjectName) {
            certSelect.value = subjectName;
            break;
        }
    }
    
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
        
        if (selectedCertSubjectName) {
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

// Create signature from hash (synchronous like in doc.txt)
function signCreate(certSubjectName, oHashedData) {
    if (!cadespluginObj) {
        throw new Error("Плагин не активирован");
    }
    
    const oStore = cadespluginObj.CreateObject("CAdESCOM.Store");
    oStore.Open(
        cadespluginObj.CAPICOM_CURRENT_USER_STORE,
        cadespluginObj.CAPICOM_MY_STORE,
        cadespluginObj.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
    );

    const oCertificates = oStore.Certificates.Find(
        cadespluginObj.CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME,
        certSubjectName
    );
    
    if (oCertificates.Count == 0) {
        oStore.Close();
        throw new Error("Certificate not found: " + certSubjectName);
    }
    
    const oCertificate = oCertificates.Item(1);
    const oSigner = cadespluginObj.CreateObject("CAdESCOM.CPSigner");
    oSigner.Certificate = oCertificate;
    oSigner.CheckCertificate = true;

    const oSignedData = cadespluginObj.CreateObject("CAdESCOM.CadesSignedData");
    oSignedData.ContentEncoding = cadespluginObj.CADESCOM_BASE64_TO_BINARY;

    let sSignedMessage;
    try {
        sSignedMessage = oSignedData.SignHash(oHashedData, oSigner, cadespluginObj.CADESCOM_CADES_BES);
    } catch (err) {
        oStore.Close();
        throw new Error("Failed to create signature. Error: " + (cadespluginObj.getLastError ? cadespluginObj.getLastError(err) : err.message || err));
    }

    oStore.Close();
    return sSignedMessage;
}

// Verify signature (synchronous like in doc.txt)
function Verify(sSignedMessage, oHashedData) {
    if (!cadespluginObj) {
        console.error("Плагин не активирован");
        return false;
    }
    
    try {
        const oSignedData = cadespluginObj.CreateObject("CAdESCOM.CadesSignedData");
        oSignedData.VerifyHash(oHashedData, sSignedMessage, cadespluginObj.CADESCOM_CADES_BES);
        return true;
    } catch (err) {
        console.error("Failed to verify signature. Error: " + (cadespluginObj.getLastError ? cadespluginObj.getLastError(err) : err.message || err));
        return false;
    }
}

// Sign file using hash-based approach with chunked reading (like in doc.txt)
function signFile(file, certSubjectName) {
    if (!cadespluginObj) {
        alert("Плагин не активирован");
        return;
    }
    
    const blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
    const chunkSize = 3 * 1024 * 1024; // 3MB
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;

    // Create HashedData object (synchronous)
    oHashedData = cadespluginObj.CreateObject("CAdESCOM.HashedData");
    oHashedData.DataEncoding = cadespluginObj.CADESCOM_BASE64_TO_BINARY;

    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const signStatus = document.getElementById('signStatus');
    
    progressContainer.style.display = 'block';

    const frOnload = function(e) {
        try {
            const header = ";base64,";
            const sFileData = e.target.result;
            const sBase64Data = sFileData.substr(sFileData.indexOf(header) + header.length);

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
                progressContainer.style.display = 'none';
                signStatus.innerHTML = '<div class="status info">Создание подписи...</div>';
                
                try {
                    // Call signCreate synchronously (like in doc.txt)
                    const signedMessage = signCreate(certSubjectName, oHashedData);
                    
                    // Download signature file
                    downloadSignature(signedMessage, file.name);
                    
                    // Verify signature synchronously (like in doc.txt)
                    const verifyResult = Verify(signedMessage, oHashedData);
                    if (verifyResult) {
                        signStatus.innerHTML = '<div class="status success">Файл успешно подписан и проверен! Файл подписи скачан.</div>';
                    } else {
                        signStatus.innerHTML = '<div class="status success">Файл подписан, но проверка не удалась. Файл подписи скачан.</div>';
                    }
                } catch (err) {
                    signStatus.innerHTML = `<div class="status error">Ошибка подписания: ${err.message || err}</div>`;
                }
            }
        } catch (err) {
            progressContainer.style.display = 'none';
            signStatus.innerHTML = `<div class="status error">Ошибка обработки файла: ${err.message || err}</div>`;
        }
    };

    const frOnerror = function() {
        progressContainer.style.display = 'none';
        signStatus.innerHTML = '<div class="status error">Ошибка чтения файла.</div>';
    };

    function loadNext() {
        const fileReader = new FileReader();
        fileReader.onload = frOnload;
        fileReader.onerror = frOnerror;

        const start = currentChunk * chunkSize;
        const end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;

        fileReader.readAsDataURL(blobSlice.call(file, start, end));
    }

    loadNext();
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

// Main sign function (synchronous like in doc.txt)
function doSign() {
    // Check File API
    if (!doCheck()) {
        return;
    }
    
    const fileInput = document.getElementById('fileInput');
    const signBtn = document.getElementById('signBtn');
    
    if (!fileInput.files.length) {
        alert("Выберите файл.");
        return;
    }

    const file = fileInput.files[0];
    
    if (!selectedCertSubjectName || selectedCertSubjectName === '') {
        alert("Выберите или введите имя сертификата (Subject Name).");
        return;
    }
    
    signBtn.disabled = true;
    
    // Call signFile synchronously (like in doc.txt)
    // Note: signFile uses async callbacks internally for file reading
    signFile(file, selectedCertSubjectName);
    
    // Re-enable button after a delay (file reading is async)
    setTimeout(() => {
        signBtn.disabled = false;
    }, 1000);
}
