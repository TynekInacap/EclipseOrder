import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router"
import App from "./App"

const rootRoute = createRootRoute({
  component: App,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "registro",
})

const sectionRoutes = ["tienda", "miembros", "servidor", "control", "admin"].map((path) => createRoute({
  getParentRoute: () => rootRoute,
  path,
}))

const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: "perfil/$profileId" })
const threadRoute = createRoute({ getParentRoute: () => rootRoute, path: "hilo/$threadId" })
const forumRoute = createRoute({ getParentRoute: () => rootRoute, path: "foro/$category" })
const newThreadRoute = createRoute({ getParentRoute: () => rootRoute, path: "foro/$category/nuevo" })
const reportStatusRoute = createRoute({ getParentRoute: () => rootRoute, path: "foro/reportes/$reportStatus" })
const factionSubforumRoute = createRoute({ getParentRoute: () => rootRoute, path: "foro/facciones/$factionSubforum" })

const routeTree = rootRoute.addChildren([
  homeRoute,
  registerRoute,
  ...sectionRoutes,
  profileRoute,
  threadRoute,
  newThreadRoute,
  reportStatusRoute,
  factionSubforumRoute,
  forumRoute,
])

export const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
