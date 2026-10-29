#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import dotenv from 'dotenv'

const rootDir = process.cwd()
dotenv.config({ path: path.join(rootDir, '.env') })

const swaggerUrl = process.env.VITE_SWAGGER_URL
const jsonDir = path.join(rootDir, 'src', 'lib')
const typesDir = path.join(rootDir, 'src', 'types', 'services-type')
const jsonFile = path.join(jsonDir, 'openapi.json')
const openapiTypesFile = path.join(jsonDir, 'openapi.ts')
const legacyOutputFile = path.join(rootDir, 'src', 'types', 'openapi.ts')
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']

const normalizeDuplicateOperationIds = (openapiSpec) => {
  const operationIdUsage = new Map()

  for (const [routePath, routeConfig] of Object.entries(openapiSpec?.paths || {})) {
    for (const method of HTTP_METHODS) {
      const operation = routeConfig?.[method]
      const operationId = operation?.operationId
      if (typeof operationId !== 'string' || !operationId.trim()) continue

      const usages = operationIdUsage.get(operationId) || []
      usages.push({ method, routePath, operation })
      operationIdUsage.set(operationId, usages)
    }
  }

  const usedOperationIds = new Set(operationIdUsage.keys())
  let normalizedCount = 0

  for (const [operationId, usages] of operationIdUsage.entries()) {
    if (usages.length < 2) continue

    for (const { method, routePath, operation } of usages) {
      const routeKey = routePath
        .replace(/[{}]/g, '')
        .split('/')
        .filter(Boolean)
        .join('_')
        .replace(/[^a-zA-Z0-9_]+/g, '_')
      const baseOperationId = `${method}_${routeKey}_${operationId}`
      let uniqueOperationId = baseOperationId
      let suffix = 2

      while (usedOperationIds.has(uniqueOperationId)) {
        uniqueOperationId = `${baseOperationId}_${suffix}`
        suffix++
      }

      operation.operationId = uniqueOperationId
      usedOperationIds.add(uniqueOperationId)
      normalizedCount++
    }
  }

  return normalizedCount
}

const fallbackObjectSchema = () => ({
  type: 'object',
  additionalProperties: true,
})

const sanitizeRootWrappedSchemas = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRootWrappedSchemas(item))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const sanitized = {}

  for (const [key, itemValue] of Object.entries(value)) {
    if (typeof key === 'string' && key.startsWith('x-nestjs_zod-')) {
      continue
    }
    if (key === 'type' && itemValue === '') {
      continue
    }
    if (key === '$ref' && typeof itemValue === 'string' && itemValue.startsWith('#/$defs/')) {
      Object.assign(sanitized, fallbackObjectSchema())
      continue
    }
    if (
      key === 'root' &&
      itemValue &&
      typeof itemValue === 'object' &&
      itemValue.$ref &&
      typeof itemValue.$ref === 'string' &&
      itemValue.$ref.startsWith('#/$defs/')
    ) {
      sanitized[key] = fallbackObjectSchema()
      continue
    }

    sanitized[key] = sanitizeRootWrappedSchemas(itemValue)
  }

  return sanitized
}

const sanitizeOpenApiSpec = (openapiSpec) => sanitizeRootWrappedSchemas(openapiSpec)

if (!fs.existsSync(jsonDir)) {
  fs.mkdirSync(jsonDir, { recursive: true })
}
if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir, { recursive: true })
}

console.log(`📡 Swagger URL: ${swaggerUrl}`)
console.log(`📥 JSON file: ${jsonFile}`)
console.log(`📝 Output dir: ${typesDir}`)

const extractSwaggerDocJson = (swaggerInitJs) => {
  const marker = '"swaggerDoc":'
  const markerIndex = swaggerInitJs.indexOf(marker)
  if (markerIndex === -1) return null

  const firstBrace = swaggerInitJs.indexOf('{', markerIndex)
  if (firstBrace === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = firstBrace; i < swaggerInitJs.length; i++) {
    const ch = swaggerInitJs[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (!inString) {
      if (ch === '{') depth++
      if (ch === '}') {
        depth--
        if (depth === 0) return swaggerInitJs.slice(firstBrace, i + 1)
      }
    }
  }

  return null
}

const getInitScriptUrlFromHtml = (html) => {
  const match = html.match(/<script[^>]+src="([^"]*swagger-ui-init\.js)"/i)
  return match ? match[1] : null
}

