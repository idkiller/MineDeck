import type { ServerProvider } from './types';
import { execCommand } from './exec';

export class DockerProvider implements ServerProvider {
  type: 'docker' = 'docker';

  constructor(private containerName: string) {}

  async restart(): Promise<void> {
    await execCommand('docker', ['restart', this.containerName]);
  }

  async logsTail(lines: number): Promise<string> {
    return execCommand('docker', ['logs', '--tail', String(lines), this.containerName]);
  }
}