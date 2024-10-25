import type { InferInsertModel, InferSelectModel } from "drizzle-orm"
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { createInsertSchema } from "drizzle-typebox"

const enumToPgEnum = <T extends Record<string, any>>(
  myEnum: T,
): [T[keyof T], ...T[keyof T][]] => {
  return Object.values(myEnum).map((value: any) => `${value}`) as any
}

export const settings = pgTable(
  "settings",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      settings_createdAt_index: index("settings_createdAt_index").on(
        table.createdAt,
      ),
    }
  },
)

export enum UserStatus {
  Active = "Active",
  Blacklisted = "Blacklisted",
  Deleted = "Deleted",
}
export const userStatus = pgEnum("userStatus", enumToPgEnum(UserStatus))

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    status: userStatus("status").notNull().default(UserStatus.Active),
    lastLoggedIn: timestamp("last_logged_in", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      users_createdAt_index: index("users_createdAt_index").on(table.createdAt),
    }
  },
)

export type User = InferSelectModel<typeof users>
export type UserToInsert = InferInsertModel<typeof users>
export type UserDisplay = {
  id: number
  username: string
}

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    url: text("url").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      posts_createdAt_index: index("posts_createdAt_index").on(table.createdAt),
    }
  },
)

export type Post = InferSelectModel<typeof posts>
export type PostToInsert = InferInsertModel<typeof posts>

export enum CommentStatus {
  Visible = "Visible",
  Moderation = "Moderation",
  Deleted = "Deleted",
}
export const commentStatus = pgEnum(
  "commentStatus",
  enumToPgEnum(CommentStatus),
)

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id),
    status: commentStatus("status").notNull().default(CommentStatus.Visible),
    body: text("body").notNull(),
    depth: integer("depth").notNull().default(0),
    path: text("path").notNull(),
    rating: integer("rating").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      comments_createdAt_index: index("comments_createdAt_index").on(
        table.createdAt,
      ),
      comemnt_depth_index: index("depth_index").on(table.depth),
      comemnt_rating_index: index("rating_index").on(table.rating),
      comemnt_path_index: index("path_index").on(table.path),
    }
  },
)

export type Comment = InferSelectModel<typeof comments>
export type CommentToInsert = InferInsertModel<typeof comments>

export const commentRatings = pgTable(
  "comment_ratings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    commentId: integer("comment_id")
      .notNull()
      .references(() => comments.id),
    rating: integer("rating").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      commentRatings_createdAt_index: index(
        "commentRatings_createdAt_index",
      ).on(table.createdAt),
    }
  },
)

export type CommentRating = InferSelectModel<typeof commentRatings>
export type CommentRatingToInsert = InferInsertModel<typeof commentRatings>
export const CommentRatingToInsertSchema = createInsertSchema(commentRatings)
