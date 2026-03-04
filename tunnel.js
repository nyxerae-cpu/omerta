const http = require('http');

// Try ngrok first
const testNgrok = () => {
  const req = http.get('http://localhost:4040/api/tunnels', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const tunnels = JSON.parse(data);
        if (tunnels.tunnels && tunnels.tunnels.length > 0) {
          console.log('NGROK_URL=' + tunnels.tunnels[0].public_url);
        }
      } catch (e) {
        console.log('NO_NGROK');
      }
    });
  });
  req.on('error', () => console.log('NO_NGROK'));
};

// Fallback to localhost
const fallback = () => {
  console.log('LOCALHOST_URL=http://localhost:3000');
};

testNgrok();
setTimeout(fallback, 2000);
