    /* ============================================================
       SESSION HELPERS
    ============================================================ */
    const SESSION_KEY = 'valnet_session';
    const SESSION_TIMEOUT = 5_400_000; // 90 min in ms

    function loadSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (Date.now() - s.lastActivity > SESSION_TIMEOUT) {
          localStorage.removeItem(SESSION_KEY);
          return null;
        }
        return s;
      } catch { return null; }
    }

    function saveSession(session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, lastActivity: Date.now() }));
    }

    function touchSession() {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        s.lastActivity = Date.now();
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } catch {}
    }

    function setCampaniaSession(campaniaId) {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        s.campaniaId = campaniaId;
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } catch {}
    }

export { SESSION_KEY, SESSION_TIMEOUT, loadSession, saveSession, touchSession, setCampaniaSession };
