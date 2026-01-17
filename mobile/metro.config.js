const { getDefaultConfig } = require('expo/metro-config');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// Detectar IP da LAN
function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (!iface.internal && iface.family === 'IPv4') {
        const ip = iface.address;
        if (
          ip.startsWith('192.168.') ||
          ip.startsWith('10.') ||
          (ip.startsWith('172.') && (() => {
            const n = parseInt(ip.split('.')[1], 10);
            return n >= 16 && n <= 31;
          })())
        ) {
          return ip;
        }
      }
    }
  }
  return '';
}

function checkHealth(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        resolve(res.statusCode === 200);
        req.destroy();
      });
      req.on('error', () => resolve(false));
      req.setTimeout(timeoutMs, () => {
        try { req.destroy(); } catch {}
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

async function ensureApiDeps(apiDir) {
  try {
    const expressDir = path.resolve(apiDir, 'node_modules', 'express');
    const hasDeps = fs.existsSync(expressDir);
    if (!hasDeps) {
      await new Promise((resolve) => {
        const p = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install','--no-audit','--no-fund'], {
          cwd: apiDir,
          stdio: 'inherit',
        });
        p.on('close', () => resolve());
        p.on('error', () => resolve());
      });
    }
  } catch {}
}

function createDevControlServer(lanIp) {
  try {
    if (process.env.EXPO_PUBLIC_DEV_CONTROL_URL) return;
    const server = http.createServer((req, res) => {
      try {
        const baseHost = lanIp || 'localhost';
        const u = new URL(req.url, `http://${baseHost}:4005`);
        if (u.pathname === '/dev/start-api') {
          const t = (u.searchParams.get('target') || '').toLowerCase();
          const arg = t === 'local' ? 'local' : 'railway';
          try {
            const kill = spawn('bash', ['-lc', 'lsof -tiTCP:4000 | xargs kill -9 2>/dev/null || true'], { detached: true, stdio: 'ignore' });
            kill.unref();
          } catch {}
          try {
            const apiDir = path.resolve(__dirname, '..', 'api');
            const child = spawn('node', ['server.js'], {
              cwd: apiDir,
              detached: true,
              stdio: 'ignore',
              env: { ...process.env, DB_TARGET: arg },
            });
            child.unref();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, target: arg }));
            return;
          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false }));
            return;
          }
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      }
    });
    server.on('error', () => {});
    server.listen(4005, '0.0.0.0', () => {
      const exposeHost = lanIp || 'localhost';
      process.env.EXPO_PUBLIC_DEV_CONTROL_URL = `http://${exposeHost}:4005`;
    });
  } catch {}
}

