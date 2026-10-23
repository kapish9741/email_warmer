import handler, { getApp, buildApp } from "./app"

export default handler
export { getApp, buildApp }

if (typeof module !== "undefined" && module.exports) {
  module.exports = handler
  module.exports.default = handler
  module.exports.getApp = getApp
  module.exports.buildApp = buildApp
}

