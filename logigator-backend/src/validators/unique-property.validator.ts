import {
	buildMessage,
	ValidateBy, ValidationArguments,
	ValidationOptions
} from 'class-validator';

export function UniqueProperty(property: string, validationOptions?: ValidationOptions) {
	return ValidateBy({
		name: 'uniqueProperty',
		constraints: [property],
		validator: {
			validate(value: any[], args: ValidationArguments): boolean {
				return value instanceof Array && new Set(value.map(x => x[args.constraints[0]])).size === value.length;
			},
			defaultMessage: buildMessage(
				eachPrefix => eachPrefix + '$property must have unique property $constraint1'
			)
		}
	}, validationOptions);
}
