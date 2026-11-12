export const playStoreUrl = '';

export function getPlayStoreUrl(value = playStoreUrl) {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isSomaiListing =
      url.origin === 'https://play.google.com' &&
      url.pathname === '/store/apps/details' &&
      url.searchParams.get('id') === 'br.com.denny.somai';
    return isSomaiListing ? url.href : null;
  } catch {
    return null;
  }
}
