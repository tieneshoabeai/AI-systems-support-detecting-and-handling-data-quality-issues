import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ProjectsService } from '../src/modules/projects/application/projects.service';
import { PROJECT_REPOSITORY_PORT } from '../src/modules/projects/domain/ports/project.repository.port';
import { WORKSPACE_REPOSITORY_PORT } from '../src/modules/workspaces/domain/ports/workspace.repository.port';
import { USER_REPOSITORY_PORT } from '../src/modules/users/domain/ports/user.repository.port';
import { NotFoundException } from '@nestjs/common';

describe('ProjectsService (Quản lý Project & Ràng buộc 1 Project = 1 Dataset)', () => {
  let service: ProjectsService;
  let repository: Record<string, jest.Mock>;
  let workspacesPort: Record<string, jest.Mock>;

  const mockWorkspaceId = new Types.ObjectId().toHexString();
  const mockUserId = new Types.ObjectId().toHexString();
  const mockProjectId = new Types.ObjectId().toHexString();

  const mockProjectRecord = {
    id: mockProjectId,
    workspaceId: mockWorkspaceId,
    name: 'Customer Profiling Project',
    description: 'Data profiling for customers',
    hasDataset: false,
    status: 'not_started' as const,
    members: [{ userId: mockUserId, role: 'owner' as const, joinedAt: new Date() }],
    version: 3,
    lastAccessedAt: null,
    createdBy: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockResolvedValue(mockProjectRecord),
      findById: jest.fn().mockImplementation((id: string) => {
        if (id === mockProjectId) return Promise.resolve(mockProjectRecord);
        return Promise.resolve(null);
      }),
      findByWorkspace: jest.fn().mockResolvedValue([mockProjectRecord]),
      findByWorkspacePaged: jest.fn().mockResolvedValue({ items: [mockProjectRecord], total: 1 }),
      findOneByWorkspaceAndName: jest.fn().mockResolvedValue(null),
      updateById: jest.fn().mockResolvedValue(mockProjectRecord),
      softDelete: jest.fn().mockResolvedValue(true),
      setHasDataset: jest.fn().mockResolvedValue(true),
      setStatus: jest.fn().mockResolvedValue(true),
      markCompleted: jest.fn().mockResolvedValue(true),
      touchLastAccessed: jest.fn().mockResolvedValue(undefined),
      addMember: jest.fn().mockResolvedValue(true),
      removeMember: jest.fn().mockResolvedValue(true),
      updateMemberRole: jest.fn().mockResolvedValue(true),
      transferOwner: jest.fn().mockResolvedValue(true),
    };

    workspacesPort = {
      findById: jest.fn().mockResolvedValue({ id: mockWorkspaceId, name: 'WS' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PROJECT_REPOSITORY_PORT, useValue: repository },
        { provide: WORKSPACE_REPOSITORY_PORT, useValue: workspacesPort },
        { provide: USER_REPOSITORY_PORT, useValue: { findByEmail: jest.fn(), findById: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('createProject should initialize hasDataset to false', async () => {
    const result = await service.createProject(mockWorkspaceId, mockUserId, {
      name: 'Customer Profiling Project',
      description: 'Data profiling for customers',
    });

    expect(result).toBeDefined();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: mockWorkspaceId, name: 'Customer Profiling Project' }),
    );
  });

  it('getProjectsByWorkspace should verify workspace exists and return projects', async () => {
    const list = await service.getProjectsByWorkspace(mockWorkspaceId);
    expect(workspacesPort.findById).toHaveBeenCalledWith(mockWorkspaceId);
    expect(list).toHaveLength(1);
  });

  it('setHasDataset should toggle the hasDataset flag successfully', async () => {
    const success = await service.setHasDataset(mockProjectId, true);
    expect(success).toBe(true);
    expect(repository.setHasDataset).toHaveBeenCalledWith(mockProjectId, true);
  });

  it('deleteProject should soft delete the project', async () => {
    const success = await service.deleteProject(mockProjectId);
    expect(success).toBe(true);
    expect(repository.softDelete).toHaveBeenCalledWith(mockProjectId);
  });

  it('getProjectById should throw NotFoundException when project not found', async () => {
    const randomId = new Types.ObjectId().toHexString();
    await expect(service.getProjectById(randomId)).rejects.toThrow(NotFoundException);
  });

  it('createProject should reject duplicate name in workspace (PROJ-01)', async () => {
    (repository.findOneByWorkspaceAndName as jest.Mock).mockResolvedValueOnce(mockProjectRecord);
    await expect(
      service.createProject(mockWorkspaceId, mockUserId, { name: 'Customer Profiling Project' }),
    ).rejects.toThrow();
  });

  it('setHasDataset(true) should move status not_started -> in_progress', async () => {
    (repository.findById as jest.Mock).mockResolvedValue({ ...mockProjectRecord, status: 'not_started' });
    await service.setHasDataset(mockProjectId, true);
    expect(repository.setStatus).toHaveBeenCalledWith(mockProjectId, 'in_progress');
  });

  it('markCompleted should require in_progress status', async () => {
    (repository.findById as jest.Mock).mockResolvedValue({ ...mockProjectRecord, status: 'not_started' });
    await expect(service.markCompleted(mockProjectId)).rejects.toThrow();
    await expect(service.markCompleted(mockProjectId, 3)).rejects.toThrow();
    (repository.findById as jest.Mock).mockResolvedValue({ ...mockProjectRecord, status: 'in_progress' });
    await service.markCompleted(mockProjectId, 3);
    expect(repository.markCompleted).toHaveBeenCalledWith(mockProjectId, 3);
  });
});
