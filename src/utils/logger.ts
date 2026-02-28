const isDev = import.meta.env.DEV;

export const log = {
  debug: (...args: any[]) => { if (isDev) console.debug('[debug]', ...args); },
  info: (...args: any[]) => { if (isDev) console.log('[info]', ...args); },
  warn: (...args: any[]) => { if (isDev) console.warn('[warn]', ...args); },
  error: (...args: any[]) => { console.error(...args); },
};
