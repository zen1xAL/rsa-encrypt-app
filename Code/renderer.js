// renderer.js

function openTab(tabName) { 
    let i, tabcontent, tablinks;

    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "block";

    const activeButton = document.getElementById(tabName + '-button');
    if (activeButton) {
        activeButton.className += " active";
    }

    clearStatus();
    clearDecryptStatus();
}

//  DOM elem
const encryptTabButton = document.getElementById('encrypt-tab-button');
const decryptTabButton = document.getElementById('decrypt-tab-button');
const pInput = document.getElementById('p');
const qInput = document.getElementById('q');
const dInput = document.getElementById('d');

const selectEncryptFileButton = document.getElementById('select-encrypt-file');
const encryptFilePathSpan = document.getElementById('encrypt-file-path');
const encryptButton = document.getElementById('encrypt-button');
const publicKeyOutput = document.getElementById('public-key-output');

const originalBytesEncryptOutput = document.getElementById('original-bytes-encrypt-output');
const encryptedOutputTextarea = document.getElementById('encrypted-output');
const saveEncryptedButton = document.getElementById('save-encrypted-button');

const rDecryptInput = document.getElementById('r-decrypt');
const dDecryptInput = document.getElementById('d-decrypt');
const selectDecryptFileButton = document.getElementById('select-decrypt-file');
const decryptFilePathSpan = document.getElementById('decrypt-file-path');
const decryptButton = document.getElementById('decrypt-button');
const decryptStatusDiv = document.getElementById('decrypt-status');
const originalEncryptedDataOutput = document.getElementById('original-encrypted-data-output');
const decryptedBytesOutput = document.getElementById('decrypted-bytes-output');

const saveDecryptedButton = document.getElementById('save-decrypted-button');

const statusMessageDiv = document.getElementById('status-message');

// file path
let encryptFilePath = null;
let decryptFilePath = null;
let decryptedDataBase64 = null;

const path = {
    basename: (str) => {
        const match = str.match(/[^\\/]+$/);
        return match ? match[0] : '';
    }
};

function showStatus(message, isError = false) {
    statusMessageDiv.textContent = message;
    statusMessageDiv.className = isError ? 'status error' : 'status success';
}
function clearStatus() {
    statusMessageDiv.textContent = '';
    statusMessageDiv.className = 'status';
    saveDecryptedButton.disabled = true;
    decryptedDataBase64 = null;
}
function showDecryptStatus(message, isError = false) {
     decryptStatusDiv.textContent = message;
     decryptStatusDiv.className = isError ? 'status error' : 'status success';
}
function clearDecryptStatus(){
    decryptStatusDiv.textContent = '';
    decryptStatusDiv.className = 'status';
    
    if(originalEncryptedDataOutput) originalEncryptedDataOutput.value = '';
    if(decryptedBytesOutput) decryptedBytesOutput.value = '';
    if(saveDecryptedButton) saveDecryptedButton.disabled = true;
    decryptedDataBase64 = null;
}

function resetEncryptionOutput() {
    if(encryptedOutputTextarea) encryptedOutputTextarea.value = '';
    if(publicKeyOutput) publicKeyOutput.value = '';
    if(originalBytesEncryptOutput) originalBytesEncryptOutput.value = ''; 
    if(saveEncryptedButton) saveEncryptedButton.disabled = true;
    clearStatus();
}

// EVENTS PROCESSING

if (encryptTabButton) {
    encryptTabButton.addEventListener('click', () => openTab('encrypt-tab'));
}
if (decryptTabButton) {
    decryptTabButton.addEventListener('click', () => openTab('decrypt-tab'));
}

selectEncryptFileButton.addEventListener('click', async () => {
    resetEncryptionOutput(); 
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
        encryptFilePath = filePath;
        encryptFilePathSpan.textContent = filePath;
    } else {
        encryptFilePath = null;
        encryptFilePathSpan.textContent = 'Файл не выбран';
    }
});

[pInput, qInput, dInput].forEach(input => {
    input.addEventListener('input', resetEncryptionOutput);
});


