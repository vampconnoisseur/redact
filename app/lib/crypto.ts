import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const algorithm = 'aes-256-gcm';
const ivLength = 16;
const tagLength = 16;
const secret = process.env.DOCUMENT_PASSWORD_ENCRYPTION_KEY;

if (!secret || secret.length < 32) {
    throw new Error('A DOCUMENT_PASSWORD_ENCRYPTION_KEY of at least 32 characters must be defined in your .env file.');
}

const key = scryptSync(secret, 'salt', 32);

export function encrypt(text: string): string {
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv(algorithm, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString('hex');
}

export function decrypt(encryptedText: string): string {
    const data = Buffer.from(encryptedText, 'hex');
    
    const iv = data.slice(0, ivLength);
    const tag = data.slice(ivLength, ivLength + tagLength);
    const encrypted = data.slice(ivLength + tagLength);

    const decipher = createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
}