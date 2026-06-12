import { useState } from 'react';
import { Icon } from '../icons';
import { saveSession } from '../session';

    /* ============================================================
       LOGIN PAGE
    ============================================================ */
    function LoginPage({ onLogin }) {
      const [nombre, setNombre] = useState('');
      const [password, setPassword] = useState('');
      const [error, setError] = useState('');
      const [loading, setLoading] = useState(false);

      const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
          const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre.trim(), password }),
          });
          const data = await res.json();
          if (!res.ok) { setError(data.error || 'Error al iniciar sesión'); return; }
          const session = { id: data.id, nombre: data.nombre, isAdmin: data.isAdmin, token: data.token };
          saveSession(session);
          onLogin(session);
        } catch {
          setError('No se pudo conectar al servidor');
        } finally {
          setLoading(false);
        }
      };

      return (
        <div className="fixed inset-0 grid place-items-center bg-slate-100">
          <div className="w-full max-w-sm px-4">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-sky-400 text-white shadow-lg">
                <Icon.Signal className="h-7 w-7" />
              </div>
              <div className="text-xl font-extrabold tracking-tight text-slate-900">ValNet Wireless</div>
              <div className="text-sm text-slate-500">ValNet Wireless · Gestión de Campañas</div>
            </div>
            <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-slate-900">Iniciar sesión</h2>
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Nombre</span>
                  <input autoFocus type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="Tu nombre de agente" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Contraseña</span>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="••••••••" />
                </label>
              </div>
              {error && <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>}
              <button type="submit" disabled={loading || !nombre.trim() || !password}
                className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40">
                {loading ? 'Verificando…' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      );
    }

export { LoginPage };
