import { getStore } from '@netlify/blobs';
import { handler } from '../../lib/couple.mjs';

export default handler(() => getStore({ name: 'somai-casal-v1', consistency: 'strong' }));

export const config = {
  path: ['/health', '/v1/:room', '/v1/:room/:operation'],
  rateLimit: { aggregateBy: 'ip', windowLimit: 240, windowSize: 60, action: 'rate_limit' },
};
