import { useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authApi } from '../api/auth';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password.length < 6) {
      setErrorMsg('Пароль должен быть не менее 6 символов');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Пароли не совпадают');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      await authApi.resetPassword(token, password);
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Ссылка недействительна или истекла. Запросите новую.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#12121a] rounded-2xl p-8 border border-white/5">
          <h1 className="text-2xl font-bold text-white mb-2">Новый пароль</h1>
          <p className="text-gray-400 text-sm mb-6">
            Придумайте новый пароль для вашего аккаунта.
          </p>

          {status === 'success' ? (
            <div className="text-center py-4">
              <div className="text-green-400 text-lg mb-2">✓ Пароль изменен!</div>
              <p className="text-gray-400 text-sm mb-4">Теперь вы можете войти с новым паролем.</p>
              <Link to="/login" className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-medium py-3 px-8 rounded-lg transition-colors">
                Войти
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm text-gray-400 mb-1">Новый пароль</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Минимум 6 символов"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm text-gray-400 mb-1">Подтвердите пароль</label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Повторите пароль"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {status === 'error' && (
                <p className="text-red-400 text-sm">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
              >
                {status === 'loading' ? 'Сохранение...' : 'Сохранить пароль'}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-purple-400 hover:text-purple-300 text-sm">
                  Вернуться ко входу
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
