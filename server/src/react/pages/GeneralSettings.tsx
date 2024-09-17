import { useGlobalContext } from "@chatfall/client"
import { type ChangeEvent, type FC, useCallback } from "react"
import { Setting } from "../../settings/types"
import { PageWrapper } from "../components/PageWrapper"
import type { ServerStore } from "../store/server"

export const GeneralSettings: FC = () => {
  const { store } = useGlobalContext<ServerStore>()
  const { settings, setSetting } = store.useStore()

  const handleModerateAllCommentsChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.checked
      setSetting(Setting.ModerateAllComments, value)
    },
    [setSetting],
  )

  const handleCommentDelayChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(1, parseInt(event.target.value, 10))
      setSetting(Setting.UserNextCommentDelaySeconds, value)
    },
    [setSetting],
  )

  const handleCommentsPerPageChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(1, parseInt(event.target.value, 10))
      setSetting(Setting.CommentsPerPage, value)
    },
    [setSetting],
  )

  return (
    <PageWrapper title="General settings">
      <div className="form-control">
        <label className="label cursor-pointer">
          <span className="label-text mr-4">
            Flag all comments for moderation
          </span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={settings?.[Setting.ModerateAllComments]}
            onChange={handleModerateAllCommentsChange}
          />
        </label>
      </div>

      <div className="form-control mt-4">
        <label className="label">
          <span className="label-text">Comment delay (seconds)</span>
        </label>
        <input
          type="number"
          className="input input-bordered w-full max-w-xs"
          min="1"
          value={settings?.[Setting.UserNextCommentDelaySeconds]}
          onChange={handleCommentDelayChange}
        />
      </div>

      <div className="form-control mt-4">
        <label className="label">
          <span className="label-text">Comments per page</span>
        </label>
        <input
          type="number"
          className="input input-bordered w-full max-w-xs"
          min="1"
          value={settings?.[Setting.CommentsPerPage]}
          onChange={handleCommentsPerPageChange}
        />
      </div>
    </PageWrapper>
  )
}
