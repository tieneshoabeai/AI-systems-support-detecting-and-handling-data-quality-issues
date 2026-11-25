import { RequestMethod } from '@nestjs/common';
import { AnalysisController } from '../src/modules/analysis/infrastructure/http/analysis.controller';

describe('Analysis config API contract', () => {
  it('exposes PUT as the canonical route and keeps POST as deprecated compatibility', () => {
    const canonical = AnalysisController.prototype.saveConfig;
    const legacy = AnalysisController.prototype.saveConfigLegacy;
    expect(Reflect.getMetadata('path', canonical)).toBe('projects/:projectId/analysis/config');
    expect(Reflect.getMetadata('method', canonical)).toBe(RequestMethod.PUT);
    expect(Reflect.getMetadata('path', legacy)).toBe('projects/:projectId/analysis/config');
    expect(Reflect.getMetadata('method', legacy)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata('swagger/apiOperation', legacy)?.deprecated).toBe(true);
  });
});