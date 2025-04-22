// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const rsa = require('./rsa-logic'); 

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),

            // SECURITY PROCESSING
            contextIsolation: true, 
            enableRemoteModule: false, 
            nodeIntegration: false 
        }
    });

    mainWindow.loadFile('index.html');

    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();
});

function bufferToDecimalString(buffer) {
    return Array.from(buffer).join(' ');
}

ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) {
        return null; 
    } else {
        return filePaths[0];
    }
});


ipcMain.handle('rsa:calculate-encrypt', async (event, args) => {
    const { p: pValue, q: qValue, d: dValue, filePath } = args;
    try {

        if (pValue === undefined || pValue === null || pValue === '' || /* ... */ !filePath) { throw new Error("..."); }
        const p = String(pValue); const q = String(qValue); const d = String(dValue);
        if (typeof p !== 'string' || typeof q !== 'string' || typeof d !== 'string') { throw new Error("..."); }

        const originalBuffer = await fs.readFile(filePath);

        const publicKey = rsa.calculatePublicKey(p, q, d);

        const encryptedDataStrings = await rsa.encryptFile(filePath, publicKey.e, publicKey.r);

        const originalBytesString = bufferToDecimalString(originalBuffer); 

        const encryptedDecimalStringForDisplay = encryptedDataStrings.join(' ');

        return {
            success: true,
            publicKey: { e: publicKey.e.toString(), r: publicKey.r.toString() },
           
            originalData: originalBytesString, 

            encryptedData: encryptedDecimalStringForDisplay 
        };
    } catch (error) {
        console.error("Ошибка в процессе calculate-encrypt:", error);
        return { success: false, error: error.message || "Неизвестная ошибка шифрования." };
    }
});


ipcMain.handle('dialog:saveEncryptedFile', async (event, encryptedDataString, defaultFileName) => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Сохранить зашифрованные данные',
            defaultPath: defaultFileName || 'encrypted_data.bin', 
            filters: [
                { name: 'Binary Encrypted File', extensions: ['bin'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (canceled || !filePath) {
            return { success: false, canceled: true };
        }

        const numberStrings = encryptedDataString.trim().split(/\s+/);

        const encryptedBuffer = rsa.encodeNumbersToBytes(numberStrings);

        await fs.writeFile(filePath, encryptedBuffer);

        return { success: true, filePath: filePath };

    } catch (error) {
        console.error("Ошибка сохранения зашифрованного файла:", error);
        return { success: false, canceled: false, error: error.message || "Неизвестная ошибка сохранения." };
    }
});


ipcMain.handle('rsa:decrypt', async (event, args) => {
    const { r_decrypt: rStr, d_decrypt: dStr, filePath_decrypt } = args;
    try {
        if (!rStr || !dStr || !filePath_decrypt) {
            throw new Error("Не все параметры (r, Kc, файл) предоставлены.");
        }

        const encryptedBuffer = await fs.readFile(filePath_decrypt);

        const decryptedBuffer = await rsa.decryptData(encryptedBuffer, dStr, rStr);

   
        let originalNumbersString = ''; 
        try {
            const originalNumbers = rsa.decodeBytesToNumbers(encryptedBuffer);
            originalNumbersString = originalNumbers.map(n => n.toString()).join(' ');
        } catch (decodeError) {
             console.error("Ошибка декодирования исходного файла для отображения:", decodeError);
             originalNumbersString = `[Ошибка декодирования файла: ${decodeError.message}]`;
        
        }

      
        const decryptedBytesString = bufferToDecimalString(decryptedBuffer);

       
        const decryptedBase64 = decryptedBuffer.toString('base64');
     

        return {
            success: true,
            originalEncryptedData: originalNumbersString, 
            decryptedBytesData: decryptedBytesString,    
            decryptedData: decryptedBase64           
        };

    } catch (error) {
        console.error("Ошибка в процессе decrypt:", error);
        return { success: false, error: error.message || "Неизвестная ошибка расшифрования." };
    }
});


ipcMain.handle('dialog:saveDecryptedFile', async (event, base64DecryptedData, defaultFileName) => {
    try {
        const { canceled, filePath: savePath } = await dialog.showSaveDialog({
            title: 'Сохранить расшифрованный файл',
            defaultPath: defaultFileName || 'decrypted_file', 
             filters: [ { name: 'Text Files', extensions: ['txt'] },
                        { name: 'All Files', extensions: ['*'] } ]
        });

        if (canceled || !savePath) {
             return { success: false, canceled: true };
        }

        const decryptedBuffer = Buffer.from(base64DecryptedData, 'base64');

        await fs.writeFile(savePath, decryptedBuffer);

        return { success: true, filePath: savePath };

    } catch (error) {
        console.error("Ошибка сохранения расшифрованного файла:", error);
        return { success: false, canceled: false, error: error.message || "Неизвестная ошибка сохранения." };
    }
});