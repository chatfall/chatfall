import React from "react"
import ReactDOM from "react-dom/client"
import { createApp } from "../src/App"
import { Config } from "../src/types"

export type ChatfallProps = Config & {
  elem: HTMLElement
}

export const Chatfall = {
  init: (props: ChatfallProps) => {
    const App = createApp(props)

    ReactDOM.createRoot(props.elem).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  },
}
