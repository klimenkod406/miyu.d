const API_BASE = 'http://localhost:3001/api';

async function test() {
  const response = await fetch(`${API_BASE}/health`);
  console.log('Health:', await response.json());
}

test();