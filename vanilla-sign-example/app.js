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
    
    const file = fileInput.files[0];
    
    if (file) {
        selectedFile = file;
        fileInfo.textContent = `Выбран файл: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
        
        if (selectedCert) {
            signSection.style.display = 'block';
            signBtn.disabled = false;
        }
    } else {
        selectedFile = null;
        fileInfo.textContent = '';
        signSection.style.display = 'none';
    }
}

// Read file as base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            // Remove data:...;base64, prefix
            const base64 = result.split(',')[1] || result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
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

// Sign file
async function signFile() {
    if (!selectedFile || !selectedCert || !pluginObject) {
        return;
    }

    const signBtn = document.getElementById('signBtn');
    const signStatus = document.getElementById('signStatus');
    
    signBtn.disabled = true;
    signStatus.innerHTML = '<div class="status info">Подписание файла...</div>';

    try {
        // Read file as base64
        const base64Data = await fileToBase64(selectedFile);
        
        // Sign file using async_spawn
        const signature = await cadesplugin.async_spawn(function* () {
            try {
                // Open store and get certificate by thumbprint
                const oStore = yield pluginObject.CreateObjectAsync("CAdESCOM.Store");
                yield oStore.Open(
                    cadesplugin.CAPICOM_CURRENT_USER_STORE,
                    cadesplugin.CAPICOM_MY_STORE,
                    cadesplugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED
                );

                const oCertificates = yield oStore.Certificates;
                const oCerts = yield oCertificates.Find(
                    cadesplugin.CAPICOM_CERTIFICATE_FIND_SHA1_HASH,
                    selectedCert.thumbprint
                );
                const count = yield oCerts.Count;
                
                if (count === 0) {
                    throw new Error('Сертификат не найден');
                }
                
                const oCertificate = yield oCerts.Item(1);

                // Create signer
                const oSigner = yield pluginObject.CreateObjectAsync("CAdESCOM.CPSigner");
                yield oSigner.propset_Certificate(oCertificate);
                yield oSigner.propset_CheckCertificate(true);

                // Create signed data object
                const oSignedData = yield pluginObject.CreateObjectAsync("CAdESCOM.CadesSignedData");
                yield oSignedData.propset_Content(base64Data);
                
                // Create detached signature (CADESCOM_CADES_BES)
                const signedMessage = yield oSignedData.SignCades(oSigner, cadesplugin.CADESCOM_CADES_BES);
                
                yield oStore.Close();
                
                return signedMessage;
            } catch (err) {
                throw new Error('Ошибка подписания: ' + (err.message || err));
            }
        });

        // Download signature
        const fileName = selectedFile.name;
        downloadSignature(signature, fileName);
        
        signStatus.innerHTML = '<div class="status success">Файл успешно подписан! Файл подписи скачан.</div>';
        
        // Reset after 2 seconds
        setTimeout(() => {
            signStatus.innerHTML = '';
            signBtn.disabled = false;
        }, 2000);
        
    } catch (error) {
        const errorMsg = error.message || 'Неизвестная ошибка';
        signStatus.innerHTML = `<div class="status error">Ошибка: ${errorMsg}</div>`;
        signBtn.disabled = false;
    }
}
