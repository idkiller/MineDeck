import type { PageServerLoad } from './$types';
import { getProvider } from '$lib/server/providers';

export const load: PageServerLoad = async ({ url }) => {
  const requested = Number(url.searchParams.get('lines') ?? '200');
  const lines = Number.isFinite(requested) ? Math.max(50, Math.min(2000, requested)) : 200;

  let logs = '';
  try {
    logs = await getProvider().logsTail(lines);
  } catch (error: any) {
    logs = `Unable to fetch logs: ${error?.message ?? 'unknown error'}`;
  }

  return {
    lines,
    logs,
    refreshedAt: new Date().toISOString()
  };
};