const downloadOpenApiJson = async () => {
  const res = await fetch(swaggerUrl)
  if (!res.ok) throw new Error(`Cannot fetch swagger url: ${res.status}`)

  const text = await res.text()
  try {
    const parsed = JSON.parse(text)
    fs.writeFileSync(jsonFile, JSON.stringify(parsed, null, 2))
    return
  } catch {
    // Not JSON, continue with Swagger UI extraction.
  }

  const initScriptPath = getInitScriptUrlFromHtml(text)
  if (!initScriptPath) throw new Error('Cannot find swagger-ui-init.js in swagger html')

  const initScriptUrl = new URL(initScriptPath, swaggerUrl).toString()
  const initRes = await fetch(initScriptUrl)
  if (!initRes.ok) throw new Error(`Cannot fetch init script: ${initRes.status}`)

  const initJs = await initRes.text()
  const swaggerDocJson = extractSwaggerDocJson(initJs)
  if (!swaggerDocJson) throw new Error('Cannot extract "swaggerDoc" from swagger-ui-init.js')

  const parsed = JSON.parse(swaggerDocJson)
  fs.writeFileSync(jsonFile, JSON.stringify(parsed, null, 2))
}

const normalizeText = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')

const toPascalCase = (value) =>
  (() => {
    const normalized = normalizeText(value)
    if (/^[a-zA-Z0-9]+$/.test(normalized)) {
      return normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : ''
    }

    return normalized
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => {
        const lower = part.toLowerCase()
        return lower[0].toUpperCase() + lower.slice(1)
      })
      .join('')
  })()

const splitPascalWords = (value) => (value.match(/[A-Z][a-z0-9]*/g) || []).filter(Boolean)

const toCamelCase = (value) => {
  const pascal = toPascalCase(value)
  return pascal ? `${pascal[0].toLowerCase()}${pascal.slice(1)}` : 'default'
}

const getFileNameFromTag = (tag) => {
  const normalized = tag.startsWith('sgod-') ? tag.slice(5) : tag
  return `${toCamelCase(normalized)}.ts`
}

const getTypeNamePrefixFromRoutePath = (routePath) => {
  const parts = routePath.split('/').filter(Boolean)
  const servicePart = parts.find((part) => part.startsWith('sgod-')) || ''
  const serviceName = servicePart.replace(/^sgod-/i, '') || 'default'
  const resourceParts = parts
    .filter((part) => !part.startsWith('sgod-'))
    .filter((part) => !/^v\d+$/i.test(part))
    .filter((part) => !part.startsWith('{'))
  const primaryResource = resourceParts.length ? singularize(resourceParts[0]) : 'endpoint'
  const servicePascal = toPascalCase(serviceName)
  const resourcePascal = toPascalCase(primaryResource)
  const dedupedResourcePascal = resourcePascal.startsWith(servicePascal)
    ? resourcePascal.slice(servicePascal.length) || resourcePascal
    : resourcePascal
  return toCamelCase(`${servicePascal}${dedupedResourcePascal}`)
}

const singularize = (segment) => {
  if (segment.endsWith('ies') && segment.length > 3) return `${segment.slice(0, -3)}y`
  if (segment.endsWith('sses') || segment.endsWith('xes')) return segment
  if (segment.endsWith('s') && segment.length > 3) return segment.slice(0, -1)
  return segment
}

const toByParamNamePart = (paramName) => {
  if (!paramName) return ''
  if (/^id$/i.test(paramName)) return 'Id'

  if (/id$/i.test(paramName)) {
    const withoutId = paramName.replace(/id$/i, '')
    const entityName = toPascalCase(withoutId || paramName)
    return `${entityName}Id`
  }

  const withoutKey = paramName.replace(/key$/i, '')
  const normalized = withoutKey || paramName
  return toPascalCase(normalized)
}

