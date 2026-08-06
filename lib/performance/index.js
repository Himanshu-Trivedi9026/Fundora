// Performance — barrel exports

export {
  configurePool,
  acquireConnection,
  releaseConnection,
  getPoolStats,
  resetPoolMetrics,
  trackQuery,
  setSlowQueryThreshold,
  trackEndpoint,
  getEndpointMetrics,
  resetEndpointMetrics,
  checkDatabaseHealth,
  persistPoolMetrics,
} from "./poolManager.js";
