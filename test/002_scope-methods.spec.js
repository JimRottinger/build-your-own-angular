"use strict";

var Scope = require("../src/scope");
var _ = require("lodash");

describe("scope.$eval", function() {
  var scope;

  beforeEach(function() {
    scope = new Scope();
  });

  it("executes $evaled function and returns result", function() {
    scope.value = 11;

    var result = scope.$eval(function(scope) {
      return scope.value;
    });

    expect(result).toEqual(11);
  });

  it("passes the second $eval argument straight through", function() {
    scope.value = 11;

    var result = scope.$eval(function(scope, arg) {
      return scope.value + 6;
    }, 6);

    expect(result).toEqual(17);
  });
});

describe("scope.$apply", function() {
  var scope;

  beforeEach(function() {
    scope = new Scope();
  });

  it("executes the given function and starts the digest", function() {
    var listenerFn = jasmine.createSpy();
    scope.$watch(function(scope) {
      return scope.value;
    }, listenerFn);

    scope.$apply(function(scope, arg) {
      scope.value = 1;
    });

    expect(scope.value).toEqual(1);
    expect(listenerFn).toHaveBeenCalled();
  });
});

describe("scope.$evalAsync", function() {
  var scope;

  beforeEach(function() {
    scope = new Scope();
  });

  it("executes given function later in the same cycle", function() {
    scope.value = [1, 2, 3];
    scope.asyncEvaluated = false;
    scope.asyncEvaluatedImmediately = false;

    scope.$watch(
      function(scope) {
        return scope.value;
      },
      function(newValue, oldValue, scope) {
        scope.$evalAsync(function(scope) {
          scope.asyncEvaluated = true;
        });
        scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
      }
    );

    scope.$digest();
    expect(scope.asyncEvaluated).toBe(true);
    expect(scope.asyncEvaluatedImmediately).toBe(false);
  });

  it("executes $evalAsynced functions added by watch functions", function() {
    scope.value = [1, 2, 3];
    scope.asyncEvalulated = false;

    scope.$watch(
      function(scope) {
        if (!scope.asyncEvalulated) {
          scope.$evalAsync(function(scope) {
            scope.asyncEvalulated = true;
          });
        }
        return scope.value;
      },
      function(newValue, oldValue, scope) {}
    );

    scope.$digest();
    expect(scope.asyncEvalulated).toBe(true);
  });

  it("executes given function later in the same cycle", function() {
    scope.value = [1, 2, 3];
    scope.asyncEvaluated = false;
    scope.asyncEvaluatedImmediately = false;

    scope.$watch(
      function(scope) {
        return scope.value;
      },
      function(newValue, oldValue, scope) {
        scope.$evalAsync(function(scope) {
          scope.asyncEvaluated = true;
        });
        scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
      }
    );

    scope.$digest();
    expect(scope.asyncEvaluated).toBe(true);
    expect(scope.asyncEvaluatedImmediately).toBe(false);
  });

  it("executes $evalAsynced functions added by watch functions", function() {
    scope.value = [1, 2, 3];
    scope.asyncEvalulatedTimes = 0;

    scope.$watch(
      function(scope) {
        if (scope.asyncEvalulatedTimes < 2) {
          scope.$evalAsync(function(scope) {
            scope.asyncEvalulatedTimes++;
          });
        }
        return scope.value;
      },
      function(newValue, oldValue, scope) {}
    );

    scope.$digest();
    expect(scope.asyncEvalulatedTimes).toBe(2);
  });

  it("schedules a digest in $evalAsync", function(done) {
    scope.value = 1;
    var listenerFn = jasmine.createSpy();

    scope.$watch(function(scope) {
      return scope.value;
    }, listenerFn);

    scope.$evalAsync(function(scope) {});
    expect(listenerFn.calls.count()).toEqual(0);
    setTimeout(function() {
      expect(listenerFn.calls.count()).toEqual(1);
      done();
    }, 50);
  });

  it("should correctly catch an error in the eval asynced function", function(done) {
    scope.counter = 0;
    scope.$watch(
      function(scope) {
        return scope.value;
      },
      function() {
        scope.counter++;
      }
    );

    scope.$evalAsync(function(scope) {
      throw "Error in eval Async";
    });

    setTimeout(
      function() {
        expect(scope.counter).toEqual(1);
        done();
      }.bind(this),
      50
    );
  });
});

describe("scope.$$phase", function() {
  var scope;

  beforeEach(function() {
    scope = new Scope();
  });

  it("has a $$phase field whose value is the current digest phase", function() {
    scope.value = [1, 2, 3];
    scope.phaseInWatchFunction = undefined;
    scope.phaseInListenerFunction = undefined;
    scope.phaseInApplyFunction = undefined;

    expect(scope.$$phase).toEqual(null);

    scope.$watch(
      function(scope) {
        scope.phaseInWatchFunction = scope.$$phase;
      },
      function(oldValue, newValue, scope) {
        scope.phaseInListenerFunction = scope.$$phase;
      }
    );

    scope.$apply(function(scope) {
      scope.phaseInApplyFunction = scope.$$phase;
    });

    expect(scope.phaseInWatchFunction).toEqual("$digest");
    expect(scope.phaseInListenerFunction).toEqual("$digest");
    expect(scope.phaseInApplyFunction).toEqual("$apply");
  });
});

