export interface ProviderCommandStatus {
  ok: boolean;
  message: string;
}

export interface ProviderCommandResult {
  output: string;
  message: string;
}

export interface ServerProvider {
  type: 'docker' | 'systemd';
  restart(): Promise<void>;
  logsTail(lines: number): Promise<string>;
  commandStatus(): Promise<ProviderCommandStatus>;
  runCommand(command: string): Promise<ProviderCommandResult>;
}