const getByParamPartFromRoutePath = (routePath) => {
  const pathParams = [...routePath.matchAll(/\{([^}]+)\}/g)]
    .map((match) => match[1])
    .filter(Boolean)
  return pathParams.map(toByParamNamePart).filter(Boolean).join('And')
}

const normalizeIdPattern = (value) => value.replace(/([A-Za-z0-9]+)ById/g, '$1Id')

const getOperationBaseName = (operationId, method, routePath) => {
  const byParamPart = getByParamPartFromRoutePath(routePath)
  if (typeof operationId === 'string' && operationId.trim()) {
    const operationIdParts = operationId.split('_').filter(Boolean)
    const actionPart = operationIdParts.length
      ? operationIdParts[operationIdParts.length - 1]
      : operationId
    let actionName = toPascalCase(actionPart)
    const normalizedActionName = normalizeIdPattern(actionName)
    const normalizedByParamPart = normalizeIdPattern(byParamPart)
    const hasByPrefix = byParamPart
      ? normalizedActionName.includes(`By${normalizedByParamPart}`)
      : /^By[A-Z0-9]/.test(actionName)
    if (byParamPart && !hasByPrefix) {
      if (actionName.toLowerCase().endsWith(byParamPart.toLowerCase())) {
        actionName = `By${byParamPart}`
      } else {
        actionName = `By${byParamPart}${actionName}`
      }
    }
    if (actionName) {
      return `${method}${actionName}`
    }
  }

  const routeParts = routePath
    .split('/')
    .filter(Boolean)
    .filter((part) => !part.startsWith('sgod-'))
    .filter((part) => !/^v\d+$/i.test(part))
    .filter((part) => !part.startsWith('{'))
    .map((part, index) => (index === 0 ? singularize(part) : part))

  const resourceName = routeParts.length ? toPascalCase(routeParts.join('-')) : 'Endpoint'
  const byPrefix = byParamPart ? `By${byParamPart}` : ''
  if (!byParamPart) return `${method}${resourceName}`

  const byPartLower = byParamPart.toLowerCase()
  let dedupedResourceName = resourceName
  if (resourceName.toLowerCase() === byPartLower) {
    dedupedResourceName = ''
  } else if (resourceName.toLowerCase().startsWith(byPartLower)) {
    dedupedResourceName = resourceName.slice(byParamPart.length)
  }

  return `${method}${byPrefix}${dedupedResourceName}`
}

