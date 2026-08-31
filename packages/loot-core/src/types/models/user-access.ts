export type NewUserAccessEntity = {
  fileId: string;
  userId: string;
  role?: string;
};

export type UserAccessEntity = {
  displayName: string;
  userName: string;
  fileName: string;
} & NewUserAccessEntity;

export type InviteEntity = {
  id: string;
  fileId: string;
  createdBy: string;
  role: string;
  token: string;
  expiresAt: number;
  usedAt: number | null;
  usedBy: string | null;
};

export type InvitePreview = {
  role: string;
  fileName: string | null;
};
