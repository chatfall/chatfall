import {
  type App,
  type Comment,
  type CommentUser,
  type LoggedInUser,
  PostCommentResponse,
  SocketEvent,
  SocketEventTypeEnum,
  SocketNewCommentEvent,
  Sort,
} from "@chatfall/server"
import { treaty } from "@elysiajs/eden"
import { produce } from "immer"
import { create } from "zustand"
import { jwt } from "../lib/jwt"

type CommentId = number

type CommentList = {
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

type State = {
  canonicalUrl: string | null
  users: Record<CommentId, CommentUser>
  liked: Record<CommentId, boolean>
  comments: Record<number, Comment>
  replies: Record<CommentId, CommentList>
  rootList: CommentList
  loggedInUser?: LoggedInUser
}

type Actions = {
  getCanonicalUrl: () => string
  logout: () => void
  checkAuth: () => Promise<void>
  hasAdmin: () => Promise<boolean>
  addComment: (
    comment: string,
    parentCommentId?: number,
  ) => Promise<PostCommentResponse>
  likeComment: (commentId: number, like: boolean) => Promise<void>
  fetchComments: (sort?: Sort, skipOverride?: number) => Promise<void>
  fetchReplies: (commentId: number) => Promise<void>
  loginEmail: (email: string, adminOnly?: boolean) => Promise<{ blob: string }>
  verifyEmail: (blob: string, code: string) => Promise<void>
}

export type CommentStoreProps = {
  server: string
  initialSort?: Sort
}

const createApp = (server: string) => {
  return treaty<App>(server, {
    headers: () => {
      const jwtToken = jwt.getToken()
      if (jwtToken?.token) {
        return {
          authorization: `Bearer ${jwtToken.token}`,
        }
      }
    },
  })
}

type TreatyApp = ReturnType<typeof createApp>

type AppWebSocket = ReturnType<TreatyApp["ws"]["subscribe"]>

class Socket {
  private ws: AppWebSocket
  private onReady: Promise<void>

  constructor(app: TreatyApp) {
    this.ws = app.ws.subscribe()

    this.onReady = new Promise<void>((resolve) =>
      this.ws.on("open", () => resolve()),
    )

    this.ws
      .on("error", (error) => {
        console.error("Websocket error", error)
      })
      .on("close", () => {
        console.debug("Websocket closed")
      })
  }

  async onceReady(cb: (ws: AppWebSocket) => void) {
    return this.onReady.then(() => cb(this.ws))
  }

  onMessage(cb: (data: SocketEvent) => void) {
    this.ws.subscribe((data) => {
      cb(data.data)
    })
  }
}

const getPageUrl = () => {
  return window.location.href
}

export const createStore = (props: CommentStoreProps) => {
  const app = createApp(props.server)

  // websocket
  const ws = new Socket(app)

  const _updateLoginState = (
    set: (
      fn: (state: State) => (State & Actions) | Partial<State & Actions>,
    ) => void,
    loggedInUser?: LoggedInUser,
  ) => {
    set(
      produce((state) => {
        state.loggedInUser = loggedInUser
        ws.onceReady((ws) => {
          const token = jwt.getToken()?.token
          ws.send({ type: "register", url: getPageUrl(), jwtToken: token })
        })
      }),
    )
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

  const useStore = create<State & Actions>()((set, get) => ({
    canonicalUrl: null,
    users: {},
    liked: {},
    comments: {},
    replies: {},
    rootList: createCommentList(-1, "", props.initialSort),
    loggedInUser: undefined,
    getCanonicalUrl: () => {
      return get().canonicalUrl || getPageUrl()
    },
    logout: () => {
      jwt.removeToken()
      _updateLoginState(set)
    },
    checkAuth: async () => {
      if (jwt.getToken()) {
        const { data, error } = await app.api.users.check.get()
        if (error) {
          console.error(`Error checking auth`, error)
          jwt.removeToken()
        } else {
          if (!data.user) {
            console.warn(`Unable to verify JWT token, removing it`)
            jwt.removeToken()
          } else {
            _updateLoginState(set, data.user as LoggedInUser)
            return
          }
        }
      }

      _updateLoginState(set)
    },
    hasAdmin: async () => {
      const { data, error } = await app.api.users.has_admin.get()
      if (error) {
        throw error
      }
      return !!data
    },
    verifyEmail: async (blob: string, code: string) => {
      const { data, error } = await app.api.users.verify_email.post({
        blob,
        code,
      })

      if (error) {
        throw error
      }

      jwt.setToken({ token: data.jwt })

      _updateLoginState(set, data.user)
    },
    loginEmail: async (email: string, adminOnly?: boolean) => {
      const { data, error } = await app.api.users.login_email.post({
        email,
        adminOnly,
      })

      if (error) {
        throw error
      }

      return data
    },
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
  }))

  ws.onMessage((data) => {
    // console.debug(`Received socket event`, data)

    switch (data.type) {
      case SocketEventTypeEnum.NewComment:
        useStore.setState(
          produce((state) => {
            const newComment = data.data as SocketNewCommentEvent
            state.comments[newComment.id] = newComment
            state.users[data.user.id] = data.user

            // if it's a root comment
            if (newComment.depth === 0) {
              // if the comment is from the current user
              if (data.user.id === state.loggedInUser?.id) {
                const existing = (state.rootList.myNewItems as number[]).find(
                  (c) => c === newComment.id,
                )

                if (!existing) {
                  state.rootList.myNewItems.unshift(newComment.id)
                }
              } else {
                const existing = (
                  state.rootList.otherUserNewItems as number[]
                ).find((c) => c === newComment.id)

                if (!existing) {
                  state.rootList.otherUserNewItems.unshift(newComment.id)
                }
              }
              // it's a reply
            } else {
              const parentCommentPath = newComment.path.slice(
                0,
                newComment.path.lastIndexOf("."),
              )

              const parentComment = Object.values(state.comments).find(
                (c) => (c as Comment).path === parentCommentPath,
              ) as Comment

              if (parentComment) {
                parentComment.replyCount++
                const replies = state.replies[parentComment.id]
                if (replies) {
                  // if already got all comments then add to the list
                  if (replies.total === replies.items.length) {
                    replies.items.push(newComment.id)
                  }
                  // else if there are more comments to fetch
                  else {
                    // if the comment is from the current user then show it immediately
                    if (data.user.id === state.loggedInUser?.id) {
                      const existing = (replies.myNewItems as number[]).find(
                        (c) => c === newComment.id,
                      )
                      if (!existing) {
                        replies.myNewItems.unshift(newComment.id)
                      }
                    }
                  }
                  // increment the total reply count
                  replies.total++
                }
              }
            }
          }),
        )
        break
      case SocketEventTypeEnum.LikeComment:
        useStore.setState(
          produce((state) => {
            if (data.user.id === state.loggedInUser?.id) {
              state.liked[data.data.id] = true
            }
            state.comments[data.data.id].rating = data.data.rating
          }),
        )
        break
      case SocketEventTypeEnum.UnlikeComment:
        useStore.setState(
          produce((state) => {
            if (data.user.id === state.loggedInUser?.id) {
              state.liked[data.data.id] = false
            }
            state.comments[data.data.id].rating = data.data.rating
          }),
        )
        break
    }
  })

  return { useStore }
}

export type CommentStore = ReturnType<typeof createStore>

const commentListToMap = (comments: Comment[]) => {
  return comments.reduce(
    (acc, c) => {
      acc[c.id] = c
      return acc
    },
    {} as Record<CommentId, Comment>,
  )
}

const replaceCommentList = (
  list: CommentList,
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
  list: CommentList,
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