describe("$applyAsync", function() {
  var scope;
  beforeEach(function() {
    scope = new Scope();
  });

  it("allows async $apply with $applyAsync", function(done) {
    scope.value = 1;
    var listenerFn = jasmine.createSpy();

    scope.$watch(function(scope) {
      return scope.value;
    }, listenerFn);

    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);

    scope.$applyAsync(function(scope) {
      scope.value = 2;
    });
    expect(listenerFn.calls.count()).toEqual(1);

    setTimeout(function() {
      expect(listenerFn.calls.count()).toEqual(2);
      done();
    }, 50);
  });

  it("never executes $applyAsynced function in the same cycle", function(done) {
    scope.value = 1;
    scope.asyncApplied = false;

    scope.$watch(
      function(scope) {
        return scope.value;
      },
      function(newValue, oldValue, scope) {
        scope.$applyAsync(function(scope) {
          scope.asyncApplied = true;
        });
      }
    );

    scope.$digest();
    expect(scope.asyncApplied).toBe(false);
    setTimeout(function() {
      expect(scope.asyncApplied).toBe(true);
      done();
    }, 50);
  });

  it("should coalesce many calls to $applyAsync", function(done) {
    var watchCalls = 0;

    scope.$watch(
      function(scope) {
        watchCalls++;
        return scope.value;
      },
      function() {}
    );

    scope.$applyAsync(function(scope) {
      scope.value = 2;
    });
    scope.$applyAsync(function(scope) {
      scope.value = 3;
    });

    setTimeout(function() {
      expect(watchCalls).toEqual(2);
      done();
    }, 50);
  });

  it("should cancel and flush $applyAsync if digested first", function(done) {
    scope.value = 0;
    var watchCalls = 0;

    scope.$watch(
      function(scope) {
        watchCalls++;
        return scope.value;
      },
      function() {}
    );

    scope.$applyAsync(function(scope) {
      scope.value = 1;
    });
    scope.$applyAsync(function(scope) {
      scope.value = 2;
    });

    scope.$digest();
    expect(watchCalls).toBe(2);
    expect(scope.value).toEqual(2);

    setTimeout(function() {
      expect(watchCalls).toBe(2); //should still be 2 because the async digest should not happen
      done();
    }, 50);
  });
});

describe("$$postDigest", function() {
  var scope;
  beforeEach(function() {
    scope = new Scope();
  });

  it("should run the post digest after each digest", function() {
    scope.counter = 0;

    scope.$$postDigest(function() {
      scope.counter++;
    });

    expect(scope.counter).toBe(0);
    scope.$digest();

    expect(scope.counter).toBe(1);
    scope.$digest();

    expect(scope.counter).toBe(1);
  });
});

describe("$watchGroup", function() {
  var scope;
  beforeEach(function() {
    scope = new Scope();
  });

  it("takes watches as an array and calls listener with arrays", function() {
    var gotNewValues, gotOldValues;

    scope.value = 1;
    scope.value2 = 2;

    scope.$watchGroup(
      [
        function(scope) {
          return scope.value;
        },
        function(scope) {
          return scope.value2;
        }
      ],
      function(newValues, oldValues, scope) {
        gotNewValues = newValues;
        gotOldValues = oldValues;
      }
    );
    scope.$digest();

    scope.value = 11;
    scope.value2 = 22;
    scope.$digest();
    expect(gotNewValues).toEqual([11, 22]);
    expect(gotOldValues).toEqual([1, 2]);
  });

  it("should only call the listener once per digest", function() {
    scope.value = 1;
    scope.value2 = 2;
    var listenerFn = jasmine.createSpy();

    scope.$watchGroup(
      [
        function(scope) {
          return scope.value;
        },
        function(scope) {
          return scope.value2;
        }
      ],
      listenerFn
    );
    scope.$digest();

    expect(listenerFn.calls.count()).toEqual(1);
  });

  it("should take in an empty array of watchers and call the listener once", function() {
    var newVals, oldVals;

    scope.$watchGroup([], function(newValues, oldValues, scope) {
      newVals = newValues;
      oldVals = oldValues;
    });
    scope.$digest();

    expect(newVals).toEqual([]);
    expect(oldVals).toEqual([]);
  });

  it("can deregister a watch group", function() {
    var listenerFn = jasmine.createSpy();

    scope.value = 1;
    scope.value2 = 2;

    var destroyGroup = scope.$watchGroup(
      [
        function(scope) {
          return scope.value;
        },
        function(scope) {
          return scope.value2;
        }
      ],
      listenerFn
    );
    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);

    scope.value = 11;
    scope.value2 = 22;
    destroyGroup();
    scope.$digest();
    expect(listenerFn.calls.count()).toEqual(1);
  });
});
