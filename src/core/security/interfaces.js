/**
 * Security Service interfaces for the Alexandria Platform
 *
 * These interfaces define the security services including authentication,
 * authorization, data encryption, and audit logging.
 */
/**
 * Audit event types
 */
export var AuditEventType;
(function (AuditEventType) {
    AuditEventType["USER_LOGIN"] = "user.login";
    AuditEventType["USER_LOGOUT"] = "user.logout";
    AuditEventType["USER_CREATED"] = "user.created";
    AuditEventType["USER_UPDATED"] = "user.updated";
    AuditEventType["USER_DELETED"] = "user.deleted";
    AuditEventType["PERMISSION_GRANTED"] = "permission.granted";
    AuditEventType["PERMISSION_REVOKED"] = "permission.revoked";
    AuditEventType["CASE_CREATED"] = "case.created";
    AuditEventType["CASE_UPDATED"] = "case.updated";
    AuditEventType["CASE_DELETED"] = "case.deleted";
    AuditEventType["PLUGIN_INSTALLED"] = "plugin.installed";
    AuditEventType["PLUGIN_ACTIVATED"] = "plugin.activated";
    AuditEventType["PLUGIN_DEACTIVATED"] = "plugin.deactivated";
    AuditEventType["PLUGIN_UNINSTALLED"] = "plugin.uninstalled";
    AuditEventType["SYSTEM_ERROR"] = "system.error";
    AuditEventType["DATA_EXPORTED"] = "data.exported";
    AuditEventType["SETTINGS_CHANGED"] = "settings.changed";
})(AuditEventType || (AuditEventType = {}));
//# sourceMappingURL=interfaces.js.map