const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.body || req.url, true);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'Test CareerConnect API',
      message: 'Minimal server for testing FCM token registration'
    }));
    return;
  }

  // FCM token registration
  if (req.method === 'POST' && parsedUrl.pathname === '/api/notifications/fcm/tokens') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('📱 FCM Token Registration:', {
          token: data.fcm_token ? 'Present' : 'Missing',
          device: data.device_id,
          type: data.device_type,
          auth: req.headers.authorization ? 'Present' : 'Missing'
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Mock application submission
  if (req.method === 'POST' && parsedUrl.pathname === '/api/applications') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log('📝 Application Submission:', data);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'test-app-' + Date.now(),
          job_id: data.job_id,
          applicant_uid: 'test-user-id',
          status: 'pending',
          applied_at: new Date().toISOString()
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Mock application status update
  if (req.method === 'PATCH' && parsedUrl.pathname.startsWith('/api/applications/') && parsedUrl.pathname.endsWith('/status')) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const appId = parsedUrl.pathname.split('/')[3];

        console.log('📋 Application Status Update:', { id: appId, status: data.status });
        console.log('📲 Would send FCM notification about status:', data.status);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: appId,
          status: data.status,
          updated_at: new Date().toISOString()
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Test CareerConnect API listening on port ${PORT}`);
  console.log('🔶 Minimal server for testing FCM token registration');
  console.log('🔶 No Firebase/Supabase - just mocks endpoints');
});
