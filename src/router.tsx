import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router"
import App from "./App"

const rootRoute = createRootRoute({
  component: App,
})

const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "$",
})

const routeTree = rootRoute.addChildren([catchAllRoute])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
