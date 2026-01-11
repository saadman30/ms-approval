export interface Organization {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Invitation {
  id: string;
  organizationId: string;
  inviteeEmail: string;
  role: string;
  token: string;
  sentBy: string;
  sentAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
}

export interface CreateOrganizationInput {
  name: string;
  createdBy: string;
}

export interface CreateMembershipInput {
  organizationId: string;
  userId: string;
  role: string;
}

export interface CreateInvitationInput {
  organizationId: string;
  inviteeEmail: string;
  role: string;
  sentBy: string;
}

export type Role = 'owner' | 'admin' | 'member' | 'viewer';
