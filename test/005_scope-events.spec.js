"use strict";

var Scope = require("../src/scope");
var _ = require("lodash");

describe("Events", function() {
  var parent, scope, child, isolatedChild;

  beforeEach(function() {
    parent = new Scope();
    scope = parent.$new();
    child = scope.$new();
    isolatedChild = scope.$new(true);
  });

  it('allows registering listeners', function() {
    var listener1 = function() { };
    var listener2 = function() { };
    var listener3 = function() { };
    scope.$on('someEvent', listener1);
    scope.$on('someEvent', listener2);
    scope.$on('someOtherEvent', listener3);
    expect(scope.$$listeners).toEqual({
      someEvent: [listener1, listener2],
      someOtherEvent: [listener3]
    });
  });

  it('registers different listeners for every scope', function() {
    var listener1 = function() { };
    var listener2 = function() { };
    var listener3 = function() { };
    scope.$on('someEvent', listener1);
    child.$on('someEvent', listener2);
    isolatedChild.$on('someEvent', listener3);
    expect(scope.$$listeners).toEqual({someEvent: [listener1]});
    expect(child.$$listeners).toEqual({someEvent: [listener2]});
    expect(isolatedChild.$$listeners).toEqual({someEvent: [listener3]});
  });

  _.forEach(['$emit', '$broadcast'], function(method){
    it('calls the listeners of the matching event on ' + method, function() {
      var listener1 = jasmine.createSpy();
      var listener2 = jasmine.createSpy();
      scope.$on('someEvent', listener1);
      scope.$on('someOtherEvent', listener2);
      scope[method]('someEvent');
      expect(listener1).toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('passes an event object with a name to listeners on '+method, function() {
      var listener = jasmine.createSpy();
      scope.$on('someEvent', listener);
      scope[method]('someEvent');
      expect(listener).toHaveBeenCalled();
      expect(listener.calls.mostRecent().args[0].name).toEqual('someEvent');
    });

    it('passes the same event object to each listener on '+method, function() {
      var listener1 = jasmine.createSpy();
      var listener2 = jasmine.createSpy();
      scope.$on('someEvent', listener1);
      scope.$on('someEvent', listener2);
      scope[method]('someEvent');
      var event1 = listener1.calls.mostRecent().args[0];
      var event2 = listener2.calls.mostRecent().args[0];
      expect(event1).toBe(event2);
    });

    it('passes additional arguments to listeners on '+method, function() {
      var listener = jasmine.createSpy();
      scope.$on('someEvent', listener);
      scope[method]('someEvent', 'and', ['additional', 'arguments'], '...');
      expect(listener.calls.mostRecent().args[1]).toEqual('and');
      expect(listener.calls.mostRecent().args[2]).toEqual(['additional', 'arguments']);
      expect(listener.calls.mostRecent().args[3]).toEqual('...');
    });

    it('returns the event object on '+method, function() {
      var returnedEvent = scope[method]('someEvent');
      expect(returnedEvent).toBeDefined();
      expect(returnedEvent.name).toEqual('someEvent');
    });
  });
});
