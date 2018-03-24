"use strict";

var Scope = require("../src/scope");
var _ = require("lodash");

describe("Scope Inheritance", function() {
  it("should inherit the parents properties", function() {
    var parent = new Scope();
    parent.value = 1;
    var child = parent.$new();

    expect(child.value).toEqual(1);
  });

  it("does not cause a parent to inherit the childs properties", function() {
    var parent = new Scope();
    var child = parent.$new();
    child.value = 1;

    expect(parent.value).toBeUndefined();
  });

  it("does not care when properties are defined on the parent", function() {
    var parent = new Scope();
    var child = parent.$new();
    parent.value = 1;

    expect(child.value).toEqual(1);
  });

  it("should allow a child to manipulate the values of the parent", function() {
    var parent = new Scope();
    parent.aValue = [1, 2, 3];
    var child = parent.$new();
    child.aValue.push(4);

    expect(parent.aValue).toEqual([1, 2, 3, 4]);
  });

  it("can watch a property on the parent scope", function() {
    var parentScope = new Scope();
    var childScope = parentScope.$new();
    var childListenerFn = jasmine.createSpy();

    parentScope.value = [1, 2, 3];
    childScope.$watch(
      function(scope) {
        return scope.value;
      },
      childListenerFn,
      true
    );

    childScope.$digest();
    expect(childListenerFn.calls.count()).toEqual(1);

    parentScope.value.push(4);
    childScope.$digest();
    expect(childListenerFn.calls.count()).toEqual(2);
  });

  it("shadows a parents property with the same name", function() {
    var parent = new Scope();
    var child = parent.$new();

    parent.name = "John";
    child.name = "Jim";

    expect(child.name).toBe("Jim");
    expect(parent.name).toBe("John");
  });

  it("should not shadow members of the parent scopes attributes", function() {
    var parent = new Scope();
    var child = parent.$new();

    parent.user = { name: "John" };
    child.user.name = "Jim";

    expect(child.user.name).toBe("Jim");
    expect(parent.user.name).toBe("Jim");
  });

  it("does not digest its parent(s)", function() {
    var parent = new Scope();
    var child = parent.$new();

    parent.value = 1;
    parent.$watch(
      function(scope) {
        return scope.value;
      },
      function(newValue, oldValue, scope) {
        scope.valueWas = newValue;
      }
    );

    child.$digest();
    expect(child.valueWas).toBeUndefined();
  });

  it("keeps a record of its children", function() {
    var parent = new Scope();
    var child1 = parent.$new();
    var child2 = parent.$new();
    var child2_1 = child2.$new();

    expect(parent.$$children.length).toBe(2);
    expect(parent.$$children[0]).toBe(child1);
    expect(parent.$$children[1]).toBe(child2);
    expect(child2.$$children.length).toBe(1);
    expect(child2.$$children[0]).toBe(child2_1);
  });

  it("digests its children", function() {
    var parent = new Scope();
    var child = parent.$new();

    parent.value = 1;
    child.$watch(
      function(scope) {
        return scope.value;
      },
      function(newValue, oldValue, scope) {
        scope.valueWas = newValue;
      }
    );

    parent.$digest();
    expect(child.valueWas).toBe(1);
  });

  it("digests from root on $apply", function() {
    var parent = new Scope();
    var child = parent.$new();

    parent.value = 1;
    parent.$watch(
      function(scope) {
        return parent.value;
      },
      function(newValue, oldValue, scope) {
        child.valueWas = newValue;
      }
    );

    child.$apply(function(scope) {});
    expect(child.valueWas).toBeDefined();
  });

  it("digests from root on $evalAsync", function(done) {
    var parent = new Scope();
    var child = parent.$new();

    parent.value = 1;
    parent.$watch(
      function(scope) {
        return parent.value;
      },
      function(newValue, oldValue, scope) {
        child.valueWas = newValue;
      }
    );

    child.$evalAsync(function(scope) {});

    setTimeout(function() {
      expect(child.valueWas).toBeDefined();
      done();
    }, 50);
  });

  it("does not have access to parent attributes when isolated", function() {
    var parent = new Scope();
    var child = parent.$new(true);

    parent.value = 123;
    expect(child.value).toBeUndefined();
  });

  it("should not be able to watc a parent attribute when isolated", function() {
    var parent = new Scope();
    var child = parent.$new(true);

    parent.value = 123;
    child.$watch(
      function(scope) {
        return scope.value;
      },
      function(newValue, oldValue, scope) {
        scope.aValueWas = newValue;
      }
    );

    child.$digest();
    expect(child.aValueWas).toBeUndefined();
  });

  it("digests its isolated children", function() {
    var parent = new Scope();
    var child = parent.$new(true);

    child.aValue = "abc";

    child.$watch(
      function(scope) {
        return scope.aValue;
      },
      function(newValue, oldValue, scope) {
        scope.aValueWas = newValue;
      }
    );

    parent.$digest();
    expect(child.aValueWas).toBe("abc");
  });

  it("digests from root on $apply when isolated", function() {
    var parent = new Scope();
    var child = parent.$new(true);
    var child2 = child.$new();

    parent.aValue = "abc";
    parent.counter = 0;
    parent.$watch(
      function(scope) {
        return scope.aValue;
      },
      function(newValue, oldValue, scope) {
        scope.counter++;
      }
    );

    child2.$apply(function(scope) {});
    expect(parent.counter).toBe(1);
  });

  it("schedules a digest from root on $evalAsync when isolated", function(done) {
    var parent = new Scope();
    var child = parent.$new(true);
    var child2 = child.$new();

    parent.aValue = "abc";
    parent.counter = 0;
    parent.$watch(
      function(scope) {
        return scope.aValue;
      },
      function(newValue, oldValue, scope) {
        scope.counter++;
      }
    );

    child2.$evalAsync(function(scope) {});
    setTimeout(function() {
      expect(parent.counter).toBe(1);
      done();
    }, 50);
  });

  it("executes $evalAsync functions on isolated scopes", function(done) {
    var parent = new Scope();
    var child = parent.$new(true);

    child.$evalAsync(function(scope) {
      scope.didEvalAsync = true;
    });

    setTimeout(function() {
      expect(child.didEvalAsync).toBe(true);
      done();
    }, 100);
  });

  it("executes $applyAsync functions on isolated scopes", function() {
    var parent = new Scope();
    var child = parent.$new(true);
    var applied = false;

    parent.$applyAsync(function() {
      applied = true;
    });
    child.$digest();

    expect(applied).toBe(true);
  });

  it("executes $$postDigest functions on isolated scopes", function() {
    var parent = new Scope();
    var child = parent.$new(true);

    child.$$postDigest(function() {
      child.didPostDigest = true;
    });
    parent.$digest();

    expect(child.didPostDigest).toBe(true);
  });

  it("can take in some other scope as the parent", function() {
    var prototypeParent = new Scope();
    var hierarchyParent = new Scope();
    var child = prototypeParent.$new(false, hierarchyParent);

    prototypeParent.value = 1;
    expect(child.value).toBe(1);

    child.counter = 0;
    child.$watch(function(scope) {
      scope.counter++;
    });

    prototypeParent.$digest();
    expect(child.counter).toBe(0);

    hierarchyParent.$digest();
    expect(child.counter).toBe(2);
  });

  it("is no longer digested when $destroy has been called", function() {
    var parent = new Scope();
    var child = parent.$new();

    child.aValue = [1, 2, 3];
    child.counter = 0;
    child.$watch(
      function(scope) {
        return scope.aValue;
      },
      function(newValue, oldValue, scope) {
        scope.counter++;
      },
      true
    );

    parent.$digest();
    expect(child.counter).toBe(1);

    child.aValue.push(4);
    parent.$digest();
    expect(child.counter).toBe(2);

    child.$destroy();
    child.aValue.push(5);
    parent.$digest();
    expect(child.counter).toBe(2);
  });
});