async function ensureApiRunning() {
  try {
    process.env.EXPO_PUBLIC_WEB_API_URL = process.env.EXPO_PUBLIC_WEB_API_URL || 'http://localhost:4000/api';
    const lanIp = getLanIp();
    if (lanIp) {
      process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
      createDevControlServer(lanIp);
      // Expor a URL pública da API para o bundle
      process.env.EXPO_PUBLIC_API_URL = `http://${lanIp}:4000/api`;
      process.env.EXPO_PUBLIC_WEB_API_URL = `http://localhost:4000/api`;
      let healthy = await checkHealth(`http://${lanIp}:4000/api/health`, 1500);
      if (!healthy) {
        console.log('🔧 API não está ativa. Iniciando automaticamente com DB_TARGET=local...');
        const scriptPathSh = path.resolve(__dirname, '..', 'start-api.sh');
        const scriptPathPs1 = path.resolve(__dirname, '..', 'start-api.ps1');
        // Ler alvo preferido do arquivo .env da API, se existir
        let preferredTarget = 'railway';
        try {
          const envPath = path.resolve(__dirname, '..', 'api', '.env');
          if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const m = content.match(/DB_TARGET\s*=\s*(\w+)/i);
            if (m && /^(local|railway)$/i.test(m[1])) preferredTarget = m[1].toLowerCase();
          }
        } catch {}
        try {
          let child;
          if (process.platform === 'win32' && fs.existsSync(scriptPathPs1)) {
            child = spawn('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-File', scriptPathPs1], {
              cwd: path.resolve(__dirname, '..'),
              detached: true,
              stdio: 'ignore',
            });
          } else if (fs.existsSync(scriptPathSh)) {
            child = spawn('bash', [scriptPathSh, preferredTarget], {
              cwd: path.resolve(__dirname, '..'),
              detached: true,
              stdio: 'ignore',
            });
          } else {
            const apiDir = path.resolve(__dirname, '..', 'api');
            try {
              const envExample = path.resolve(apiDir, 'env_exemplo');
              const envTarget = path.resolve(apiDir, '.env');
              if (!fs.existsSync(envTarget) && fs.existsSync(envExample)) {
                fs.copyFileSync(envExample, envTarget);
              }
            } catch {}
            await ensureApiDeps(apiDir);
            child = spawn('node', ['server.js'], {
              cwd: apiDir,
              detached: true,
              stdio: 'ignore',
              env: { ...process.env, DB_TARGET: 'local' },
            });
          }
          child.unref();
          for (let i = 0; i < 10; i++) {
            healthy = await checkHealth(`http://${lanIp}:4000/api/health`, 800) || await checkHealth(`http://localhost:4000/api/health`, 800);
            if (healthy) break;
            await new Promise((r) => setTimeout(r, 400));
          }
        } catch (e) {
          console.warn('⚠️ Falha ao iniciar API automaticamente:', e?.message || e);
          try {
            const apiDir = path.resolve(__dirname, '..', 'api');
            try {
              const envExample = path.resolve(apiDir, 'env_exemplo');
              const envTarget = path.resolve(apiDir, '.env');
              if (!fs.existsSync(envTarget) && fs.existsSync(envExample)) {
                fs.copyFileSync(envExample, envTarget);
              }
            } catch {}
            await ensureApiDeps(apiDir);
            const node = spawn('node', ['server.js'], {
              cwd: apiDir,
              detached: true,
              stdio: 'ignore',
              env: { ...process.env, DB_TARGET: preferredTarget },
            });
            node.unref();
            for (let i = 0; i < 10; i++) {
              healthy = await checkHealth(`http://${lanIp}:4000/api/health`, 800) || await checkHealth(`http://localhost:4000/api/health`, 800);
              if (healthy) break;
              await new Promise((r) => setTimeout(r, 400));
            }
          } catch (e2) {
            console.warn('⚠️ Fallback direto também falhou:', e2?.message || e2);
          }
        }
      }
      if (healthy) console.log('✅ API já está saudável em LAN.');
    } else {
      let healthy = false;
      createDevControlServer('localhost');
      try {
        const scriptPathSh = path.resolve(__dirname, '..', 'start-api.sh');
        const scriptPathPs1 = path.resolve(__dirname, '..', 'start-api.ps1');
        let child;
        if (process.platform === 'win32' && fs.existsSync(scriptPathPs1)) {
          child = spawn('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-File', scriptPathPs1], {
            cwd: path.resolve(__dirname, '..'),
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        } else if (fs.existsSync(scriptPathSh)) {
          child = spawn('bash', [scriptPathSh, 'local'], {
            cwd: path.resolve(__dirname, '..'),
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        } else {
          const apiDir = path.resolve(__dirname, '..', 'api');
          await ensureApiDeps(apiDir);
          const node = spawn('node', ['server.js'], {
            cwd: apiDir,
            detached: true,
            stdio: 'ignore',
            env: { ...process.env, DB_TARGET: 'local' },
          });
          node.unref();
        }
        for (let i = 0; i < 12; i++) {
          healthy = await checkHealth(`http://localhost:4000/api/health`, 800);
          if (healthy) break;
          await new Promise((r) => setTimeout(r, 400));
        }
      } catch {}
      if (!healthy) {
        console.warn('⚠️ Não foi possível detectar IP da LAN automaticamente.');
      }
    }
  } catch (e) {
    console.warn('⚠️ ensureApiRunning error:', e?.message || e);
  }
}

// Disparar verificação/inicialização da API assim que o Metro carregar
ensureApiRunning();

const config = getDefaultConfig(__dirname);
module.exports = config;
