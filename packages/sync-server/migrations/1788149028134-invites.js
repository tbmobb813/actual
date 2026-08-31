import { getAccountDb } from '../src/account-db';

export const up = async function () {
  await getAccountDb().exec(
    `
    CREATE TABLE invites
        (id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        role TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        used_at INTEGER,
        used_by TEXT,
        FOREIGN KEY (file_id) REFERENCES files(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (used_by) REFERENCES users(id)
        );

    CREATE INDEX invites_token_idx ON invites(token);
        `,
  );
};

export const down = async function () {
  await getAccountDb().exec(`DROP TABLE IF EXISTS invites;`);
};
