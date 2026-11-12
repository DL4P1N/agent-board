// Thin wrapper so the UI has one place to get difficulty->config and the model catalogue.
import type { AgentConfig, Provider } from '../types';
import { MODEL_LIST, configForDifficulty } from '../sim/difficulty';

export { configForDifficulty };

export interface ModelOption { model: string; tier: string; provider: Provider; label: string }

export const allModels = (): ModelOption[] => MODEL_LIST.map((m) => ({ model: m.model, tier: m.tier, provider: m.provider, label: m.label }));
export const modelsFor = (p: Provider): ModelOption[] => allModels().filter((m) => m.provider === p);
export const findModel = (model: string): ModelOption | undefined => allModels().find((m) => m.model === model);
export const EFFORTS: AgentConfig['effort'][] = ['low', 'medium', 'high', 'max'];
