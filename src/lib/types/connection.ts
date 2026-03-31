export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  password?: string;
  password_stored?: boolean;
  username?: string;
  db: number;
  ssl: boolean;
  ssh_tunnel: boolean;
  ssh_host?: string;
  ssh_port?: number;
  ssh_user?: string;
  cluster: boolean;
  sentinel: boolean;
  sentinel_master?: string;
}

export interface ConnectionState {
  id: string;
  connected: boolean;
  latency?: number;
  error?: string;
}