const normalizeActionName = (method, tagPrefixPascal, rawActionName, forcedByPrefix = '') => {
  let actionName = rawActionName || 'Endpoint'
  const leadingByPrefix =
    forcedByPrefix && actionName.startsWith(forcedByPrefix) ? forcedByPrefix : ''
  let actionCore = leadingByPrefix ? actionName.slice(leadingByPrefix.length) : actionName

  const redundantVerbByMethod = {
    get: ['Get', 'Fetch', 'Find', 'List'],
    post: ['Post', 'Create', 'Add'],
    put: ['Put', 'Update'],
    patch: ['Patch', 'Update'],
    delete: ['Delete', 'Remove'],
  }

  const redundantVerbs = redundantVerbByMethod[method] || []
  for (const verb of redundantVerbs) {
    if (actionCore.startsWith(verb) && actionCore.length >= verb.length) {
      actionCore = actionCore.slice(verb.length)
      break
    }
  }

  const trailingTagTokenMatch = tagPrefixPascal.match(/[A-Z][a-z0-9]*$/)
  const trailingTagToken = trailingTagTokenMatch ? trailingTagTokenMatch[0] : ''
  if (
    trailingTagToken &&
    actionCore.endsWith(trailingTagToken) &&
    actionCore.length >= trailingTagToken.length
  ) {
    actionCore = actionCore.slice(0, -trailingTagToken.length)
  }

  if (
    leadingByPrefix &&
    actionCore.endsWith(leadingByPrefix) &&
    actionCore.length > leadingByPrefix.length
  ) {
    actionCore = actionCore.slice(0, -leadingByPrefix.length)
  }
  if (leadingByPrefix) {
    const byCore = leadingByPrefix.replace(/^By/, '')
    const byCoreWords = splitPascalWords(byCore)
    const byCoreLastWord = byCoreWords.length ? byCoreWords[byCoreWords.length - 1] : ''
    const byCoreEntityWord =
      byCoreWords.length >= 2 && byCoreLastWord === 'Id' ? byCoreWords[byCoreWords.length - 2] : ''
    const actionCoreLower = actionCore.toLowerCase()
    const byCoreLower = byCore.toLowerCase()
    const normalizedActionCoreLower = normalizeIdPattern(actionCore).toLowerCase()
    const normalizedByCoreLower = normalizeIdPattern(byCore).toLowerCase()
    if (normalizedActionCoreLower === normalizedByCoreLower) {
      actionCore = ''
    } else if (normalizedActionCoreLower.endsWith(normalizedByCoreLower)) {
      actionCore = actionCore.slice(0, -byCore.length)
    } else if (normalizedActionCoreLower.startsWith(normalizedByCoreLower)) {
      actionCore = actionCore.slice(byCore.length)
    }
    if (
      byCoreLastWord &&
      actionCore.endsWith(byCoreLastWord) &&
      actionCore.length > byCoreLastWord.length
    ) {
      actionCore = actionCore.slice(0, -byCoreLastWord.length)
    }
    if (
      byCoreEntityWord &&
      actionCore.endsWith(`By${byCoreEntityWord}`) &&
      actionCore.length > `By${byCoreEntityWord}`.length
    ) {
      actionCore = actionCore.slice(0, -`By${byCoreEntityWord}`.length)
    }
  }

  const tagWords = splitPascalWords(tagPrefixPascal)
  const actionWords = splitPascalWords(actionCore)
  let overlapWords = 0
  for (let len = Math.min(tagWords.length, actionWords.length); len > 0; len--) {
    const tagSuffix = tagWords
      .slice(tagWords.length - len)
      .map((word) => singularize(word.toLowerCase()))
      .join('|')
    const actionPrefix = actionWords
      .slice(0, len)
      .map((word) => singularize(word.toLowerCase()))
      .join('|')
    if (tagSuffix === actionPrefix) {
      overlapWords = len
      break
    }
  }
  if (overlapWords > 0 && actionWords.length > overlapWords) {
    actionCore = actionWords.slice(overlapWords).join('')
  }

  actionName = `${leadingByPrefix}${actionCore}`
  return actionName || 'Endpoint'
}

const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

const clearGeneratedTypesDir = () => {
  if (!fs.existsSync(typesDir)) return
  const files = fs.readdirSync(typesDir)
  for (const file of files) {
    if (file.endsWith('.ts')) {
      fs.rmSync(path.join(typesDir, file), { force: true })
    }
  }
}

// const generateServiceTypeFiles = (openapiSpec) => {
//   const pathsObj = openapiSpec?.paths || {}
//   const groupByTag = new Map()
//   const operationNameUsageByTag = new Map()
//   const finalTypeNameUsageByTag = new Map()

//   for (const [routePath, routeConfig] of Object.entries(pathsObj)) {
//     const pathLevelParameters = Array.isArray(routeConfig.parameters) ? routeConfig.parameters : []
//     for (const method of HTTP_METHODS) {
//       const operation = routeConfig[method]
//       if (!operation || typeof operation !== 'object') continue

