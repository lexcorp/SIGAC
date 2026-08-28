/**
 * Application layer — Vale Archivo
 *
 * Exporta ports, use cases y errores de aplicación.
 * T-32: VA-001 (RegistrarVale), VA-003 (ConsultarVale), VA-004 (ListarVales + IniciarBusqueda)
 * T-33: RegistrarLocalizacion, RegistrarEntrega, CerrarValeAdministrativo, GenerarPdfVale
 */

// Errors
export { ApplicationError, type ApplicationErrorCode } from './ApplicationError.js';

// Ports
export type { ValeArchivoRepository } from './ports/ValeArchivoRepository.js';
export type {
  ValeBatchUnitOfWork,
  ValeBatchTransaction,
  ValeBatchSourceIdentity,
  ValeBatchIdempotencyKey,
  ValeBatchTraceSnapshot,
  ValeBatchItemTraceSnapshot,
  ExistingGeneratedVale,
} from './ports/ValeBatchUnitOfWork.js';
export type {
  ValeArchivoQueryPort,
  ValeArchivoSummary,
  ValeArchivoPage,
  ValeArchivoPageFilter,
} from './ports/ValeArchivoQueryPort.js';

// Use cases — T-32
export {
  RegistrarVale,
  type RegistrarValeCommand,
  type RegistrarValeItemInput,
  type RegistrarValeResult,
  type RegistrarValeDeps,
} from './use-cases/RegistrarVale.js';

export {
  GenerateValeBatch,
  type GenerateValeBatchCommand,
  type GenerateValeBatchGroup,
  type GenerateValeBatchResult,
  type GenerateValeBatchDependencies,
} from './use-cases/GenerateValeBatch.js';

export {
  ConsultarVale,
  type ConsultarValeQuery,
  type ConsultarValeDeps,
} from './use-cases/ConsultarVale.js';

export {
  ListarVales,
  type ListarValesQuery,
  type ListarValesDeps,
} from './use-cases/ListarVales.js';

export {
  IniciarBusqueda,
  type IniciarBusquedaCommand,
  type IniciarBusquedaDeps,
} from './use-cases/IniciarBusqueda.js';

// Use cases — T-33 completados
export {
  RegistrarLocalizacion,
  type RegistrarLocalizacionCommand,
  type RegistrarLocalizacionDeps,
} from './use-cases/RegistrarLocalizacion.js';

export {
  RegistrarEntrega,
  type RegistrarEntregaCommand,
  type RegistrarEntregaDeps,
} from './use-cases/RegistrarEntrega.js';

export {
  CerrarValeAdministrativo,
  type CerrarValeAdministrativoCommand,
  type CerrarValeAdministrativoDeps,
} from './use-cases/CerrarValeAdministrativo.js';

// Port — T-35
export type {
  ValeArchivoReportGeneratorPort,
  ValeArchivoReportResult,
} from './ports/ValeArchivoReportGeneratorPort.js';

// Use case — T-35
export {
  GenerarPdfVale,
  type GenerarPdfValeQuery,
  type GenerarPdfValeDeps,
} from './use-cases/GenerarPdfVale.js';
