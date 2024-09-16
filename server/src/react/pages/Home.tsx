import { useGlobalContext } from "@chatfall/client"
import { type ChangeEvent, type FC, useCallback } from "react"
import { Setting } from "../../settings"
import type { ServerStore } from "../store/server"

export const Home: FC = () => {
  const { store } = useGlobalContext<ServerStore>()
  const { settings, setSetting } = store.useStore()

  const handleModerateAllCommentsChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.checked
      setSetting(Setting.ModerateAllComments, value)
    },
    [setSetting],
  )

  return (
    <div className="mt-4">
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
    </div>
  )
}
