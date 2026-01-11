export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'deleted';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}

export interface Task {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  assignedTo?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface MembershipCache {
  organizationId: string;
  userId: string;
  role: string;
  cachedAt: Date;
}

export interface EntitlementsCache {
  organizationId: string;
  maxProjects?: number;
  maxTasks?: number;
  maxMembers?: number;
  features: string[];
  cachedAt: Date;
}

export interface CreateProjectInput {
  organizationId: string;
  name: string;
  description?: string;
  createdBy: string;
}

export interface CreateTaskInput {
  organizationId: string;
  projectId: string;
  title: string;
  description?: string;
  createdBy: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled';
  assignedTo?: string;
}
