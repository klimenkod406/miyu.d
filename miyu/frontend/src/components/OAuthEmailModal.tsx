import { useState } from 'react';
import { Mail, X } from 'lucide-react';

interface OAuthEmailModalProps {
  open: boolean;
  onSubmit: (email: string) => void;
  onCancel: () => void;
}

export default function OAuthEmailModal({ open, onSubmit, onCancel }: OAuthEmailModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Введите корректный email адрес');
      return;
    }

    onSubmit(email);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-[#1a1a2e] border border-white/[0.08] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Укажите email</h2>
          <button
            onClick={onCancel}
            className="text-white/40 hover:text-white/80 transition p-1"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-white/50 text-sm mb-5">
          Социальная сеть не предоставила email. Пожалуйста, укажите его для завершения регистрации.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-purple-400 transition" size={20} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              autoFocus
              className="w-full pl-12 pr-4 py-3 bg-white/[0.02] border border-white/[0.08] rounded-xl focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.04] text-white placeholder-white/30 transition-all text-sm"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 hover:from-purple-500 hover:via-pink-400 hover:to-purple-500 rounded-xl font-semibold text-sm transition-all duration-300"
          >
            Продолжить
          </button>
        </form>
      </div>
    </div>
  );
}
