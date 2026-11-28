export function notify(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('admin-toast', { detail: { id: `${Date.now()}-${Math.random()}`, message, type } }));
}
