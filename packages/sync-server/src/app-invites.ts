import express from 'express';

import { getAccountDb, isAdmin } from './account-db';
import {
  createInvite,
  expireInvite,
  getInviteByToken,
  getInvitesForFile,
  InviteError,
  isInviteValid,
  redeemInvite,
} from './services/invite-service';
import * as UserService from './services/user-service';
import {
  errorMiddleware,
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from './util/middlewares';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLoggerMiddleware);

export { app as handlers };

function hasFileAccess(fileId: string, userId: string): boolean {
  if (isAdmin(userId)) return true;
  const { granted } = UserService.checkFilePermission(fileId, userId) || {
    granted: 0,
  };
  return granted !== 0;
}

app.post('/', validateSessionMiddleware, (req, res) => {
  const { fileId, role, expiryDays } = req.body || {};

  if (!fileId) {
    res.status(400).send({
      status: 'error',
      reason: 'file-cant-be-empty',
      details: 'File cannot be empty',
    });
    return;
  }

  if (!hasFileAccess(fileId, res.locals.user_id)) {
    res.status(403).send({
      status: 'error',
      reason: 'file-denied',
      details: "You don't have permissions over this file",
    });
    return;
  }

  const resolvedRole = role || 'editor';
  if (!UserService.validateFileAccessRole(resolvedRole)) {
    res.status(400).send({
      status: 'error',
      reason: 'role-does-not-exists',
      details: 'Selected role does not exist',
    });
    return;
  }

  const invite = createInvite(
    fileId,
    res.locals.user_id,
    resolvedRole,
    expiryDays,
  );

  res.status(200).send({
    status: 'ok',
    data: { token: invite.token, expiresAt: invite.expiresAt },
  });
});

app.get('/:token', (req, res) => {
  const invite = getInviteByToken(req.params.token);

  if (!isInviteValid(invite)) {
    res.status(404).send({
      status: 'error',
      reason: 'invite-not-found',
      details: 'This invite is invalid, expired, or already used',
    });
    return;
  }

  const file = getAccountDb().first('SELECT name FROM files WHERE id = ?', [
    invite.fileId,
  ]);

  res.status(200).send({
    status: 'ok',
    data: { role: invite.role, fileName: file ? file.name : null },
  });
});

app.post('/:token/accept', validateSessionMiddleware, (req, res) => {
  try {
    const invite = redeemInvite(req.params.token, res.locals.user_id);
    res.status(200).send({ status: 'ok', data: { fileId: invite.fileId } });
  } catch (err) {
    if (err instanceof InviteError) {
      res.status(400).send({ status: 'error', reason: err.reason });
      return;
    }
    throw err;
  }
});

app.get('/', validateSessionMiddleware, (req, res) => {
  const fileId = req.query.fileId as string;

  if (!fileId || !hasFileAccess(fileId, res.locals.user_id)) {
    res.status(403).send({
      status: 'error',
      reason: 'file-denied',
      details: "You don't have permissions over this file",
    });
    return;
  }

  res.json(getInvitesForFile(fileId));
});

app.delete('/:id', validateSessionMiddleware, (req, res) => {
  const fileId = req.query.fileId as string;

  if (!fileId || !hasFileAccess(fileId, res.locals.user_id)) {
    res.status(403).send({
      status: 'error',
      reason: 'file-denied',
      details: "You don't have permissions over this file",
    });
    return;
  }

  try {
    expireInvite(req.params.id, fileId);
    res.status(200).send({ status: 'ok', data: {} });
  } catch (err) {
    if (err instanceof InviteError) {
      res.status(404).send({ status: 'error', reason: err.reason });
      return;
    }
    throw err;
  }
});

app.use(errorMiddleware);
