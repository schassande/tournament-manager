export function checkParameter(paramValue: string, paramName: string) {
  if (!paramValue || paramValue.length === 0) {
    throw new Error(`Parameter ${paramName} is missing.`)
  }
}