encryptButton.addEventListener('click', async () => {
    const p = pInput.value.trim();
    const q = qInput.value.trim();
    const d = dInput.value.trim();

    if (!p || !q || !d || !encryptFilePath) {
        showStatus('Ошибка: Заполните все поля (p, q, d) и выберите файл.', true);
        resetEncryptionOutput();
        return;
    }

    resetEncryptionOutput();
    showStatus('Чтение файла, вычисление и шифрование...');

    const result = await window.electronAPI.calculateEncrypt({ p, q, d, filePath: encryptFilePath });

    if (result.success) {
        if (publicKeyOutput) {
            publicKeyOutput.value = `e = ${result.publicKey.e}\nr = ${result.publicKey.r}`;
        }

        if (originalBytesEncryptOutput) {
            originalBytesEncryptOutput.value = result.originalData;
        }

        if (encryptedOutputTextarea) {
            encryptedOutputTextarea.value = result.encryptedData;
        }

        if (saveEncryptedButton) saveEncryptedButton.disabled = false;
        showStatus('Шифрование успешно завершено.', false);
    } else {
        showStatus(`Ошибка шифрования: ${result.error}`, true);
    }
});


saveEncryptedButton.addEventListener('click', async () => {
    const encryptedData = encryptedOutputTextarea.value;
    if (!encryptedData) {
        showStatus('Нет данных для сохранения.', true);
        return;
    }

    showStatus('Подготовка к сохранению...');

   
    const defaultFileName = encryptFilePath
        ? `encrypted_${encryptFilePath.split(/[\\/]/).pop()}.txt`
        : 'encrypted_data.txt';

    const result = await window.electronAPI.saveEncryptedFile(encryptedData, defaultFileName);

    if (result.success) {
        showStatus(`Зашифрованные данные сохранены в ${result.filePath}`, false);
    } else if (result.canceled) {
        showStatus('Сохранение отменено пользователем.', false);
    } else {
        showStatus(`Ошибка сохранения файла: ${result.error}`, true);
    }
});


selectDecryptFileButton.addEventListener('click', async () => {
    clearDecryptStatus();
    const filePath = await window.electronAPI.openFile();
    if (filePath) {
        decryptFilePath = filePath;
        decryptFilePathSpan.textContent = filePath;;
    } else {
        decryptFilePath = null;
        decryptFilePathSpan.textContent = 'Файл не выбран';
    }
});


decryptButton.addEventListener('click', async () => {
    const r_decrypt = rDecryptInput.value.trim();
    const d_decrypt = dDecryptInput.value.trim();

    if (!r_decrypt || !d_decrypt || !decryptFilePath) {
        showDecryptStatus('Ошибка: Заполните все поля (r, d) и выберите файл.', true);
        clearDecryptStatus(); 
        return;
    }

    clearDecryptStatus();
    showDecryptStatus('Чтение файла и расшифрование...');

    const result = await window.electronAPI.decrypt({
        r_decrypt,
        d_decrypt,
        filePath_decrypt: decryptFilePath
    });

    if (result.success) {
        showDecryptStatus('Расшифрование успешно завершено. Готово к сохранению.', false);

        if (originalEncryptedDataOutput) {
            originalEncryptedDataOutput.value = result.originalEncryptedData;
        }

        if (decryptedBytesOutput) {
            decryptedBytesOutput.value = result.decryptedBytesData;
        }

        decryptedDataBase64 = result.decryptedData;


        if (saveDecryptedButton) saveDecryptedButton.disabled = false;

    } else {
        showDecryptStatus(`Ошибка расшифрования: ${result.error}`, true);
        if (saveDecryptedButton) saveDecryptedButton.disabled = true;
        decryptedDataBase64 = null;
    }
});

saveDecryptedButton.addEventListener('click', async () => {
    if (!decryptedDataBase64) {
        showDecryptStatus('Нет данных для сохранения. Сначала расшифруйте файл.', true);
        return;
    }

    showDecryptStatus('Подготовка к сохранению...');

    const defaultFileName = decryptFilePath
        ? path.basename(decryptFilePath).replace(/^(encrypted_|cipher_)/i, 'decrypted_') // Удаляем префиксы и добавляем decrypted_
        : 'decrypted_file'; 

    const result = await window.electronAPI.saveDecryptedFile(decryptedDataBase64, defaultFileName);

    if (result.success) {
        showDecryptStatus(`Расшифрованный файл сохранен как: ${result.filePath}`, false);
    } else if (result.canceled) {
        showDecryptStatus('Сохранение отменено пользователем.', false);
    } else {
        showDecryptStatus(`Ошибка сохранения файла: ${result.error}`, true);
    }
});

// show first tab (encrypt)
document.addEventListener('DOMContentLoaded', () => {     
     const saveBtn = document.getElementById('save-encrypted-button');
     if (saveBtn) {saveBtn.disabled = true;}

     const saveDecBtn = document.getElementById('save-decrypted-button');
     if (saveDecBtn) { saveDecBtn.disabled = true; }
});
