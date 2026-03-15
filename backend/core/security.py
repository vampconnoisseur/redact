
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from base64 import urlsafe_b64encode, urlsafe_b64decode


NONCE_SIZE = 12

def generate_key() -> bytes:
    """Generates a cryptographically secure 32-byte key."""
    return AESGCM.generate_key(bit_length=256)

def encrypt_text(key: bytes, plaintext: str) -> bytes:
    """
    Encrypts text using AES-GCM.
    Returns a url-safe base64 encoded string containing (nonce + ciphertext + tag).
    """
    aesgcm = AESGCM(key)
    nonce = os.urandom(NONCE_SIZE)
    plaintext_bytes = plaintext.encode('utf-8')
    ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, None)
    
    encrypted_payload = nonce + ciphertext
    return urlsafe_b64encode(encrypted_payload)

def decrypt_text(key: bytes, encrypted_payload_b64: bytes) -> str:
    """
    Decrypts a payload encrypted with AES-GCM.
    Expects a url-safe base64 encoded string containing (nonce + ciphertext + tag).
    """
    try:
        encrypted_payload = urlsafe_b64decode(encrypted_payload_b64)
        
        nonce = encrypted_payload[:NONCE_SIZE]
        ciphertext = encrypted_payload[NONCE_SIZE:]
        
        aesgcm = AESGCM(key)
        decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted_bytes.decode('utf-8')
    except Exception as e:
        print(f"Decryption failed: {e}")
        raise ValueError("Decryption failed. Invalid key or corrupted data.")