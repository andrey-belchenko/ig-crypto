// Global state
let pluginAvailable = false;
let certificates = [];
let selectedCertSubjectName = '';
let selectedFile = null;
let oHashedData = null;

// Check if cadesplugin is available
function isCadesPluginDefined() {
    return typeof cadesplugin !== 'undefined' && cadesplugin.CreateObject;
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
        // Wait for plugin to be ready
        await cadesplugin;
        
        // Test plugin by creating an object
        const oAbout = cadesplugin.CreateObject("CAdESCOM.About");
        const version = oAbout.PluginVersion;
        
        pluginAvailable = true;
        pluginStatus.innerHTML = `<div class="status success">Плагин активирован успешно (версия: ${version})</div>`;
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

    if (!isCadesPluginDefined()) {
        return;
    }

    try {
        await cadesplugin;
        
        // Create store object
        const oStore = cadesplugin.CreateObject("CAdESCOM.Store");
        oStore.Open(
            cadesplugin.CAPICOM_CURRENT_USER_STORE,
            cadesplugin.CAPICOM_MY_STORE,
            cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
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

// Create signature from hash
function signCreate(certSubjectName, oHashedData) {
    try {
        const oStore = cadesplugin.CreateObject("CAdESCOM.Store");
        oStore.Open(
            cadesplugin.CAPICOM_CURRENT_USER_STORE,
            cadesplugin.CAPICOM_MY_STORE,
            cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
        );

        const oCertificates = oStore.Certificates.Find(
            cadesplugin.CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME,
            certSubjectName
        );
        
        if (oCertificates.Count == 0) {
            oStore.Close();
            throw new Error("Certificate not found: " + certSubjectName);
        }
        
        const oCertificate = oCertificates.Item(1);
        const oSigner = cadesplugin.CreateObject("CAdESCOM.CPSigner");
        oSigner.Certificate = oCertificate;
        oSigner.CheckCertificate = true;

        const oSignedData = cadesplugin.CreateObject("CAdESCOM.CadesSignedData");
        oSignedData.ContentEncoding = cadesplugin.CADESCOM_BASE64_TO_BINARY;

        let sSignedMessage;
        try {
            sSignedMessage = oSignedData.SignHash(oHashedData, oSigner, cadesplugin.CADESCOM_CADES_BES);
        } catch (err) {
            oStore.Close();
            throw new Error("Failed to create signature. Error: " + (cadesplugin.getLastError ? cadesplugin.getLastError(err) : err.message || err));
        }

        oStore.Close();
        return sSignedMessage;
    } catch (err) {
        throw new Error(err.message || err);
    }
}

// Verify signature
function Verify(sSignedMessage, oHashedData) {
    try {
        const oSignedData = cadesplugin.CreateObject("CAdESCOM.CadesSignedData");
        oSignedData.VerifyHash(oHashedData, sSignedMessage, cadesplugin.CADESCOM_CADES_BES);
        return true;
    } catch (err) {
        console.error("Failed to verify signature. Error: " + (cadesplugin.getLastError ? cadesplugin.getLastError(err) : err.message || err));
        return false;
    }
}

// Sign file using hash-based approach with chunked reading
function signFile(file, certSubjectName) {
    const blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
    const chunkSize = 3 * 1024 * 1024; // 3MB
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;

    // Create HashedData object
    oHashedData = cadesplugin.CreateObject("CAdESCOM.HashedData");
    oHashedData.DataEncoding = cadesplugin.CADESCOM_BASE64_TO_BINARY;

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
                    const signedMessage = signCreate(certSubjectName, oHashedData);
                    
                    // Download signature file
                    downloadSignature(signedMessage, file.name);
                    
                    // Verify signature
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

// Main sign function
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
    signFile(file, selectedCertSubjectName);
    
    // Re-enable button after a delay (signing is async)
    setTimeout(() => {
        signBtn.disabled = false;
    }, 1000);
}
