// @ts-strict-ignore
import * as asyncStorage from '#platform/server/asyncStorage';
import { createApp } from '#server/app';
import { del, get, patch, post } from '#server/post';
import { getServer } from '#server/server-config';
import type {
  InviteEntity,
  InvitePreview,
  NewUserAccessEntity,
  UserAvailable,
  UserEntity,
} from '#types/models';

export type AdminHandlers = {
  'users-get': typeof getUsers;
  'user-delete-all': typeof deleteAllUsers;
  'user-add': typeof addUser;
  'user-update': typeof updateUser;
  'access-add': typeof addAccess;
  'access-update-role': typeof updateAccessRole;
  'access-delete-all': typeof deleteAllAccess;
  'access-get-available-users': typeof accessGetAvailableUsers;
  'transfer-ownership': typeof transferOwnership;
  'owner-created': typeof ownerCreated;
  'invite-create': typeof inviteCreate;
  'invite-get-preview': typeof inviteGetPreview;
  'invite-accept': typeof inviteAccept;
  'invite-get-all': typeof inviteGetAll;
  'invite-revoke': typeof inviteRevoke;
};

// Expose functions to the client
export const app = createApp<AdminHandlers>();

app.method('users-get', getUsers);
app.method('user-delete-all', deleteAllUsers);
app.method('user-add', addUser);
app.method('user-update', updateUser);
app.method('access-add', addAccess);
app.method('access-update-role', updateAccessRole);
app.method('access-delete-all', deleteAllAccess);
app.method('access-get-available-users', accessGetAvailableUsers);
app.method('transfer-ownership', transferOwnership);
app.method('owner-created', ownerCreated);
app.method('invite-create', inviteCreate);
app.method('invite-get-preview', inviteGetPreview);
app.method('invite-accept', inviteAccept);
app.method('invite-get-all', inviteGetAll);
app.method('invite-revoke', inviteRevoke);

async function getUsers() {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    const res = await get(getServer().BASE_SERVER + '/admin/users/', {
      headers: {
        'X-ACTUAL-TOKEN': userToken,
      },
    });

    if (res) {
      try {
        const list = JSON.parse(res) as UserEntity[];
        return list;
      } catch (err) {
        return { error: 'Failed to parse response: ' + err.message };
      }
    }
  }

  return null;
}

async function deleteAllUsers(
  ids: Array<UserEntity['id']>,
): Promise<
  { someDeletionsFailed: boolean; ids?: number[] } | { error: string }
> {
  const userToken = await asyncStorage.getItem('user-token');
  if (userToken) {
    try {
      const res = await del(
        getServer().BASE_SERVER + '/admin/users',
        {
          ids,
        },
        {
          'X-ACTUAL-TOKEN': userToken,
        },
      );

      if (res) {
        return res;
      }
    } catch (err) {
      return { error: err.reason };
    }
  }

  return { someDeletionsFailed: true };
}

async function addUser(
  user: Omit<UserEntity, 'id'>,
): Promise<{ error: string } | { id: string }> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    try {
      const res = await post(getServer().BASE_SERVER + '/admin/users/', user, {
        'X-ACTUAL-TOKEN': userToken,
      });

      return res as UserEntity;
    } catch (err) {
      return { error: err.reason };
    }
  }

  return null;
}

async function updateUser(
  user: Omit<UserEntity, 'id'>,
): Promise<{ error: string } | { id: string }> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    try {
      const res = await patch(getServer().BASE_SERVER + '/admin/users/', user, {
        'X-ACTUAL-TOKEN': userToken,
      });

      return res as UserEntity;
    } catch (err) {
      return { error: err.reason };
    }
  }

  return null;
}

async function addAccess(
  access: NewUserAccessEntity,
): Promise<{ error?: string } | Record<string, never>> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    try {
      await post(getServer().BASE_SERVER + '/admin/access/', access, {
        'X-ACTUAL-TOKEN': userToken,
      });

      return {};
    } catch (err) {
      return { error: err.reason };
    }
  }

  return null;
}

async function updateAccessRole(
  access: Required<NewUserAccessEntity>,
): Promise<{ error?: string } | Record<string, never>> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    try {
      await patch(getServer().BASE_SERVER + '/admin/access/', access, {
        'X-ACTUAL-TOKEN': userToken,
      });

      return {};
    } catch (err) {
      return { error: err.reason };
    }
  }

  return null;
}

