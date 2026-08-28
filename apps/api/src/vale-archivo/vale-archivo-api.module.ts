import { DynamicModule, Module } from '@nestjs/common';
import { VALE_ARCHIVO_API_TOKENS, type ValeArchivoApiModuleDependencies } from './vale-archivo-api.contracts.js';
import { ValeArchivoApiProblemMapper } from './vale-archivo-api-errors.js';
import { ValeArchivoController } from './vale-archivo.controller.js';

@Module({})
export class ValeArchivoApiModule {
  static register(deps: ValeArchivoApiModuleDependencies): DynamicModule {
    return {
      module: ValeArchivoApiModule,
      controllers: [ValeArchivoController],
      providers: [
        ValeArchivoApiProblemMapper,
        { provide: VALE_ARCHIVO_API_TOKENS.requestContextResolver,   useValue: deps.requestContextResolver   },
        { provide: VALE_ARCHIVO_API_TOKENS.registrarVale,            useValue: deps.registrarVale            },
        { provide: VALE_ARCHIVO_API_TOKENS.consultarVale,            useValue: deps.consultarVale            },
        { provide: VALE_ARCHIVO_API_TOKENS.listarVales,              useValue: deps.listarVales              },
        { provide: VALE_ARCHIVO_API_TOKENS.iniciarBusqueda,          useValue: deps.iniciarBusqueda          },
        { provide: VALE_ARCHIVO_API_TOKENS.registrarLocalizacion,    useValue: deps.registrarLocalizacion    },
        { provide: VALE_ARCHIVO_API_TOKENS.registrarEntrega,         useValue: deps.registrarEntrega         },
        { provide: VALE_ARCHIVO_API_TOKENS.cerrarValeAdministrativo, useValue: deps.cerrarValeAdministrativo },
        { provide: VALE_ARCHIVO_API_TOKENS.generarPdfVale, useValue: deps.generarPdfVale },
      ],
    };
  }
}
