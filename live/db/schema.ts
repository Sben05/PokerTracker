import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const ledgers = sqliteTable('ledgers', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
  lastCommandId: text('last_command_id'),
  updatedAt: text('updated_at').notNull(),
});
export const operations = sqliteTable('operations', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
});
export const accessAttempts=sqliteTable('access_attempts',{
 id:text('id').primaryKey(),
 attempts:integer('attempts').notNull().default(0),
});