async function deleteAllAccess({
  fileId,
  ids,
}: {
  fileId: string;
  ids: string[];
}): Promise<
  { someDeletionsFailed: boolean; ids?: number[] } | { error: unknown }
> {
  const userToken = await asyncStorage.getItem('user-token');
  if (userToken) {
    try {
      const res = await del(
        getServer().BASE_SERVER + `/admin/access?fileId=${fileId}`,
        {
          token: userToken,
          ids,
        },
      );

      if (res) {
        return res;
      }
    } catch (err) {
      return { error: err.reason };
    }
  }

  return { someDeletionsFailed: true };
}

async function accessGetAvailableUsers(
  fileId: string,
): Promise<UserAvailable[] | { error: string }> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    const res = await get(
      `${getServer().BASE_SERVER + '/admin/access/users'}?fileId=${fileId}`,
      {
        headers: {
          'X-ACTUAL-TOKEN': userToken,
        },
      },
    );

    if (res) {
      try {
        return JSON.parse(res) as UserAvailable[];
      } catch (err) {
        return { error: 'Failed to parse response: ' + err.message };
      }
    }
  }

  return [];
}

async function transferOwnership({
  fileId,
  newUserId,
}: {
  fileId: string;
  newUserId: string;
}): Promise<{ error?: string } | Record<string, never>> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    try {
      await post(
        getServer().BASE_SERVER + '/admin/access/transfer-ownership/',
        { fileId, newUserId },
        {
          'X-ACTUAL-TOKEN': userToken,
        },
      );
    } catch (err) {
      return { error: err.reason };
    }
  }

  return {};
}

async function ownerCreated() {
  const res = await get(getServer().BASE_SERVER + '/admin/owner-created/');

  if (res) {
    return JSON.parse(res) as boolean;
  }

  return null;
}

async function inviteCreate({
  fileId,
  role,
  expiryDays,
}: {
  fileId: string;
  role?: string;
  expiryDays?: number;
}): Promise<{ token: string; expiresAt: number } | { error: string }> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    try {
      const data = await post(
        getServer().BASE_SERVER + '/invites/',
        { fileId, role, expiryDays },
        { 'X-ACTUAL-TOKEN': userToken },
      );
      return data as { token: string; expiresAt: number };
    } catch (err) {
      return { error: err.reason };
    }
  }

  return { error: 'unauthorized' };
}

async function inviteGetPreview(
  token: string,
): Promise<InvitePreview | { error: string }> {
  const res = await get(
    getServer().BASE_SERVER + `/invites/${encodeURIComponent(token)}`,
  );

  if (res) {
    try {
      const body = JSON.parse(res);
      if (body.status === 'ok') {
        return body.data as InvitePreview;
      }
      return { error: body.reason || 'invite-not-found' };
    } catch (err) {
      return { error: 'Failed to parse response: ' + err.message };
    }
  }

  return { error: 'network-failure' };
}

async function inviteAccept(
  token: string,
): Promise<{ fileId: string } | { error: string }> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    try {
      const data = await post(
        getServer().BASE_SERVER +
          `/invites/${encodeURIComponent(token)}/accept`,
        {},
        { 'X-ACTUAL-TOKEN': userToken },
      );
      return data as { fileId: string };
    } catch (err) {
      return { error: err.reason };
    }
  }

  return { error: 'unauthorized' };
}

async function inviteGetAll(
  fileId: string,
): Promise<InviteEntity[] | { error: string }> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    const res = await get(
      `${getServer().BASE_SERVER + '/invites'}?fileId=${fileId}`,
      {
        headers: {
          'X-ACTUAL-TOKEN': userToken,
        },
      },
    );

    if (res) {
      try {
        return JSON.parse(res) as InviteEntity[];
      } catch (err) {
        return { error: 'Failed to parse response: ' + err.message };
      }
    }
  }

  return [];
}

async function inviteRevoke({
  id,
  fileId,
}: {
  id: string;
  fileId: string;
}): Promise<{ error?: string } | Record<string, never>> {
  const userToken = await asyncStorage.getItem('user-token');

  if (userToken) {
    try {
      await del(getServer().BASE_SERVER + `/invites/${id}?fileId=${fileId}`, {
        token: userToken,
      });
      return {};
    } catch (err) {
      return { error: err.reason };
    }
  }

  return { error: 'unauthorized' };
}