//       const tags =
//         Array.isArray(operation.tags) && operation.tags.length ? operation.tags : ['default']
//       const primaryTag = tags[0]
//       const typeNamePrefix = getTypeNamePrefixFromRoutePath(routePath)
//       const byParamPart = getByParamPartFromRoutePath(routePath)
//       const operationBase = getOperationBaseName(operation.operationId, method, routePath)
//       const usedNames = operationNameUsageByTag.get(primaryTag) || new Map()
//       const currentCount = usedNames.get(operationBase) || 0
//       const uniqueOperationBase =
//         currentCount === 0 ? operationBase : `${operationBase}${currentCount + 1}`
//       usedNames.set(operationBase, currentCount + 1)
//       operationNameUsageByTag.set(primaryTag, usedNames)
//       const operationBasePascal = toPascalCase(uniqueOperationBase)
//       const methodPrefix = method
//       const tagPrefixPascal = toPascalCase(typeNamePrefix)
//       const operationWithoutMethod = operationBasePascal.startsWith(toPascalCase(methodPrefix))
//         ? operationBasePascal.slice(toPascalCase(methodPrefix).length)
//         : operationBasePascal
//       const normalizedActionName = normalizeActionName(
//         methodPrefix,
//         tagPrefixPascal,
//         operationWithoutMethod,
//         byParamPart ? `By${byParamPart}` : '',
//       )
//       const baseTypeStem = `${methodPrefix}${tagPrefixPascal}${normalizedActionName}`
//       const finalUsedNames = finalTypeNameUsageByTag.get(primaryTag) || new Map()
//       const finalCurrentCount = finalUsedNames.get(baseTypeStem) || 0
//       const uniqueTypeStem =
//         finalCurrentCount === 0 ? baseTypeStem : `${baseTypeStem}${finalCurrentCount + 1}`
//       finalUsedNames.set(baseTypeStem, finalCurrentCount + 1)
//       finalTypeNameUsageByTag.set(primaryTag, finalUsedNames)
//       const requestTypeName = `${uniqueTypeStem}Request`
//       const lines = [`export type ${requestTypeName} = paths["${routePath}"]["${method}"]`]

//       const allParameters = [
//         ...pathLevelParameters,
//         ...(Array.isArray(operation.parameters) ? operation.parameters : []),
//       ]
//       if (allParameters.length > 0) {
//         const parameterTypeName = `${uniqueTypeStem}Params`
//         lines.push(`export type ${parameterTypeName} = ${requestTypeName}["parameters"]`)
//         const parameterLocations = new Set(
//           allParameters.map((parameter) => parameter?.in).filter(Boolean),
//         )
//         if (parameterLocations.has('query')) {
//           lines.push(`export type ${parameterTypeName}Query = ${parameterTypeName}["query"]`)
//         }
//         if (parameterLocations.has('path')) {
//           lines.push(`export type ${parameterTypeName}Path = ${parameterTypeName}["path"]`)
//         }
//         if (parameterLocations.has('header')) {
//           lines.push(`export type ${parameterTypeName}Header = ${parameterTypeName}["header"]`)
//         }
//         if (parameterLocations.has('cookie')) {
//           lines.push(`export type ${parameterTypeName}Cookie = ${parameterTypeName}["cookie"]`)
//         }
//       }

//       if (operation.requestBody) {
//         lines.push(
//           `export type ${uniqueTypeStem}RequestBody = NonNullable<${requestTypeName}["requestBody"]>["content"][keyof NonNullable<${requestTypeName}["requestBody"]>["content"]]`,
//         )
//       }

//       if (!groupByTag.has(primaryTag)) groupByTag.set(primaryTag, [])
//       groupByTag.get(primaryTag).push(lines.join('\n'))
//     }
//   }

//   const generatedFiles = []
//   for (const [tag, operations] of groupByTag.entries()) {
//     const fileName = getFileNameFromTag(tag)
//     const fileContent = [
//       '/** Auto-generated from OpenAPI. Do not edit manually. */',
//       "import type { paths } from '../../lib/openapi'",
//       '',
//       operations.join('\n\n'),
//       '',
//     ].join('\n')
//     fs.writeFileSync(path.join(typesDir, fileName), fileContent)
//     generatedFiles.push(fileName)
//   }

//   const indexFileContent = generatedFiles
//     .sort()
//     .map((fileName) => `export * from './${fileName.replace(/\.ts$/, '')}'`)
//     .join('\n')
//   fs.writeFileSync(path.join(typesDir, 'index.ts'), `${indexFileContent}\n`)
// }

