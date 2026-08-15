import { Controller, Get, Param } from '@nestjs/common';

@Controller('expedientes')
export class ExpedientesController {
  @Get(':id')
  getById(@Param('id') id: string) {
    // Bootstrap placeholder: wire to GetExpediente use case in first vertical slice.
    return {
      id,
      status: 'BOOTSTRAP_PLACEHOLDER',
      message: 'Implement SPEC-009 / UC-018 before production use.',
    };
  }
}
