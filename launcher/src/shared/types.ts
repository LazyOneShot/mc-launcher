export interface ModpackMeta {
  id: string
  name: string
  description: string
  mc_version: string
  loader: 'forge' | 'neoforge' | 'fabric'
  loader_version: string
  owner: string
  default_server_ip: string
  default_server_port: number
  created_at: string
  updated_at: string
}

export interface Mod {
  id: string
  filename: string
  sha256: string
  size_bytes: number
  download_url: string
  uploaded_at: string
}

export interface ModpackFull extends ModpackMeta {
  mods: Mod[]
}

export interface AuthTokens {
  access_token: string
  mc_access_token: string
  mc_expires_at: number
  minecraft_username: string
  minecraft_uuid: string
  ms_home_account_id?: string
}
