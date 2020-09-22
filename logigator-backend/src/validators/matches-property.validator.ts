import {
	registerDecorator, ValidationArguments,
	ValidationOptions,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from 'class-validator';

export function MatchesProperty(property: string, validationOptions?: ValidationOptions) {
	return function (object: unknown, propertyName: string) {
		registerDecorator({
			target: object.constructor,
			propertyName: propertyName,
			options: validationOptions,
			constraints: [property],
			validator: MatchesPropertyConstraint
		});
	};
}

@ValidatorConstraint({name: 'matchesProperty'})
class MatchesPropertyConstraint implements ValidatorConstraintInterface {

	validate(value: any, validationArguments?: ValidationArguments): boolean {
		const [propToMatch] = validationArguments.constraints;
		const propToMatchValue = (validationArguments.object as any)[propToMatch];
		return typeof value === 'string' && typeof propToMatchValue === 'string' && value === propToMatchValue;
	}

	defaultMessage(validationArguments?: ValidationArguments): string {
		return `$property must match ${validationArguments.constraints[0]}!`;
	}

}
