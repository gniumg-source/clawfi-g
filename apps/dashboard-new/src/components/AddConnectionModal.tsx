import { useState } from 'react';
import { API_URL } from '../app/constants';

interface AddConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ConnectionType = 'cex' | 'dex' | 'launchpad' | 'wallet';
type Venue = 'binance' | 'coinbase' | 'okx' | 'bybit' | 'jupiter' | 'uniswap' | 'pancakeswap' | 'clanker' | 'pumpfun' | 'fourmeme' | 'evm_wallet' | 'solana_wallet';

interface VenueConfig {
  id: Venue;
  name: string;
  type: ConnectionType;
  icon: string;
  description: string;
  fields: {
    name: string;
    key: string;
    type: 'text' | 'password' | 'select' | 'checkbox';
    placeholder?: string;
    required?: boolean;
    options?: { value: string; label: string }[];
    defaultValue?: string | boolean;
  }[];
  chains?: string[];
}

const VENUES: VenueConfig[] = [
  // CEX - Centralized Exchanges
  {
    id: 'binance',
    name: 'Binance',
    type: 'cex',
    icon: '🟡',
    description: 'Connect your Binance account via API keys',
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'My Binance Account', required: false },
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Enter your Binance API key', required: true },
      { name: 'API Secret', key: 'apiSecret', type: 'password', placeholder: 'Enter your API secret', required: true },
      { name: 'Use Testnet', key: 'testnet', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    type: 'cex',
    icon: '🔵',
    description: 'Connect your Coinbase account via API keys',
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'My Coinbase Account', required: false },
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Enter your Coinbase API key', required: true },
      { name: 'API Secret', key: 'apiSecret', type: 'password', placeholder: 'Enter your API secret', required: true },
    ],
  },
  {
    id: 'okx',
    name: 'OKX',
    type: 'cex',
    icon: '⚫',
    description: 'Connect your OKX account via API keys',
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'My OKX Account', required: false },
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Enter your OKX API key', required: true },
      { name: 'API Secret', key: 'apiSecret', type: 'password', placeholder: 'Enter your API secret', required: true },
      { name: 'Passphrase', key: 'passphrase', type: 'password', placeholder: 'Enter your passphrase', required: true },
    ],
  },
  {
    id: 'bybit',
    name: 'Bybit',
    type: 'cex',
    icon: '🟠',
    description: 'Connect your Bybit account via API keys',
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'My Bybit Account', required: false },
      { name: 'API Key', key: 'apiKey', type: 'password', placeholder: 'Enter your Bybit API key', required: true },
      { name: 'API Secret', key: 'apiSecret', type: 'password', placeholder: 'Enter your API secret', required: true },
      { name: 'Use Testnet', key: 'testnet', type: 'checkbox', defaultValue: true },
    ],
  },
  // DEX - Decentralized Exchanges
  {
    id: 'jupiter',
    name: 'Jupiter',
    type: 'dex',
    icon: '🪐',
    description: 'Solana DEX aggregator - requires wallet connection',
    chains: ['solana'],
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'Jupiter Swap', required: false },
      { name: 'Wallet Address', key: 'walletAddress', type: 'text', placeholder: 'Your Solana wallet address', required: true },
      { name: 'Max Slippage (bps)', key: 'slippageBps', type: 'text', placeholder: '50', defaultValue: '50' },
    ],
  },
  {
    id: 'uniswap',
    name: 'Uniswap',
    type: 'dex',
    icon: '🦄',
    description: 'Ethereum/L2 DEX - requires wallet connection',
    chains: ['ethereum', 'arbitrum', 'base', 'polygon', 'optimism'],
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'Uniswap', required: false },
      { name: 'Chain', key: 'chain', type: 'select', required: true, options: [
        { value: 'ethereum', label: 'Ethereum' },
        { value: 'arbitrum', label: 'Arbitrum' },
        { value: 'base', label: 'Base' },
        { value: 'polygon', label: 'Polygon' },
        { value: 'optimism', label: 'Optimism' },
      ]},
      { name: 'Wallet Address', key: 'walletAddress', type: 'text', placeholder: 'Your EVM wallet address', required: true },
    ],
  },
  {
    id: 'pancakeswap',
    name: 'PancakeSwap',
    type: 'dex',
    icon: '🥞',
    description: 'BSC DEX - requires wallet connection',
    chains: ['bsc'],
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'PancakeSwap', required: false },
      { name: 'Wallet Address', key: 'walletAddress', type: 'text', placeholder: 'Your BSC wallet address', required: true },
    ],
  },
  // Launchpads
  {
    id: 'clanker',
    name: 'Clanker',
    type: 'launchpad',
    icon: '🤖',
    description: 'Base chain token launchpad monitoring',
    chains: ['base'],
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'Clanker Monitor', required: false },
      { name: 'Enable Alerts', key: 'enableAlerts', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    id: 'pumpfun',
    name: 'Pump.fun',
    type: 'launchpad',
    icon: '🎰',
    description: 'Solana token launchpad monitoring',
    chains: ['solana'],
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'Pump.fun Monitor', required: false },
      { name: 'Enable Alerts', key: 'enableAlerts', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    id: 'fourmeme',
    name: 'Four.Meme',
    type: 'launchpad',
    icon: '4️⃣',
    description: 'BSC token launchpad monitoring',
    chains: ['bsc'],
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'Four.Meme Monitor', required: false },
      { name: 'Enable Alerts', key: 'enableAlerts', type: 'checkbox', defaultValue: true },
    ],
  },
  // Wallets
  {
    id: 'evm_wallet',
    name: 'EVM Wallet',
    type: 'wallet',
    icon: '👛',
    description: 'Track an Ethereum/EVM wallet address',
    chains: ['ethereum', 'arbitrum', 'base', 'polygon', 'optimism', 'bsc'],
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'My ETH Wallet', required: false },
      { name: 'Chain', key: 'chain', type: 'select', required: true, options: [
        { value: 'ethereum', label: 'Ethereum' },
        { value: 'arbitrum', label: 'Arbitrum' },
        { value: 'base', label: 'Base' },
        { value: 'polygon', label: 'Polygon' },
        { value: 'optimism', label: 'Optimism' },
        { value: 'bsc', label: 'BSC' },
      ]},
      { name: 'Wallet Address', key: 'address', type: 'text', placeholder: '0x...', required: true },
      { name: 'Enable Alerts', key: 'enableAlerts', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    id: 'solana_wallet',
    name: 'Solana Wallet',
    type: 'wallet',
    icon: '🟣',
    description: 'Track a Solana wallet address',
    chains: ['solana'],
    fields: [
      { name: 'Label', key: 'label', type: 'text', placeholder: 'My SOL Wallet', required: false },
      { name: 'Wallet Address', key: 'address', type: 'text', placeholder: 'Enter Solana address', required: true },
      { name: 'Enable Alerts', key: 'enableAlerts', type: 'checkbox', defaultValue: true },
    ],
  },
];

