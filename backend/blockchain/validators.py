import re


def is_valid_evm_address(address: str) -> bool:
    if not address or not isinstance(address, str):
        return False
    return bool(re.match(r'^0x[a-fA-F0-9]{40}$', address.strip()))


def is_valid_btc_address(address: str) -> bool:
    if not address or not isinstance(address, str):
        return False
    trimmed = address.strip()
    return bool(re.match(r'^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$', trimmed))


def is_valid_sol_address(address: str) -> bool:
    if not address or not isinstance(address, str):
        return False
    trimmed = address.strip()
    return bool(re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$', trimmed))


def is_valid_tron_address(address: str) -> bool:
    if not address or not isinstance(address, str):
        return False
    trimmed = address.strip()
    return bool(re.match(r'^T[a-zA-HJ-NP-Za-km-z0-9]{33}$', trimmed))


def validate_blockchain_address(address: str, blockchain: str = 'ethereum') -> tuple[bool, str]:
    """
    Validates a wallet address for a given blockchain network.
    Returns (is_valid, error_message).
    """
    if not address or not address.strip():
        return False, 'Wallet address cannot be empty.'

    net = blockchain.lower().strip()
    addr = address.strip()

    evm_chains = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'binance-smart-chain', 'bsc', 'avalanche', 'base']
    if net in evm_chains:
        if not is_valid_evm_address(addr):
            return False, f"Invalid EVM address format for {blockchain} (must be 0x followed by 40 hex characters)."
    elif net == 'bitcoin':
        if not is_valid_btc_address(addr):
            return False, "Invalid Bitcoin address format (must start with 1, 3, or bc1)."
    elif net == 'solana':
        if not is_valid_sol_address(addr):
            return False, "Invalid Solana address format (Base58 string between 32 and 44 characters)."
    elif net == 'tron':
        if not is_valid_tron_address(addr):
            return False, "Invalid Tron address format (must start with T followed by 33 characters)."

    return True, ''
