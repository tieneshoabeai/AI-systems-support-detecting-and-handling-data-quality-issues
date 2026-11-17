/** Auto-generated from OpenAPI. Do not edit manually. */
import type { paths } from '../../lib/openapi'

export type getNotificationsEndpointRequest = paths["/api/v1/notifications"]["get"]
export type getNotificationsEndpointParams = getNotificationsEndpointRequest["parameters"]
export type getNotificationsEndpointParamsQuery = getNotificationsEndpointParams["query"]
export type getNotificationsEndpointResponses = getNotificationsEndpointRequest["responses"]
export type getNotificationsEndpointResponse200 = NonNullable<getNotificationsEndpointResponses["200"]>

export type getNotificationsUnreadCountRequest = paths["/api/v1/notifications/unread-count"]["get"]
export type getNotificationsUnreadCountResponses = getNotificationsUnreadCountRequest["responses"]
export type getNotificationsUnreadCountResponse200 = NonNullable<getNotificationsUnreadCountResponses["200"]>

export type getNotificationsByIdDetailRequest = paths["/api/v1/notifications/{id}"]["get"]
export type getNotificationsByIdDetailParams = getNotificationsByIdDetailRequest["parameters"]
export type getNotificationsByIdDetailParamsPath = getNotificationsByIdDetailParams["path"]
export type getNotificationsByIdDetailResponses = getNotificationsByIdDetailRequest["responses"]
export type getNotificationsByIdDetailResponse200 = NonNullable<getNotificationsByIdDetailResponses["200"]>

export type patchNotificationsByIdMarkAsReadRequest = paths["/api/v1/notifications/{id}/read"]["patch"]
export type patchNotificationsByIdMarkAsReadParams = patchNotificationsByIdMarkAsReadRequest["parameters"]
export type patchNotificationsByIdMarkAsReadParamsPath = patchNotificationsByIdMarkAsReadParams["path"]
export type patchNotificationsByIdMarkAsReadResponses = patchNotificationsByIdMarkAsReadRequest["responses"]
export type patchNotificationsByIdMarkAsReadResponse200 = NonNullable<patchNotificationsByIdMarkAsReadResponses["200"]>

export type patchUsersPreferencesRequest = paths["/api/v1/users/me/notification-preferences"]["patch"]
export type patchUsersPreferencesRequestBody = NonNullable<patchUsersPreferencesRequest["requestBody"]>["content"][keyof NonNullable<patchUsersPreferencesRequest["requestBody"]>["content"]]
export type patchUsersPreferencesResponses = patchUsersPreferencesRequest["responses"]
export type patchUsersPreferencesResponse200 = NonNullable<patchUsersPreferencesResponses["200"]>
