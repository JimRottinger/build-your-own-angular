'use strict';

var Scope = require('../src/scope');
var _ = require('lodash');

describe('Scope Inheritance', function(){

  it('should inherit the parents properties', function(){
    var parent = new Scope();
    parent.value = 1;
    var child = parent.$new();

    expect(child.value).toEqual(1);
  });

  it('does not cause a parent to inherit the childs properties', function(){
    var parent = new Scope();
    var child = parent.$new();
    child.value = 1;

    expect(parent.value).toBeUndefined();
  });

  it('does not care when properties are defined on the parent', function(){
    var parent = new Scope();
    var child = parent.$new();
    parent.value = 1;

    expect(child.value).toEqual(1);
  });

  it('should allow a child to manipulate the values of the parent', function(){
    var parent = new Scope();
    parent.aValue = [1,2,3];
    var child = parent.$new();
    child.aValue.push(4);

    expect(parent.aValue).toEqual([1,2,3,4]);
  });

  it('can watch a property on the parent scope', function(){
    var parentScope = new Scope();
    var childScope = parentScope.$new();
    var childListenerFn = jasmine.createSpy();

    parentScope.value = [1,2,3];
    childScope.$watch(
      function(scope) { return scope.value; },
      childListenerFn,
      true
    );

    childScope.$digest();
    expect(childListenerFn.calls.count()).toEqual(1);

    parentScope.value.push(4);
    childScope.$digest();
    expect(childListenerFn.calls.count()).toEqual(2);
  });
});
