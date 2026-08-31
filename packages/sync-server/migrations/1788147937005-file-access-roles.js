import { getAccountDb } from '../src/account-db';

export const up = async function () {
  const accountDb = getAccountDb();

  accountDb.transaction(() => {
    accountDb.exec(
      `
    ALTER TABLE user_access
        ADD COLUMN role TEXT NOT NULL DEFAULT 'editor';
        `,
    );
  });
};

export const down = async function () {
  await getAccountDb().exec(
    `
      BEGIN TRANSACTION;

      CREATE TABLE user_access_backup (
          user_id TEXT,
          file_id TEXT,
          PRIMARY KEY (user_id, file_id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (file_id) REFERENCES files(id)
      );

      INSERT INTO user_access_backup (user_id, file_id)
      SELECT user_id, file_id FROM user_access;

      DROP TABLE user_access;

      ALTER TABLE user_access_backup RENAME TO user_access;

      COMMIT;
      `,
  );
};
