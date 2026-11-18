/**
 * DatasetPolicyLoader — Loader tài nguyên cho `@PolicyResource('Dataset', ...)`.
 *
 * Nạp dataset theo id để `PoliciesGuard` kiểm tra quyền ở TẦNG ĐỘNG
 * (instance check) — chặn IDOR trên dataset của project khác.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  DATASET_REPOSITORY_PORT,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';

@Injectable()
export class DatasetPolicyLoader {
  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
  ) {}

  async load(id: string): Promise<unknown> {
    return this.datasets.findById(id);
  }
}
