// Secrets Manager — barrel exports

export {
  getSecret,
  setSecret,
  deleteSecret,
  listSecrets,
  rotateSecret,
  checkExpiringSecrets,
  validateCredentials,
  registerVaultProvider,
  generateSecurityAudit,
} from "./secretsManager.js";
