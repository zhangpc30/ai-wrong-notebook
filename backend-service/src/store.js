import fs from 'node:fs/promises';
import path from 'node:path';

const dataDir = path.resolve(process.env.DATA_DIR || './data');
const storePath = path.join(dataDir, 'sync-store.json');
let writeQueue = Promise.resolve();
let cache = null;

function emptyStore() {
  return { version: 1, users: {} };
}

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(storePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    cache = emptyStore();
  }
  return cache;
}

async function persist() {
  await fs.mkdir(dataDir, { recursive: true });
  const temporary = `${storePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(cache), 'utf8');
  await fs.rename(temporary, storePath);
}

function enqueue(task) {
  const next = writeQueue.then(task, task);
  writeQueue = next.catch(() => {});
  return next;
}

function timestamp(value, fallback = '') {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function sanitizeRecord(value) {
  const source = value && typeof value === 'object' ? value : {};
  const serialized = JSON.stringify(source);
  if (Buffer.byteLength(serialized) > 256 * 1024) {
    throw new Error('单条错题数据不能超过 256 KB');
  }
  const id = String(source.id || '').slice(0, 160);
  if (!id) throw new Error('错题 id 不能为空');
  const now = new Date().toISOString();
  return {
    ...source,
    id,
    createdAt: timestamp(source.createdAt, now),
    updatedAt: timestamp(source.updatedAt, now),
    imagePath: '',
    cloudImageUrl: String(source.cloudImageUrl || '').slice(0, 2048),
  };
}

export async function syncMistakes(userId, { items = [], deletions = [] }) {
  if (!Array.isArray(items) || !Array.isArray(deletions)) {
    throw new Error('items 和 deletions 必须是数组');
  }
  if (items.length > 2000 || deletions.length > 2000) {
    throw new Error('单次同步最多处理 2000 条记录');
  }

  return enqueue(async () => {
    const store = await load();
    const user = store.users[userId] || { mistakes: {}, tombstones: {} };
    store.users[userId] = user;

    for (const raw of items) {
      const item = sanitizeRecord(raw);
      const current = user.mistakes[item.id];
      const tombstone = user.tombstones[item.id];
      if (tombstone && tombstone >= item.updatedAt) continue;
      if (!current || current.updatedAt < item.updatedAt) {
        user.mistakes[item.id] = item;
        delete user.tombstones[item.id];
      }
    }

    for (const raw of deletions) {
      const id = String(raw?.id || '').slice(0, 160);
      if (!id) continue;
      const deletedAt = timestamp(raw.deletedAt, new Date().toISOString());
      const current = user.mistakes[id];
      if (!current || current.updatedAt <= deletedAt) {
        delete user.mistakes[id];
        if (!user.tombstones[id] || user.tombstones[id] < deletedAt) {
          user.tombstones[id] = deletedAt;
        }
      }
    }

    await persist();
    return {
      items: Object.values(user.mistakes).sort((a, b) =>
        String(b.updatedAt).localeCompare(String(a.updatedAt)),
      ),
      deletions: Object.entries(user.tombstones).map(([id, deletedAt]) => ({
        id,
        deletedAt,
      })),
      serverTime: new Date().toISOString(),
    };
  });
}

export function getDataDir() {
  return dataDir;
}

export async function resetStoreForTests() {
  cache = emptyStore();
  writeQueue = Promise.resolve();
}
