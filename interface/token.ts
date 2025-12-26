export default interface Token {
  access_token: string | null
  client_id: string | null
  client_secret: string | null
  scope: string | null
  refresh_token: string | null
  dtetme: string | null
  tenantid: string | null
  tenantname: string | null
  tenanttype: string | null
  jit: string | null
  companyid: number
  expires_at?: string
}
