// @ts-ignore
import {createFakeDom} from './createFakeDom';

createFakeDom();

import {ElementProviderService} from '../src/app/services/element-provider/element-provider.service';
import {Test} from './auto-tests/tests';
import {ManuallyLogged} from './auto-tests/board-recorder';
import {ErrorHandlingService} from '../src/app/services/error-handling/error-handling.service';


// @ts-ignore
const elemProvService = new ElementProviderService();

for (const name in ManuallyLogged) {
	Test.runAndCheck(name, false);
}
