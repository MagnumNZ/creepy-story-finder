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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    };
    https.get(redditUrl, opts, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const loc = res.headers.location;
          if (loc) {
            https.get(loc, opts, res2 => {
              let b2 = '';
              res2.on('data', c => b2 += c);
              res2.on('end', () => {
                try { resolve(JSON.parse(b2)); } catch(e) { reject({ status: 500, error: 'Invalid JSON from Reddit' }); }
              });
            }).on('error', err => reject({ status: 502, error: err.message }));
          } else {
            reject({ status: 502, error: 'Reddit redirect with no location' });
          }
          return;
        }
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
