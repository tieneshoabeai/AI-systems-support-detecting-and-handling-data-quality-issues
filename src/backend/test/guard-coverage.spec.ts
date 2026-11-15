import { Reflector } from '@nestjs/core';
import { AppController } from '../src/app.controller';
import { AuthController } from '../src/modules/auth/infrastructure/http/auth.controller';
import { UsersController } from '../src/modules/users/infrastructure/http/users.controller';
import { WorkspacesController } from '../src/modules/workspaces/infrastructure/http/workspaces.controller';
import { ProjectsController } from '../src/modules/projects/infrastructure/http/projects.controller';
import { DatasetsController } from '../src/modules/datasets/infrastructure/http/datasets.controller';
import { DataViewController } from '../src/modules/data-view/infrastructure/http/data-view.controller';
import { AnalysisController } from '../src/modules/analysis/infrastructure/http/analysis.controller';
import { SummaryController } from '../src/modules/analysis/infrastructure/http/summary.controller';
import { ReportController } from '../src/modules/analysis/infrastructure/http/report.controller';
import { NotificationsController } from '../src/modules/notifications/infrastructure/http/notifications.controller';
import { IssuesController } from '../src/modules/issues/infrastructure/http/issues.controller';
import { FeedbackController } from '../src/modules/feedback/infrastructure/http/feedback.controller';
import { IS_PUBLIC_KEY } from '../src/shared/decorators/public.decorator';
import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';

describe('Architectural Guard Coverage (Zero-Trust Security)', () => {
  const reflector = new Reflector();
  const controllers = [
    AppController,
    AuthController,
    UsersController,
    WorkspacesController,
    ProjectsController,
    DatasetsController,
    DataViewController,
    AnalysisController,
    SummaryController,
    ReportController,
    NotificationsController,
    IssuesController,
    FeedbackController,
  ];

  it('every endpoint across all controllers must be explicitly guarded by JwtAuthGuard or decorated with @Public()', () => {
    const unprotectedRoutes: string[] = [];

    for (const controller of controllers) {
      const controllerName = controller.name;
      const classGuards: unknown[] = Reflect.getMetadata('__guards__', controller) || [];
      const isClassGuarded = classGuards.some(
        (g) =>
          g === JwtAuthGuard ||
          (typeof g === 'function' && g.name === 'JwtAuthGuard') ||
          (typeof g === 'object' && g !== null && 'name' in g && (g as { name?: string }).name === 'JwtAuthGuard')
      );
      const isClassPublic = reflector.get<boolean>(IS_PUBLIC_KEY, controller);

      const prototype = controller.prototype as unknown as Record<string, unknown>;
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (prop) => prop !== 'constructor' && typeof prototype[prop] === 'function'
      );

      for (const method of methodNames) {
        const handler = prototype[method];
        if (typeof handler !== 'function') continue;

        const isHttpEndpoint =
          Reflect.hasMetadata('path', handler) || Reflect.hasMetadata('method', handler);

        if (!isHttpEndpoint) continue;

        const isMethodPublic = reflector.get<boolean>(IS_PUBLIC_KEY, handler);
        const methodGuards: unknown[] = Reflect.getMetadata('__guards__', handler) || [];
        const isMethodGuarded = methodGuards.some(
          (g) =>
            g === JwtAuthGuard ||
            (typeof g === 'function' && g.name === 'JwtAuthGuard') ||
            (typeof g === 'object' && g !== null && 'name' in g && (g as { name?: string }).name === 'JwtAuthGuard')
        );

        const isSecured = isClassPublic || isMethodPublic || isClassGuarded || isMethodGuarded;

        if (!isSecured) {
          unprotectedRoutes.push(`${controllerName}.${method}()`);
        }
      }
    }

    if (unprotectedRoutes.length > 0) {
      throw new Error(
        `Lỗ hổng bảo mật kiến trúc! Các endpoint sau chưa được bảo vệ bằng JwtAuthGuard hoặc @Public():\n${unprotectedRoutes.join(
          '\n'
        )}`
      );
    }

    expect(unprotectedRoutes).toHaveLength(0);
  });
});
