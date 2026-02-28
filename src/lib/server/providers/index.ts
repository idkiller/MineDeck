import { loadConfig } from '../config';
import { DockerProvider } from './docker';
import { SystemdProvider } from './systemd';
import type { ServerProvider } from './types';

let provider: ServerProvider | null = null;

export function getProvider(): ServerProvider {
  if (provider) {
    return provider;
  }

  const config = loadConfig();
  provider =
    config.provider === 'docker'
      ? new DockerProvider(config.docker.containerName)
      : new SystemdProvider(config.systemd.serviceName);

  return provider;
}