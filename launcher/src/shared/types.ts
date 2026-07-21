export interface ModpackServer {
  id: string
  pack_id: string
  name: string
  host: string
  port: number
  sort_order: number
}

export interface ModpackMeta {
  id: string
  name: string
  description: string
  mc_version: string
  loader: 'forge' | 'neoforge' | 'fabric'
  loader_version: string
  owner: string
  owner_username: string
  visibility: 'public' | 'private'
  join_mode: 'open' | 'request'
  created_at: string
  updated_at: string
  my_role?: string
  pending_request_count?: number
}

export interface MyJoinRequest {
  id: string
  pack_id: string
  pack_name: string
  created_at: string
}

export interface PublicPack {
  id: string
  name: string
  description: string
  mc_version: string
  loader: string
  owner_username: string
  join_mode: 'open' | 'request'
}

export interface JoinRequest {
  id: string
  pack_id: string
  minecraft_uuid: string
  minecraft_username: string
  created_at: string
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
  servers: ModpackServer[]
}

export interface AuditEntry {
  id: string
  pack_id: string
  actor_uuid: string
  actor_username: string
  action: string
  target: string
  detail: string
  created_at: string
}

export interface UpdateCandidate {
  mod_id: string
  current_filename: string
  new_filename: string
  new_version_number: string
  new_version_type: string
  url: string
  size: number
}

export interface CheckUpdatesResponse {
  checked: number
  unmatched: number
  updates: UpdateCandidate[]
}

export interface BannedUser {
  id: string
  minecraft_uuid: string
  minecraft_username: string
  reason: string
  created_at: string
}

export interface Report {
  id: string
  pack_id: string
  pack_name: string
  reported_uuid?: string
  reported_username?: string
  reporter_uuid: string
  reporter_username: string
  reason: string
  status: 'open' | 'resolved' | 'dismissed'
  created_at: string
}

export interface AuthTokens {
  access_token: string
  mc_access_token: string
  mc_expires_at: number
  minecraft_username: string
  minecraft_uuid: string
  ms_home_account_id?: string
}
