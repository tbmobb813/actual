import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

import { getAccountDb } from './account-db';
import { handlers as app } from './app-invites';
import { createInvite } from './services/invite-service';

const ADMIN_ROLE = 'ADMIN';
const BASIC_ROLE = 'BASIC';

const createUser = (userId, userName, role, owner = 0, enabled = 1) => {
  getAccountDb().mutate(
    'INSERT INTO users (id, user_name, display_name, enabled, owner, role) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, userName, `${userName} display`, enabled, owner, role],
  );
};

const deleteUser = userId => {
  getAccountDb().mutate('DELETE FROM user_access WHERE user_id = ?', [userId]);
  getAccountDb().mutate('DELETE FROM users WHERE id = ?', [userId]);
};

const createSession = (userId, sessionToken) => {
  getAccountDb().mutate(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    [sessionToken, userId, Date.now() + 1000 * 60 * 60],
  );
};

const generateSessionToken = () => `token-${uuidv4()}`;

describe('/invites', () => {
  let ownerId, inviteeId, fileId, ownerToken, inviteeToken;

  beforeEach(() => {
    ownerId = uuidv4();
    inviteeId = uuidv4();
    fileId = uuidv4();
    ownerToken = generateSessionToken();
    inviteeToken = generateSessionToken();

    createUser(ownerId, 'owner', ADMIN_ROLE);
    createSession(ownerId, ownerToken);
    createUser(inviteeId, 'invitee', BASIC_ROLE);
    createSession(inviteeId, inviteeToken);

    getAccountDb().mutate(
      'INSERT INTO files (id, owner, name) VALUES (?, ?, ?)',
      [fileId, ownerId, 'Household Budget'],
    );
  });

  afterEach(() => {
    getAccountDb().mutate('DELETE FROM invites WHERE file_id = ?', [fileId]);
    getAccountDb().mutate('DELETE FROM user_access WHERE file_id = ?', [
      fileId,
    ]);
    getAccountDb().mutate('DELETE FROM files WHERE id = ?', [fileId]);
    deleteUser(ownerId);
    deleteUser(inviteeId);
  });

  describe('POST /invites', () => {
    it('returns 200 and a token when the file owner creates an invite', async () => {
      const res = await request(app)
        .post('/')
        .send({ fileId, role: 'viewer' })
        .set('x-actual-token', ownerToken);

      expect(res.statusCode).toEqual(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.data.token).toBe('string');
    });

    it('defaults to the editor role when none is given', async () => {
      const res = await request(app)
        .post('/')
        .send({ fileId })
        .set('x-actual-token', ownerToken);

      const invite = getAccountDb().first(
        'SELECT role FROM invites WHERE token = ?',
        [res.body.data.token],
      );
      expect(invite.role).toBe('editor');
    });

    it('returns 400 for an invalid role', async () => {
      const res = await request(app)
        .post('/')
        .send({ fileId, role: 'not-a-real-role' })
        .set('x-actual-token', ownerToken);

      expect(res.statusCode).toEqual(400);
      expect(res.body.reason).toBe('role-does-not-exists');
    });

    it('returns 403 when a non-owner without access tries to create an invite', async () => {
      const res = await request(app)
        .post('/')
        .send({ fileId, role: 'viewer' })
        .set('x-actual-token', inviteeToken);

      expect(res.statusCode).toEqual(403);
      expect(res.body.reason).toBe('file-denied');
    });

    it('allows a non-owner editor (granted via user_access) to create an invite', async () => {
      getAccountDb().mutate(
        'INSERT INTO user_access (user_id, file_id, role) VALUES (?, ?, ?)',
        [inviteeId, fileId, 'editor'],
      );

      const res = await request(app)
        .post('/')
        .send({ fileId, role: 'viewer' })
        .set('x-actual-token', inviteeToken);

      expect(res.statusCode).toEqual(200);
    });

    it('returns 403 for a non-owner viewer (granted via user_access)', async () => {
      getAccountDb().mutate(
        'INSERT INTO user_access (user_id, file_id, role) VALUES (?, ?, ?)',
        [inviteeId, fileId, 'viewer'],
      );

      const res = await request(app)
        .post('/')
        .send({ fileId, role: 'viewer' })
        .set('x-actual-token', inviteeToken);

      expect(res.statusCode).toEqual(403);
      expect(res.body.reason).toBe('file-denied');
    });
  });

  describe('GET /invites/:token', () => {
    it('returns the role and file name for a valid invite', async () => {
      const invite = createInvite(fileId, ownerId, 'viewer');

      const res = await request(app).get(`/${invite.token}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual({
        role: 'viewer',
        fileName: 'Household Budget',
      });
    });

    it('returns 404 for an unknown token', async () => {
      const res = await request(app).get('/does-not-exist');

      expect(res.statusCode).toEqual(404);
      expect(res.body.reason).toBe('invite-not-found');
    });

    it('returns 404 for an expired invite', async () => {
      const invite = createInvite(fileId, ownerId, 'editor', -1);

      const res = await request(app).get(`/${invite.token}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /invites/:token/accept', () => {
    it('grants access at the invited role and marks the invite used', async () => {
      const invite = createInvite(fileId, ownerId, 'viewer');

      const res = await request(app)
        .post(`/${invite.token}/accept`)
        .set('x-actual-token', inviteeToken);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.fileId).toBe(fileId);

      const access = getAccountDb().first(
        'SELECT role FROM user_access WHERE user_id = ? AND file_id = ?',
        [inviteeId, fileId],
      );
      expect(access.role).toBe('viewer');
    });

    it('returns 400 when the invite was already used', async () => {
      const invite = createInvite(fileId, ownerId, 'viewer');

      await request(app)
        .post(`/${invite.token}/accept`)
        .set('x-actual-token', inviteeToken);

      const res = await request(app)
        .post(`/${invite.token}/accept`)
        .set('x-actual-token', inviteeToken);

      expect(res.statusCode).toEqual(400);
      expect(res.body.reason).toBe('invite-already-used');
    });

    it('returns 400 when the invite has expired', async () => {
      const invite = createInvite(fileId, ownerId, 'viewer', -1);

      const res = await request(app)
        .post(`/${invite.token}/accept`)
        .set('x-actual-token', inviteeToken);

      expect(res.statusCode).toEqual(400);
      expect(res.body.reason).toBe('invite-expired');
    });

    it('returns 401 when the accepting user is not authenticated', async () => {
      const invite = createInvite(fileId, ownerId, 'viewer');

      const res = await request(app).post(`/${invite.token}/accept`);

      expect(res.statusCode).toEqual(401);
    });
  });

  describe('GET /invites and DELETE /invites/:id', () => {
    it('lists invites for a file and revokes one', async () => {
      const invite = createInvite(fileId, ownerId, 'viewer');

      const listRes = await request(app)
        .get('/')
        .query({ fileId })
        .set('x-actual-token', ownerToken);

      expect(listRes.statusCode).toEqual(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].token).toBe(invite.token);

      const deleteRes = await request(app)
        .delete(`/${invite.id}`)
        .query({ fileId })
        .set('x-actual-token', ownerToken);

      expect(deleteRes.statusCode).toEqual(200);

      const previewRes = await request(app).get(`/${invite.token}`);
      expect(previewRes.statusCode).toEqual(404);
    });
  });
});
