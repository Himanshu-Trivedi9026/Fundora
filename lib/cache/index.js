// Cache Engine — barrel exports

export {
  get,
  set,
  del,
  getOrSet,
  invalidatePattern,
  clear,
  getStats,
  acquireLock,
  releaseLock,
  isLocked,
  checkRateLimit,
  resetRateLimit,
  cleanupExpiredCache,
} from "./cacheEngine.js";
