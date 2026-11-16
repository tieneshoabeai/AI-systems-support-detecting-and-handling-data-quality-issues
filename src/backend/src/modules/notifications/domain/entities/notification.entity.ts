import { isMandatoryNotification, shouldDispatch, type NotificationType } from '../value-objects/notification-type.vo';

export interface NotificationProps {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  isMandatory: boolean;
}

export class Notification {
  private constructor(private readonly props: NotificationProps) {}

  static create(props: NotificationProps): Notification {
    return new Notification({ ...props, title: props.title.trim().slice(0, 200) });
  }

  static resolveMandatory(type: string, explicitFlag: boolean): boolean {
    return isMandatoryNotification(type, explicitFlag);
  }

  static canDispatch(enabled: boolean | undefined, mandatory: boolean): boolean {
    return shouldDispatch(enabled, mandatory);
  }
}