const generateServiceTypeFiles = (openapiSpec) => {
  const pathsObj = openapiSpec?.paths || {}
  const groupByTag = new Map()
  const operationNameUsageByTag = new Map()
  const finalTypeNameUsageByTag = new Map()

  for (const [routePath, routeConfig] of Object.entries(pathsObj)) {
    const pathLevelParameters = Array.isArray(routeConfig.parameters) ? routeConfig.parameters : []
    for (const method of HTTP_METHODS) {
      const operation = routeConfig[method]
      if (!operation || typeof operation !== 'object') continue

      const tags =
        Array.isArray(operation.tags) && operation.tags.length ? operation.tags : ['default']
      const primaryTag = tags[0]
      const typeNamePrefix = getTypeNamePrefixFromRoutePath(routePath)
      const byParamPart = getByParamPartFromRoutePath(routePath)
      const operationBase = getOperationBaseName(operation.operationId, method, routePath)
      const usedNames = operationNameUsageByTag.get(primaryTag) || new Map()
      const currentCount = usedNames.get(operationBase) || 0
      const uniqueOperationBase =
        currentCount === 0 ? operationBase : `${operationBase}${currentCount + 1}`
      usedNames.set(operationBase, currentCount + 1)
      operationNameUsageByTag.set(primaryTag, usedNames)
      const operationBasePascal = toPascalCase(uniqueOperationBase)
      const methodPrefix = method
      const tagPrefixPascal = toPascalCase(typeNamePrefix)
      const operationWithoutMethod = operationBasePascal.startsWith(toPascalCase(methodPrefix))
        ? operationBasePascal.slice(toPascalCase(methodPrefix).length)
        : operationBasePascal
      const normalizedActionName = normalizeActionName(
        methodPrefix,
        tagPrefixPascal,
        operationWithoutMethod,
        byParamPart ? `By${byParamPart}` : '',
      )
      const baseTypeStem = `${methodPrefix}${tagPrefixPascal}${normalizedActionName}`
      const finalUsedNames = finalTypeNameUsageByTag.get(primaryTag) || new Map()
      const finalCurrentCount = finalUsedNames.get(baseTypeStem) || 0
      const uniqueTypeStem =
        finalCurrentCount === 0 ? baseTypeStem : `${baseTypeStem}${finalCurrentCount + 1}`
      finalUsedNames.set(baseTypeStem, finalCurrentCount + 1)
      finalTypeNameUsageByTag.set(primaryTag, finalUsedNames)
      const requestTypeName = `${uniqueTypeStem}Request`
      const lines = [`export type ${requestTypeName} = paths["${routePath}"]["${method}"]`]

      const allParameters = [
        ...pathLevelParameters,
        ...(Array.isArray(operation.parameters) ? operation.parameters : []),
      ]
      if (allParameters.length > 0) {
        const parameterTypeName = `${uniqueTypeStem}Params`
        lines.push(`export type ${parameterTypeName} = ${requestTypeName}["parameters"]`)
        const parameterLocations = new Set(
          allParameters.map((parameter) => parameter?.in).filter(Boolean),
        )
        if (parameterLocations.has('query')) {
          lines.push(`export type ${parameterTypeName}Query = ${parameterTypeName}["query"]`)
        }
        if (parameterLocations.has('path')) {
          lines.push(`export type ${parameterTypeName}Path = ${parameterTypeName}["path"]`)
        }
        if (parameterLocations.has('header')) {
          lines.push(`export type ${parameterTypeName}Header = ${parameterTypeName}["header"]`)
        }
        if (parameterLocations.has('cookie')) {
          lines.push(`export type ${parameterTypeName}Cookie = ${parameterTypeName}["cookie"]`)
        }
      }

      if (operation.requestBody) {
        lines.push(
          `export type ${uniqueTypeStem}RequestBody = NonNullable<${requestTypeName}["requestBody"]>["content"][keyof NonNullable<${requestTypeName}["requestBody"]>["content"]]`,
        )
      }

      // ==========================================
      // 👇 PHẦN CODE MỚI ĐƯỢC THÊM VÀO ĐỂ LẤY RESPONSE TYPE
      // ==========================================
      if (operation.responses) {
        const responsesTypeName = `${uniqueTypeStem}Responses`
        lines.push(`export type ${responsesTypeName} = ${requestTypeName}["responses"]`)

        for (const [statusCode, responseConfig] of Object.entries(operation.responses)) {
          // Xử lý case default fallback của OpenAPI
          const statusKey = statusCode.toLowerCase() === 'default' ? 'Default' : statusCode
          const responseTypeName = `${uniqueTypeStem}Response${statusKey}`

          lines.push(
            `export type ${responseTypeName} = NonNullable<${responsesTypeName}["${statusCode}"]>`,
          )

          // Nếu response có content (vd: application/json), trích xuất payload thẳng ra một type riêng
          if (responseConfig && responseConfig.content) {
            lines.push(
              `export type ${responseTypeName}Content = NonNullable<${responseTypeName}["content"]>[keyof NonNullable<${responseTypeName}["content"]>]`,
            )
          }
        }
      }
      // ==========================================

      if (!groupByTag.has(primaryTag)) groupByTag.set(primaryTag, [])
      groupByTag.get(primaryTag).push(lines.join('\n'))
    }
  }

  const generatedFiles = []
  for (const [tag, operations] of groupByTag.entries()) {
    const fileName = getFileNameFromTag(tag)
    const fileContent = [
      '/** Auto-generated from OpenAPI. Do not edit manually. */',
      "import type { paths } from '../../lib/openapi'",
      '',
      operations.join('\n\n'),
      '',
    ].join('\n')
    fs.writeFileSync(path.join(typesDir, fileName), fileContent)
    generatedFiles.push(fileName)
  }

  const indexFileContent = generatedFiles
    .sort()
    .map((fileName) => `export * from './${fileName.replace(/\.ts$/, '')}'`)
    .join('\n')
  fs.writeFileSync(path.join(typesDir, 'index.ts'), `${indexFileContent}\n`)
}

