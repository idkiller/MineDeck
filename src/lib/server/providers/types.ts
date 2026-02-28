export interface ServerProvider {
  type: 'docker' | 'systemd';
  restart(): Promise<void>;
  logsTail(lines: number): Promise<string>;
}