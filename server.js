const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function fetchReddit(sub, t, limit) {
  return new Promise((resolve, reject) => {
    const redditUrl = `https://www.reddit.com/r/${sub}/top.json?t=${t}&limit=${limit}&raw_json=1`;
    const opts = {
      headers: {
        'User-Agent': 'CreepyStoryFinder/1.0 (halloween stream tool)',
        'Accept': 'application/json',
      }
    };
    https.get(redditUrl, opts, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 404) return reject({ status: 404, error: `r/${sub} doesn't exist` });
        if (res.statusCode === 403) return reject({ status: 403, error: `r/${sub} is private or banned` });
        if (res.statusCode !== 200) return reject({ status: res.statusCode, error: `Reddit returned HTTP ${res.statusCode}` });
        try { resolve(JSON.parse(body)); }
        catch (e) { reject({ status: 500, error: 'Invalid JSON from Reddit' }); }
      });
    }).on('error', err => reject({ status: 502, error: err.message }));
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // API endpoint
  if (pathname === '/api/reddit') {
    const { sub, t, limit } = parsed.query;
    if (!sub) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing sub parameter' }));
    }
    try {
      const data = await fetchReddit(sub, t || 'week', Math.min(parseInt(limit) || 25, 100));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(err.status || 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.error || 'Unknown error' }));
    }
    return;
  }

  // Serve static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Creepy Story Finder running on port ${PORT}`));
