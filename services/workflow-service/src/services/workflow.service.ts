import { ProjectRepository } from '../repositories/project.repository';
import { TaskRepository } from '../repositories/task.repository';
import { CacheRepository } from '../repositories/cache.repository';
import { EventPublisher } from '../events/event-publisher';
import {
  createEvent,
  ProjectCreatedEventSchema,
  ProjectArchivedEventSchema,
  TaskCreatedEventSchema,
  TaskUpdatedEventSchema,
  TaskAssignedEventSchema,
  TaskStatusChangedEventSchema,
} from '@microservice-learning/events';
import { getCorrelationId } from '@microservice-learning/observability';
import {
  CreateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
} from '../types/workflow.types';

export class WorkflowService {
  constructor(
    private projectRepository: ProjectRepository,
    private taskRepository: TaskRepository,
    private cacheRepository: CacheRepository,
    private eventPublisher: EventPublisher
  ) {}

  async createProject(
    input: CreateProjectInput,
    correlationId?: string
  ) {
    // Check entitlements
    const entitlements = await this.cacheRepository.getEntitlements(input.organizationId);
    
    if (entitlements) {
      const currentCount = await this.projectRepository.countByOrganization(input.organizationId);
      if (entitlements.maxProjects && currentCount >= entitlements.maxProjects) {
        throw new Error('Project limit reached for this organization');
      }
    }

    const project = await this.projectRepository.create(input);

    // Publish event
    const event = createEvent(
      'ProjectCreated',
      'v1',
      {
        organizationId: input.organizationId,
        projectId: project.id,
        name: project.name,
        createdBy: project.createdBy,
        createdAt: project.createdAt.toISOString(),
      },
      {
        source: 'workflow-service',
        correlationId: correlationId || getCorrelationId(),
        userId: project.createdBy,
        organizationId: input.organizationId,
      }
    );

    await this.eventPublisher.publish('workflow.project.created', event);

    return project;
  }

  async archiveProject(
    projectId: string,
    archivedBy: string,
    correlationId?: string
  ) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const archived = await this.projectRepository.archive(projectId);

    // Publish event
    const event = createEvent(
      'ProjectArchived',
      'v1',
      {
        organizationId: project.organizationId,
        projectId: project.id,
        archivedBy,
        archivedAt: archived.archivedAt!.toISOString(),
      },
      {
        source: 'workflow-service',
        correlationId: correlationId || getCorrelationId(),
        userId: archivedBy,
        organizationId: project.organizationId,
      }
    );

    await this.eventPublisher.publish('workflow.project.archived', event);

    return archived;
  }

  async createTask(
    input: CreateTaskInput,
    correlationId?: string
  ) {
    // Verify project exists and user has access
    const project = await this.projectRepository.findById(input.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (project.organizationId !== input.organizationId) {
      throw new Error('Project does not belong to this organization');
    }

    // Check entitlements
    const entitlements = await this.cacheRepository.getEntitlements(input.organizationId);
    
    if (entitlements) {
      const currentCount = await this.taskRepository.countByOrganization(input.organizationId);
      if (entitlements.maxTasks && currentCount >= entitlements.maxTasks) {
        throw new Error('Task limit reached for this organization');
      }
    }

    const task = await this.taskRepository.create(input);

    // Publish event
    const event = createEvent(
      'TaskCreated',
      'v1',
      {
        organizationId: input.organizationId,
        projectId: input.projectId,
        taskId: task.id,
        title: task.title,
        createdBy: task.createdBy,
        createdAt: task.createdAt.toISOString(),
      },
      {
        source: 'workflow-service',
        correlationId: correlationId || getCorrelationId(),
        userId: task.createdBy,
        organizationId: input.organizationId,
      }
    );

    await this.eventPublisher.publish('workflow.task.created', event);

    return task;
  }

  async updateTask(
    taskId: string,
    input: UpdateTaskInput,
    updatedBy: string,
    correlationId?: string
  ) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const oldStatus = task.status;
    const updated = await this.taskRepository.update(taskId, input);

    // Track what fields were updated
    const updatedFields: string[] = [];
    if (input.title !== undefined) updatedFields.push('title');
    if (input.description !== undefined) updatedFields.push('description');
    if (input.status !== undefined) updatedFields.push('status');
    if (input.assignedTo !== undefined) updatedFields.push('assignedTo');

    // Publish TaskUpdated event
    const updatedEvent = createEvent(
      'TaskUpdated',
      'v1',
      {
        organizationId: task.organizationId,
        projectId: task.projectId,
        taskId: task.id,
        updatedFields,
        updatedBy,
        updatedAt: updated.updatedAt.toISOString(),
      },
      {
        source: 'workflow-service',
        correlationId: correlationId || getCorrelationId(),
        userId: updatedBy,
        organizationId: task.organizationId,
      }
    );

    await this.eventPublisher.publish('workflow.task.updated', updatedEvent);

    // Publish TaskAssigned event if assignment changed
    if (input.assignedTo !== undefined && input.assignedTo !== task.assignedTo) {
      const assignedEvent = createEvent(
        'TaskAssigned',
        'v1',
        {
          organizationId: task.organizationId,
          projectId: task.projectId,
          taskId: task.id,
          assignedTo: input.assignedTo,
          assignedBy: updatedBy,
          assignedAt: updated.updatedAt.toISOString(),
        },
        {
          source: 'workflow-service',
          correlationId: correlationId || getCorrelationId(),
          userId: updatedBy,
          organizationId: task.organizationId,
        }
      );

      await this.eventPublisher.publish('workflow.task.assigned', assignedEvent);
    }

    // Publish TaskStatusChanged event if status changed
    if (input.status !== undefined && input.status !== oldStatus) {
      const statusEvent = createEvent(
        'TaskStatusChanged',
        'v1',
        {
          organizationId: task.organizationId,
          projectId: task.projectId,
          taskId: task.id,
          oldStatus,
          newStatus: input.status,
          changedBy: updatedBy,
          changedAt: updated.updatedAt.toISOString(),
        },
        {
          source: 'workflow-service',
          correlationId: correlationId || getCorrelationId(),
          userId: updatedBy,
          organizationId: task.organizationId,
        }
      );

      await this.eventPublisher.publish('workflow.task.status-changed', statusEvent);
    }

    return updated;
  }

  async verifyMembership(organizationId: string, userId: string): Promise<boolean> {
    const membership = await this.cacheRepository.getMembership(organizationId, userId);
    return membership !== null;
  }

  async getMembershipRole(organizationId: string, userId: string): Promise<string | null> {
    const membership = await this.cacheRepository.getMembership(organizationId, userId);
    return membership?.role || null;
  }
}
