(() => {
  const form = document.getElementById('login-form');
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');
  const err = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    err.classList.add('hidden');
    btn.disabled = true;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('login-user').value,
          password: document.getElementById('login-pass').value
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { location.replace('/'); return; }
      err.textContent = data.error || 'No se pudo iniciar sesión';
    } catch (ex) {
      err.textContent = 'No se pudo conectar con el servidor';
    }
    err.classList.remove('hidden');
    btn.disabled = false;
  });
})();
