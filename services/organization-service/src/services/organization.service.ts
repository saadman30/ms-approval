import { OrganizationRepository } from '../repositories/organization.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { InvitationRepository } from '../repositories/invitation.repository';
import { EventPublisher } from '../events/event-publisher';
import {
  createEvent,
  OrganizationCreatedEventSchema,
  OrganizationDeletedEventSchema,
  MemberAddedEventSchema,
  MemberRemovedEventSchema,
  RoleChangedEventSchema,
  InvitationSentEventSchema,
} from '@microservice-learning/events';
import { getCorrelationId } from '@microservice-learning/observability';
import { randomUUID } from 'crypto';
import {
  CreateOrganizationInput,
  CreateMembershipInput,
  CreateInvitationInput,
} from '../types/organization.types';

export class OrganizationService {
  constructor(
    private organizationRepository: OrganizationRepository,
    private membershipRepository: MembershipRepository,
    private invitationRepository: InvitationRepository,
    private eventPublisher: EventPublisher
  ) {}

  async createOrganization(
    input: CreateOrganizationInput,
    correlationId?: string
  ) {
    const org = await this.organizationRepository.create(input);

    // Create membership for creator as owner
    const membership = await this.membershipRepository.create({
      organizationId: org.id,
      userId: input.createdBy,
      role: 'owner',
    });

    // Publish event
    const event = createEvent(
      'OrganizationCreated',
      'v1',
      {
        organizationId: org.id,
        name: org.name,
        createdBy: org.createdBy,
        createdAt: org.createdAt.toISOString(),
      },
      {
        source: 'organization-service',
        correlationId: correlationId || getCorrelationId(),
        userId: org.createdBy,
        organizationId: org.id,
      }
    );

    await this.eventPublisher.publish('organization.created', event);

    return { organization: org, membership };
  }

  async deleteOrganization(
    organizationId: string,
    deletedBy: string,
    correlationId?: string
  ) {
    // Soft delete organization
    await this.organizationRepository.softDelete(organizationId, deletedBy);

    // Soft delete all memberships
    const memberships = await this.membershipRepository.findByOrganization(
      organizationId
    );
    for (const membership of memberships) {
      await this.membershipRepository.softDelete(membership.id);
    }

    // Publish event
    const event = createEvent(
      'OrganizationDeleted',
      'v1',
      {
        organizationId,
        deletedBy,
        deletedAt: new Date().toISOString(),
      },
      {
        source: 'organization-service',
        correlationId: correlationId || getCorrelationId(),
        userId: deletedBy,
        organizationId,
      }
    );

    await this.eventPublisher.publish('organization.deleted', event);
  }

  async addMember(
    input: CreateMembershipInput,
    addedBy: string,
    correlationId?: string
  ) {
    // Check if membership already exists
    const existing = await this.membershipRepository.findByOrganizationAndUser(
      input.organizationId,
      input.userId
    );

    if (existing) {
      throw new Error('User is already a member of this organization');
    }

    const membership = await this.membershipRepository.create(input);

    // Publish event
    const event = createEvent(
      'MemberAdded',
      'v1',
      {
        organizationId: input.organizationId,
        userId: input.userId,
        role: input.role,
        addedBy,
        addedAt: membership.createdAt.toISOString(),
      },
      {
        source: 'organization-service',
        correlationId: correlationId || getCorrelationId(),
        userId: addedBy,
        organizationId: input.organizationId,
      }
    );

    await this.eventPublisher.publish('organization.member.added', event);

    return membership;
  }

  async removeMember(
    organizationId: string,
    userId: string,
    removedBy: string,
    correlationId?: string
  ) {
    const membership = await this.membershipRepository.findByOrganizationAndUser(
      organizationId,
      userId
    );

    if (!membership) {
      throw new Error('Membership not found');
    }

    await this.membershipRepository.softDeleteByOrganizationAndUser(
      organizationId,
      userId
    );

    // Publish event
    const event = createEvent(
      'MemberRemoved',
      'v1',
      {
        organizationId,
        userId,
        removedBy,
        removedAt: new Date().toISOString(),
      },
      {
        source: 'organization-service',
        correlationId: correlationId || getCorrelationId(),
        userId: removedBy,
        organizationId,
      }
    );

    await this.eventPublisher.publish('organization.member.removed', event);
  }

  async changeRole(
    membershipId: string,
    newRole: string,
    changedBy: string,
    correlationId?: string
  ) {
    const membership = await this.membershipRepository.findById(membershipId);
    if (!membership) {
      throw new Error('Membership not found');
    }

    const oldRole = membership.role;
    const updated = await this.membershipRepository.updateRole(
      membershipId,
      newRole
    );

    // Publish event
    const event = createEvent(
      'RoleChanged',
      'v1',
      {
        organizationId: membership.organizationId,
        userId: membership.userId,
        oldRole,
        newRole,
        changedBy,
        changedAt: updated.updatedAt.toISOString(),
      },
      {
        source: 'organization-service',
        correlationId: correlationId || getCorrelationId(),
        userId: changedBy,
        organizationId: membership.organizationId,
      }
    );

    await this.eventPublisher.publish('organization.role.changed', event);

    return updated;
  }

  async sendInvitation(
    input: CreateInvitationInput,
    correlationId?: string
  ) {
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const invitation = await this.invitationRepository.create(
      { ...input, expiresAt },
      token
    );

    // Publish event
    const event = createEvent(
      'InvitationSent',
      'v1',
      {
        organizationId: input.organizationId,
        inviteeEmail: input.inviteeEmail,
        role: input.role,
        invitationToken: token,
        sentBy: input.sentBy,
        sentAt: invitation.sentAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
      },
      {
        source: 'organization-service',
        correlationId: correlationId || getCorrelationId(),
        userId: input.sentBy,
        organizationId: input.organizationId,
      }
    );

    await this.eventPublisher.publish('organization.invitation.sent', event);

    return invitation;
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.invitationRepository.findByToken(token);
    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    // Mark invitation as accepted
    await this.invitationRepository.markAccepted(invitation.id);

    // Create membership
    const membership = await this.membershipRepository.create({
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
    });

    // Publish MemberAdded event
    const event = createEvent(
      'MemberAdded',
      'v1',
      {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
        addedBy: invitation.sentBy,
        addedAt: new Date().toISOString(),
      },
      {
        source: 'organization-service',
        correlationId: getCorrelationId(),
        userId,
        organizationId: invitation.organizationId,
      }
    );

    await this.eventPublisher.publish('organization.member.added', event);

    return membership;
  }

  async rejectInvitation(token: string) {
    const invitation = await this.invitationRepository.findByToken(token);
    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    await this.invitationRepository.markRejected(invitation.id);
  }
}
