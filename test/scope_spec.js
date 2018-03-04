'use strict';

var Scope = require('../src/scope');
var _ = require('lodash');

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

  it('calls listener when watch value is first undefined', function() {
    var watchFn = function(scope) {
      return scope.watchThis;
    };
    var listenerFn = jasmine.createSpy();

    scope.$watch(watchFn, listenerFn);
    expect(listenerFn.calls.count()).toEqual(0);

    scope.watchThis = undefined;
    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);
  });

  it('may have watchers that omit the listener function', function() {
    var watchFn = jasmine.createSpy().and.returnValue('something');

    scope.$watch(watchFn);
    scope.$digest();

    expect(watchFn).toHaveBeenCalled();
  });

  it('triggers chained watchers in the same digest', function() {
    scope.name = "Jim";

    scope.$watch(
      function(scope) { return scope.nameUpper; },
      function(newValue, oldValue, scope) {
        if (newValue) {
          scope.initial = newValue.substring(0,1) + '.';
        }
      }
    );

    scope.$watch(
      function(scope) { return scope.name; },
      function(newValue, oldValue, scope) {
        if (newValue) {
          scope.nameUpper = newValue.toUpperCase();
        }
      }
    );

    scope.$digest();
    expect(scope.initial).toEqual('J.');

    scope.name = 'Bob';
    scope.$digest();
    expect(scope.initial).toEqual('B.');
  });

  it('gives up on the watches after 10 iterations', function() {
    scope.counterA = 0;
    scope.counterB = 0;

    scope.$watch(
      function (scope) { return scope.counterA; },
      function (newValue, oldValue, scope) {
        scope.counterB++;
      }
    );

    scope.$watch(
      function (scope) { return scope.counterB; },
      function (newValue, oldValue, scope) {
        scope.counterA++;
      }
    );

    expect((function() { scope.$digest(); })).toThrow();
  });

  it('ends the digest when the last watch is clean', function() {
    scope.array = _.range(100);
    var watchExecutions = 0;

    _.times(100, function(i) {
      scope.$watch(
        function(scope) {
          watchExecutions++;
          return scope.array[i];
        },
        function (newValue, oldValue, scope) { }
      );
    });

    scope.$digest();
    expect(watchExecutions).toEqual(200);

    watchExecutions = 0;
    scope.array[0] = 9999;
    scope.$digest();
    expect(watchExecutions).toEqual(101);

    watchExecutions = 0;
    scope.array[0] = -9999;
    scope.array[49] = 9999;
    scope.$digest();
    expect(watchExecutions).toEqual(150);
  });

  it('does not end digest so that new watches are not run', function() {
    scope.aValue = 'abc';
    scope.counter = 0;

    scope.$watch(
      function(scope) { return scope.aValue; },
      function(newValue, oldValue, scope) {
        scope.$watch(
          function(scope) { return scope.aValue; },
          function(newValue, oldValue, scope) {
            scope.counter++;
          }
        );
      }
   );

    scope.$digest();
    expect(scope.counter).toBe(1);
  });

  it ('should compare by reference if value-based checking is not enabled', function(){
    scope.array = [1,2,3];

    var listenerFn = jasmine.createSpy();

    scope.$watch(
      function(scope) { return scope.array; },
      listenerFn,
      false
    );

    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);

    scope.array.push(4);
    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);
  });

  it ('should compare by value if value-based checking is enabled', function() {
    scope.array = [1,2,3];

    var listenerFn = jasmine.createSpy();

    scope.$watch(
      function(scope) { return scope.array; },
      listenerFn,
      true
    );

    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);

    scope.array.push(4);
    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(2);
  });

  it ('should should correctly handle NaNs', function() {
    scope.value = 0/0; //NaN
    var listenerFn = jasmine.createSpy();

    scope.$watch(
      function(scope) { return scope.value; },
      listenerFn,
      false //the true case is correctly handled by _.isEqual
    );

    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);

    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);
  });

  it ('catches exceptions in the watch function and continues', function(){
    scope.watchThis = 1;

    scope.$watch(
      function(scope){ throw 'Error'; },
      function(newValue, oldValue, scope) {}
    );

    var listenerFn = jasmine.createSpy().and.callThrough();

    scope.$watch(
      function(scope){ return scope.watchThis; },
      listenerFn
    );

    scope.$digest();
    expect(listenerFn).toHaveBeenCalled();
  });

  it ('catches exceptions in the watch function and continues', function(){
    scope.watchThis = 1;

    scope.$watch(
      function(scope){ return scope.watchThis; },
      function(newValue, oldValue, scope) { throw "Error"; }
    );

    var listenerFn = jasmine.createSpy();
    scope.watchThis2 = 2;
    scope.$watch(
      function(scope){ return scope.watchThis2; },
      listenerFn
    );

    scope.$digest();
    expect(listenerFn).toHaveBeenCalled();
  });

  it ('allows destroying a watch with a removal function', function() {
    scope.watchThis = 1;

    var listenerFn = jasmine.createSpy();

    var destroyWatcher1 = scope.$watch(
      function(scope){ return scope.watchThis; },
      listenerFn
    );

    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);

    destroyWatcher1(); //destroy the watcher

    scope.watchThis = 2;
    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);
  });

  it ('allows destroying a watch during a digest cycle', function() {
    scope.watchThis = 1;

    var watchCalls = [];

    var destroyWatcher1 = scope.$watch(
      function(scope) {
        watchCalls.push(1);
        return scope.watchThis;
      },
      function() {}
    );

    var destroyWatcher2 = scope.$watch(
      function(scope) {
        watchCalls.push(2);
        return scope.watchThis;
      },
      function() {
        destroyWatcher2();
      }
    );

    var destroyWatcher3 = scope.$watch(
      function(scope) {
        watchCalls.push(3);
        return scope.watchThis;
      },
      function() {}
    );

    scope.$digest();
    expect(watchCalls).toEqual([1,2,3,1,3]);
  });

  it ('allows a $watch to destroying another $watch', function() {
    scope.watchThis = 1;
    var watchCalls = [];

    var destroyWatcher1 = scope.$watch(
      function(scope) {
        watchCalls.push(1);
        return scope.watchThis;
      },
      function() {
        destroyWatcher2();
      }
    );

    var destroyWatcher2 = scope.$watch(
      function(scope) {
        watchCalls.push(2);
        return scope.watchThis;
      },
      function() { }
    );

    var destroyWatcher3 = scope.$watch(
      function(scope) {
        watchCalls.push(3);
        return scope.watchThis;
      },
      function() {}
    );

    scope.$digest();
    expect(watchCalls).toEqual([1,1,3,1,3]); //first watcher executes twice
  });

  it ('allows a $watch to destroy multiple other watches', function() {
    scope.watchThis = 1;
    var watchCalls = [];

    var destroyWatcher1 = scope.$watch(
      function(scope) {
        watchCalls.push(1);
        return scope.watchThis;
      },
      function() {
        destroyWatcher2();
        destroyWatcher3();
      }
    );

    var destroyWatcher2 = scope.$watch(
      function(scope) {
        watchCalls.push(2);
        return scope.watchThis;
      },
      function() { }
    );

    var destroyWatcher3 = scope.$watch(
      function(scope) {
        watchCalls.push(3);
        return scope.watchThis;
      },
      function() {}
    );

    scope.$digest();
    expect(watchCalls).toEqual([1,1,1]); //first watcher executes twice
  });
});
