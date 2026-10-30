import React from 'react';
import { ExternalLink } from 'lucide-react';
import CopyButton from './CopyButton';
import { truncateAddress } from '../../utils/formatters';

const EXPLORERS = {
  ethereum: 'https://etherscan.io/address/',
  bitcoin: 'https://mempool.space/address/',
  polygon: 'https://polygonscan.com/address/',
  arbitrum: 'https://arbiscan.io/address/',
  optimism: 'https://optimistic.etherscan.io/address/',
  'binance-smart-chain': 'https://bscscan.com/address/',
  avalanche: 'https://snowtrace.io/address/',
  base: 'https://basescan.org/address/',
  solana: 'https://solscan.io/account/',
  tron: 'https://tronscan.org/#/address/',
};

export const AddressBadge = ({
  address,
  network = 'ethereum',
  truncate = true,
  start = 6,
  end = 4,
  showCopy = true,
  showExplorer = true,
  className = '',
  onClick,
}) => {
  if (!address) return <span className="text-slate-500 font-mono text-xs">Not available</span>;

  const display = truncate ? truncateAddress(address, start, end) : address;
  const explorerUrl = EXPLORERS[network?.toLowerCase()] ? `${EXPLORERS[network.toLowerCase()]}${address}` : null;

  return (
    <div className={`inline-flex items-center gap-1.5 font-mono text-xs bg-slate-900/90 border border-slate-800 px-2 py-0.5 rounded text-slate-200 ${className}`}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="hover:text-cyan-400 transition-colors text-left font-mono"
        >
          {display}
        </button>
      ) : (
        <span className="font-mono text-slate-300">{display}</span>
      )}

      {showCopy && <CopyButton text={address} size="xs" />}

      {showExplorer && explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Blockchain Explorer"
          className="text-slate-400 hover:text-cyan-400 transition-colors p-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};

export default AddressBadge;
