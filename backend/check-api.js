async function check() {
  try {
    const res = await fetch('http://127.0.0.1:3000/api/v1/admin/auth/dev-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'editor@mes.ac.in' })
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
check();
