export interface ServerStatusResponse {
  online: boolean;
  ip: string;
  port: number;
  playersOnline: number;
  playersMax: number;
  version: string;
  motd: string;
  source: 'live_api' | 'configured_fallback' | 'manual';
  lastUpdated: string;
}

interface CachedStatus {
  data: ServerStatusResponse;
  expiresAt: number;
}

let statusCache: CachedStatus | null = null;

export async function fetchMinecraftServerStatus(config: {
  serverIp: string;
  serverPort: number;
  mode: string;
  manualOnline: boolean;
  manualPlayersOnline: number;
  manualPlayersMax: number;
}): Promise<ServerStatusResponse> {
  const now = Date.now();
  if (
    statusCache &&
    statusCache.expiresAt > now &&
    statusCache.data.ip === config.serverIp &&
    config.mode !== 'manual'
  ) {
    return statusCache.data;
  }

  if (config.mode === 'manual') {
    return {
      online: config.manualOnline,
      ip: config.serverIp,
      port: config.serverPort,
      playersOnline: config.manualOnline ? config.manualPlayersOnline : 0,
      playersMax: config.manualPlayersMax,
      version: 'Java & Bedrock 1.20.4–1.21.x',
      motd: 'OwnVerse Network — Season IV Citadel',
      source: 'manual',
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3200);
    const target =
      config.serverPort && config.serverPort !== 25565
        ? `${config.serverIp}:${config.serverPort}`
        : config.serverIp;

    const res = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(target)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OwnVerseStore/1.0 (+https://ownverse.mc)',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const json = (await res.json()) as any;
      if (json && typeof json.online === 'boolean' && json.online) {
        const liveData: ServerStatusResponse = {
          online: true,
          ip: config.serverIp,
          port: config.serverPort,
          playersOnline: json.players?.online ?? config.manualPlayersOnline,
          playersMax: json.players?.max ?? config.manualPlayersMax,
          version: json.version || '1.21.x',
          motd: json.motd?.clean?.[0] || 'OwnVerse Network',
          source: 'live_api',
          lastUpdated: new Date().toISOString(),
        };
        statusCache = { data: liveData, expiresAt: now + 30_000 };
        return liveData;
      } else if (config.mode === 'live_api') {
        const offlineData: ServerStatusResponse = {
          online: false,
          ip: config.serverIp,
          port: config.serverPort,
          playersOnline: 0,
          playersMax: config.manualPlayersMax,
          version: 'Offline',
          motd: 'Server unreachable via public status API',
          source: 'live_api',
          lastUpdated: new Date().toISOString(),
        };
        statusCache = { data: offlineData, expiresAt: now + 15_000 };
        return offlineData;
      }
    }
  } catch {
    // Fallback handled below
  }

  const fallback: ServerStatusResponse = {
    online: config.manualOnline,
    ip: config.serverIp,
    port: config.serverPort,
    playersOnline: config.manualOnline ? config.manualPlayersOnline : 0,
    playersMax: config.manualPlayersMax,
    version: 'Java & Bedrock 1.21.x',
    motd: 'OwnVerse Network — Season IV Citadel',
    source: 'configured_fallback',
    lastUpdated: new Date().toISOString(),
  };

  statusCache = { data: fallback, expiresAt: now + 20_000 };
  return fallback;
}
