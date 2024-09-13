import {
  type Comment,
  CommentUser,
  PostCommentResponse,
  SocketEvent,
  Sort,
} from "@chatfall/server"
import { produce } from "immer"
import { CoreState, StoreProps, createBaseStore } from "./base"

// Export types
export type ClientCommentId = number

export type ClientCommentList = {
  sort: Sort
  parentDepth: number
  parentPath: string
  items: number[]
  total: number
  // new comments by others since last fetch
  otherUserNewItems: number[]
  // new comments by the current user since last fetch
  myNewItems: number[]
}

export type ClientState = CoreState & {
  users: Record<ClientCommentId, CommentUser>
  liked: Record<ClientCommentId, boolean>
  comments: Record<ClientCommentId, Comment>
  replies: Record<ClientCommentId, ClientCommentList>
  rootList: ClientCommentList
  addComment: (
    comment: string,
    parentCommentId?: number,
  ) => Promise<PostCommentResponse>
  likeComment: (commentId: number, like: boolean) => Promise<void>
  fetchComments: (sort?: Sort, skipOverride?: number) => Promise<void>
  fetchReplies: (commentId: number) => Promise<void>
}

const createCommentList = (
  parentDepth: number,
  parentPath: string,
  sort: Sort = Sort.newestFirst,
) => {
  return {
    sort,
    parentDepth,
    parentPath,
    items: [],
    total: 0,
    otherUserNewItems: [],
    myNewItems: [],
  }
}

export type ClientStoreProps = StoreProps & {
  initialSort?: Sort
}

export const createStore = (props: ClientStoreProps) => {
  return createBaseStore<ClientState>(
    props,
    (set, get, app) =>
      ({
        users: {},
        liked: {},
        comments: {},
        replies: {},
        rootList: createCommentList(-1, "", props.initialSort),
        likeComment: async (commentId: number, like: boolean) => {
          const { error } = await app.api.comments.like.post({
            commentId,
            like,
          })

          if (error) {
            throw error
          }
        },
        addComment: async (comment: string, parentCommentId?: number) => {
          const { data, error } = await app.api.comments.index.post({
            comment,
            parentCommentId: parentCommentId ? `${parentCommentId}` : undefined,
            url: get().getCanonicalUrl(),
          })

          if (error) {
            throw error
          }

          return data
        },
        fetchComments: async (
          sort = get().rootList.sort,
          skipOverride?: number,
        ) => {
          // if we've changed the filter then reset the paging, otherwise increment
          const skip =
            typeof skipOverride === "number"
              ? skipOverride
              : get().rootList.items.length

          const { data, error } = await app.api.comments.index.get({
            query: {
              url: get().getCanonicalUrl(),
              depth: `0`,
              skip: `${skip}`,
              sort,
            },
          })

          if (error) {
            throw error
          }

          set(
            produce((state) => {
              state.canonicalUrl = data.canonicalUrl

              // if fetching more comments, append to existing list
              if (skip) {
                Object.assign(state.users, data.users)
                Object.assign(state.liked, data.liked)
                Object.assign(state.comments, commentListToMap(data.comments))
                appendCommentList(state.rootList, data)
              }
              // if fetching new comments, reset the list
              else {
                state.users = data.users
                state.liked = data.liked
                state.comments = commentListToMap(data.comments)
                state.replies = {}
                replaceCommentList(state.rootList, data)
                state.rootList.sort = sort
              }
            }),
          )
        },
        fetchReplies: async (parentCommentId: number) => {
          const existing = get().replies[parentCommentId]

          const parentDepth = existing
            ? existing.parentDepth
            : get().comments[parentCommentId].depth

          const parentPath = existing
            ? existing.parentPath
            : get().comments[parentCommentId].path

          const skip = existing ? existing.items.length : 0

          const { data, error } = await app.api.comments.index.get({
            query: {
              url: get().getCanonicalUrl(),
              depth: `${parentDepth + 1}`,
              pathPrefix: `${parentPath}.`,
              skip: `${skip}`,
              sort: Sort.oldestFirst,
            },
          })

          if (error) {
            throw error
          }

          set(
            produce((state) => {
              Object.assign(state.users, data.users)
              Object.assign(state.liked, data.liked)
              Object.assign(state.comments, commentListToMap(data.comments))

              // if fetching more replies, append to existing list
              if (skip) {
                appendCommentList(state.replies[parentCommentId], data)
              }
              // if fetching new replies, reset the list
              else {
                state.replies[parentCommentId] = createCommentList(
                  parentDepth,
                  parentPath,
                )
                replaceCommentList(state.replies[parentCommentId], data)
              }
            }),
          )
        },
      }) as Omit<ClientState, keyof CoreState>,
    (data: SocketEvent) => {
      console.log(data)
    },
  )
}

const commentListToMap = (comments: Comment[]) => {
  return comments.reduce(
    (acc, c) => {
      acc[c.id] = c
      return acc
    },
    {} as Record<ClientCommentId, Comment>,
  )
}

const replaceCommentList = (
  list: ClientCommentList,
  data: {
    comments: Comment[]
    totalComments: number
  },
) => {
  const { comments, totalComments } = data
  list.items = comments.map((c) => c.id)
  list.total = totalComments
  list.otherUserNewItems = []
  list.myNewItems = []
}

const appendCommentList = (
  list: ClientCommentList,
  data: {
    comments: Comment[]
    totalComments: number
  },
) => {
  const { comments, totalComments } = data
  const newItems = comments
    .filter((c) => !list.items.includes(c.id))
    .map((c) => c.id)
  list.items = list.items.concat(newItems)
  list.total = totalComments
  // remove items from the other new items lists that are now in the core list
  list.otherUserNewItems = list.otherUserNewItems.filter(
    (c: number) => !list.items.includes(c),
  )
  list.myNewItems = list.myNewItems.filter(
    (c: number) => !list.items.includes(c),
  )
}
