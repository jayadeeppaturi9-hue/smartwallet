import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const CopyButton = ({ text, label = 'Copy', className = '', size = 'sm' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied to clipboard!' : label}
      aria-label={label}
      className={`inline-flex items-center justify-center p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none ${className}`}
    >
      {copied ? (
        <Check className={`${iconSizes[size] || iconSizes.sm} text-emerald-400`} />
      ) : (
        <Copy className={iconSizes[size] || iconSizes.sm} />
      )}
    </button>
  );
};

export default CopyButton;
