/**
 * Webhook de despliegue continuo (CD): GitHub avisa de cada push y el servidor se actualiza solo.
 *
 *   POST /webhook-deploy      (Content-Type: application/json, firmado con WEBHOOK_SECRET)
 *
 * Seguridad:
 *  - Se exige la firma HMAC-SHA256 de GitHub (cabecera X-Hub-Signature-256) calculada sobre el cuerpo SIN tocar.
 *    El secreto nunca viaja por la red. Comparación en tiempo constante.
 *  - Sin WEBHOOK_SECRET definido la ruta NO se monta (cerrado por defecto).
 *  - Solo despliega el evento `push` de la rama main; `ping` responde pong; lo demás se ignora.
 *
 * El despliegue lo hace deploy/deploy.sh (git pull → npm ci → pm2 restart) en un proceso SEPARADO y desacoplado:
 * `pm2 restart` mata al servidor que lo lanzó (y a sus hijos), así que un `exec` normal moriría a mitad de camino y
 * nunca podría responder. Por eso se responde 200 en cuanto el despliegue arranca; el resultado queda en deploy.log.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { closeSync, existsSync, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { Router } from 'express';

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(BACKEND_DIR, 'deploy', 'deploy.sh');
const LOG = join(BACKEND_DIR, 'deploy.log');

/** ¿la firma de GitHub ("sha256=<hex>") corresponde a este cuerpo y este secreto? */
export function verifySignature(secret: string, body: Buffer, header: string | undefined): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(body).digest('hex'), 'utf8');
  const got = Buffer.from(header.slice(7), 'utf8');
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export interface DeployOpts {
  secret: string;
  /** rama que despliega */
  branch?: string;
  /** lanza el despliegue (inyectable en pruebas). Devuelve false si no pudo arrancar. */
  run?: () => boolean;
}

/** Lanza deploy.sh desacoplado del servidor (sobrevive al pm2 restart) con su salida en deploy.log. */
function runDeployScript(): boolean {
  if (!existsSync(SCRIPT)) return false;
  try {
    const out = openSync(LOG, 'a');
    const child = spawn('bash', [SCRIPT], { cwd: BACKEND_DIR, detached: true, stdio: ['ignore', out, out], env: process.env });
    child.on('error', (e) => console.error('webhook-deploy: no se pudo lanzar deploy.sh:', e));
    child.unref();
    closeSync(out);
    return true;
  } catch (e) {
    console.error('webhook-deploy: error al lanzar el despliegue:', e);
    return false;
  }
}

export function deployRouter(opts: DeployOpts) {
  const { secret, branch = 'main', run = runDeployScript } = opts;
  const ref = `refs/heads/${branch}`;
  const r = Router();
  // cuerpo en crudo (Buffer): la firma se calcula sobre los bytes exactos que mandó GitHub
  r.post('/', express.raw({ type: () => true, limit: '1mb' }), (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!verifySignature(secret, body, req.header('x-hub-signature-256'))) {
      res.status(401).json({ ok: false, error: 'firma inválida' });
      return;
    }
    const event = req.header('x-github-event');
    if (event === 'ping') {
      res.json({ ok: true, pong: true });
      return;
    }
    if (event !== 'push') {
      res.json({ ok: true, ignored: `evento ${event ?? 'desconocido'}` });
      return;
    }
    let pushed: unknown;
    try {
      pushed = (JSON.parse(body.toString('utf8')) as { ref?: unknown }).ref;
    } catch {
      res.status(400).json({ ok: false, error: 'JSON inválido' });
      return;
    }
    if (pushed !== ref) {
      res.json({ ok: true, ignored: `rama ${String(pushed)}` });
      return;
    }
    if (!run()) {
      res.status(500).json({ ok: false, error: 'no se pudo iniciar el despliegue (ver logs del servidor)' });
      return;
    }
    console.log(new Date().toISOString(), `webhook-deploy: push a ${branch}, despliegue iniciado (log: ${LOG})`);
    res.json({ ok: true, status: 'despliegue iniciado', log: 'deploy.log' });
  });
  return r;
}
