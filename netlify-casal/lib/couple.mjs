import { createHash } from 'node:crypto';

const token = /^[a-f0-9]{64}$/;
const id = /^[a-f0-9]{32}$/;
const roomLifetime = 12 * 60 * 60 * 1000;
const productLimit = 150;
const bodyLimit = 64 * 1024;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function refuse(status, message) {
  throw new RequestError(status, message);
}

function validated(pattern, value) {
  if (typeof value !== 'string' || !pattern.test(value)) refuse(400, 'Código inválido.');
  return value;
}

function label(value, limit) {
  const cleaned = typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
  if (!cleaned || cleaned.length > limit || /[\p{Cc}\p{Cf}]/u.test(cleaned)) {
    refuse(400, 'Confira o nome informado.');
  }
  return cleaned;
}

function product(value) {
  if (!value || typeof value !== 'object') refuse(400, 'Produto inválido.');
  if (!Number.isSafeInteger(value.cents) || value.cents < 1 || value.cents > 999899990001) {
    refuse(400, 'Valor inválido.');
  }
  return {
    id: validated(id, value.id),
    name: label(value.name, 120),
    cents: value.cents,
    pickedBy: '',
  };
}

function digest(secret) {
  return createHash('sha256').update(secret).digest('hex');
}

function snapshot(room, role) {
  return {
    me: role,
    host: room.host.name,
    guest: room.guest?.name ?? '',
    closed: room.closed,
    items: [...room.items.values()],
    ...(role === 'host' && !room.guest && !room.closed ? { invite: room.invite } : {}),
  };
}

function route(room, operation, auth, body) {
  if (operation === 'create') {
    if (room) {
      if (room.host.auth === auth) return { role: 'host', room, changed: false };
      refuse(409, 'Código de carrinho já em uso.');
    }
    const initial = body.items;
    if (!Array.isArray(initial) || initial.length > productLimit) refuse(400, 'Use até 150 produtos.');
    const items = new Map(initial.map(value => {
      const item = product(value);
      return [item.id, item];
    }));
    room = {
      expires: Date.now() + roomLifetime,
      invite: validated(token, body.invite),
      host: { name: label(body.name, 40), auth },
      guest: null,
      items,
      closed: false,
    };
    return { role: 'host', room, changed: true };
  }

  if (!room) refuse(404, 'Carrinho expirado ou indisponível.');
  const role = room.host.auth === auth ? 'host' : room.guest?.auth === auth ? 'guest' : '';
  if (operation === 'join') {
    if (role === 'guest') return { role, room, changed: false };
    if (role === 'host') refuse(409, 'Use um segundo celular para entrar pelo convite.');
    if (room.closed || room.guest || body.invite !== room.invite) {
      refuse(403, 'Convite inválido, encerrado ou já utilizado.');
    }
    const name = label(body.name, 40);
    if (name.toLocaleLowerCase('pt-BR') === room.host.name.toLocaleLowerCase('pt-BR')) {
      refuse(409, 'Use um nome diferente para distinguir as duas pessoas.');
    }
    room.guest = { name, auth };
    room.invite = '';
    return { role: 'guest', room, changed: true };
  }

  if (!role) refuse(403, 'Você não tem acesso a este carrinho.');
  if (!operation) return { role, room, changed: false };
  if (operation === 'close' && role === 'host') {
    room.closed = true;
    room.invite = '';
    return { role, room, changed: true };
  }
  if (room.closed) refuse(409, 'Este carrinho foi encerrado.');
  if (operation === 'add') {
    const item = product(body);
    if (room.items.has(item.id)) return { role, room, changed: false };
    if (room.items.size >= productLimit) refuse(409, 'O carrinho atingiu o limite de 150 produtos.');
    room.items.set(item.id, item);
    return { role, room, changed: true };
  }
  if (operation !== 'pick' && operation !== 'return' && operation !== 'delete') {
    refuse(404, 'Ação indisponível.');
  }
  const item = room.items.get(validated(id, body.id));
  if (!item && operation === 'delete' && role === 'host') return { role, room, changed: false };
  if (!item) refuse(404, 'Este produto foi removido.');
  if (operation === 'pick') {
    if (item.pickedBy && item.pickedBy !== role) refuse(409, 'A outra pessoa já pegou este produto.');
    item.pickedBy = role;
  } else if (operation === 'return') {
    if (item.pickedBy && item.pickedBy !== role) refuse(409, 'Só quem pegou pode devolver.');
    item.pickedBy = '';
  } else {
    if (role !== 'host' || item.pickedBy) refuse(409, 'Só o anfitrião pode excluir itens pendentes.');
    room.items.delete(item.id);
  }
  return { role, room, changed: true };
}

function reply(status, data) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function readBody(request) {
  const stream = request.body?.getReader();
  if (!stream) refuse(400, 'Pedido inválido.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await stream.read();
    if (done) break;
    size += value.byteLength;
    if (size > bodyLimit) {
      await stream.cancel();
      refuse(413, 'Pedido muito grande.');
    }
    chunks.push(value);
  }
  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
  } catch {
    refuse(400, 'Pedido inválido.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) refuse(400, 'Pedido inválido.');
  return data;
}

export function handler(openStore) {
  return async request => {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/health' && request.method === 'GET') return reply(200, { ok: true });
      const match = /^\/v1\/([a-f0-9]{32})(?:\/(create|join|add|pick|return|delete|close))?$/.exec(path);
      if (!match || request.method !== (match[2] ? 'POST' : 'GET')) refuse(404, 'Caminho inválido.');
      const [, roomId, operation] = match;
      const header = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization') || '');
      if (!header) refuse(401, 'Código de acesso obrigatório.');
      const auth = digest(header[1]);
      const body = operation ? await readBody(request) : null;
      const store = openStore();
      for (let attempt = 0; attempt < 5; attempt++) {
        const entry = await store.getWithMetadata(roomId, { type: 'json' });
        if (entry?.data.expires <= Date.now()) refuse(404, 'Carrinho expirado ou indisponível.');
        if (entry && !entry.etag) refuse(503, 'Não foi possível confirmar a versão do carrinho.');
        const previous = entry ? { ...entry.data, items: new Map(entry.data.items) } : null;
        const { role, room, changed } = route(previous, operation, auth, body);
        if (!changed) return reply(200, snapshot(room, role));

        const condition = entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true };
        const result = await store.setJSON(roomId, { ...room, items: [...room.items] }, {
          ...condition,
          metadata: { expires: room.expires },
        });
        if (result.modified) return reply(200, snapshot(room, role));
      }
      return reply(409, { error: 'O carrinho foi atualizado. Tente novamente.' });
    } catch (error) {
      if (error instanceof RequestError) return reply(error.status, { error: error.message });
      return reply(503, { error: 'O servidor não concluiu a operação.' });
    }
  };
}

export async function removeExpired(store, now = Date.now()) {
  for await (const page of store.list({ paginate: true })) {
    for (let offset = 0; offset < page.blobs.length; offset += 12) {
      await Promise.all(page.blobs.slice(offset, offset + 12).map(async ({ key }) => {
        const entry = await store.getMetadata(key);
        if (entry?.metadata.expires <= now) await store.delete(key);
      }));
    }
  }
}
