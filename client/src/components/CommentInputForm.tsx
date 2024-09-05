import { PostCommentResponse } from "@chatfall/server"
import React, { FC, useCallback, useState } from "react"
import { useGlobalContext } from "../contexts/global"
import { useField, useForm } from "../hooks/form"
import { PropsWithClassname } from "../types"
import { cn } from "../utils/ui"
import { Button } from "./Button"
import { ErrorBox } from "./ErrorBox"
import { FormDiv, TextAreaInput, standardInputStyle } from "./Form"
import { ButtonWithLogin } from "./Login"
import { WarningSvg } from "./Svg"

export type CommentInputFormProps = PropsWithClassname & {
  parentCommentId?: number
  commentFieldPlaceholder?: string
  commentFieldTitle?: string
  initiallyFocused?: boolean
  onCommentPosted?: () => void
}

const validateCommentText = (value: string) => {
  if (value.trim() === "") {
    return "Comment cannot be empty"
  }
}

export const CommentInputForm: FC<CommentInputFormProps> = ({
  className,
  parentCommentId,
  commentFieldPlaceholder,
  initiallyFocused,
  onCommentPosted,
}) => {
  const { store } = useGlobalContext()
  const { loggedInUser, addComment, logout } = store.useStore()
  const [focused, setFocused] = useState<boolean>(!!initiallyFocused)
  const [error, setError] = useState<string>("")
  const [isPosting, setIsPosting] = useState<boolean>(false)
  const [responseAfterPosting, setResponseAfterPosting] =
    useState<PostCommentResponse>()

  const [commentText] = [
    useField({
      name: "commentText",
      initialValue: "",
      validate: validateCommentText,
    }),
  ]

  const { valid, reset } = useForm({
    fields: [commentText],
    isValidFn: (fields, formError) => {
      if (formError) {
        return false
      }
      return fields.reduce((m: boolean, f) => {
        if (f.name === "email" && loggedInUser) {
          return m
        } else {
          return m && f.valid && f.isSet
        }
      }, true)
    },
  })

  const postComment = useCallback(
    async (comment: string) => {
      const response = await addComment(comment, parentCommentId)
      setResponseAfterPosting(response)
    },
    [addComment, parentCommentId],
  )

  const onClickContinue = useCallback(() => {
    reset()
    setResponseAfterPosting(undefined)
    onCommentPosted?.()
  }, [reset, onCommentPosted])

  const handleSubmit = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      try {
        setIsPosting(true)
        setError("")
        await postComment(commentText.value)
        reset()
      } catch (err: any) {
        setError(err.toString())
      } finally {
        setIsPosting(false)
      }
    },
    [commentText.value, postComment, reset],
  )

  const onClickLogout = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      logout()
    },
    [logout],
  )

  const onFocusForm = useCallback(() => {
    setFocused(true)
  }, [])

  const onHideError = useCallback(() => {
    setError("")
  }, [])

  return (
    <FormDiv
      className={cn(
        "max-h-14 p-4",
        {
          "max-h-full": focused,
        },
        className,
      )}
    >
      {responseAfterPosting ? (
        <div>
          <p className="flex flex-row justify-start items-center">
            {responseAfterPosting.alert ? (
              <WarningSvg className="w-4 h-4 mr-2" />
            ) : null}
            {responseAfterPosting.message}
          </p>
          <Button className="mt-4" onClick={onClickContinue}>
            Continue
          </Button>
        </div>
      ) : (
        <form className="flex flex-col">
          <TextAreaInput
            field={commentText}
            hideError={true}
            required={true}
            placeholder={commentFieldPlaceholder || "Add comment..."}
            hideValidationIndicator={true}
            inputClassname={cn("self-stretch w-full", {
              "bg-transparent border-0 italic": !focused,
              [standardInputStyle]: focused,
            })}
            onFocus={onFocusForm}
            disabled={!!isPosting}
          />
          {loggedInUser && focused ? (
            <p className="text-xs italic">
              Logged in as: <strong>{loggedInUser.name}</strong>
              <Button
                variant="link"
                className="ml-2 italic"
                title="Logout"
                onClick={onClickLogout}
              >
                (logout)
              </Button>
            </p>
          ) : null}
          {focused ? (
            <div>
              <ButtonWithLogin
                disabled={!valid}
                inProgress={isPosting}
                className="inline-block mt-6"
                type="submit"
                onClick={handleSubmit}
              >
                {loggedInUser ? "Submit" : "Login and submit"}
              </ButtonWithLogin>
              {error && (
                <ErrorBox className="mt-2" hideError={onHideError}>
                  {error}
                </ErrorBox>
              )}
            </div>
          ) : null}
        </form>
      )}
    </FormDiv>
  )
}
