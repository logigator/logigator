import {
	registerDecorator,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from 'class-validator';

export function Required(validationOptions?: ValidationOptions) {
	return function (object: unknown, propertyName: string) {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			validator: RequiredConstraint
		});
	};
}

@ValidatorConstraint({name: 'required'})
class RequiredConstraint implements ValidatorConstraintInterface {

	validate(value: any): boolean {
		if (value === undefined || value === null) {
			return false;
		}
		if (typeof value === 'string') {
			return value.trim() !== '';
		}
		return true;
	}

	defaultMessage(): string {
		return '$property is required!';
	}

}
