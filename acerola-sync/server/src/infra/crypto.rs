use aes_gcm::{
    aead::{Aead, KeyInit, Nonce},
    Aes256Gcm,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use sha2::{Digest, Sha256};

/// Bytes aleatórios de um gerador criptográfico (o `ThreadRng` do rand é um ChaCha12
/// alimentado e realimentado pelo sistema operacional).
fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes = [0u8; N];
    rand::rng().fill_bytes(&mut bytes);
    bytes
}

use crate::infra::error::CryptoError;

/// Criptografa com AES-256-GCM e devolve `(ciphertext, nonce)`. O nonce é novo a cada chamada.
pub fn encrypt(key: &[u8; 32], plaintext: &str) -> Result<(Vec<u8>, Vec<u8>), CryptoError> {
    let cipher = Aes256Gcm::new(&(*key).into());
    let nonce = Nonce::<Aes256Gcm>::from(random_bytes::<12>());
    let ciphertext =
        cipher.encrypt(&nonce, plaintext.as_bytes()).map_err(|_| CryptoError::Encrypt)?;
    Ok((ciphertext, nonce.to_vec()))
}

pub fn decrypt(key: &[u8; 32], ciphertext: &[u8], nonce: &[u8]) -> Result<String, CryptoError> {
    let nonce = Nonce::<Aes256Gcm>::try_from(nonce).map_err(|_| CryptoError::Decrypt)?;
    let cipher = Aes256Gcm::new(&(*key).into());
    let plaintext = cipher.decrypt(&nonce, ciphertext).map_err(|_| CryptoError::Decrypt)?;
    String::from_utf8(plaintext).map_err(|_| CryptoError::Decrypt)
}

/// Token de sessão opaco (32 bytes aleatórios em base64url).
pub fn generate_session_token() -> String {
    URL_SAFE_NO_PAD.encode(random_bytes::<32>())
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

    /// Vetor fixo (AES-256-GCM padrão, gerado fora do Rust): o token que já está cifrado no
    /// banco continua abrindo depois de trocar a versão da biblioteca.
    #[test]
    fn test_decrypts_ciphertext_from_any_aes_gcm_implementation() {
        let nonce = [1u8, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let ciphertext = [
            218, 18, 129, 242, 3, 153, 150, 1, 145, 81, 105, 123, 251, 164, 251, 225, 101, 57, 109,
            253, 179, 145, 177, 149, 38, 60, 223, 206, 80,
        ];
        assert_eq!(decrypt(&KEY, &ciphertext, &nonce).unwrap(), "anilist-token");
        assert!(decrypt(&KEY, &ciphertext, &nonce[..11]).is_err());
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
