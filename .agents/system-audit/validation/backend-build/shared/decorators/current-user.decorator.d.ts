export interface CurrentUserPayload {
    userId: string;
    email: string;
    role: 'admin' | 'analyst';
    sessionId?: string;
}
export declare const CurrentUser: (...dataOrPipes: (import("@nestjs/common").PipeTransform<any, any> | import("@nestjs/common").Type<import("@nestjs/common").PipeTransform<any, any>> | keyof CurrentUserPayload | undefined)[]) => ParameterDecorator;
