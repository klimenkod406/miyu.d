const API_BASE = 'http://localhost:3001/api';

async function test() {
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'artist@miyu.ru', password: 'artist123' })
  });
  
  const loginData = await loginRes.json();
  console.log('Login:', loginData.user?.role);
  
  const albumsRes = await fetch(`${API_BASE}/artist/albums`, {
    headers: { Authorization: `Bearer ${loginData.accessToken}` }
  });
  
  console.log('Albums status:', albumsRes.status);
  console.log('Albums:', await albumsRes.text());
}

test();