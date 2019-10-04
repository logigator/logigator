// @ts-ignore
import {createFakeDom} from './createFakeDom';

createFakeDom();

import {ElementProviderService} from '../src/app/services/element-provider/element-provider.service';
import {Test} from './auto-tests/tests';
import {ManuallyLogged} from './auto-tests/board-recorder';


// for static instance to have a value
const elemProvService = new ElementProviderService();

for (const name in ManuallyLogged) {
	Test.runAndCheck(name, false);
}
