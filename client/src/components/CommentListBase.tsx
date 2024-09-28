import { Sort } from "@chatfall/server"
import { Comment } from "@chatfall/server"
import React, { FC, useEffect, useMemo, useState } from "react"
import { useCallback } from "react"
import { useGlobalContext } from "../contexts/global"
import { BaseStore, PropsWithClassname } from "../exports"
import { cn } from "../utils/ui"
import { Button } from "./Button"
import { CommentListItem } from "./CommentListItem"
import { CommentsBlockPlaceholder } from "./CommentPlaceholder"
import { ErrorBox } from "./ErrorBox"
import { NumberValue } from "./NumberValue"

export interface CommentListBaseProps {
  url?: string
  showHeader?: boolean
  renderHeaderContent?: ({
    setIsLoading,
    setError,
  }: {
    setIsLoading: (v: boolean) => void
    setError: (v: string) => void
  }) => React.ReactNode
  renderPreCommentContent?: ({
    isLoading,
  }: { isLoading: boolean }) => React.ReactNode
  title?: string
  renderExtraControls?: (comment: Comment) => React.ReactNode
  disableItemActions?: boolean
  disableAnimatedNumber?: boolean
  headerClassName?: string
}

export const CommentListBase: FC<CommentListBaseProps & PropsWithClassname> = ({
  url,
  className,
  showHeader,
  renderHeaderContent,
  renderPreCommentContent,
  title = "Comments",
  renderExtraControls,
  disableItemActions,
  disableAnimatedNumber = false,
  headerClassName,
}) => {
  const { store } = useGlobalContext<BaseStore>()

  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>("")

  const { comments, rootList, users, liked, fetchComments } = store.useStore()

  const refetch = useCallback(
    async (s?: Sort, skipOverride?: number) => {
      setIsLoading(true)
      setError("")

      try {
        await fetchComments({ url, sort: s, skipOverride })
      } catch (error: any) {
        setError(error.toString())
      } finally {
        setIsLoading(false)
      }
    },
    [fetchComments, url],
  )

  const handleShowNewComments = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      refetch(Sort.newestFirst, 0)
    },
    [refetch],
  )

  const handleClickLoadMoreComments = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      refetch()
    },
    [refetch],
  )

  const canLoadMoreComments = useMemo(
    () => rootList.items.length < rootList.total,
    [rootList.items.length, rootList.total],
  )

  const allItems = useMemo(() => {
    const items = [...rootList.items]
    if (rootList.myNewItems.length) {
      items.unshift(...rootList.myNewItems)
    }
    return items
  }, [rootList.items, rootList.myNewItems])

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <div className={cn("flex flex-col", className)}>
      {showHeader && (
        <div
          className={cn(
            "flex flex-row justify-between font-heading bg-info text-info-content px-4 py-3 rounded-md",
            headerClassName,
          )}
        >
          <div className="text-xl flex flex-row items-center">
            {title ? <span className="mr-4">{title}</span> : null}
          </div>
          <div className="flex flex-row items-center justify-end">
            {renderHeaderContent?.({ setIsLoading, setError })}
          </div>
        </div>
      )}
      <div className="px-2">
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        {renderPreCommentContent?.({ isLoading })}
        {!isLoading && !error && rootList.items.length === 0 ? (
          <p className="italic">No comments!</p>
        ) : null}
        {rootList.otherUserNewItems.length ? (
          <div className="text-sm bg-green-200 py-2 px-4 mb-6 rounded-md">
            <div className="inline-block mr-2">
              <strong>
                <NumberValue
                  disableAnimatedNumber={disableAnimatedNumber}
                  value={rootList.otherUserNewItems.length}
                />{" "}
                new comment
                {rootList.otherUserNewItems.length > 1 ? "s" : ""}
              </strong>
              <span className="ml-2">available</span>
            </div>
            <Button
              className="inline-block text-sm py-1"
              onClick={handleShowNewComments}
            >
              Show
            </Button>
          </div>
        ) : null}
        {!error && rootList.items.length ? (
          <ul className="flex flex-col" key={rootList.sort}>
            {allItems.map((c) => (
              <CommentListItem
                key={c}
                className="mb-9"
                comment={comments[c]}
                user={users[comments[c].userId]}
                liked={liked[c]}
                renderExtraControls={renderExtraControls}
                disableActions={disableItemActions}
                disableAnimatedNumber={disableAnimatedNumber}
              />
            ))}
          </ul>
        ) : null}
        {canLoadMoreComments ? (
          <Button
            className={cn("mt-2 mb-4", {
              hidden: isLoading,
            })}
            onClick={handleClickLoadMoreComments}
            inProgress={isLoading}
          >
            Load more comments
          </Button>
        ) : null}
        {isLoading ? (
          <CommentsBlockPlaceholder className="mt-6" numComments={4} />
        ) : null}
      </div>
    </div>
  )
}