const TYPE_LABELS: Record<ConnectionType, string> = {
  cex: 'Centralized Exchanges',
  dex: 'DEX / Swaps',
  launchpad: 'Launchpads',
  wallet: 'Wallets',
};

export default function AddConnectionModal({ isOpen, onClose, onSuccess }: AddConnectionModalProps) {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedVenue, setSelectedVenue] = useState<VenueConfig | null>(null);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVenueSelect = (venue: VenueConfig) => {
    setSelectedVenue(venue);
    // Initialize form data with default values
    const defaults: Record<string, string | boolean> = {};
    venue.fields.forEach(field => {
      if (field.defaultValue !== undefined) {
        defaults[field.key] = field.defaultValue;
      }
    });
    setFormData(defaults);
    setStep('configure');
    setError(null);
  };

  const handleBack = () => {
    setStep('select');
    setSelectedVenue(null);
    setFormData({});
    setError(null);
  };

  const handleClose = () => {
    setStep('select');
    setSelectedVenue(null);
    setFormData({});
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenue) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('clawfi_token');
      
      // Build the request body based on venue type
      const body: Record<string, unknown> = { ...formData };
      
      // Determine the endpoint based on venue
      let endpoint = '/connectors/generic'; // Default generic endpoint
      
      if (selectedVenue.id === 'binance') {
        endpoint = '/connectors/binance';
      } else if (selectedVenue.type === 'cex') {
        endpoint = `/connectors/${selectedVenue.id}`;
      } else if (selectedVenue.type === 'dex') {
        endpoint = `/connectors/dex/${selectedVenue.id}`;
      } else if (selectedVenue.type === 'launchpad') {
        endpoint = `/connectors/launchpad/${selectedVenue.id}`;
      } else if (selectedVenue.type === 'wallet') {
        endpoint = `/connectors/wallet`;
        body.walletType = selectedVenue.id;
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to add connection');
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add connection');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (key: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  const groupedVenues = VENUES.reduce((acc, venue) => {
    acc[venue.type] = acc[venue.type] || [];
    acc[venue.type].push(venue);
    return acc;
  }, {} as Record<ConnectionType, VenueConfig[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      
      {/* Modal */}
      <div className="relative glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            {step === 'configure' && (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {step === 'select' ? 'Add Connection' : `Connect ${selectedVenue?.name}`}
              </h2>
              <p className="text-sm text-gray-400">
                {step === 'select' 
                  ? 'Choose a service to connect' 
                  : selectedVenue?.description}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'select' ? (
            <div className="space-y-6">
              {Object.entries(groupedVenues).map(([type, venues]) => (
                <div key={type}>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">
                    {TYPE_LABELS[type as ConnectionType]}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {venues.map((venue) => (
                      <button
                        key={venue.id}
                        onClick={() => handleVenueSelect(venue)}
                        className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-500/50 rounded-xl transition-all text-left"
                      >
                        <span className="text-2xl">{venue.icon}</span>
                        <div>
                          <div className="font-medium text-white">{venue.name}</div>
                          {venue.chains && (
                            <div className="text-xs text-gray-500">
                              {venue.chains.join(', ')}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : selectedVenue ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Security Notice for CEX */}
              {selectedVenue.type === 'cex' && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div className="text-sm">
                      <p className="font-medium text-yellow-400 mb-1">Security Notice</p>
                      <ul className="text-yellow-400/80 space-y-1">
                        <li>• Use API keys with <strong>read-only</strong> or <strong>trade-only</strong> permissions</li>
                        <li>• <strong>Disable withdrawals</strong> on your API key</li>
                        <li>• Credentials are encrypted and stored securely</li>
                        <li>• We recommend testing with a testnet account first</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Fields */}
              {selectedVenue.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {field.name}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  
                  {field.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!formData[field.key]}
                        onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-400">{field.placeholder || `Enable ${field.name}`}</span>
                    </label>
                  ) : field.type === 'select' ? (
                    <select
                      value={(formData[field.key] as string) || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      required={field.required}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">Select {field.name}</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={(formData[field.key] as string) || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  )}
                </div>
              ))}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Connect {selectedVenue.name}
                  </>
                )}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
