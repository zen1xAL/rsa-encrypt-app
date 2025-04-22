// rsa-logic.js
const fs = require('fs').promises;
const path = require('path');

function isPrime(num) {
    if (num <= 1n) return false;
    if (num <= 3n) return true;
    if (num % 2n === 0n || num % 3n === 0n) return false;
    let i = 5n;
    while (i * i <= num) {
        if (num % i === 0n || num % (i + 2n) === 0n) return false;
        i += 6n;
    }
    return true;
}

// НОД
function gcd(a, b) {
    while (b) {
        a = a % b;
        [a, b] = [b, a]; // Swap a and b
    }
    return a;
}

function extendedEuclidean(a, b) {
    if (b === 0n) {
        return [a, 1n, 0n];
    }
    const [d1, x1, y1] = extendedEuclidean(b, a % b);
    const x = y1;
    const y = x1 - (a / b) * y1; 
    return [d1, x, y];
}

function modInverse(a, m) {
    const [d, x, y] = extendedEuclidean(a, m);
    if (d !== 1n) {
        return null;
    }
    return (x % m + m) % m;
}

function power(base, exp, mod) {
    if (mod === 1n) return 0n;
    let res = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) res = (res * base) % mod;
        exp = exp >> 1n; 
        base = (base * base) % mod;
    }
    return res;
}

// MAIN PROGRAM LOGIC

function numberToBytes(num) {
    if (num < 0n) throw new Error("Отрицательные числа не поддерживаются в numberToBytes");
    if (num === 0n) return Buffer.from([0]);
    let hex = num.toString(16);
    if (hex.length % 2) { hex = '0' + hex; }
    return Buffer.from(hex, 'hex');
}

function bytesToNumber(buf) {
    if (buf.length === 0) return 0n;
    return BigInt('0x' + buf.toString('hex'));
}

function encodeNumbersToBytes(numberSequence) {
    const buffers = [];
    for (const numItem of numberSequence) {
        if (!numItem && numItem !== 0n && numItem !== '0') continue;
        const num = typeof numItem === 'string' ? BigInt(numItem) : numItem;
        const numBytes = numberToBytes(num);
        const len = numBytes.length;

        if (len > 255) {
            throw new Error(`Число ${num} слишком велико (${len} байт), макс. 255 байт для кодирования.`);
        }
        buffers.push(Buffer.from([len]), numBytes);
    }
    return Buffer.concat(buffers);
}

function decodeBytesToNumbers(buffer) {
    const numbers = [];
    let offset = 0;
    while (offset < buffer.length) {
        // Проверка: есть ли хотя бы 1 байт для длины
        if (offset >= buffer.length) {
             throw new Error("Некорректный формат файла: неожиданный конец файла при чтении длины.");
        }
        const len = buffer.readUInt8(offset);
        offset += 1;

        if (offset + len > buffer.length) {
            throw new Error(`Некорректный формат файла: ожидаемая длина числа (${len}) превышает остаток буфера (${buffer.length - offset}).`);
        }

        const numBytes = buffer.slice(offset, offset + len);
        offset += len;

        numbers.push(bytesToNumber(numBytes));
    }
    // Проверка, что мы прочитали весь буфер ровно
    if (offset !== buffer.length) {
         console.warn(`decodeBytesToNumbers: Прочитано ${offset} байт, но длина буфера ${buffer.length}. Возможны лишние данные.`);
         // Можно либо бросить ошибку, либо просто вернуть то, что успели прочитать
         // throw new Error("Некорректный формат файла: остались лишние байты после декодирования.");
    }
    return numbers;
}

function calculatePublicKey(pStr, qStr, dStr) {
    try {
        const p = BigInt(pStr);
        const q = BigInt(qStr);
        const d = BigInt(dStr);


        if (!isPrime(p)) throw new Error(`p (${p}) не является простым числом.`);
        if (!isPrime(q)) throw new Error(`q (${q}) не является простым числом.`);
        if (p === q) throw new Error('p и q должны быть разными.');

        const r = p * q;
        const phi = (p - 1n) * (q - 1n);

        if (!(d > 1n && d < phi)) {
            throw new Error(`Kc (d) должно быть в диапазоне (1, ${phi}).`);
        }
        if (gcd(d, phi) !== 1n) {
            throw new Error(`Kc (d) и phi(r)=${phi} не являются взаимно простыми. Невозможно вычислить e.`);
        }

        
        const e = modInverse(d, phi);
        if (e === null) {
             throw new Error(`Не удалось вычислить мультипликативную инверсию для d=${d} и phi=${phi}.`);
        }

        return { e, r }; // Returns public key

    } catch (error) {
        console.error("Ошибка при вычислении открытого ключа:", error);
        throw error;
    }
}

async function encryptFile(filePath, e, r) {
    try {
        const dataBuffer = await fs.readFile(filePath);
        const encryptedData = [];

        if (r <= 255n) {
             throw new Error(`Модуль r=${r} слишком мал. Он должен быть больше 255 для шифрования байтов.`);
        }

        for (const byte of dataBuffer) {
            const m = BigInt(byte); 
            const c = power(m, e, r); 
            encryptedData.push(c.toString());
        }
        return encryptedData;

    } catch (error) {
        console.error("Ошибка при шифровании файла:", error);
        throw error;
    }
}


async function decryptData(encryptedBuffer, dStr, rStr) {
    try {
        const d = BigInt(dStr);
        const r = BigInt(rStr);

        // 1. Декодируем буфер в массив зашифрованных чисел (BigInt)
        const encryptedNumbers = decodeBytesToNumbers(encryptedBuffer); // Используем новую функцию

        const decryptedBytes = [];

        // 2. Расшифровываем каждое число
        for (const c of encryptedNumbers) { // c - уже BigInt
            const m = power(c, d, r); // Расшифровываем

            if (m < 0n || m > 255n) {
                console.warn(`Результат расшифрования ${m} вне диапазона байта (0-255)... Замена на '?'.`);
                decryptedBytes.push(63);
            } else {
                decryptedBytes.push(Number(m));
            }
        }
        // 3. Возвращаем Buffer с расшифрованными байтами
        return Buffer.from(decryptedBytes);

    } catch (error) {
        console.error("Ошибка при расшифровании:", error);
        // Уточняем сообщение об ошибке, если она связана с декодированием
        if (error.message.includes("Некорректный формат файла") || error.message.includes("Cannot convert")) {
             throw new Error("Ошибка декодирования данных. Убедитесь, что файл не поврежден и является зашифрованным файлом этого приложения.");
        }
        throw error;
    }
}


module.exports = {
    calculatePublicKey,
    encryptFile,         // Для получения строк-чисел (для UI)
    encodeNumbersToBytes,  // Для сохранения шифра в байты
    decodeBytesToNumbers,  // Для чтения шифра из байт и для UI
    decryptData,         // Принимает буфер шифра, возвращает буфер расшифровки
    // Вспомогательные
    isPrime,
    gcd,
    power
};