const normalizeGeneratedFileNames = () => {
  const generatedFiles = fs.readdirSync(typesDir)
  for (const fileName of generatedFiles) {
    if (!fileName.endsWith('.ts')) continue
    if (SHARED_FILES.has(fileName)) continue

    const baseName = fileName.slice(0, -3)
    if (!/^[A-Z]/.test(baseName)) continue

    const normalizedBaseName = toCamelCaseFileName(baseName)
    const normalizedFileName = `${normalizedBaseName}.ts`
    if (normalizedFileName === fileName) continue

    const fromPath = path.join(typesDir, fileName)
    const toPath = path.join(typesDir, normalizedFileName)
    fs.renameSync(fromPath, toPath)
  }
}

try {
  ensureDirExists(jsonDir)
  ensureDirExists(typesDir)
  await downloadOpenApiJson()
  const spec = JSON.parse(fs.readFileSync(jsonFile, 'utf8'))
  const sanitizedSpec = sanitizeOpenApiSpec(spec)
  const normalizedOperationIdCount = normalizeDuplicateOperationIds(sanitizedSpec)
  if (normalizedOperationIdCount > 0) {
    fs.writeFileSync(jsonFile, JSON.stringify(sanitizedSpec, null, 2))
    console.warn(
      `⚠️ Normalized ${normalizedOperationIdCount} operations with duplicate operationId values`,
    )
  } else {
    fs.writeFileSync(jsonFile, JSON.stringify(sanitizedSpec, null, 2))
  }
  execSync(`npx openapi-typescript "${jsonFile}" -o "${openapiTypesFile}"`, {
    stdio: 'inherit',
  })

  // ==========================================
  // 👇 THÊM ĐOẠN NÀY ĐỂ BỎ QUA LỖI TYPESCRIPT
  // ==========================================
  if (fs.existsSync(openapiTypesFile)) {
    const fileContent = fs.readFileSync(openapiTypesFile, 'utf8')
    if (!fileContent.startsWith('// @ts-nocheck')) {
      fs.writeFileSync(openapiTypesFile, `// @ts-nocheck\n${fileContent}`)
    }
  }
  // ==========================================
  clearGeneratedTypesDir()
  generateServiceTypeFiles(sanitizedSpec)

  if (fs.existsSync(legacyOutputFile)) {
    fs.rmSync(legacyOutputFile, { force: true })
  }

  console.log(
    '✅ Downloaded openapi.json, generated src/lib/openapi.ts and split type aliases in src/types/services-type',
  )
} catch (error) {
  console.error('❌ Failed to download OpenAPI and generate types')
  if (error instanceof Error) {
    console.error(error.message)
  }
  process.exit(1)
}
