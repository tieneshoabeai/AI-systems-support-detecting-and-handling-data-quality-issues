import { type NotificationType } from '../value-objects/notification-type.vo';
export interface NotificationProps {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    isMandatory: boolean;
}
export declare class Notification {
    private readonly props;
    private constructor();
    static create(props: NotificationProps): Notification;
    static resolveMandatory(type: string, explicitFlag: boolean): boolean;
    static canDispatch(enabled: boolean | undefined, mandatory: boolean): boolean;
}
