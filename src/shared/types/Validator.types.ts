export interface IValidationError {
    field: string;
    message: string;
    value?: any;
}

export interface IValidationResult {
    isValid: boolean;
    errors: IValidationError[];
}

export interface IValidator<T = any> {
    validate(data: T): IValidationResult;
}
