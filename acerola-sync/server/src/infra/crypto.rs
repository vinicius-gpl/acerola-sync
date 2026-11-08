use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::infra::error::CryptoError;

/// Criptografa com AES-256-GCM e devolve `(ciphertext, nonce)`. O nonce é novo a cada chamada.
pub fn encrypt(key: &[u8; 32], plaintext: &str) -> Result<(Vec<u8>, Vec<u8>), CryptoError> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext =
        cipher.encrypt(&nonce, plaintext.as_bytes()).map_err(|_| CryptoError::Encrypt)?;
    Ok((ciphertext, nonce.to_vec()))
}

pub fn decrypt(key: &[u8; 32], ciphertext: &[u8], nonce: &[u8]) -> Result<String, CryptoError> {
    if nonce.len() != 12 {
        return Err(CryptoError::Decrypt);
    }
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let plaintext =
        cipher.decrypt(Nonce::from_slice(nonce), ciphertext).map_err(|_| CryptoError::Decrypt)?;
    String::from_utf8(plaintext).map_err(|_| CryptoError::Decrypt)
}

/// Token de sessão opaco (32 bytes aleatórios em base64url).
pub fn generate_session_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

/// Só o hash do token vai para o banco: quem lê o banco não consegue se passar pela extensão.
pub fn hash_token(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    const KEY: [u8; 32] = [7u8; 32];

    #[test]
    fn test_encrypt_then_decrypt_returns_plaintext() {
        let (ciphertext, nonce) = encrypt(&KEY, "anilist-token").unwrap();
        assert_ne!(ciphertext, b"anilist-token");
        assert_eq!(decrypt(&KEY, &ciphertext, &nonce).unwrap(), "anilist-token");
    }

    #[test]
    fn test_decrypt_with_wrong_key_fails() {
        let (ciphertext, nonce) = encrypt(&KEY, "anilist-token").unwrap();
        assert!(decrypt(&[8u8; 32], &ciphertext, &nonce).is_err());
    }

    #[test]
    fn test_session_tokens_are_unique_and_hash_is_stable() {
        let first = generate_session_token();
        let second = generate_session_token();
        assert_ne!(first, second);
        assert_eq!(hash_token(&first), hash_token(&first));
        assert_ne!(hash_token(&first), hash_token(&second));
    }
}
