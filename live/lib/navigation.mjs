const globalPages = new Set(['players', 'history', 'settings', 'music']);
const gamePages = new Set(['activity', 'settlements']);
export function readRoute(pathname = '/') {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return {page: 'overview', sessionId: ''};
  if (parts[0] === 'games' && parts[1] && parts.length <= 3) {
    let sessionId;
    try { sessionId = decodeURIComponent(parts[1]); } catch { return {page: 'missing', sessionId: ''}; }
    if (!parts[2] || gamePages.has(parts[2])) return {page: parts[2] || 'game', sessionId};
  }
  if (parts.length === 1 && parts[0] === 'settlements') return {page: 'owed', sessionId: ''};
  if (parts.length === 1 && (globalPages.has(parts[0]) || parts[0] === 'games')) return {page: parts[0] === 'games' ? 'history' : parts[0], sessionId: ''};
  return {page: 'missing', sessionId: ''};
}
export function routePath(page, sessionId = '') {
  if (page === 'overview') return '/';
  if (page === 'history') return '/games';
  if (page === 'owed') return '/settlements';
  if (page === 'game' || gamePages.has(page)) return sessionId ? `/games/${encodeURIComponent(sessionId)}${page === 'game' ? '' : `/${page}`}` : '/games';
  return `/${page}`;
}
