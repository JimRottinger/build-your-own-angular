'use strict';

var Scope = require('../src/scope');

describe('Scope', function() {
	it('can be constructed and used as an object', function() {
		var scope = new Scope();
		scope.prop = 1;
		expect(scope.prop).toBe(1);
	});
});
