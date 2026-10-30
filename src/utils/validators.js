/**
 * Validation utilities for blockchain addresses and investigation inputs
 */

export const isEvmAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
};

export const isBitcoinAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  // Legacy (1...), P2SH (3...), SegWit (bc1q...), Taproot (bc1p...)
  return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed);
};

export const isSolanaAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
};

export const isTronAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  return /^T[a-zA-HJ-NP-Za-km-z0-9]{33}$/.test(trimmed);
};

export const validateAddressForNetwork = (address, networkId = 'ethereum') => {
  if (!address || !address.trim()) {
    return { valid: false, message: 'Wallet address is required.' };
  }

  const net = networkId.toLowerCase();
  if (['ethereum', 'polygon', 'arbitrum', 'optimism', 'binance-smart-chain', 'avalanche', 'base'].includes(net)) {
    if (!isEvmAddress(address)) {
      return { valid: false, message: 'Invalid EVM wallet address format (must start with 0x followed by 40 hex characters).' };
    }
  } else if (net === 'bitcoin') {
    if (!isBitcoinAddress(address)) {
      return { valid: false, message: 'Invalid Bitcoin address format (must start with 1, 3, or bc1).' };
    }
  } else if (net === 'solana') {
    if (!isSolanaAddress(address)) {
      return { valid: false, message: 'Invalid Solana address format (Base58 encoded 32-44 characters).' };
    }
  } else if (net === 'tron') {
    if (!isTronAddress(address)) {
      return { valid: false, message: 'Invalid Tron address format (must start with T followed by 33 characters).' };
    }
  }

  return { valid: true, message: '' };
};
