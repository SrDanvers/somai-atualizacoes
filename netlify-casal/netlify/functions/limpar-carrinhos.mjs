import { getStore } from '@netlify/blobs';
import { removeExpired } from '../../lib/couple.mjs';

export default async () => {
  await removeExpired(getStore({ name: 'somai-casal-v1', consistency: 'strong' }));
  return new Response(null, { status: 204 });
};

export const config = { schedule: '*/15 * * * *' };
