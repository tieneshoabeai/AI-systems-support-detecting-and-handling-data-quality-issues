import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { WorkspacesService } from '../src/modules/workspaces/workspaces.service';
import { WorkspacesRepository } from '../src/modules/workspaces/workspaces.repository';
import { UsersService } from '../src/modules/users/users.service';
import { IWorkspace } from '../src/modules/workspaces/schemas/workspace.schema';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('WorkspacesService (CRUD & Phân quyền Thành viên)', () => {
  let service: WorkspacesService;
  let repository: jest.Mocked<Partial<WorkspacesRepository>>;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const mockAdminUser = {
    userId: new Types.ObjectId().toHexString(),
    email: 'admin@shool.local',
    role: 'admin' as const,
  };

  const mockAnalystUser = {
    userId: new Types.ObjectId().toHexString(),
    email: 'analyst@shool.local',
    role: 'analyst' as const,
  };

  const mockWorkspaceId = new Types.ObjectId();
  const mockWorkspaceDoc = {
    _id: mockWorkspaceId,
    name: 'Research Workspace',
    description: 'Workspace for QA research',
    owner_id: new Types.ObjectId(mockAdminUser.userId),
    members: [
      {
        user_id: new Types.ObjectId(mockAdminUser.userId),
        role: 'owner' as const,
        joined_at: new Date(),
      },
    ],
    deleted_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as IWorkspace;

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockResolvedValue(mockWorkspaceDoc),
      findById: jest.fn().mockImplementation((id: string | Types.ObjectId) => {
        if (id.toString() === mockWorkspaceId.toString()) {
          return Promise.resolve(mockWorkspaceDoc);
        }
        return Promise.resolve(null);
      }),
      findByUser: jest.fn().mockResolvedValue([mockWorkspaceDoc]),
      findAllActive: jest.fn().mockResolvedValue([mockWorkspaceDoc]),
      updateById: jest.fn().mockResolvedValue(mockWorkspaceDoc),
      softDelete: jest.fn().mockResolvedValue(true),
      addMember: jest.fn().mockResolvedValue(true),
      removeMember: jest.fn().mockResolvedValue(true),
    };

    usersService = {
      findByEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: WorkspacesRepository, useValue: repository },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it('createWorkspace should initialize creator as owner in members list', async () => {
    const result = await service.createWorkspace(mockAdminUser.userId, {
      name: 'Research Workspace',
      description: 'Workspace for QA research',
    });

    expect(result).toBeDefined();
    expect(repository.create).toHaveBeenCalled();
  });

  it('getWorkspaces should return all active workspaces for admin and filtered for analyst', async () => {
    const adminWorkspaces = await service.getWorkspaces(mockAdminUser);
    expect(repository.findAllActive).toHaveBeenCalled();
    expect(adminWorkspaces).toHaveLength(1);

    const analystWorkspaces = await service.getWorkspaces(mockAnalystUser);
    expect(repository.findByUser).toHaveBeenCalledWith(mockAnalystUser.userId);
    expect(analystWorkspaces).toHaveLength(1);
  });

  it('addMember should add new member with role and reject duplicate members', async () => {
    const newUserId = new Types.ObjectId();
    usersService.findByEmail = jest.fn().mockResolvedValue({
      _id: newUserId,
      email: 'collaborator@shool.local',
    });

    await service.addMember(mockWorkspaceId.toHexString(), {
      email: 'collaborator@shool.local',
      role: 'editor',
    });

    expect(repository.addMember).toHaveBeenCalled();

    // Thử thêm lại chính user đã là thành viên (admin)
    usersService.findByEmail = jest.fn().mockResolvedValue({
      _id: new Types.ObjectId(mockAdminUser.userId),
      email: mockAdminUser.email,
    });

    await expect(
      service.addMember(mockWorkspaceId.toHexString(), {
        email: mockAdminUser.email,
        role: 'viewer',
      })
    ).rejects.toThrow(ConflictException);
  });

  it('removeMember should reject removing original workspace owner', async () => {
    await expect(
      service.removeMember(mockWorkspaceId.toHexString(), mockAdminUser.userId)
    ).rejects.toThrow(BadRequestException);
  });

  it('deleteWorkspace should soft delete workspace', async () => {
    const success = await service.deleteWorkspace(mockWorkspaceId.toHexString());
    expect(success).toBe(true);
    expect(repository.softDelete).toHaveBeenCalledWith(mockWorkspaceId.toHexString());
  });

  it('getWorkspaceById should throw NotFoundException for non-existent workspace', async () => {
    const randomId = new Types.ObjectId().toHexString();
    await expect(service.getWorkspaceById(randomId)).rejects.toThrow(NotFoundException);
  });
});
