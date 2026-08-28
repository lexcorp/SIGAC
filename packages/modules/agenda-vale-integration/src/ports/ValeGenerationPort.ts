import type { RequestContext } from '@sigac/tenant';
import type {
  ValeGenerationBatchCommand,
  ValeGenerationBatchResult,
} from '../contracts/ValeGenerationResult.js';

/**
 * ACL target: confirma el batch sin exponer Aggregate, Repository, UnitOfWork o DB.
 */
export interface ValeGenerationPort {
  generateBatch(
    command: ValeGenerationBatchCommand,
    context: RequestContext,
  ): Promise<ValeGenerationBatchResult>;
}
