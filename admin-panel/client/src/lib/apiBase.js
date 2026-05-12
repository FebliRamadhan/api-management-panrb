// Resolve API base URL relatif terhadap Vite base path.
// - Dev (base '/')              → '/api'
// - Prod (base '/wso2-admin/')  → '/wso2-admin/api'
// Nginx prod.conf strip prefix '/wso2-admin/' → admin-panel tetap menerima '/api/*'.
const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
export const API_BASE = `${base}/api`;
