// 构建期类型桩：引擎对宿主 ctx 一律鸭子类型（运行时零硬依赖， cordis 仅 type-only import 被剥离）。
// 真实 cordis 类型仅在 devDependencies 供 IDE 可选；本桩让 tsc 转译不被宿主 alpha 版类型面卡住。
declare module '@deepseek-ai/cordis' {
  export interface Context {
    [key: string]: any
  }
  export type Events = Record<string, any>
}
