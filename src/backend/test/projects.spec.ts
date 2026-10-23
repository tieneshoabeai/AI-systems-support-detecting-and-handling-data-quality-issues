import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ProjectsService } from '../src/modules/projects/projects.service';
import { ProjectsRepository } from '../src/modules/projects/projects.repository';
import { WorkspacesService } from '../src/modules/workspaces/workspaces.service';
import { IProject } from '../src/modules/projects/schemas/project.schema';
import { NotFoundException } from '@nestjs/common';

describe('ProjectsService (Quản lý Project & Ràng buộc 1 Project = 1 Dataset)', () => {
  let service: ProjectsService;
  let repository: jest.Mocked<Partial<ProjectsRepository>>;
  let workspacesService: jest.Mocked<Partial<WorkspacesService>>;

  const mockWorkspaceId = new Types.ObjectId();
  const mockUserId = new Types.ObjectId();
  const mockProjectId = new Types.ObjectId();

  const mockProjectDoc = {
    _id: mockProjectId,
    workspace_id: mockWorkspaceId,
    name: 'Customer Profiling Project',
    description: 'Data profiling for customers',
    has_dataset: false,
    created_by: mockUserId,
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as IProject;

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockResolvedValue(mockProjectDoc),
      findById: jest.fn().mockImplementation((id: string | Types.ObjectId) => {
        if (id.toString() === mockProjectId.toString()) {
          return Promise.resolve(mockProjectDoc);
        }
        return Promise.resolve(null);
      }),
      findByWorkspace: jest.fn().mockResolvedValue([mockProjectDoc]),
      updateById: jest.fn().mockResolvedValue(mockProjectDoc),
      softDelete: jest.fn().mockResolvedValue(true),
      setHasDataset: jest.fn().mockResolvedValue(true),
    };

    workspacesService = {
      getWorkspaceById: jest.fn().mockResolvedValue({ _id: mockWorkspaceId } as never),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: ProjectsRepository, useValue: repository },
        { provide: WorkspacesService, useValue: workspacesService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('createProject should initialize has_dataset to false', async () => {
    const result = await service.createProject(
      mockWorkspaceId.toHexString(),
      mockUserId.toHexString(),
      {
        name: 'Customer Profiling Project',
        description: 'Data profiling for customers',
      }
    );

    expect(result).toBeDefined();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        has_dataset: false,
      })
    );
  });

  it('getProjectsByWorkspace should verify workspace exists and return projects', async () => {
    const list = await service.getProjectsByWorkspace(mockWorkspaceId.toHexString());
    expect(workspacesService.getWorkspaceById).toHaveBeenCalledWith(mockWorkspaceId.toHexString());
    expect(list).toHaveLength(1);
  });

  it('setHasDataset should toggle the has_dataset flag successfully', async () => {
    const success = await service.setHasDataset(mockProjectId.toHexString(), true);
    expect(success).toBe(true);
    expect(repository.setHasDataset).toHaveBeenCalledWith(mockProjectId.toHexString(), true);
  });

  it('deleteProject should soft delete the project', async () => {
    const success = await service.deleteProject(mockProjectId.toHexString());
    expect(success).toBe(true);
    expect(repository.softDelete).toHaveBeenCalledWith(mockProjectId.toHexString());
  });

  it('getProjectById should throw NotFoundException when project not found', async () => {
    const randomId = new Types.ObjectId().toHexString();
    await expect(service.getProjectById(randomId)).rejects.toThrow(NotFoundException);
  });
});
