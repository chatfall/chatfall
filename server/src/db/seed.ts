import { faker } from "@faker-js/faker"
// src/db/seed.ts
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { env } from "../env"
import { generateCanonicalUrl } from "../utils/string.ts"
import {
  CommentStatus,
  type CommentToInsert,
  type UserToInsert,
  commentRatings,
  comments,
  posts,
  settings,
  users,
} from "./schema.ts"

const main = async () => {
  const client = new Pool({
    connectionString: env.DATABASE_URL,
  })
  const db = drizzle(client)

  console.log("Seed start")

  console.log("--> Delete existing data")

  await db.delete(commentRatings)
  await db.delete(comments)
  await db.delete(posts)
  await db.delete(users)
  await db.delete(settings)

  console.log("--> Insert users")

  const userData: UserToInsert[] = []
  for (let i = 0; i < 20; i++) {
    userData.push({
      name: faker.internet.userName(),
      email: faker.internet.email().toLowerCase(),
    })
  }
  await db.insert(users).values(userData)

  const uList = (
    await db
      .select({
        id: users.id,
      })
      .from(users)
  ).map((u) => u.id)

  console.log("--> Insert posts")

  await db.insert(posts).values([
    {
      url: generateCanonicalUrl("http://localhost:5173/"),
    },
  ])
  const p = (await db.select().from(posts).limit(1))[0]

  console.log("--> Insert comments")

  const commentData: CommentToInsert[] = []
  for (let i = 1; i <= 20; i++) {
    commentData.push({
      userId: uList[faker.number.int({ min: 0, max: uList.length - 1 })],
      postId: p.id,
      body: faker.lorem.paragraph(),
      path: `${i}`,
      rating: faker.number.int({ min: 0, max: 100 }),
      replyCount: i === 1 ? 20 : 0,
      status:
        Math.random() > 0.9 ? CommentStatus.Moderation : CommentStatus.Visible,
      createdAt: faker.date
        .between({
          from: "2023-01-01T00:00:00.000Z",
          to: "2023-02-01T00:00:00.000Z",
        })
        .toUTCString(),
    })
  }

  const maxDepth = 2

  for (let depth = 1; depth <= maxDepth; depth++) {
    const pathPrefixStr = Array.from({ length: depth }, (_) => "1").join(".")
    for (let j = 1; j <= 20; j++) {
      const d = new Date(2023, depth + 1, j).toUTCString()

      commentData.push({
        userId: uList[faker.number.int({ min: 0, max: uList.length - 1 })],
        postId: p.id,
        body: faker.lorem.paragraph(),
        depth: depth,
        path: `${pathPrefixStr}.${j}`,
        replyCount: j === 1 && depth < maxDepth ? 20 : 0,
        rating: faker.number.int({ min: 0, max: 100 }),
        status:
          Math.random() > 0.9
            ? CommentStatus.Moderation
            : CommentStatus.Visible,
        createdAt: d,
        updatedAt: d,
      })
    }
  }
  await db.insert(comments).values(commentData)

  console.log("Seed done")

  client.end()
}

main()
