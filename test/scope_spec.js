'use strict';

var Scope = require('../src/scope');

describe('Scope', function() {
	it('can be constructed and used as an object', function() {
		var scope = new Scope();
		scope.prop = 1;
		expect(scope.prop).toBe(1);
	});
});

describe('digest', function() {
  var scope;

  beforeEach(function() {
    scope = new Scope();
  });

  it('calls the listener function of a watch on first $digest', function() {
    var watchFn = function() {
      return 'watchThis';
    };
    var listenerFn = jasmine.createSpy();

    scope.$watch(watchFn, listenerFn);

    scope.$digest();
    expect(listenerFn).toHaveBeenCalled();
  });

  it('calls the watch function with the scope as the argument', function() {
    var watchFn = jasmine.createSpy();
    var listenerFn = jasmine.createSpy();

    scope.$watch(watchFn, listenerFn);

    scope.$digest();
    expect(watchFn).toHaveBeenCalledWith(scope);
  });

  it('calls the listener function when the watched value changes', function() {
    var watchFn = function(scope) {
      return scope.watchThis;
    };
    var listenerFn = jasmine.createSpy();

    scope.$watch(watchFn, listenerFn);
    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(0);

    scope.watchThis = "new value";
    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);

    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);

    scope.watchThis = "new value 2";
    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(2);
  });
});
