const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('timeout')));
  });
}

(async () => {
  const port = Number(process.env.KBOA_FUNCTIONS_PORT || 5001);
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'kboa-academy-production-test';
  const url = `http://127.0.0.1:${port}/${project}/us-central1/health`;
  const result = await get(url);
  if (result.status !== 200 || !JSON.parse(result.body).ok) {
    throw new Error(`Health smoke test failed: HTTP ${result.status} ${result.body}`);
  }
  console.log('Firebase emulator smoke test: PASS');
})().catch(err => { console.error(err); process.exit(1); });
