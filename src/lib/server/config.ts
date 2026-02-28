import fs from 'node:fs';
import path from 'node:path';

export type ProviderType = 'docker' | 'systemd';

export interface AppConfig {
  dataRoot: string;
  provider: ProviderType;
  docker: {
    containerName: string;
  };
  systemd: {
    serviceName: string;
  };
  rcon: {
    host: string;
    port?: number;
    password?: string;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  dataRoot: '/opt/mc-data',
  provider: 'docker',
  docker: {
    containerName: 'mc-bedrock'
  },
  systemd: {
    serviceName: 'bedrock-server'
  },
  rcon: {
    host: '127.0.0.1'
  }
};

let configCache: AppConfig | null = null;

function parseFileConfig(filePath: string): Partial<AppConfig> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<AppConfig>;
  return parsed;
}

function mergeConfig(base: AppConfig, overrides: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...overrides,
    docker: {
      ...base.docker,
      ...(overrides.docker ?? {})
    },
    systemd: {
      ...base.systemd,
      ...(overrides.systemd ?? {})
    },
    rcon: {
      ...base.rcon,
      ...(overrides.rcon ?? {})
    }
  };
}

export function loadConfig(): AppConfig {
  if (configCache) {
    return configCache;
  }

  const configPath = process.env.PANEL_CONFIG_PATH
    ? path.resolve(process.env.PANEL_CONFIG_PATH)
    : path.resolve(process.cwd(), 'config/panel.config.json');

  const fileConfig = parseFileConfig(configPath);
  let config = mergeConfig(DEFAULT_CONFIG, fileConfig);

  if (process.env.MINEDECK_DATA_ROOT) {
    config.dataRoot = process.env.MINEDECK_DATA_ROOT;
  }

  if (process.env.MINEDECK_PROVIDER === 'docker' || process.env.MINEDECK_PROVIDER === 'systemd') {
    config.provider = process.env.MINEDECK_PROVIDER;
  }

  if (process.env.MINEDECK_DOCKER_CONTAINER) {
    config.docker.containerName = process.env.MINEDECK_DOCKER_CONTAINER;
  }

  if (process.env.MINEDECK_SYSTEMD_SERVICE) {
    config.systemd.serviceName = process.env.MINEDECK_SYSTEMD_SERVICE;
  }

  if (process.env.MINEDECK_RCON_HOST) {
    config.rcon.host = process.env.MINEDECK_RCON_HOST;
  }

  if (process.env.MINEDECK_RCON_PORT) {
    const port = Number(process.env.MINEDECK_RCON_PORT);
    if (!Number.isNaN(port)) {
      config.rcon.port = port;
    }
  }

  if (process.env.MINEDECK_RCON_PASSWORD) {
    config.rcon.password = process.env.MINEDECK_RCON_PASSWORD;
  }

  config.dataRoot = path.resolve(config.dataRoot);
  configCache = config;
  return config;
}