import { Icon } from '../icons';

    function Toast({ toast }) {
      if (!toast) return null;
      const tone = toast.tone === 'ok' ? 'bg-emerald-600' : toast.tone === 'warn' ? 'bg-amber-600' : toast.tone === 'err' ? 'bg-rose-600' : 'bg-slate-800';
      const ToastIcon = toast.tone === 'err' ? Icon.X : toast.tone === 'warn' ? Icon.Clock : Icon.Check;
      return (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className={'toast-in flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ' + tone}>
            <ToastIcon className="h-4 w-4" />{toast.msg}
          </div>
        </div>
      );
    }

export { Toast };
