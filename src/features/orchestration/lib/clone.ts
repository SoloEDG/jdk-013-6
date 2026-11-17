/** 深拷贝纯数据（叙事图/节点均为 JSON 安全结构）；可穿透 Vue 响应式代理 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
