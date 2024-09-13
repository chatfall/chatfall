import {
  FC,
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
} from "react"
import { CommentStore } from "../store/comments.store"
import { Config } from "../types"

export interface StoreContextValue {
  store: CommentStore
  config: Config
}

export const GlobalContext = createContext({} as StoreContextValue)

export const GlobalProvider: FC<
  PropsWithChildren & { store: CommentStore; config: Config }
> = ({ children, store, config }) => {
  const { loggedInUser, checkAuth } = store.useStore()

  // check auth upon startup
  useEffect(() => {
    if (!loggedInUser) {
      checkAuth()
    }
  }, [checkAuth, loggedInUser])

  return (
    <GlobalContext.Provider
      value={{
        store,
        config,
      }}
    >
      {children}
    </GlobalContext.Provider>
  )
}

export const GlobalConsumer = GlobalContext.Consumer

export const useGlobalContext = () => {
  return useContext(GlobalContext)
}
