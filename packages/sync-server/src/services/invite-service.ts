import crypto from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { getAccountDb } from '#account-db';

import { addUserAccess, countUserAccess } from './user-service';

const DEFAULT_EXPIRY_DAYS = 7;

export type Invite = {
  id: string;
  fileId: string;
  createdBy: string;
  role: string;
  token: string;
  expiresAt: number;
  usedAt: number | null;
  usedBy: string | null;
};

function rowToInvite(row): Invite {
  return {
    id: row.id,
    fileId: row.file_id,
    createdBy: row.created_by,
    role: row.role,
    token: row.token,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    usedBy: row.used_by,
  };
}

export function createInvite(
  fileId: string,
  createdBy: string,
  role: string,
  expiryDays: number = DEFAULT_EXPIRY_DAYS,
): Invite {
  const id = uuidv4();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000;

  getAccountDb().mutate(
    `INSERT INTO invites (id, file_id, created_by, role, token, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, fileId, createdBy, role, token, expiresAt],
  );

  return {
    id,
    fileId,
    createdBy,
    role,
    token,
    expiresAt,
    usedAt: null,
    usedBy: null,
  };
}

export function getInviteByToken(token: string): Invite | null {
  const row = getAccountDb().first('SELECT * FROM invites WHERE token = ?', [
    token,
  ]);
  return row ? rowToInvite(row) : null;
}

export function isInviteValid(invite: Invite | null): boolean {
  if (!invite) return false;
  if (invite.usedAt) return false;
  if (invite.expiresAt < Date.now()) return false;
  return true;
}

export class InviteError extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

export function redeemInvite(token: string, userId: string): Invite {
  const invite = getInviteByToken(token);

  if (!invite) {
    throw new InviteError('invite-not-found');
  }
  if (invite.usedAt) {
    throw new InviteError('invite-already-used');
  }
  if (invite.expiresAt < Date.now()) {
    throw new InviteError('invite-expired');
  }
  if (countUserAccess(invite.fileId, userId) > 0) {
    throw new InviteError('user-already-have-access');
  }

  getAccountDb().transaction(() => {
    addUserAccess(userId, invite.fileId, invite.role);
    getAccountDb().mutate(
      'UPDATE invites SET used_at = ?, used_by = ? WHERE id = ?',
      [Date.now(), userId, invite.id],
    );
  });

  return { ...invite, usedAt: Date.now(), usedBy: userId };
}

export function expireInvite(id: string, fileId: string): void {
  const result = getAccountDb().mutate(
    'UPDATE invites SET expires_at = 0 WHERE id = ? AND file_id = ?',
    [id, fileId],
  );
  if (result.changes === 0) {
    throw new InviteError('invite-not-found');
  }
}

export function getInvitesForFile(fileId: string): Invite[] {
  return getAccountDb()
    .all('SELECT * FROM invites WHERE file_id = ? ORDER BY expires_at DESC', [
      fileId,
    ])
    .map(rowToInvite);
}
