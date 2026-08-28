import type {
  CerrarValeAdministrativo,
  GenerarPdfVale,
  ConsultarVale,
  IniciarBusqueda,
  ListarVales,
  RegistrarEntrega,
  RegistrarLocalizacion,
  RegistrarVale,
} from '@sigac/vale-archivo';
import type { RequestContext } from '@sigac/tenant';

export interface HttpRequestContext { readonly nativeRequest: unknown; }

export interface AuthenticatedRequestContextResolver {
  resolve(request: HttpRequestContext): Promise<RequestContext>;
}

export interface ValeArchivoApiModuleDependencies {
  readonly requestContextResolver: AuthenticatedRequestContextResolver;
  readonly registrarVale:            RegistrarVale;
  readonly consultarVale:            ConsultarVale;
  readonly listarVales:              ListarVales;
  readonly iniciarBusqueda:          IniciarBusqueda;
  readonly registrarLocalizacion:    RegistrarLocalizacion;
  readonly registrarEntrega:         RegistrarEntrega;
  readonly cerrarValeAdministrativo: CerrarValeAdministrativo;
  readonly generarPdfVale: GenerarPdfVale;
}

export const VALE_ARCHIVO_API_TOKENS = {
  requestContextResolver:    Symbol('ValeArchivoRequestContextResolver'),
  registrarVale:             Symbol('RegistrarVale'),
  consultarVale:             Symbol('ConsultarVale'),
  listarVales:               Symbol('ListarVales'),
  iniciarBusqueda:           Symbol('IniciarBusqueda'),
  registrarLocalizacion:     Symbol('RegistrarLocalizacion'),
  registrarEntrega:          Symbol('RegistrarEntrega'),
  cerrarValeAdministrativo:  Symbol('CerrarValeAdministrativo'),
  generarPdfVale:            Symbol('GenerarPdfVale'),
} as const;
