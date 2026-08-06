// Core AI Engine
export {
  completeAIRequest,
  getAIConfig,
  updateAIConfig,
  sanitizeAIOutput,
} from "./aiEngine.js";
export {
  getPromptTemplate,
  createPromptTemplate,
  listPromptTemplates,
  renderPrompt,
} from "./promptEngine.js";
export {
  buildCampaignContext,
  buildUserContext,
  buildDonorContext,
  buildPlatformContext,
  buildConversationContext,
} from "./contextBuilder.js";
export {
  createConversation,
  addMessage,
  getConversationHistory,
  getConversationContext,
  archiveConversation,
  COPILOT_TYPES,
} from "./conversationMemory.js";
export {
  createEmbedding,
  batchCreateEmbeddings,
  searchEmbeddings,
  deleteEmbeddings,
  refreshEmbeddings,
} from "./embeddingEngine.js";
export {
  indexKnowledgeArticle,
  searchKnowledge,
  getRelevantContext,
  chunkDocument,
  manageKnowledgeArticle,
} from "./knowledgeEngine.js";
export {
  getDonorRecommendations,
  getCampaignDonorSuggestions,
  getSimilarCampaigns,
  getTrendingCampaigns,
  getCreatorRecommendations,
  invalidateRecommendationCache,
} from "./recommendationEngine.js";
export {
  predictCampaignSuccess,
  predictFundingTimeline,
  predictDonationVelocity,
  predictFailureRisk,
  predictRefundProbability,
  predictMilestoneCompletion,
  predictCreatorGrowth,
  batchPredict,
} from "./predictionEngine.js";
export {
  scoreCampaignQuality,
  suggestCampaignTitles,
  improveCampaignDescription,
  recommendFundingGoal,
  predictCategory,
  observeCampaignRisk,
  generateSEOSuggestions,
  analyzeCompleteness,
  batchQualityCheck,
} from "./campaignAI.js";
export {
  askCopilot,
  getDashboardSummary,
  explainAnalytics,
  getWorkflowGuidance,
  getSuggestions,
} from "./copilotEngine.js";

// Provider infrastructure
export {
  registerModelProvider,
  getActiveModelProvider,
  setActiveModelProvider,
  listModelProviders,
  initializeModelProviders,
  BaseModelProvider,
} from "./providerRegistry.js";
export {
  trackTokenUsage,
  getUserUsage,
  getUsageStats,
  checkUsageLimit,
  MODEL_COSTS,
} from "./tokenTracker.js";
export {
  recordAICost,
  getCostSummary,
  getPlatformAICosts,
  checkCostBudget,
} from "./costTracker.js";
export {
  routeModel,
  getRouterConfig,
  getProviderHealth,
} from "./modelRouter.js";
